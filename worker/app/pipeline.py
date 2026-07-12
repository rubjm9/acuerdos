"""Pipeline de procesamiento de un trabajo de ingesta (se ejecuta en segundo plano)."""

import logging
import tempfile
from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig
from psycopg.types.json import Json

from .config import get_settings
from .db import get_conn
from .extractor import extract_candidate
from .pdf import extract_text_pages
from .segmenter import split_actas, split_candidates

logger = logging.getLogger(__name__)

INSERT_CANDIDATE_SQL = """
    INSERT INTO extraction_candidates
        (job_id, proposed_titulo, proposed_text, proposed_date,
         acta_numero, acta_fecha, page, suggested_area_ids, suggested_links)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::uuid[], %s)
"""


def process_job(job_id: str) -> None:
    """Procesa el trabajo completo; ante cualquier fallo lo marca como 'failed'."""
    logger.info("Procesando trabajo %s", job_id)
    try:
        _run(job_id)
        logger.info("Trabajo %s extraído correctamente", job_id)
    except Exception as exc:
        logger.exception("Fallo procesando el trabajo %s", job_id)
        _mark_failed(job_id, str(exc))


def _run(job_id: str) -> None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT source_file_key FROM ingestion_jobs WHERE id = %s", (job_id,)
        ).fetchone()
        if row is None:
            raise RuntimeError(f"Trabajo {job_id} no encontrado")
        source_key: str = row[0]
        conn.execute(
            "UPDATE ingestion_jobs SET status = 'processing', error = NULL, "
            "updated_at = now() WHERE id = %s",
            (job_id,),
        )

    with tempfile.TemporaryDirectory(prefix="ingesta-") as tmp:
        workdir = Path(tmp)
        pdf_path = workdir / "origen.pdf"
        _download_source(source_key, pdf_path)
        pages, ocr_used = extract_text_pages(pdf_path, workdir)

    actas = split_actas(pages)
    areas_by_slug = _load_areas()
    candidates = []  # (texto, página, acta, extracción)
    restricted_total = 0
    for acta in actas:
        for page, text in split_candidates(acta):
            extraction = extract_candidate(text, areas_by_slug)
            restricted_total += extraction.restricted_count
            candidates.append((text, page, acta, extraction))

    stats: dict = {
        "pages": len(pages),
        "actas": len(actas),
        "candidates": len(candidates),
        "ocr_used": ocr_used,
    }
    if restricted_total:
        stats["restricted_suggested"] = restricted_total

    with get_conn() as conn:
        with conn.cursor() as cur:
            for text, page, acta, extraction in candidates:
                cur.execute(INSERT_CANDIDATE_SQL, (
                    job_id,
                    extraction.titulo,
                    text,
                    acta.fecha,  # proposed_date = fecha del acta
                    acta.numero,
                    acta.fecha,
                    page,
                    extraction.area_ids,
                    Json(extraction.links),
                ))
        conn.execute(
            "UPDATE ingestion_jobs SET status = 'extracted', stats = %s, "
            "updated_at = now() WHERE id = %s",
            (Json(stats), job_id),
        )


def _mark_failed(job_id: str, error: str) -> None:
    try:
        with get_conn() as conn:
            conn.execute(
                "UPDATE ingestion_jobs SET status = 'failed', error = %s, "
                "updated_at = now() WHERE id = %s",
                (error[:2000], job_id),
            )
    except Exception:
        logger.exception("No se pudo marcar el trabajo %s como fallido", job_id)


def _download_source(key: str, dest: Path) -> None:
    """Descarga el fichero origen desde S3 (endpoint propio, path-style)."""
    settings = get_settings()
    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    client.download_file(settings.s3_bucket_actas, key, str(dest))


def _load_areas() -> dict[str, str]:
    """Mapa slug -> id (uuid en texto) de todas las áreas."""
    with get_conn() as conn:
        rows = conn.execute("SELECT slug, id FROM areas").fetchall()
    return {slug: str(area_id) for slug, area_id in rows}
