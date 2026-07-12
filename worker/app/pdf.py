"""Extracción de texto de PDF con OCR opcional (ocrmypdf) si falta capa de texto."""

import logging
import shutil
import subprocess
from pathlib import Path

import pdfplumber
from pypdf import PdfReader

logger = logging.getLogger(__name__)

# Umbral: si el promedio de caracteres por página baja de esto, se intenta OCR.
MIN_AVG_CHARS_PER_PAGE = 50
OCR_TIMEOUT_SECONDS = 1800


def read_pages(path: Path) -> list[str]:
    """Devuelve el texto de cada página. pdfplumber primero, pypdf como respaldo."""
    try:
        with pdfplumber.open(path) as pdf:
            return [(page.extract_text() or "") for page in pdf.pages]
    except Exception:
        logger.warning("pdfplumber falló con %s; se reintenta con pypdf", path.name)
        reader = PdfReader(str(path))
        return [(page.extract_text() or "") for page in reader.pages]


def _run_ocrmypdf(src: Path, dst: Path) -> bool:
    """Ejecuta ocrmypdf --skip-text -l spa. Devuelve False si no está disponible o falla."""
    if shutil.which("ocrmypdf") is None:
        logger.warning("ocrmypdf no está instalado; se continúa sin OCR")
        return False
    try:
        proc = subprocess.run(
            ["ocrmypdf", "--skip-text", "-l", "spa", str(src), str(dst)],
            capture_output=True,
            text=True,
            timeout=OCR_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        logger.warning("ocrmypdf superó el tiempo máximo; se continúa sin OCR")
        return False
    if proc.returncode != 0:
        logger.warning("ocrmypdf terminó con código %s: %s", proc.returncode, proc.stderr[-500:])
        return False
    return True


def extract_text_pages(path: Path, workdir: Path) -> tuple[list[str], bool]:
    """Extrae texto por página; aplica OCR solo si el PDF apenas tiene capa de texto.

    Devuelve (páginas, ocr_usado).
    """
    pages = read_pages(path)
    if not pages:
        return pages, False
    avg_chars = sum(len(p.strip()) for p in pages) / len(pages)
    if avg_chars >= MIN_AVG_CHARS_PER_PAGE:
        return pages, False
    logger.info("Promedio de %.0f caracteres/página: se intenta OCR", avg_chars)
    ocr_path = workdir / "ocr.pdf"
    if not _run_ocrmypdf(path, ocr_path):
        return pages, False
    return read_pages(ocr_path), True
