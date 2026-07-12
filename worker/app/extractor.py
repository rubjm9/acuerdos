"""Extracción de metadatos de cada candidato: LLM autoalojado o stub determinista.

Nunca se llama a APIs externas: solo el endpoint OpenAI-compatible configurado
en LLM_BASE_URL (vLLM autoalojado). Si está vacío, se usa el stub.
"""

import json
import logging
import re
from dataclasses import dataclass, field

import httpx

from .config import get_settings

logger = logging.getLogger(__name__)

MAX_TITULO_CHARS = 120
LLM_TIMEOUT_SECONDS = 120
LLM_MAX_INPUT_CHARS = 6000

# Áreas restringidas: el stub jamás las sugiere; si el LLM lo hace, se contabiliza.
RESTRICTED_SLUGS = {"casos-personales", "salud-espiritual"}

ALLOWED_LINK_TIPOS = {"deriva_de", "continua", "modifica", "sustituye_a", "relacionado_con"}

# Mapa de palabras clave (regex) -> slug de área para el extractor determinista.
KEYWORD_SLUGS: list[tuple[str, str]] = [
    (r"educaci|escuela|instituto|clase|formaci[oó]n", "educacion"),
    (r"finanz|fondo|presupuesto|contribuci|econ[oó]mic|tesorer", "fondo-finanzas"),
    (r"propiedad|inmueble|edificio|local\b|alquiler|terreno", "propiedades-inmuebles"),
    (r"jur[ií]dic|legal|abogad|estatut|registro civil", "asuntos-juridicos"),
    (r"traducc", "traducciones"),
    (r"tecnolog|web|inform[aá]tic|digital|internet", "tecnologias"),
    (r"elecci[oó]n|elecciones|electoral|convenci[oó]n", "elecciones"),
    (r"comit[eé]|agencia", "comites-agencias"),
    (r"ll[ií]ria", "lliria"),
    (r"regi[oó]n norte", "region-norte"),
    (r"regi[oó]n sur", "region-sur"),
    (r"regi[oó]n este", "region-este"),
    (r"comunicaci[oó]n interna|bolet[ií]n", "comunicacion-interna"),
    (r"asuntos p[uú]blicos|prensa|medios de comunicaci[oó]n", "asuntos-publicos"),
    (r"editorial|publicaci[oó]n|libro", "editorial-publicaciones"),
    (r"evento|conferencia|encuentro|escuela de verano", "eventos-vida-comunitaria"),
    (r"crecimiento|agrupaci[oó]n", "crecimiento-agrupaciones"),
]

# Referencias a acuerdos anteriores del tipo "ACU-2018-0142"
ACU_REF_RE = re.compile(r"ACU-\d{4}-\d{4}")

SENTENCE_END_RE = re.compile(r"(?<=[.!?;])\s")


@dataclass
class Extraction:
    titulo: str
    area_ids: list[str] = field(default_factory=list)
    links: list[dict] = field(default_factory=list)
    restricted_count: int = 0  # nº de áreas restringidas sugeridas (solo LLM)


def extract_candidate(text: str, areas_by_slug: dict[str, str]) -> Extraction:
    """Extrae metadatos con el LLM si está configurado; si no (o falla), con el stub."""
    if get_settings().llm_base_url:
        try:
            return llm_extract(text, areas_by_slug)
        except Exception:
            logger.warning("El LLM falló; se usa el extractor determinista", exc_info=True)
    return stub_extract(text, areas_by_slug)


def stub_extract(text: str, areas_by_slug: dict[str, str]) -> Extraction:
    """Extractor determinista: título = primera frase, áreas por palabras clave."""
    area_ids = [
        areas_by_slug[slug]
        for pattern, slug in KEYWORD_SLUGS
        if slug in areas_by_slug
        and slug not in RESTRICTED_SLUGS
        and re.search(pattern, text, re.IGNORECASE)
    ]
    links = [
        {"ref_text": ref, "tipo": "relacionado_con", "motivo": "Mención detectada en el texto"}
        for ref in dict.fromkeys(ACU_REF_RE.findall(text))
    ]
    return Extraction(titulo=_first_sentence(text), area_ids=area_ids, links=links)


def llm_extract(text: str, areas_by_slug: dict[str, str]) -> Extraction:
    """Pide al endpoint OpenAI-compatible una extracción en JSON estricto."""
    settings = get_settings()
    slugs = ", ".join(sorted(areas_by_slug))
    system = (
        "Eres un asistente que extrae metadatos de acuerdos institucionales en español. "
        "Respondes únicamente con un objeto JSON válido, sin texto adicional."
    )
    user = (
        "Analiza este acuerdo extraído de un acta y devuelve JSON con esta forma exacta:\n"
        '{"titulo": "título breve (máx. 120 caracteres)", "resumen": "resumen breve", '
        '"areas": ["slug", ...], "links": [{"ref_text": "...", "tipo": "...", "motivo": "..."}]}\n'
        f"- areas: solo slugs de esta lista: {slugs}\n"
        "- links: referencias a acuerdos o actas anteriores mencionados en el texto "
        '(p. ej. "acuerdo ACU-2018-0142", "acta 12/2018"); tipo debe ser uno de: '
        "deriva_de, continua, modifica, sustituye_a, relacionado_con.\n"
        "- Si no hay áreas o links, devuelve listas vacías.\n\n"
        f"Texto del acuerdo:\n{text[:LLM_MAX_INPUT_CHARS]}"
    )
    payload = {
        "model": settings.llm_model,
        "temperature": 0,
        "max_tokens": 800,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    response = httpx.post(url, json=payload, timeout=LLM_TIMEOUT_SECONDS)
    response.raise_for_status()
    data = _parse_json(response.json()["choices"][0]["message"]["content"])

    titulo = " ".join(str(data.get("titulo") or "").split())[:MAX_TITULO_CHARS]
    area_ids: list[str] = []
    restricted = 0
    for slug in data.get("areas") or []:
        if slug in areas_by_slug and areas_by_slug[slug] not in area_ids:
            area_ids.append(areas_by_slug[slug])
            if slug in RESTRICTED_SLUGS:
                restricted += 1
    links: list[dict] = []
    for link in data.get("links") or []:
        if isinstance(link, dict) and link.get("ref_text"):
            tipo = link.get("tipo")
            links.append({
                "ref_text": str(link["ref_text"]),
                "tipo": tipo if tipo in ALLOWED_LINK_TIPOS else "relacionado_con",
                "motivo": str(link.get("motivo") or ""),
            })
    return Extraction(
        titulo=titulo or _first_sentence(text),
        area_ids=area_ids,
        links=links,
        restricted_count=restricted,
    )


_LEADING_MARKER_RE = re.compile(
    r"^\s*(?:acuerdo\s+)?(?:n[ºo°]\s*)?\d+[\.\):]\s*", re.IGNORECASE
)


def _first_sentence(text: str) -> str:
    """Primera frase del texto (sin el marcador de numeración), truncada a 120."""
    clean = " ".join(text.split())
    clean = _LEADING_MARKER_RE.sub("", clean)
    match = SENTENCE_END_RE.search(clean)
    sentence = clean[:match.start()] if match else clean
    if len(sentence) > MAX_TITULO_CHARS:
        sentence = sentence[:MAX_TITULO_CHARS - 1].rstrip() + "…"
    return sentence


def _parse_json(content: str) -> dict:
    """Extrae el primer objeto JSON de la respuesta (tolera vallas de código)."""
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("La respuesta del LLM no contiene JSON")
    data = json.loads(content[start:end + 1])
    if not isinstance(data, dict):
        raise ValueError("La respuesta del LLM no es un objeto JSON")
    return data
