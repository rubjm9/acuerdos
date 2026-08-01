-- ============================================================================
-- Roles de aplicación para Supabase (o cualquier Postgres gestionado).
-- Ejecutar PRIMERO en el SQL Editor (rol postgres), ANTES de 001_schema.sql.
-- Sustituye las contraseñas antes de ejecutar.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_web') THEN
    CREATE ROLE app_web LOGIN PASSWORD 'CAMBIA_APP_WEB_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_worker') THEN
    CREATE ROLE app_worker LOGIN PASSWORD 'CAMBIA_APP_WORKER_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;
