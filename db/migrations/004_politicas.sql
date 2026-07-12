-- ============================================================================
-- 004_politicas.sql — Políticas (Fase 3)
--
-- Una Política es un documento vivo (cuerpo markdown) que consolida la postura
-- de la Asamblea sobre una temática, agrupando acuerdos. La CLASIFICACIÓN de un
-- acuerdo (eventual / de política / en expediente) NO se almacena: se deriva de
-- sus asociaciones (ver web/lib/domain.ts).
-- ============================================================================

CREATE TYPE politica_estado AS ENUM ('vigente', 'en_revision', 'derogada');

-- Contador global para la referencia pública POL-NNNN
CREATE TABLE politica_ref_counter (
  id   boolean PRIMARY KEY DEFAULT true CHECK (id),  -- fila única
  next int NOT NULL DEFAULT 1
);
INSERT INTO politica_ref_counter (id, next) VALUES (true, 1);

CREATE FUNCTION next_politica_ref() RETURNS text AS $$
DECLARE n int;
BEGIN
  UPDATE politica_ref_counter SET next = next + 1 RETURNING next - 1 INTO n;
  RETURN format('POL-%s', lpad(n::text, 4, '0'));
END;
$$ LANGUAGE plpgsql;

CREATE TABLE politicas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref      text NOT NULL UNIQUE,             -- POL-NNNN; inmutable
  titulo          text NOT NULL,
  resumen         text,                             -- descripción corta (listados)
  cuerpo_md       text,                             -- cuerpo de la política en markdown
  primary_area_id uuid REFERENCES areas(id),
  estado          politica_estado NOT NULL DEFAULT 'vigente',
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER politicas_updated BEFORE UPDATE ON politicas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- public_ref inmutable (reutiliza la función genérica no; definimos una propia)
CREATE FUNCTION forbid_politica_ref_change() RETURNS trigger AS $$
BEGIN
  IF NEW.public_ref <> OLD.public_ref THEN
    RAISE EXCEPTION 'public_ref de política es inmutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER politicas_ref_immutable BEFORE UPDATE ON politicas
  FOR EACH ROW EXECUTE FUNCTION forbid_politica_ref_change();

CREATE TABLE politica_acuerdos (
  politica_id uuid NOT NULL REFERENCES politicas(id) ON DELETE CASCADE,
  acuerdo_id  uuid NOT NULL REFERENCES acuerdos(id) ON DELETE CASCADE,
  added_by    uuid REFERENCES users(id),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (politica_id, acuerdo_id)
);
CREATE INDEX politica_acuerdos_acuerdo_idx ON politica_acuerdos (acuerdo_id);

-- Trozos indexables del cuerpo de la política para búsqueda/asistente.
-- Solo se pueblan para políticas de áreas NO restringidas (invariante: el
-- contenido restringido nunca entra en ningún índice). El worker o la app
-- garantizan esa condición al indexar.
CREATE TABLE politica_chunks (
  id          bigserial PRIMARY KEY,
  politica_id uuid NOT NULL REFERENCES politicas(id) ON DELETE CASCADE,
  chunk_idx   int NOT NULL,
  chunk_text  text NOT NULL,
  embedding   vector(1024),
  tsv         tsvector GENERATED ALWAYS AS (to_tsvector('spanish', chunk_text)) STORED,
  UNIQUE (politica_id, chunk_idx)
);
CREATE INDEX politica_chunks_tsv_idx ON politica_chunks USING gin (tsv);
CREATE INDEX politica_chunks_vec_idx ON politica_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ----------------------------------------------------------------------------
-- Permisos (el GRANT ON ALL TABLES de 002 no cubre estas tablas nuevas)
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON politicas, politica_acuerdos, politica_chunks TO app_web;
GRANT SELECT, UPDATE ON politica_ref_counter TO app_web;
GRANT USAGE, SELECT ON SEQUENCE politica_chunks_id_seq TO app_web;
-- El worker recalcula embeddings de politica_chunks
GRANT SELECT ON politicas TO app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON politica_chunks TO app_worker;
GRANT USAGE, SELECT ON SEQUENCE politica_chunks_id_seq TO app_worker;

-- ----------------------------------------------------------------------------
-- RLS (espejo de expedientes / expediente_acuerdos)
-- ----------------------------------------------------------------------------
ALTER TABLE politicas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE politica_acuerdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE politica_chunks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE politica_ref_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY politicas_select ON politicas FOR SELECT
  USING (
    app_is_authenticated() AND
    (primary_area_id IS NULL OR app_can_view_area(primary_area_id))
  );
CREATE POLICY politicas_write ON politicas FOR ALL
  USING (app_is_secretary() AND (primary_area_id IS NULL OR app_can_view_area(primary_area_id)))
  WITH CHECK (app_is_secretary() AND (primary_area_id IS NULL OR app_can_view_area(primary_area_id)));

CREATE POLICY pol_acuerdos_select ON politica_acuerdos FOR SELECT
  USING (app_can_view_acuerdo(acuerdo_id));
CREATE POLICY pol_acuerdos_write ON politica_acuerdos FOR ALL
  USING (app_is_secretary() AND app_can_view_acuerdo(acuerdo_id))
  WITH CHECK (app_is_secretary() AND app_can_view_acuerdo(acuerdo_id));

-- chunks: heredan la visibilidad de su política (el worker inserta con su rol)
CREATE POLICY pol_chunks_select ON politica_chunks FOR SELECT
  USING (EXISTS (SELECT 1 FROM politicas p WHERE p.id = politica_id
                 AND (p.primary_area_id IS NULL OR app_can_view_area(p.primary_area_id))));
CREATE POLICY pol_chunks_write ON politica_chunks FOR ALL
  USING (app_is_secretary() OR current_user = 'app_worker')
  WITH CHECK (app_is_secretary() OR current_user = 'app_worker');

CREATE POLICY politica_ref_rw ON politica_ref_counter FOR ALL
  USING (app_is_secretary()) WITH CHECK (app_is_secretary());
