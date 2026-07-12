import Link from "next/link";
import { Bell } from "lucide-react";
import { auth } from "@/lib/auth";
import { queryAsUser } from "@/lib/db";

/** Campana de notificaciones con contador de no leídas. */
export async function NotificationsBell() {
  const session = await auth();
  let unread = 0;
  if (session?.user?.id) {
    try {
      const rows = await queryAsUser<{ n: number }>(
        session.user.id,
        "SELECT count(*)::int AS n FROM notifications WHERE read_at IS NULL"
      );
      unread = rows[0]?.n ?? 0;
    } catch {
      unread = 0;
    }
  }
  return (
    <Link
      href="/notificaciones"
      aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
      className="relative flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 ? (
        <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
