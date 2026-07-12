# Worker de ingesta

Servicio FastAPI que procesa PDFs de actas (extracción de texto, OCR opcional,
segmentación en acuerdos candidatos), indexa acuerdos en chunks con embeddings
pgvector y genera embeddings de consulta. Solo usa servicios autoalojados
(vLLM OpenAI-compatible y HuggingFace TEI); nunca APIs externas.

## Endpoints

- `GET /health` → `{"status": "ok"}`
- `POST /jobs/{job_id}/process` → 202; procesa en segundo plano: descarga el PDF
  de S3, extrae texto (OCR con `ocrmypdf` solo si falta capa de texto), segmenta
  actas y candidatos, e inserta `extraction_candidates`. Estado del job:
  `processing` → `extracted` (o `failed` con `error`).
- `POST /acuerdos/{acuerdo_id}/index` — body `{"text": "...", "titulo": "..."}` →
  reemplaza los chunks del acuerdo (~800 caracteres, solape 150) con embeddings
  vía TEI si está configurado. Devuelve `{"chunks": n, "embedded": bool}`.
- `POST /search/embed` — body `{"text": "..."}` → `{"embedding": [...]}` o
  `{"embedding": null}` si TEI no está configurado.

## Variables de entorno

`DATABASE_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
`S3_BUCKET_ACTAS`, `LLM_BASE_URL` (vacío → extractor determinista),
`LLM_MODEL`, `TEI_EMBED_URL` (vacío → sin embeddings), `EMBEDDING_DIM` (1024).

## Desarrollo

```bash
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Requiere Python 3.12 (imagen Docker `python:3.12-slim`). Para OCR local,
instalar `ocrmypdf` y `tesseract-ocr-spa`.
