/** Se ejecuta una vez al arrancar el servidor: inicia los trabajos programados. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startJobs } = await import("@/lib/jobs");
    await startJobs().catch((err) => console.error("[jobs] no se pudo iniciar pg-boss:", err));
  }
}
