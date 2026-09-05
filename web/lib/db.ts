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

/**
 * Session pooler (5432) = 1 cliente ≈ 1 backend; en Free ~15 clientes totales.
 * Transaction pooler (6543) multiplexa muchas peticiones cortas: apto para
 * Vercel. Nuestra app ya usa BEGIN + set_config(..., true) + COMMIT, así que
 * SET LOCAL es compatible con Transaction mode.
 */
function preferTransactionPooler(url: string | undefined): {
  url: string | undefined;
  rewritten: boolean;
  mode: "transaction" | "session" | "direct" | "unknown";
} {
  if (!url) return { url, rewritten: false, mode: "unknown" };
  try {
    const u = new URL(url);
    const isPooler = /pooler\.supabase\.com$/i.test(u.hostname);
    if (!isPooler) {
      return { url, rewritten: false, mode: /supabase\.(co|com)/i.test(u.hostname) ? "direct" : "unknown" };
    }
    if (u.port === "6543") {
      return { url, rewritten: false, mode: "transaction" };
    }
    // 5432 o sin puerto explícito en pooler → Session; forzar Transaction.
    if (u.port === "5432" || u.port === "") {
      u.port = "6543";
      return { url: u.toString(), rewritten: true, mode: "transaction" };
    }
    return { url, rewritten: false, mode: "session" };
  } catch {
    return { url, rewritten: false, mode: "unknown" };
  }
}

function createPools() {
  // Supabase (y casi todo Postgres gestionado) exige TLS desde Vercel.
  const useSsl =
    process.env.DATABASE_SSL === "true" ||
    process.env.DATABASE_SSL === "1" ||
    /supabase\.(co|com)/i.test(process.env.DATABASE_URL ?? "") ||
    /supabase\.(co|com)/i.test(process.env.DATABASE_URL_OWNER ?? "");

  const ssl = useSsl ? { rejectUnauthorized: false } : undefined;

  const appUrl = preferTransactionPooler(process.env.DATABASE_URL);
  const ownerUrl = preferTransactionPooler(process.env.DATABASE_URL_OWNER);

  const serverless = process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  // En serverless sigue siendo mejor un pool mínimo por isolate.
  const poolMax = serverless ? 1 : 10;
  const ownerMax = serverless ? 1 : 3;
  const idleMs = serverless ? 1000 : 30000;

  // #region agent log
  fetch("http://127.0.0.1:7597/ingest/70c41da7-0b62-46a0-b333-967b01b5a216", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d418f0" },
    body: JSON.stringify({
      sessionId: "d418f0",
      runId: "txn-pooler",
      hypothesisId: "H",
      location: "web/lib/db.ts:createPools",
      message: "pool config",
      data: {
        serverless,
        poolMax,
        ownerMax,
        appMode: appUrl.mode,
        ownerMode: ownerUrl.mode,
        appRewritten: appUrl.rewritten,
        ownerRewritten: ownerUrl.rewritten,
        vercel: process.env.VERCEL ?? null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  console.info("[db] pool config", {
    serverless,
    poolMax,
    ownerMax,
    appMode: appUrl.mode,
    ownerMode: ownerUrl.mode,
    appRewritten: appUrl.rewritten,
    ownerRewritten: ownerUrl.rewritten,
  });
  // #endregion

  const pool = new Pool({
    connectionString: appUrl.url,
    max: poolMax,
    idleTimeoutMillis: idleMs,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: serverless,
    ssl,
  });
  const ownerPool = new Pool({
    connectionString: ownerUrl.url,
    max: ownerMax,
    idleTimeoutMillis: idleMs,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: serverless,
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
        hypothesisId: "H",
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
