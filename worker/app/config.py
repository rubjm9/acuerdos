"""Configuración del worker a partir de variables de entorno."""

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    database_url: str
    s3_endpoint: str
    s3_access_key: str
    s3_secret_key: str
    s3_bucket_actas: str
    llm_base_url: str  # vacío => extractor determinista (stub)
    llm_model: str
    tei_embed_url: str  # vacío => sin embeddings (NULL)
    embedding_dim: int


@lru_cache
def get_settings() -> Settings:
    """Lee la configuración una sola vez desde el entorno."""
    return Settings(
        database_url=os.environ.get("DATABASE_URL", ""),
        s3_endpoint=os.environ.get("S3_ENDPOINT", ""),
        s3_access_key=os.environ.get("S3_ACCESS_KEY", ""),
        s3_secret_key=os.environ.get("S3_SECRET_KEY", ""),
        s3_bucket_actas=os.environ.get("S3_BUCKET_ACTAS", "actas"),
        llm_base_url=os.environ.get("LLM_BASE_URL", "").strip(),
        llm_model=os.environ.get("LLM_MODEL", ""),
        tei_embed_url=os.environ.get("TEI_EMBED_URL", "").strip(),
        embedding_dim=int(os.environ.get("EMBEDDING_DIM") or 1024),
    )
