"""Segmentación del texto en actas y acuerdos candidatos."""

import re
from dataclasses import dataclass
from datetime import date
from typing import Optional

# Cabeceras tipo "ACTA Nº 123", "ACTA NUM. 123", "ACTA 123/2020"
ACTA_RE = re.compile(
    r"^\s*ACTA\s+(?:N[ºO°]\.?\s*|N[UÚ]M\.?\s*)?(\d{1,4})(?:\s*/\s*(\d{4}))?\b",
    re.IGNORECASE,
)

# Fechas en español: "14 de marzo de 2020", "3 de julio del 2018"
DATE_RE = re.compile(r"(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+(?:de|del)\s+(\d{4})", re.IGNORECASE)

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}

# Inicios de acuerdo candidato: "1. ", "2) ", "ACUERDO 3:", "Se acuerda..."
ITEM_RE = re.compile(
    r"^\s*(?:\d{1,3}\s*[.)\-]\s+|ACUERDO\s+(?:N[ºO°]\.?\s*)?\d+\s*[:.\-]?|Se\s+acuerda\b)",
    re.IGNORECASE,
)

MIN_CANDIDATE_CHARS = 60
HEADER_LOOKAHEAD_LINES = 15  # líneas tras la cabecera donde buscar la fecha del acta

# Línea etiquetada con su número de página
Line = tuple[int, str]


@dataclass
class Acta:
    numero: Optional[int]
    fecha: Optional[date]
    page: int
    lines: list[Line]
    has_header: bool


def parse_spanish_date(text: str) -> Optional[date]:
    """Devuelve la primera fecha en español encontrada en el texto, o None."""
    for m in DATE_RE.finditer(text):
        mes = MESES.get(m.group(2).lower())
        if mes is None:
            continue
        try:
            return date(int(m.group(3)), mes, int(m.group(1)))
        except ValueError:
            continue
    return None


def _to_lines(pages: list[str]) -> list[Line]:
    return [
        (page_num, line)
        for page_num, text in enumerate(pages, start=1)
        for line in text.splitlines()
    ]


def split_actas(pages: list[str]) -> list[Acta]:
    """Divide el documento en actas según sus cabeceras; una sola acta si no hay."""
    lines = _to_lines(pages)
    if not lines:
        return []
    starts = [i for i, (_, line) in enumerate(lines) if ACTA_RE.match(line)]
    if not starts:
        head = "\n".join(line for _, line in lines[:HEADER_LOOKAHEAD_LINES * 3])
        return [Acta(numero=None, fecha=parse_spanish_date(head), page=lines[0][0],
                     lines=lines, has_header=False)]
    actas: list[Acta] = []
    for idx, start in enumerate(starts):
        end = starts[idx + 1] if idx + 1 < len(starts) else len(lines)
        segment = lines[start:end]
        match = ACTA_RE.match(segment[0][1])
        assert match is not None
        head = "\n".join(line for _, line in segment[:HEADER_LOOKAHEAD_LINES])
        actas.append(Acta(
            numero=int(match.group(1)),
            fecha=parse_spanish_date(head),
            page=segment[0][0],
            lines=segment,
            has_header=True,
        ))
    return actas


def split_candidates(acta: Acta) -> list[tuple[int, str]]:
    """Divide un acta en acuerdos candidatos. Devuelve pares (página, texto)."""
    body = acta.lines[1:] if acta.has_header else acta.lines
    starts = [i for i, (_, line) in enumerate(body) if ITEM_RE.match(line)]
    if starts:
        segments = [body[s:starts[i + 1] if i + 1 < len(starts) else len(body)]
                    for i, s in enumerate(starts)]
    else:
        segments = _paragraph_blocks(body)
    candidates: list[tuple[int, str]] = []
    for segment in segments:
        text = "\n".join(line for _, line in segment).strip()
        if len(text) >= MIN_CANDIDATE_CHARS:
            candidates.append((segment[0][0], text))
    return candidates


def _paragraph_blocks(body: list[Line]) -> list[list[Line]]:
    """Agrupa líneas en bloques de párrafo separados por líneas en blanco."""
    blocks: list[list[Line]] = []
    current: list[Line] = []
    for page_num, line in body:
        if line.strip():
            current.append((page_num, line))
        elif current:
            blocks.append(current)
            current = []
    if current:
        blocks.append(current)
    return blocks
