import { PgBoss } from "pg-boss";
import { ownerPool } from "@/lib/db";
import { notifyUser, notifyCommittee } from "@/lib/notify";
import { sendMail } from "@/lib/mailer";
import { pushToUser } from "@/lib/push";

/**
 * Trabajos programados (pg-boss sobre Postgres, sin broker adicional):
 *  - recordatorios de tareas que vencen en 3 días o mañana
 *  - aviso de tareas vencidas (y marcado de estado)
 * Corre a diario a las 07:00 (Europe/Madrid).
 */

const REMINDERS_QUEUE = "task-reminders";

type TareaPendiente = {
  id: string;
  titulo: string;
  fecha_vencimiento: string;
  assignee_user_id: string | null;
  assignee_committee_id: string | null;
  email: string | null;
  dias: number;
};

async function processReminders() {
  // 1) próximas a vencer (3 días o menos), sin recordatorio en las últimas 48 h
  const proximas = await ownerPool.query<TareaPendiente>(
    `SELECT t.id, t.titulo, t.fecha_vencimiento, t.assignee_user_id, t.assignee_committee_id,
            u.email, (t.fecha_vencimiento - CURRENT_DATE) AS dias
     FROM tareas t
     LEFT JOIN users u ON u.id = t.assignee_user_id AND u.is_active
     WHERE t.estado IN ('abierta','en_progreso')
       AND t.fecha_vencimiento IS NOT NULL
       AND t.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 3
       AND (t.reminder_sent_at IS NULL OR t.reminder_sent_at < now() - interval '48 hours')`
  );

  for (const t of proximas.rows) {
    const cuando =
      t.dias <= 0 ? "hoy" : t.dias === 1 ? "mañana" : `en ${t.dias} días`;
    const title = `La tarea vence ${cuando}`;
    if (t.assignee_user_id) {
      await notifyUser(t.assignee_user_id, "tarea_recordatorio", title, t.titulo, `/tareas/${t.id}`);
      if (t.email) await sendMail(t.email, title, t.titulo, `/tareas/${t.id}`);
      await pushToUser(t.assignee_user_id, title, t.titulo, `/tareas/${t.id}`);
    } else if (t.assignee_committee_id) {
      await notifyCommittee(t.assignee_committee_id, "tarea_recordatorio", title, t.titulo, `/tareas/${t.id}`);
    }
    await ownerPool.query("UPDATE tareas SET reminder_sent_at = now() WHERE id = $1", [t.id]);
  }

  // 2) vencidas sin aviso: marcar y notificar una única vez
  const vencidas = await ownerPool.query<TareaPendiente>(
    `SELECT t.id, t.titulo, t.fecha_vencimiento, t.assignee_user_id, t.assignee_committee_id,
            u.email, 0 AS dias
     FROM tareas t
     LEFT JOIN users u ON u.id = t.assignee_user_id AND u.is_active
     WHERE t.estado IN ('abierta','en_progreso')
       AND t.fecha_vencimiento IS NOT NULL
       AND t.fecha_vencimiento < CURRENT_DATE
       AND t.overdue_notified_at IS NULL`
  );

  for (const t of vencidas.rows) {
    const title = "Tarea vencida";
    if (t.assignee_user_id) {
      await notifyUser(t.assignee_user_id, "tarea_vencida", title, t.titulo, `/tareas/${t.id}`);
      if (t.email) await sendMail(t.email, title, t.titulo, `/tareas/${t.id}`);
      await pushToUser(t.assignee_user_id, title, t.titulo, `/tareas/${t.id}`);
    } else if (t.assignee_committee_id) {
      await notifyCommittee(t.assignee_committee_id, "tarea_vencida", title, t.titulo, `/tareas/${t.id}`);
    }
    await ownerPool.query(
      "UPDATE tareas SET estado = 'vencida', overdue_notified_at = now() WHERE id = $1",
      [t.id]
    );
  }

  return { proximas: proximas.rowCount, vencidas: vencidas.rowCount };
}

let boss: PgBoss | null = null;

/** Arranque único desde instrumentation.ts. */
export async function startJobs() {
  if (boss) return;
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) return;
  boss = new PgBoss({ connectionString: url, schema: "pgboss" });
  boss.on("error", (err: Error) => console.error("[pg-boss]", err));
  await boss.start();
  await boss.createQueue(REMINDERS_QUEUE);
  await boss.schedule(REMINDERS_QUEUE, "0 7 * * *", undefined, {
    tz: "Europe/Madrid",
  });
  await boss.work(REMINDERS_QUEUE, async () => {
    const res = await processReminders();
    console.log(`[recordatorios] próximas=${res.proximas} vencidas=${res.vencidas}`);
  });
}

/** Ejecución manual (verificación / administración). */
export { processReminders };
