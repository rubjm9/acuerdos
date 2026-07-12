import { Pool, type PoolClient } from "pg";

/**
 * Dos pools:
 *  - `pool` (app_web): mínimo privilegio, SUJETO A RLS. Todo acceso a datos de
 *    la aplicación pasa por aquí con la identidad del usuario fijada por
 *    transacción (SET LOCAL app.user_id).
 *  - `ownerPool`: solo para (1) resolución de identidad en el login,
 *    (2) pg-boss y (3) operaciones de sistema. Nunca para servir datos a la UI.
 */

declare global {
  // eslint-disable-next-line no-var
  var __acuerdosPools: { pool: Pool; ownerPool: Pool } | undefined;
}

function createPools() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });
  const ownerPool = new Pool({
    connectionString: process.env.DATABASE_URL_OWNER,
    max: 3,
  });
  return { pool, ownerPool };
}

const pools = globalThis.__acuerdosPools ?? createPools();
if (process.env.NODE_ENV !== "production") globalThis.__acuerdosPools = pools;

export const pool = pools.pool;
export const ownerPool = pools.ownerPool;

/**
 * Ejecuta `fn` dentro de una transacción con la identidad RLS del usuario.
 * Toda política de fila se evalúa contra ese usuario.
 */
export async function withUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // set_config parametrizado: sin interpolación de cadenas
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Consulta única con identidad RLS. */
export async function queryAsUser<R extends Record<string, unknown> = Record<string, unknown>>(
  userId: string,
  text: string,
  params?: unknown[]
): Promise<R[]> {
  return withUser(userId, async (c) => {
    const res = await c.query(text, params);
    return res.rows as R[];
  });
}
