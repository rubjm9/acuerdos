"""Cliente de HuggingFace TEI para embeddings (autoalojado)."""

import logging
from typing import Optional

import httpx

from .config import get_settings

logger = logging.getLogger(__name__)

BATCH_SIZE = 32
TEI_TIMEOUT_SECONDS = 60


def embed_texts(texts: list[str]) -> Optional[list[list[float]]]:
    """Devuelve un embedding por texto vía TEI, o None si TEI no está configurado."""
    url = get_settings().tei_embed_url
    if not url:
        return None
    endpoint = url.rstrip("/")
    if not endpoint.endswith("/embed"):
        endpoint += "/embed"
    vectors: list[list[float]] = []
    with httpx.Client(timeout=TEI_TIMEOUT_SECONDS) as client:
        for i in range(0, len(texts), BATCH_SIZE):
            response = client.post(endpoint, json={"inputs": texts[i:i + BATCH_SIZE]})
            response.raise_for_status()
            vectors.extend(response.json())
    expected = get_settings().embedding_dim
    if vectors and len(vectors[0]) != expected:
        raise ValueError(
            f"TEI devolvió vectores de dimensión {len(vectors[0])}, se esperaba {expected}"
        )
    return vectors


def to_vector_literal(vector: list[float]) -> str:
    """Serializa un vector al literal de pgvector: '[0.1,0.2,...]'."""
    return "[" + ",".join(str(float(v)) for v in vector) + "]"
