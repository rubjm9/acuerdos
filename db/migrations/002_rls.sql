-- ============================================================================
-- 002_rls.sql — Row-Level Security
--
-- Modelo: la aplicación se conecta con roles de mínimo privilegio (app_web,
-- app_worker) y fija la identidad por petición con:
--     SET LOCAL app.user_id = '<uuid>';
-- Toda política filtra por esa identidad. Las áreas restringidas
-- ("Casos personales", "Salud espiritual") solo son visibles con acceso
-- explícito en user_area_access — en TODAS las rutas, incluida la búsqueda.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Funciones de identidad (SECURITY DEFINER para no recursar en RLS)
-- ----------------------------------------------------------------------------
CREATE FUNCTION app_current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION app_has_role(r role_type) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id AND u.is_active
    WHERE ur.user_id = app_current_user_id() AND ur.role = r
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE FUNCTION app_is_admin() RETURNS boolean AS $$
  SELECT app_has_role('administrator');
$$ LANGUAGE sql STABLE;

CREATE FUNCTION app_is_secretary() RETURNS boolean AS $$
  SELECT app_has_role('secretary') OR app_has_role('administrator');
$$ LANGUAGE sql STABLE;

CREATE FUNCTION app_is_authenticated() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id = app_current_user_id() AND u.is_active
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ¿Puede el usuario ver un área concreta?
--  * área no restringida: cualquier usuario autenticado
--  * área restringida: solo admin o acceso explícito con can_view
CREATE FUNCTION app_can_view_area(p_area uuid) RETURNS boolean AS $$
  SELECT CASE
    WHEN NOT app_is_authenticated() THEN false
    WHEN app_is_admin() THEN true
    WHEN NOT (SELECT a.is_restricted FROM areas a WHERE a.id = p_area) THEN true
    ELSE EXISTS (
      SELECT 1 FROM user_area_access uaa
      WHERE uaa.user_id = app_current_user_id() AND uaa.area_id = p_area AND uaa.can_view
    )
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE FUNCTION app_can_edit_area(p_area uuid) RETURNS boolean AS $$
  SELECT CASE
    WHEN app_is_admin() THEN true
    WHEN NOT app_is_authenticated() THEN false
    ELSE app_can_view_area(p_area) AND (
      app_has_role('secretary')
      OR EXISTS (
        SELECT 1 FROM user_area_access uaa
        WHERE uaa.user_id = app_current_user_id() AND uaa.area_id = p_area AND uaa.can_edit
      )
    )
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Visibilidad de un acuerdo:
--  * si lleva CUALQUIER área restringida, el usuario debe poder ver TODAS
--    las áreas restringidas que lleve (sin fuga por co-etiquetado);
--  * en otro caso, basta estar autenticado.
CREATE FUNCTION app_can_view_acuerdo(p_acuerdo uuid) RETURNS boolean AS $$
  SELECT CASE
    WHEN NOT app_is_authenticated() THEN false
    WHEN app_is_admin() THEN true
    ELSE NOT EXISTS (
      SELECT 1
      FROM acuerdo_areas aa
      JOIN areas a ON a.id = aa.area_id
      WHERE aa.acuerdo_id = p_acuerdo
        AND a.is_restricted
        AND NOT EXISTS (
          SELECT 1 FROM user_area_access uaa
          WHERE uaa.user_id = app_current_user_id()
            AND uaa.area_id = aa.area_id AND uaa.can_view
        )
    )
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE FUNCTION app_can_edit_acuerdo(p_acuerdo uuid) RETURNS boolean AS $$
  SELECT app_can_view_acuerdo(p_acuerdo) AND app_is_secretary();
$$ LANGUAGE sql STABLE;

-- ¿Pertenece el usuario a un comité?
CREATE FUNCTION app_in_committee(p_committee uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM committee_members cm
    WHERE cm.committee_id = p_committee AND cm.user_id = app_current_user_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- Roles de conexión
-- ----------------------------------------------------------------------------
-- app_web / app_worker se crean en 000_roles.sh con contraseñas del entorno.
-- Aquí solo permisos. NOBYPASSRLS: las políticas aplican siempre.

GRANT USAGE ON SCHEMA public TO app_web, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_web;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_web;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_web;

-- El worker no borra nada y solo toca lo que necesita
GRANT SELECT ON areas, actas, acuerdos, acuerdo_areas, year_compilations TO app_worker;
GRANT SELECT, INSERT, UPDATE ON ingestion_jobs, extraction_candidates TO app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON acuerdo_chunks TO app_worker;
GRANT INSERT ON audit_log TO app_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_worker;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_worker;

-- audit_log: nadie actualiza ni borra (además del trigger)
REVOKE UPDATE, DELETE ON audit_log FROM app_web, app_worker;

-- ----------------------------------------------------------------------------
-- Activar RLS
-- ----------------------------------------------------------------------------
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_area_access   ENABLE ROW LEVEL SECURITY;
ALTER TABLE committees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE year_compilations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE actas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE acuerdos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE acuerdo_areas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE acuerdo_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE acuerdo_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expediente_acuerdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_counters       ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Políticas
-- ----------------------------------------------------------------------------

-- users: lectura para autenticados (necesario para asignar tareas); escritura admin
CREATE POLICY users_select ON users FOR SELECT USING (app_is_authenticated());
CREATE POLICY users_admin  ON users FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());

-- user_roles / user_area_access: se ven las propias; admin gestiona
CREATE POLICY user_roles_select ON user_roles FOR SELECT
  USING (user_id = app_current_user_id() OR app_is_admin());
CREATE POLICY user_roles_admin ON user_roles FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());

CREATE POLICY uaa_select ON user_area_access FOR SELECT
  USING (user_id = app_current_user_id() OR app_is_admin());
CREATE POLICY uaa_admin ON user_area_access FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- areas: visibles todas (el nombre del área no es sensible); escritura admin.
-- El worker de ingesta necesita leerlas para sugerir etiquetas.
CREATE POLICY areas_select ON areas FOR SELECT
  USING (app_is_authenticated() OR current_user = 'app_worker');
CREATE POLICY areas_admin  ON areas FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());

-- committees: lectura autenticados; escritura admin/secretaría
CREATE POLICY committees_select ON committees FOR SELECT USING (app_is_authenticated());
CREATE POLICY committees_write ON committees FOR ALL
  USING (app_is_secretary()) WITH CHECK (app_is_secretary());
CREATE POLICY committee_members_select ON committee_members FOR SELECT USING (app_is_authenticated());
CREATE POLICY committee_members_write ON committee_members FOR ALL
  USING (app_is_secretary()) WITH CHECK (app_is_secretary());

-- actas: metadatos visibles para autenticados; escritura secretaría.
-- (La descarga del PDF original se limita en la capa de aplicación a
--  administrator/secretary/member y se audita siempre.)
CREATE POLICY actas_select ON actas FOR SELECT USING (app_is_authenticated());
CREATE POLICY actas_write ON actas FOR ALL
  USING (app_is_secretary()) WITH CHECK (app_is_secretary());
CREATE POLICY yc_select ON year_compilations FOR SELECT USING (app_is_authenticated());
CREATE POLICY yc_write ON year_compilations FOR ALL
  USING (app_is_secretary()) WITH CHECK (app_is_secretary());

-- acuerdos: visibilidad por área (regla estricta con restringidas)
CREATE POLICY acuerdos_select ON acuerdos FOR SELECT USING (app_can_view_acuerdo(id));
CREATE POLICY acuerdos_insert ON acuerdos FOR INSERT WITH CHECK (app_is_secretary());
CREATE POLICY acuerdos_update ON acuerdos FOR UPDATE
  USING (app_can_edit_acuerdo(id)) WITH CHECK (app_can_edit_acuerdo(id));
CREATE POLICY acuerdos_delete ON acuerdos FOR DELETE USING (app_is_admin());

CREATE POLICY acuerdo_areas_select ON acuerdo_areas FOR SELECT
  USING (app_can_view_acuerdo(acuerdo_id));
CREATE POLICY acuerdo_areas_write ON acuerdo_areas FOR ALL
  USING (app_can_edit_acuerdo(acuerdo_id)) WITH CHECK (app_is_secretary());

-- enlaces: visibles solo si AMBOS extremos son visibles (sin fugas)
CREATE POLICY acuerdo_links_select ON acuerdo_links FOR SELECT
  USING (app_can_view_acuerdo(from_acuerdo_id) AND app_can_view_acuerdo(to_acuerdo_id));
CREATE POLICY acuerdo_links_write ON acuerdo_links FOR ALL
  USING (app_is_secretary() AND app_can_view_acuerdo(from_acuerdo_id) AND app_can_view_acuerdo(to_acuerdo_id))
  WITH CHECK (app_is_secretary() AND app_can_view_acuerdo(from_acuerdo_id) AND app_can_view_acuerdo(to_acuerdo_id));

-- chunks: heredan visibilidad del acuerdo (worker inserta)
CREATE POLICY chunks_select ON acuerdo_chunks FOR SELECT
  USING (app_can_view_acuerdo(acuerdo_id));
CREATE POLICY chunks_write ON acuerdo_chunks FOR ALL
  USING (app_is_secretary() OR current_user = 'app_worker')
  WITH CHECK (app_is_secretary() OR current_user = 'app_worker');

-- expedientes: si su área principal es restringida, mismo control; si no, autenticados
CREATE POLICY expedientes_select ON expedientes FOR SELECT
  USING (
    app_is_authenticated() AND
    (primary_area_id IS NULL OR app_can_view_area(primary_area_id))
  );
CREATE POLICY expedientes_write ON expedientes FOR ALL
  USING (app_is_secretary() AND (primary_area_id IS NULL OR app_can_view_area(primary_area_id)))
  WITH CHECK (app_is_secretary() AND (primary_area_id IS NULL OR app_can_view_area(primary_area_id)));

CREATE POLICY exp_acuerdos_select ON expediente_acuerdos FOR SELECT
  USING (app_can_view_acuerdo(acuerdo_id));
CREATE POLICY exp_acuerdos_write ON expediente_acuerdos FOR ALL
  USING (app_is_secretary() AND app_can_view_acuerdo(acuerdo_id))
  WITH CHECK (app_is_secretary() AND app_can_view_acuerdo(acuerdo_id));

-- tareas: la ve el asignado (persona o su comité), quien ve el acuerdo origen,
-- y la gestiona secretaría/admin. El asignado puede actualizar su estado.
CREATE POLICY tareas_select ON tareas FOR SELECT
  USING (
    assignee_user_id = app_current_user_id()
    OR (assignee_committee_id IS NOT NULL AND app_in_committee(assignee_committee_id))
    OR app_can_view_acuerdo(acuerdo_id)
  );
CREATE POLICY tareas_insert ON tareas FOR INSERT
  WITH CHECK (app_is_secretary() AND app_can_view_acuerdo(acuerdo_id));
CREATE POLICY tareas_update ON tareas FOR UPDATE
  USING (
    app_is_secretary()
    OR assignee_user_id = app_current_user_id()
    OR (assignee_committee_id IS NOT NULL AND app_in_committee(assignee_committee_id))
  )
  WITH CHECK (
    app_is_secretary()
    OR assignee_user_id = app_current_user_id()
    OR (assignee_committee_id IS NOT NULL AND app_in_committee(assignee_committee_id))
  );
CREATE POLICY tareas_delete ON tareas FOR DELETE USING (app_is_secretary());

-- ingesta: solo secretaría/admin (el worker opera con su propio rol)
CREATE POLICY ingestion_select ON ingestion_jobs FOR SELECT
  USING (app_is_secretary() OR current_user = 'app_worker');
CREATE POLICY ingestion_write ON ingestion_jobs FOR ALL
  USING (app_is_secretary() OR current_user = 'app_worker')
  WITH CHECK (app_is_secretary() OR current_user = 'app_worker');
CREATE POLICY candidates_select ON extraction_candidates FOR SELECT
  USING (app_is_secretary() OR current_user = 'app_worker');
CREATE POLICY candidates_write ON extraction_candidates FOR ALL
  USING (app_is_secretary() OR current_user = 'app_worker')
  WITH CHECK (app_is_secretary() OR current_user = 'app_worker');

-- auditoría: cualquiera inserta la suya; solo admin lee
CREATE POLICY audit_insert ON audit_log FOR INSERT
  WITH CHECK (app_is_authenticated() OR current_user = 'app_worker');
CREATE POLICY audit_select ON audit_log FOR SELECT USING (app_is_admin());

-- notificaciones y suscripciones push: estrictamente propias
CREATE POLICY notifications_own ON notifications FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
CREATE POLICY push_own ON push_subscriptions FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- ref_counters: solo vía función next_public_ref (SECURITY DEFINER no aplica aquí,
-- así que damos escritura a secretaría, que es quien crea acuerdos)
CREATE POLICY ref_counters_rw ON ref_counters FOR ALL
  USING (app_is_secretary() OR current_user = 'app_worker')
  WITH CHECK (app_is_secretary() OR current_user = 'app_worker');
