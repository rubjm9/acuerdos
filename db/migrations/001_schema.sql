-- ============================================================================
-- 001_schema.sql — Esquema principal
-- Plataforma de Gobernanza: actas, acuerdos, expedientes, tareas.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
CREATE TYPE role_type AS ENUM ('administrator', 'secretary', 'member', 'committee', 'readonly');
CREATE TYPE acta_estado AS ENUM ('borrador', 'definitiva', 'archivada');
CREATE TYPE acta_source AS ENUM ('per_minute', 'annual_compilation');
CREATE TYPE acuerdo_estado AS ENUM ('en_vigor', 'cumplido', 'superado', 'en_curso', 'anulado');
CREATE TYPE link_tipo AS ENUM ('deriva_de', 'continua', 'modifica', 'sustituye_a', 'relacionado_con');
CREATE TYPE expediente_estado AS ENUM ('abierto', 'cerrado');
CREATE TYPE tarea_estado AS ENUM ('abierta', 'en_progreso', 'completada', 'vencida', 'cancelada');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'edited', 'rejected');
CREATE TYPE ingestion_status AS ENUM ('uploaded', 'processing', 'extracted', 'failed', 'completed');
CREATE TYPE notification_type AS ENUM (
  'tarea_asignada', 'tarea_recordatorio', 'tarea_vencida',
  'acuerdo_creado', 'ingesta_lista', 'sistema'
);

-- ----------------------------------------------------------------------------
-- updated_at helper
-- ----------------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Identidad y acceso
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  name        text NOT NULL,
  google_sub  text UNIQUE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    role_type NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE areas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  slug          text NOT NULL UNIQUE,
  is_restricted boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_area_access (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id  uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, area_id)
);

CREATE TABLE committees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  area_id    uuid REFERENCES areas(id) ON DELETE SET NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE committee_members (
  committee_id uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (committee_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 1. Actas (minutes)
-- ----------------------------------------------------------------------------
CREATE TABLE year_compilations (
  año             int PRIMARY KEY,
  file_object_key text NOT NULL,
  page_count      int,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE actas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          int NOT NULL,
  fecha           date NOT NULL,
  año             int NOT NULL,
  estado          acta_estado NOT NULL DEFAULT 'definitiva',
  source_type     acta_source NOT NULL DEFAULT 'per_minute',
  file_object_key text,                          -- PDF/Word original (per_minute)
  compilation_año int REFERENCES year_compilations(año),
  page_start      int,                           -- rango dentro de la recopilación anual
  page_end        int,
  page_count      int,
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (año, numero)
);
CREATE TRIGGER actas_updated BEFORE UPDATE ON actas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX actas_año_idx ON actas (año, numero);

-- ----------------------------------------------------------------------------
-- 2. Acuerdos (agreements) — objeto central
-- ----------------------------------------------------------------------------
CREATE TABLE ref_counters (
  año  int PRIMARY KEY,
  next int NOT NULL DEFAULT 1
);

CREATE TABLE acuerdos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref     text NOT NULL UNIQUE,           -- p.ej. ACU-2018-0142; inmutable
  titulo         text NOT NULL,                  -- etiqueta corta NO sensible (visible en listados)
  full_text      text,                           -- texto íntegro (NULL si área restringida => cifrado)
  full_text_enc  bytea,                          -- texto cifrado (AES-GCM app-level) para áreas restringidas
  fecha_adopcion date NOT NULL,
  acta_id        uuid NOT NULL REFERENCES actas(id),
  source_page    int,                            -- página dentro del acta / recopilación
  estado         acuerdo_estado NOT NULL DEFAULT 'en_vigor',
  is_restricted  boolean NOT NULL DEFAULT false, -- denormalizado: lleva algún área restringida
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT texto_una_via CHECK (full_text IS NOT NULL OR full_text_enc IS NOT NULL)
);
CREATE TRIGGER acuerdos_updated BEFORE UPDATE ON acuerdos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX acuerdos_fecha_idx ON acuerdos (fecha_adopcion);
CREATE INDEX acuerdos_estado_idx ON acuerdos (estado);
CREATE INDEX acuerdos_acta_idx ON acuerdos (acta_id);

-- public_ref es inmutable
CREATE FUNCTION forbid_public_ref_change() RETURNS trigger AS $$
BEGIN
  IF NEW.public_ref <> OLD.public_ref THEN
    RAISE EXCEPTION 'public_ref es inmutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER acuerdos_ref_immutable BEFORE UPDATE ON acuerdos
  FOR EACH ROW EXECUTE FUNCTION forbid_public_ref_change();

-- Asignación atómica de referencia pública ACU-YYYY-NNNN
CREATE FUNCTION next_public_ref(p_año int) RETURNS text AS $$
DECLARE n int;
BEGIN
  -- Tras el upsert, `next` es siempre el siguiente número libre; el asignado es next-1.
  INSERT INTO ref_counters (año, next) VALUES (p_año, 2)
    ON CONFLICT (año) DO UPDATE SET next = ref_counters.next + 1
    RETURNING next - 1 INTO n;
  RETURN format('ACU-%s-%s', p_año, lpad(n::text, 4, '0'));
END;
$$ LANGUAGE plpgsql;

CREATE TABLE acuerdo_areas (
  acuerdo_id uuid NOT NULL REFERENCES acuerdos(id) ON DELETE CASCADE,
  area_id    uuid NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  PRIMARY KEY (acuerdo_id, area_id)
);
CREATE INDEX acuerdo_areas_area_idx ON acuerdo_areas (area_id);

-- Mantener acuerdos.is_restricted sincronizado con sus áreas
CREATE FUNCTION sync_acuerdo_restricted() RETURNS trigger AS $$
DECLARE aid uuid;
BEGIN
  aid := COALESCE(NEW.acuerdo_id, OLD.acuerdo_id);
  UPDATE acuerdos SET is_restricted = EXISTS (
    SELECT 1 FROM acuerdo_areas aa JOIN areas a ON a.id = aa.area_id
    WHERE aa.acuerdo_id = aid AND a.is_restricted
  ) WHERE id = aid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER acuerdo_areas_sync AFTER INSERT OR DELETE OR UPDATE ON acuerdo_areas
  FOR EACH ROW EXECUTE FUNCTION sync_acuerdo_restricted();

CREATE TABLE acuerdo_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_acuerdo_id uuid NOT NULL REFERENCES acuerdos(id) ON DELETE CASCADE,
  to_acuerdo_id   uuid NOT NULL REFERENCES acuerdos(id) ON DELETE CASCADE,
  tipo            link_tipo NOT NULL,
  confirmed       boolean NOT NULL DEFAULT true,  -- false = sugerido por IA, pendiente
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_acuerdo_id, to_acuerdo_id, tipo),
  CHECK (from_acuerdo_id <> to_acuerdo_id)
);
CREATE INDEX acuerdo_links_from_idx ON acuerdo_links (from_acuerdo_id);
CREATE INDEX acuerdo_links_to_idx ON acuerdo_links (to_acuerdo_id);

-- Trozos indexables para búsqueda híbrida.
-- Los acuerdos de áreas restringidas NO generan chunks: su contenido Art. 9
-- nunca entra en ningún índice (FTS ni vectorial).
CREATE TABLE acuerdo_chunks (
  id         bigserial PRIMARY KEY,
  acuerdo_id uuid NOT NULL REFERENCES acuerdos(id) ON DELETE CASCADE,
  chunk_idx  int NOT NULL,
  chunk_text text NOT NULL,
  embedding  vector(1024),
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('spanish', chunk_text)) STORED,
  UNIQUE (acuerdo_id, chunk_idx)
);
CREATE INDEX acuerdo_chunks_tsv_idx ON acuerdo_chunks USING gin (tsv);
CREATE INDEX acuerdo_chunks_vec_idx ON acuerdo_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ----------------------------------------------------------------------------
-- 3. Expedientes (dossiers)
-- ----------------------------------------------------------------------------
CREATE TABLE expedientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  descripcion     text,
  primary_area_id uuid REFERENCES areas(id),
  estado          expediente_estado NOT NULL DEFAULT 'abierto',
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER expedientes_updated BEFORE UPDATE ON expedientes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE expediente_acuerdos (
  expediente_id uuid NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  acuerdo_id    uuid NOT NULL REFERENCES acuerdos(id) ON DELETE CASCADE,
  added_by      uuid REFERENCES users(id),
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expediente_id, acuerdo_id)
);

-- ----------------------------------------------------------------------------
-- 4. Tareas
-- ----------------------------------------------------------------------------
CREATE TABLE tareas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acuerdo_id            uuid NOT NULL REFERENCES acuerdos(id) ON DELETE CASCADE,
  titulo                text NOT NULL,
  descripcion           text,
  assignee_user_id      uuid REFERENCES users(id),
  assignee_committee_id uuid REFERENCES committees(id),
  fecha_vencimiento     date,
  estado                tarea_estado NOT NULL DEFAULT 'abierta',
  reminder_sent_at      timestamptz,
  overdue_notified_at   timestamptz,
  created_by            uuid REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (assignee_user_id IS NOT NULL OR assignee_committee_id IS NOT NULL)
);
CREATE TRIGGER tareas_updated BEFORE UPDATE ON tareas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX tareas_assignee_idx ON tareas (assignee_user_id);
CREATE INDEX tareas_committee_idx ON tareas (assignee_committee_id);
CREATE INDEX tareas_vencimiento_idx ON tareas (fecha_vencimiento) WHERE estado IN ('abierta','en_progreso');

-- ----------------------------------------------------------------------------
-- Ingesta y cola de revisión
-- ----------------------------------------------------------------------------
CREATE TABLE ingestion_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_key text NOT NULL,
  original_name   text,
  año             int,
  status          ingestion_status NOT NULL DEFAULT 'uploaded',
  error           text,
  stats           jsonb NOT NULL DEFAULT '{}',
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER ingestion_jobs_updated BEFORE UPDATE ON ingestion_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE extraction_candidates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             uuid NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  proposed_titulo    text,
  proposed_text      text NOT NULL,
  proposed_date      date,
  acta_numero        int,
  acta_fecha         date,
  page               int,
  suggested_area_ids uuid[] NOT NULL DEFAULT '{}',
  suggested_links    jsonb NOT NULL DEFAULT '[]',   -- [{public_ref|text, tipo, motivo}]
  review_status      review_status NOT NULL DEFAULT 'pending',
  reviewed_by        uuid REFERENCES users(id),
  reviewed_at        timestamptz,
  committed_acuerdo_id uuid REFERENCES acuerdos(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extraction_candidates_job_idx ON extraction_candidates (job_id, review_status);

-- ----------------------------------------------------------------------------
-- Auditoría (append-only) y notificaciones
-- ----------------------------------------------------------------------------
CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  actor_user_id uuid,
  action        text NOT NULL,           -- create|update|delete|view|download|search|login|export
  entity_type   text NOT NULL,
  entity_id     text,
  restricted    boolean NOT NULL DEFAULT false,  -- afecta a áreas restringidas => retención reforzada
  metadata      jsonb NOT NULL DEFAULT '{}',
  ip            inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_user_id, created_at);

CREATE FUNCTION forbid_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo inserción';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      text NOT NULL,
  body       text,
  href       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, read_at, created_at DESC);

CREATE TABLE push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
