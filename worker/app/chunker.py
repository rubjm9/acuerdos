"""Troceado de texto en fragmentos con solape, respetando párrafos y frases."""

import re

CHUNK_SIZE = 800
CHUNK_OVERLAP = 150

_PARAGRAPH_RE = re.compile(r"\n\s*\n")
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Divide el texto en fragmentos de ~`size` caracteres con solape de `overlap`."""
    units = _split_units(text.strip(), max_len=size - overlap)
    chunks: list[str] = []
    current = ""
    for unit in units:
        if current and len(current) + len(unit) + 1 > size:
            chunks.append(current)
            current = f"{_tail(current, overlap)} {unit}".strip()
        else:
            current = f"{current}\n{unit}" if current else unit
    if current:
        chunks.append(current)
    return chunks


def _split_units(text: str, max_len: int) -> list[str]:
    """Unidades (párrafos, frases o cortes duros) de longitud máxima `max_len`."""
    units: list[str] = []
    for paragraph in _PARAGRAPH_RE.split(text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if len(paragraph) <= max_len:
            units.append(paragraph)
            continue
        for sentence in _SENTENCE_RE.split(paragraph):
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) <= max_len:
                units.append(sentence)
            else:
                units.extend(
                    sentence[i:i + max_len].strip()
                    for i in range(0, len(sentence), max_len)
                )
    return [u for u in units if u]


def _tail(chunk: str, overlap: int) -> str:
    """Últimos ~`overlap` caracteres del fragmento, cortados en límite de palabra."""
    tail = chunk[-overlap:]
    cut = tail.find(" ")
    return tail[cut + 1:] if cut != -1 else tail
