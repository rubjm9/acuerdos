import Link from "next/link";
import { ArrowRight, CheckSquare, FolderOpen, Gavel, Search } from "lucide-react";
import { requireUser } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { formatFecha, type AcuerdoEstado, type TareaEstado } from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Inicio" };

type TareaRow = {
  id: string;
  titulo: string;
  estado: TareaEstado;
  fecha_vencimiento: string | null;
  acuerdo_ref: string;
  vencida: boolean;
};

type AcuerdoRow = {
  id: string;
  public_ref: string;
  titulo: string;
  estado: AcuerdoEstado;
  fecha_adopcion: string;
};

export default async function InicioPage() {
  const user = await requireUser();

  const [tareas, acuerdos, stats] = await Promise.all([
    queryAsUser<TareaRow>(
      user.id,
      `SELECT t.id, t.titulo, t.estado, t.fecha_vencimiento,
              a.public_ref AS acuerdo_ref,
              (t.fecha_vencimiento IS NOT NULL AND t.fecha_vencimiento < CURRENT_DATE) AS vencida
       FROM tareas t JOIN acuerdos a ON a.id = t.acuerdo_id
       WHERE t.estado IN ('abierta','en_progreso')
         AND (t.assignee_user_id = app_current_user_id()
              OR (t.assignee_committee_id IS NOT NULL AND app_in_committee(t.assignee_committee_id)))
       ORDER BY t.fecha_vencimiento NULLS LAST
       LIMIT 5`
    ),
    queryAsUser<AcuerdoRow>(
      user.id,
      `SELECT id, public_ref, titulo, estado, fecha_adopcion
       FROM acuerdos ORDER BY fecha_adopcion DESC, created_at DESC LIMIT 5`
    ),
    queryAsUser<{ acuerdos: number; expedientes: number; tareas_abiertas: number }>(
      user.id,
      `SELECT (SELECT count(*) FROM acuerdos)::int AS acuerdos,
              (SELECT count(*) FROM expedientes WHERE estado = 'abierto')::int AS expedientes,
              (SELECT count(*) FROM tareas WHERE estado IN ('abierta','en_progreso'))::int AS tareas_abiertas`
    ),
  ]);

  const s = stats[0];
  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="font-display text-[2rem] font-medium tracking-tight text-balance sm:text-4xl">
          Hola, {firstName}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Este es el estado actual del trabajo de la Asamblea.
        </p>
      </div>

      {/* Búsqueda destacada */}
      <Link
        href="/busqueda"
        className="flex min-h-12 items-center gap-3 rounded-xl bg-card px-4 text-muted-foreground ring-1 ring-foreground/10 transition-colors hover:text-foreground hover:ring-ring/40"
      >
        <Search className="size-4.5" aria-hidden />
        <span className="text-[15px]">Buscar acuerdos, actas, expedientes…</span>
      </Link>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Acuerdos", value: s?.acuerdos ?? 0, href: "/acuerdos", icon: Gavel },
          { label: "Expedientes abiertos", value: s?.expedientes ?? 0, href: "/expedientes", icon: FolderOpen },
          { label: "Tareas abiertas", value: s?.tareas_abiertas ?? 0, href: "/tareas", icon: CheckSquare },
        ].map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="lift group relative overflow-hidden rounded-xl bg-card p-5 pl-6 ring-1 ring-foreground/10 hover:ring-primary/30"
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-primary/80" aria-hidden />
            <m.icon className="size-4.5 text-primary/80" aria-hidden />
            <div className="mt-3 text-[1.75rem] font-semibold tabular-nums leading-none tracking-tight">
              {m.value}
            </div>
            <div className="mt-1.5 text-[13px] text-muted-foreground">{m.label}</div>
          </Link>
        ))}
      </div>

      {/* Mis tareas */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Mis tareas pendientes</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tareas">
                Ver todas <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {tareas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No tienes tareas pendientes.
            </p>
          ) : (
            <ul className="divide-y">
              {tareas.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tareas/${t.id}`}
                    className={`-mx-2 flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40 ${
                      t.vencida ? "border-l-2 border-status-anulado pl-3" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium">{t.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.acuerdo_ref}
                        {t.fecha_vencimiento
                          ? ` · vence ${formatFecha(t.fecha_vencimiento)}`
                          : ""}
                      </div>
                    </div>
                    <StatusBadge estado={t.vencida ? "vencida" : t.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Acuerdos recientes */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Acuerdos recientes</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/acuerdos">
                Ver todos <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {acuerdos.length === 0 ? (
            <EmptyState
              icon={Gavel}
              title="Aún no hay acuerdos"
              description="Cuando la Secretaría registre acuerdos o se complete una ingesta, aparecerán aquí."
              className="border-0 py-8"
            />
          ) : (
            <ul className="divide-y">
              {acuerdos.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/acuerdos/${a.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium">{a.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.public_ref} · {formatFecha(a.fecha_adopcion)}
                      </div>
                    </div>
                    <StatusBadge estado={a.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
