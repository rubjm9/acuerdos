/** Se ejecuta una vez al arrancar el servidor: inicia los trabajos programados. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // pg-boss abre conexiones Session persistentes; en Vercel agota el pooler
    // de Supabase (EMAXCONNSESSION). Los recordatorios se pueden reactivar
    // con un Cron Job o DISABLE_JOBS=false en un entorno con Postgres dedicado.
    const skipJobs =
      process.env.DISABLE_JOBS === "true" ||
      (process.env.VERCEL === "1" && process.env.ENABLE_JOBS_ON_VERCEL !== "true");

    // #region agent log
    fetch("http://127.0.0.1:7597/ingest/70c41da7-0b62-46a0-b333-967b01b5a216", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d418f0" },
      body: JSON.stringify({
        sessionId: "d418f0",
        hypothesisId: "B",
        location: "web/instrumentation.ts:register",
        message: "jobs gate",
        data: {
          skipJobs,
          vercel: process.env.VERCEL ?? null,
          disableJobs: process.env.DISABLE_JOBS ?? null,
          enableOnVercel: process.env.ENABLE_JOBS_ON_VERCEL ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (skipJobs) {
      console.info("[jobs] omitido (serverless/Vercel o DISABLE_JOBS)");
      return;
    }
    const { startJobs } = await import("@/lib/jobs");
    await startJobs().catch((err) => console.error("[jobs] no se pudo iniciar pg-boss:", err));
  }
}
