# MVP: Vercel + Supabase (UE)

Guía para levantar un MVP usable **sin Docker/Coolify**. Más adelante se puede
pasar al stack completo (`docker compose` en VPS) sin reescribir la app.

## Qué incluye este MVP

- App Next.js en **Vercel** (`web/`)
- Postgres (+ `pgvector`) en **Supabase** región UE (p. ej. Frankfurt)
- Login de desarrollo (`AUTH_DEV_LOGIN`) o Google OAuth
- Actas, acuerdos, expedientes, tareas, admin básico

## Qué queda fuera (fase 2)

- Worker Python (OCR / ingesta masiva de PDF)
- MinIO propio / Coolify
- IA autoalojada (vLLM, embeddings)

Sin worker puedes crear contenido a mano; la UI degrada bien si no hay
`WORKER_URL`.

---

## 1. Proyecto Supabase

1. [supabase.com](https://supabase.com) → New project.
2. Región: **Central EU (Frankfurt)** u otra UE.
3. Guarda la contraseña del usuario `postgres`.

### Connection strings

En **Project Settings → Database**:

- Usa la conexión **directa** (`db.<ref>.supabase.co:5432`) o el pooler en
  modo **Session**.
- **No** uses Transaction mode (puerto 6543): la app hace
  `SET LOCAL app.user_id` y necesita sesión real.

Necesitarás dos URLs:

| Variable | Usuario | Uso |
|---|---|---|
| `DATABASE_URL` | `app_web` | Datos de la UI (sujeto a RLS) |
| `DATABASE_URL_OWNER` | `postgres` | Login, pg-boss, bootstrap |

Formato:

```text
postgresql://app_web:PASSWORD@db.XXXX.supabase.co:5432/postgres
postgresql://postgres:PASSWORD@db.XXXX.supabase.co:5432/postgres
```

Si la contraseña tiene `@`, `#`, `%`, etc., **URL-encódala**.

---

## 2. Esquema SQL (orden)

En **SQL Editor**, ejecuta en este orden:

1. `db/supabase/00_roles.sql` — edita antes las dos contraseñas
2. `db/migrations/001_schema.sql`
3. `db/migrations/002_rls.sql`
4. `db/migrations/003_seed_areas.sql`
5. `db/migrations/004_politicas.sql`

Si algún `CREATE EXTENSION` falla, en el dashboard habilita `vector` (Database →
Extensions).

Comprueba:

```sql
SELECT rolname FROM pg_roles WHERE rolname IN ('app_web', 'app_worker');
SELECT count(*) FROM areas;
```

---

## 3. Storage (PDFs / actas) — opcional al inicio

Si aún no subes ficheros, puedes dejar S3 vacío y entrar a la app igual.

Cuando lo necesites:

1. Storage → crea buckets privados: `actas`, `exports`.
2. Activa **S3 Access Keys** (Storage settings) y copia access key / secret.
3. Endpoint típico:

```text
https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3
```

(o el que muestre el panel; a veces es `https://<ref>.supabase.co/storage/v1/s3`)

---

## 4. Proyecto Vercel

1. Importa el repo `rubjm9/acuerdos`.
2. **Root Directory = `web`** (imprescindible; si no → 404).
3. Framework: Next.js.
4. Variables de entorno (Production + Preview):

### Obligatorias

```text
DATABASE_URL=postgresql://app_web:...@db....supabase.co:5432/postgres
DATABASE_URL_OWNER=postgresql://postgres:...@db....supabase.co:5432/postgres

AUTH_SECRET=          # openssl rand -base64 32
AUTH_URL=https://tu-app.vercel.app
AUTH_ALLOWED_DOMAIN=bahai.es
AUTH_DEV_LOGIN=true

FIELD_ENCRYPTION_KEY= # openssl rand -base64 32  (debe decodificar a 32 bytes)
```

### Storage (cuando lo uses)

```text
S3_ENDPOINT=https://<ref>.storage.supabase.co/storage/v1/s3
S3_REGION=eu-central-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET_ACTAS=actas
S3_BUCKET_EXPORTS=exports
```

### Dejar vacío en el MVP

```text
WORKER_URL=
LLM_BASE_URL=
TEI_EMBED_URL=
TEI_RERANK_URL=
SMTP_URL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

5. Deploy.
6. Abre `https://tu-app.vercel.app/acceso` → cualquier email (primer usuario =
   administrador).
7. Cuando el piloto esté estable: `AUTH_DEV_LOGIN=false` + Google OAuth con
   redirect `https://tu-app.vercel.app/api/auth/callback/google`.

---

## 5. Checklist rápido si algo falla

| Síntoma | Revisar |
|---|---|
| 404 NOT_FOUND de Vercel | Root Directory ≠ `web` |
| Error de DB / timeout | ¿Session/directo, no Transaction pooler? ¿Password URL-encoded? |
| Login no aparece | `AUTH_DEV_LOGIN=true` y redeploy |
| `FIELD_ENCRYPTION_KEY` inválida | Tiene que ser 32 bytes en base64 (`openssl rand -base64 32`) |
| Subida de PDF falla | Buckets + S3 keys + `S3_ENDPOINT` |

---

## 6. Después del MVP (stack completo)

Cuando haga falta ingesta masiva / privacidad total en VPS:

1. Coolify + `docker-compose.yml` del repo
2. Migrar datos de Supabase → Postgres del compose (dump/restore)
3. Apuntar DNS al VPS y apagar el proyecto Vercel de producción

El código de `web/` es el mismo; solo cambian URLs y secretos.
