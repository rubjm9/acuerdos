"""Acceso a la base de datos con psycopg 3 (conexión por petición)."""

import psycopg

from .config import get_settings


def get_conn() -> psycopg.Connection:
    """Abre una conexión nueva; usar como gestor de contexto para commit/rollback."""
    return psycopg.connect(get_settings().database_url)
