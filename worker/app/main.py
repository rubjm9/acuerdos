"""API del worker de ingesta: procesado de trabajos, indexado y embeddings."""

import logging
import uuid
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

from .chunker import chunk_text
from .db import get_conn
from .embeddings import embed_texts, to_vector_literal
from .pipeline import process_job

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Worker de ingesta de actas", version="1.0.0")


class IndexRequest(BaseModel):
    text: str
    titulo: Optional[str] = None


class EmbedRequest(BaseModel):
    text: str


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/jobs/{job_id}/process", status_code=202)
def process_job_endpoint(job_id: uuid.UUID, background_tasks: BackgroundTasks) -> dict:
    """Lanza el procesamiento del trabajo en segundo plano y responde 202."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM ingestion_jobs WHERE id = %s", (job_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")
    background_tasks.add_task(process_job, str(job_id))
    return {"job_id": str(job_id), "status": "processing"}


@app.post("/acuerdos/{acuerdo_id}/index")
def index_acuerdo(acuerdo_id: uuid.UUID, body: IndexRequest) -> dict:
    """Trocea el texto del acuerdo, lo (re)indexa y guarda embeddings si hay TEI."""
    full_text = f"{body.titulo}\n\n{body.text}".strip() if body.titulo else body.text
    chunks = chunk_text(full_text)
    vectors = None
    try:
        vectors = embed_texts(chunks)
    except Exception:
        logger.warning("TEI no disponible; los chunks se guardan sin embedding", exc_info=True)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM acuerdo_chunks WHERE acuerdo_id = %s", (acuerdo_id,))
        for idx, chunk in enumerate(chunks):
            embedding = to_vector_literal(vectors[idx]) if vectors else None
            cur.execute(
                "INSERT INTO acuerdo_chunks (acuerdo_id, chunk_idx, chunk_text, embedding) "
                "VALUES (%s, %s, %s, %s::vector)",
                (acuerdo_id, idx, chunk, embedding),
            )
    return {"chunks": len(chunks), "embedded": vectors is not None}


@app.post("/search/embed")
def search_embed(body: EmbedRequest) -> dict:
    """Embedding de una consulta de búsqueda; null si TEI no está configurado."""
    try:
        vectors = embed_texts([body.text])
    except Exception:
        logger.warning("TEI no disponible para la consulta", exc_info=True)
        vectors = None
    return {"embedding": vectors[0] if vectors else None}
