# Runbook de operación

## Despliegue recomendado (Hetzner, 2 nodos)

| Nodo | Ejemplo | Corre |
|---|---|---|
| Aplicación | CPX41 (8 vCPU / 16–32 GB) + volumen NVMe | postgres, minio, web, worker, caddy |
| GPU | GEX44 / GPU dedicada 24–48 GB VRAM | vllm, tei-embed, tei-rerank |

Alternativas UE: OVHcloud, Scaleway (Francia) o StackIT si el DPO prefiere
jurisdicción concreta. Con 24 GB de VRAM, cambia el modelo de vLLM a
`Qwen/Qwen2.5-14B-Instruct-AWQ` en `docker-compose.yml`.

## Instalación

```bash
# en el nodo aplicación
git clone <repo> && cd acuerdos
cp .env.example .env    # rellenar TODAS las claves (openssl rand -base64 32)
docker compose up -d
docker compose --profile edge up -d          # Caddy: edita infra/caddy/Caddyfile con tu dominio

# en el nodo GPU (o el mismo si es único)
docker compose --profile ai up -d
# luego en .env del nodo app:  LLM_BASE_URL=http://<gpu>:8001/v1
#                              TEI_EMBED_URL=http://<gpu>:8002
#                              TEI_RERANK_URL=http://<gpu>:8003
docker compose up -d web worker              # recargar config
```

Entre nodos usa red privada (Hetzner vSwitch/red privada del proveedor) o
WireGuard; los puertos de IA nunca deben ser públicos.

### Google OIDC

1. Google Cloud Console → credenciales OAuth 2.0 (tipo web).
2. Redirect URI: `https://<dominio>/api/auth/callback/google`.
3. Copia `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` a `.env`; `AUTH_ALLOWED_DOMAIN=bahai.es`.
4. La primera persona que entre se convierte en Administración y da de alta al resto.

## Operación diaria

- **Recordatorios**: cron interno (pg-boss) a las 07:00 Europe/Madrid; no
  requiere intervención.
- **Ingesta anual**: Ingesta → subir PDF del año → revisar candidatos.
- **Alta de usuario**: Administración → Usuarios → Nueva persona (email del dominio).
- **Acceso restringido**: Administración → Usuarios → chips de áreas restringidas.

## Actualizaciones

```bash
git pull
docker compose build web worker && docker compose up -d web worker
```
Las migraciones nuevas (`db/migrations/*.sql` con número superior) se aplican
manualmente: `docker exec -i acuerdos-postgres-1 psql -U acuerdos_owner -d acuerdos < db/migrations/00X_...sql`

## Diagnóstico rápido

| Síntoma | Comprobación |
|---|---|
| Búsqueda sin resultados semánticos | `curl http://<gpu>:8002/health`; sin TEI la búsqueda es solo por palabras clave (esperado) |
| Ingesta atascada en «Procesando» | `docker logs acuerdos-worker-1`; botón «Reprocesar» en la UI |
| No llegan emails | Revisa `SMTP_URL`; los avisos in-app siguen funcionando |
| 403 al descargar acta | Solo admin/secretaría/miembro pueden descargar originales (por diseño) |
| Login rechazado | ¿Usuario dado de alta y activo? ¿Email del dominio correcto? |

## Seguridad operativa

- `.env` fuera de git; rota claves si hay sospecha (FIELD_ENCRYPTION_KEY **no**
  puede rotarse sin recifrar: procedimiento en backups.md).
- Actualiza imágenes base mensualmente (`docker compose pull`).
- Verifica que el nodo GPU no expone puertos a Internet.
