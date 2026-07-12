import webpush from "web-push";
import { ownerPool } from "@/lib/db";

/**
 * Web Push (VAPID) autoalojado: los avisos llegan al móvil a través del
 * push service del navegador; el payload solo contiene título y enlace,
 * nunca contenido de áreas restringidas.
 */
const configured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(
    `mailto:${process.env.SMTP_FROM ?? "plataforma@localhost"}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export async function pushToUser(userId: string, title: string, body: string, href?: string) {
  if (!configured) return;
  const subs = await ownerPool.query(
    "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
    [userId]
  );
  const payload = JSON.stringify({ title, body, href });
  await Promise.all(
    subs.rows.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
      } catch (err: unknown) {
        // suscripción caducada → limpiar
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await ownerPool.query("DELETE FROM push_subscriptions WHERE id = $1", [s.id]);
        }
      }
    })
  );
}
