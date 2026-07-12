#!/bin/bash
# Crea los roles de aplicación con mínimo privilegio ANTES de las migraciones SQL.
# Se ejecuta solo en el primer arranque del contenedor de Postgres.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE app_web LOGIN PASSWORD '${APP_WEB_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  CREATE ROLE app_worker LOGIN PASSWORD '${APP_WORKER_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
EOSQL
