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
  // Supabase (y casi todo Postgres gestionado) exige TLS desde Vercel.
  const useSsl =
    process.env.DATABASE_SSL === "true" ||
    process.env.DATABASE_SSL === "1" ||
    /supabase\.(co|com)/i.test(process.env.DATABASE_URL ?? "") ||
    /supabase\.(co|com)/i.test(process.env.DATABASE_URL_OWNER ?? "");

  const ssl = useSsl ? { rejectUnauthorized: false } : undefined;

  // En Vercel/serverless cada instancia abre su propio pool. El Session pooler
  // de Supabase Free limita ~15 clientes; pools grandes + pg-boss agotan el cupo
  // (EMAXCONNSESSION) y la app deja de responder.
  const serverless = process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  const poolMax = serverless ? 1 : 10;
  const ownerMax = serverless ? 1 : 3;

  // #region agent log
  fetch("http://127.0.0.1:7597/ingest/70c41da7-0b62-46a0-b333-967b01b5a216", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d418f0" },
    body: JSON.stringify({
      sessionId: "d418f0",
      hypothesisId: "A",
      location: "web/lib/db.ts:createPools",
      message: "pool config",
      data: { serverless, poolMax, ownerMax, vercel: process.env.VERCEL ?? null },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  console.info("[db] pool config", { serverless, poolMax, ownerMax });
  // #endregion

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: poolMax,
    idleTimeoutMillis: serverless ? 1000 : 30000,
    connectionTimeoutMillis: 10000,
    ssl,
  });
  const ownerPool = new Pool({
    connectionString: process.env.DATABASE_URL_OWNER,
    max: ownerMax,
    idleTimeoutMillis: serverless ? 1000 : 30000,
    connectionTimeoutMillis: 10000,
    ssl,
  });
  return { pool, ownerPool };
}

const pools = globalThis.__acuerdosPools ?? createPools();
// En serverless hay que reutilizar el pool entre invocaciones del mismo isolate;
// sin esto, reinicios del módulo pueden abrir pools adicionales.
globalThis.__acuerdosPools = pools;

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
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    // #region agent log
    const msg = err instanceof Error ? err.message : String(err);
    fetch("http://127.0.0.1:7597/ingest/70c41da7-0b62-46a0-b333-967b01b5a216", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d418f0" },
      body: JSON.stringify({
        sessionId: "d418f0",
        hypothesisId: "A",
        location: "web/lib/db.ts:withUser",
        message: "pool.connect failed",
        data: { code: (err as { code?: string })?.code ?? null, msg: msg.slice(0, 200) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    console.error("[db] pool.connect failed", { code: (err as { code?: string })?.code, msg: msg.slice(0, 200) });
    // #endregion
    throw err;
  }
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
