import { Bell } from "lucide-react";
import { requireUser } from "@/lib/session";
import { withUser } from "@/lib/db";
import { formatFecha } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { PushToggle } from "@/components/push-toggle";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notificaciones" };

type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export default async function NotificacionesPage() {
  const user = await requireUser();
  // Cargar y marcar como leídas en la misma transacción
  const notifs = await withUser(user.id, async (c) => {
    const res = await c.query(
      `SELECT id, type, title, body, href, read_at, created_at
       FROM notifications ORDER BY created_at DESC LIMIT 50`
    );
    await c.query(`UPDATE notifications SET read_at = now() WHERE read_at IS NULL`);
    return res.rows as NotifRow[];
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notificaciones"
        description="Avisos sobre tareas, acuerdos e ingestas."
        action={<PushToggle vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />}
      />
      {notifs.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sin notificaciones"
          description="Cuando tengas recordatorios de tareas o avisos del sistema, aparecerán aquí."
        />
      ) : (
        <ul className="space-y-2">
          {notifs.map((n) => {
            const inner = (
              <div
                className={cn(
                  "rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors",
                  n.href && "hover:ring-ring/40",
                  !n.read_at && "border-primary/30 bg-accent/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.body ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                    ) : null}
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatFecha(n.created_at)}
                  </time>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.href ? <Link href={n.href}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
