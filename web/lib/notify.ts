import { ownerPool } from "@/lib/db";

/**
 * Notificaciones del sistema (creadas EN NOMBRE de otros usuarios, p. ej.
 * "te han asignado una tarea"), por lo que usan la conexión de sistema.
 * El contenido de la notificación nunca incluye texto de áreas restringidas.
 */
export async function notifyUser(
  userId: string,
  type: string,
  title: string,
  body?: string,
  href?: string
) {
  await ownerPool.query(
    `INSERT INTO notifications (user_id, type, title, body, href)
     VALUES ($1, $2::notification_type, $3, $4, $5)`,
    [userId, type, title, body ?? null, href ?? null]
  );
}

/** Notifica a todos los miembros activos de un comité. */
export async function notifyCommittee(
  committeeId: string,
  type: string,
  title: string,
  body?: string,
  href?: string
) {
  await ownerPool.query(
    `INSERT INTO notifications (user_id, type, title, body, href)
     SELECT cm.user_id, $2::notification_type, $3, $4, $5
     FROM committee_members cm
     JOIN users u ON u.id = cm.user_id AND u.is_active
     WHERE cm.committee_id = $1`,
    [committeeId, type, title, body ?? null, href ?? null]
  );
}
