# Acuerdos — Plataforma de Gobernanza de la Asamblea

Plataforma privada y **totalmente autoalojada en la UE** para gestionar **actas**,
**acuerdos**, **expedientes** (hilos históricos) y **tareas** de la Asamblea, con
búsqueda híbrida sobre el archivo histórico e ingesta asistida por IA
**autoalojada** (ningún contenido sale jamás de nuestra infraestructura).

## Estructura

| Ruta | Contenido |
|---|---|
| `web/` | Aplicación Next.js (App Router, es-ES, mobile-first, PWA) |
| `worker/` | Worker Python (FastAPI): ingesta de PDF, OCR, extracción, embeddings |
| `db/migrations/` | Esquema Postgres, políticas RLS y semilla de las 24 áreas |
| `infra/` | Caddy (TLS) y utilidades de despliegue |
| `docs/` | Arquitectura, flujos de datos, DPIA/ROPA, runbook y copias de seguridad |

## Arranque rápido (desarrollo)

```bash
cp .env.example .env          # rellena contraseñas y claves
# Publica Postgres/MinIO en localhost (no hace falta en Coolify/producción)
docker compose -f docker-compose.yml -f docker-compose.host-ports.yml \
  up -d postgres minio minio-init

cd web && npm install && npm run dev          # http://localhost:3000
cd worker && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000    # worker de ingesta
```

**MVP en Vercel + Supabase (sin Docker):** ver [`docs/mvp-vercel-supabase.md`](docs/mvp-vercel-supabase.md).

Con `AUTH_DEV_LOGIN=true` puedes entrar con cualquier email dado de alta en la
tabla `users` (sin contraseña). El **primer usuario** que inicia sesión se
convierte en administrador (bootstrap).

## Producción

```bash
docker compose up -d                          # nodo aplicación (web+worker+datos)
docker compose --profile ai up -d             # nodo GPU (vLLM + TEI)
docker compose --profile edge up -d           # Caddy con TLS
```

Consulta `docs/runbook.md` para el despliegue completo en Hetzner/OVH/Scaleway,
`docs/architecture.md` para las decisiones técnicas y `docs/data-flows.md` +
`docs/DPIA.md` para la documentación destinada al DPO.

## Principios no negociables

1. **Residencia UE** de todo dato y procesamiento.
2. **IA solo autoalojada** (vLLM + TEI); ninguna API externa recibe contenido.
3. **RLS en Postgres**: las áreas restringidas («Casos personales», «Salud
   espiritual») solo son visibles con acceso explícito, en todas las rutas.
4. El texto de las áreas restringidas se guarda **cifrado (AES-256-GCM)** y
   **nunca se indexa** para búsqueda.
5. **Aprobación humana obligatoria** para todo lo extraído por la ingesta.
6. **Auditoría append-only**, con registro de lecturas en áreas restringidas.
