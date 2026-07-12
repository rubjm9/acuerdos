# Copias de seguridad y recuperación

## Qué se copia

| Origen | Contenido | Método |
|---|---|---|
| Postgres | Todo el modelo (incl. texto cifrado y auditoría) | `pg_dump -Fc` diario |
| MinIO `actas/` | PDFs originales y de ingesta | `mc mirror` a bucket de segunda región (versionado activado) |
| `.env` | Claves (¡incluida FIELD_ENCRYPTION_KEY!) | Copia manual en gestor de secretos/caja fuerte; NUNCA en el mismo bucket |

> Sin `FIELD_ENCRYPTION_KEY` el contenido de las áreas restringidas es
> irrecuperable. Guárdala en dos lugares seguros e independientes.

## Script diario (cron en el nodo aplicación)

```bash
#!/usr/bin/env bash
# /opt/acuerdos/backup.sh — cron: 30 3 * * *
set -euo pipefail
STAMP=$(date +%F)
docker exec acuerdos-postgres-1 pg_dump -U acuerdos_owner -Fc acuerdos \
  | age -r "$BACKUP_AGE_RECIPIENT" > /backups/acuerdos-$STAMP.dump.age
mc mirror --overwrite local/actas backup-eu2/actas
# retención: 30 diarias + 12 mensuales
find /backups -name '*.dump.age' -mtime +30 ! -name '*-01.dump.age' -delete
rclone copy /backups backup-eu2:acuerdos-pgdumps   # segunda región UE
```

Cifrado de los dumps con [age](https://age-encryption.org) (clave del
destinatario en el gestor de secretos, junto a FIELD_ENCRYPTION_KEY).

## Restauración (probar cada 6 meses)

```bash
age -d -i clave.txt acuerdos-2026-07-01.dump.age > acuerdos.dump
docker compose up -d postgres
docker exec -i acuerdos-postgres-1 pg_restore -U acuerdos_owner -d acuerdos --clean < acuerdos.dump
mc mirror backup-eu2/actas local/actas
docker compose up -d
```

**Objetivos**: RPO ≤ 24 h · RTO ≤ 4 h (aprovisionar servidor nuevo + restaurar).

## Rotación de FIELD_ENCRYPTION_KEY

1. Añade `FIELD_ENCRYPTION_KEY_OLD` con la clave saliente.
2. Ejecuta el script de recifrado (recorre `acuerdos.full_text_enc` y
   `descifra con la vieja, cifra con la nueva`).
3. Retira la clave vieja y fuerza nueva copia de seguridad completa.
