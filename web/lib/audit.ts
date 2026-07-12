import type { PoolClient } from "pg";
import { pool } from "@/lib/db";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "download"
  | "search"
  | "export"
  | "login";

/**
 * Registro de auditoría (append-only).
 * `restricted: true` marca eventos sobre áreas restringidas (Art. 9):
 * se registran también las LECTURAS, no solo las escrituras.
 */
export async function audit(
  userId: string,
  action: AuditAction,
  entityType: string,
  entityId?: string | null,
  opts?: { restricted?: boolean; metadata?: Record<string, unknown>; client?: PoolClient }
) {
  const q = `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, restricted, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`;
  const params = [
    userId,
    action,
    entityType,
    entityId ?? null,
    opts?.restricted ?? false,
    JSON.stringify(opts?.metadata ?? {}),
  ];
  if (opts?.client) {
    await opts.client.query(q, params);
  } else {
    // fuera de transacción: la identidad RLS debe fijarse para la política de INSERT
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      await client.query(q, params);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
}
