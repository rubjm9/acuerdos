/** Se ejecuta una vez al arrancar el servidor: inicia los trabajos programados. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // pg-boss abre conexiones Session persistentes; en Vercel agota el pooler
    // de Supabase. Los recordatorios se pueden reactivar con un Cron Job o
    // ENABLE_JOBS_ON_VERCEL=true en un entorno con Postgres dedicado.
    const skipJobs =
      process.env.DISABLE_JOBS === "true" ||
      (process.env.VERCEL === "1" && process.env.ENABLE_JOBS_ON_VERCEL !== "true");

    if (skipJobs) {
      console.info("[jobs] omitido (serverless/Vercel o DISABLE_JOBS)");
      return;
    }
    const { startJobs } = await import("@/lib/jobs");
    await startJobs().catch((err) => console.error("[jobs] no se pudo iniciar pg-boss:", err));
  }
}
