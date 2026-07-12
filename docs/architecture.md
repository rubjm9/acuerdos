# Arquitectura

## Visión general

```
                    ┌─────────────────────────── Nodo aplicación (UE) ───────────────────────────┐
  Usuario ── HTTPS ─┤ Caddy (TLS) ─▶ Next.js (web) ──▶ PostgreSQL 16 + pgvector (RLS)            │
  (móvil/escritorio)│                    │  ▲               ▲                                     │
                    │                    │  │               │                                     │
                    │                    ▼  │               │                                     │
                    │                MinIO (S3, actas)   pg-boss (recordatorios)                  │
                    │                    ▲                                                        │
                    │                    │                                                        │
                    │              Worker Python (FastAPI): ingesta, OCR, chunking                │
                    └─────────────────────────┬───────────────────────────────────────────────────┘
                                              │ HTTP interno (nunca sale del perímetro)
                    ┌─────────────────────────▼───────────── Nodo GPU (UE) ──────────────────────┐
                    │   vLLM (Mistral Small 3 24B) · TEI embeddings (BGE-M3) · TEI reranker      │
                    └─────────────────────────────────────────────────────────────────────────────┘
```

## Decisiones clave y su porqué

| Decisión | Motivo |
|---|---|
| **Postgres único** (relacional + vectores + FTS + cola) | Una sola fuente de verdad; RLS aplica a TODA vía de acceso, incluida la búsqueda; menos piezas que operar para un equipo pequeño. |
| **RLS con identidad por transacción** (`SET LOCAL app.user_id`) | La autorización vive en la base de datos: un fallo en la capa web no puede saltarse el filtrado por área. La app se conecta con roles `app_web`/`app_worker` con `NOBYPASSRLS`. |
| **Cifrado de campo (AES-256-GCM)** para áreas restringidas | El contenido Art. 9 RGPD es ilegible incluso con un volcado de la BD; la clave vive solo en el entorno de la app. |
| **Restringido ⇒ jamás indexado** | Los acuerdos de áreas restringidas no generan chunks: su contenido no existe en el índice FTS ni en el vectorial. Se encuentran solo por metadatos y con autorización. |
| **Next.js App Router + Server Actions** | Una sola base de código responsive; sin API paralela que mantener; formularios funcionan sin JS pesado. |
| **Worker Python separado** | OCR/PDF/embeddings son territorio Python; puede reiniciarse o escalar sin afectar a la web; corre con rol de BD de mínimo privilegio. |
| **vLLM + TEI autoalojados** | Cumplimiento estricto: extracción, embeddings, rerank y (fase 2) asistente ocurren en nuestra GPU. Sin GPU el sistema **degrada con elegancia**: FTS + extractor determinista. |
| **Mistral Small 3 (24B, Apache-2.0)** | Proveniencia europea (refuerza la narrativa ante el DPO), castellano excelente, cabe en una GPU de 48 GB (o 24 GB cuantizado con Qwen2.5-14B como alternativa). |
| **BGE-M3 + bge-reranker-v2-m3** | Multilingüe sólido en español; BGE-M3 da denso+disperso, ideal para híbrida. |
| **pg-boss** | Cron y colas sobre Postgres: sin Redis/RabbitMQ que operar. |
| **MinIO** | S3 autoalojado UE para actas originales y exportaciones, con versionado. |

## Búsqueda híbrida (lib/search.ts)

1. **Atajo exacto**: `ACU-YYYY-NNNN` o «acta N/AAAA» → lookup directo indexado.
2. **Densa**: embedding de la consulta (worker→TEI) → kNN pgvector (HNSW, coseno).
3. **Dispersa**: FTS español (`websearch_to_tsquery`, GIN).
4. **Fusión RRF** (k=60) de ambos rankings.
5. **Re-ranking** con cross-encoder TEI (si está desplegado).
6. Resultado siempre con **cita acta + página** y acceso al expediente.

Sin TEI (p. ej. desarrollo) los pasos 2 y 5 se omiten automáticamente.

## Identificadores

`public_ref` (`ACU-AAAA-NNNN`) es **inmutable** (trigger que lo impide) y se
asigna atómicamente por `next_public_ref(año)` sobre `ref_counters`.

## Ingesta (worker/)

PDF anual → detección de capa de texto → **OCR solo si falta** (`ocrmypdf -l spa`)
→ segmentación de actas (regex de cabeceras + fechas en español) → segmentación
de acuerdos → extracción (LLM autoalojado o stub determinista) → candidatos en
`extraction_candidates` → **cola de revisión** de Secretaría → al aprobar:
acta autocreada si falta (`annual_compilation` + página), referencia asignada,
chunks e (async) embeddings. **Nada se publica sin aprobación humana**; los
enlaces sugeridos jamás se confirman solos.

## Escalado

10–12 usuarios y ~15.000 acuerdos están muy por debajo de los límites de un
único Postgres (HNSW con ~50k chunks es trivial). El nodo GPU es el único
componente caro; puede apagarse fuera de horas de ingesta si se asume búsqueda
solo-FTS temporalmente.
