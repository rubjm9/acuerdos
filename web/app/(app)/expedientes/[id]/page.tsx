import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckSquare, Download, FolderOpen, Gavel, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { formatFecha, toDateInput, type AcuerdoEstado, type TareaEstado } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  addAcuerdoToExpediente,
  removeAcuerdoFromExpediente,
  cambiarEstadoExpediente,
} from "../actions";

type ExpedienteRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: "abierto" | "cerrado";
  area_name: string | null;
};

/** Evento de la línea de tiempo: acuerdo o tarea, con su cita de origen. */
type TimelineEvent = {
  kind: "acuerdo" | "tarea";
  id: string;
  fecha: string;
  titulo: string;
  estado: AcuerdoEstado | TareaEstado;
  public_ref: string | null;
  acta_id: string | null;
  acta_numero: number | null;
  acta_año: number | null;
  source_page: number | null;
  assignee: string | null;
  acuerdo_id: string | null;
};

export default async function ExpedientePage({ params }: PageProps<"/expedientes/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  const [expedientes, eventos] = await Promise.all([
    queryAsUser<ExpedienteRow>(
      user.id,
      `SELECT e.id, e.titulo, e.descripcion, e.estado, a.name AS area_name
       FROM expedientes e LEFT JOIN areas a ON a.id = e.primary_area_id
       WHERE e.id = $1`,
      [id]
    ),
    queryAsUser<TimelineEvent>(
      user.id,
      `SELECT 'acuerdo' AS kind, ac.id, ac.fecha_adopcion AS fecha, ac.titulo,
              ac.estado::text AS estado, ac.public_ref,
              ac.acta_id, a.numero AS acta_numero, a.año AS acta_año, ac.source_page,
              NULL AS assignee, ac.id AS acuerdo_id
       FROM expediente_acuerdos ea
       JOIN acuerdos ac ON ac.id = ea.acuerdo_id
       JOIN actas a ON a.id = ac.acta_id
       WHERE ea.expediente_id = $1
       UNION ALL
       SELECT 'tarea', t.id, COALESCE(t.fecha_vencimiento, t.created_at::date), t.titulo,
              t.estado::text, NULL, NULL, NULL, NULL, NULL,
              COALESCE(u.name, c.name), t.acuerdo_id
       FROM expediente_acuerdos ea
       JOIN tareas t ON t.acuerdo_id = ea.acuerdo_id
       LEFT JOIN users u ON u.id = t.assignee_user_id
       LEFT JOIN committees c ON c.id = t.assignee_committee_id
       WHERE ea.expediente_id = $1
       ORDER BY fecha, kind`,
      [id]
    ),
  ]);

  const exp = expedientes[0];
  if (!exp) notFound();
  const secretary = isSecretary(user);

  // Agrupar por año para la línea de tiempo
  const porAño = new Map<number, TimelineEvent[]>();
  for (const ev of eventos) {
    const año = new Date(ev.fecha).getFullYear();
    if (!porAño.has(año)) porAño.set(año, []);
    porAño.get(año)!.push(ev);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={exp.titulo}
        description={exp.descripcion ?? undefined}
        meta={
          <>
            {exp.estado === "cerrado" ? <Badge variant="secondary">Cerrado</Badge> : null}
            {exp.area_name ? <Badge variant="outline">{exp.area_name}</Badge> : null}
          </>
        }
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <a href={`/api/informes/expediente/${exp.id}?formato=pdf`}>
                <Download className="size-4" aria-hidden /> Exportar
              </a>
            </Button>
            {secretary ? (
              <form action={cambiarEstadoExpediente}>
                <input type="hidden" name="expedienteId" value={exp.id} />
                <input
                  type="hidden"
                  name="estado"
                  value={exp.estado === "abierto" ? "cerrado" : "abierto"}
                />
                <Button type="submit" variant="ghost">
                  {exp.estado === "abierto" ? "Cerrar expediente" : "Reabrir"}
                </Button>
              </form>
            ) : null}
          </div>
        }
      />

      {secretary ? (
        <form
          action={addAcuerdoToExpediente}
          className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row sm:items-end"
        >
          <input type="hidden" name="expedienteId" value={exp.id} />
          <div className="flex-1 space-y-1">
            <Label htmlFor="add-ref" className="text-xs">
              Añadir acuerdo por referencia
            </Label>
            <Input id="add-ref" name="acuerdoRef" placeholder="ACU-2015-0007" required />
          </div>
          <Button type="submit" variant="outline" className="min-h-9">
            <Plus className="size-4" aria-hidden /> Añadir al expediente
          </Button>
        </form>
      ) : null}

      {eventos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <FolderOpen className="mx-auto mb-3 size-6" aria-hidden />
            Este expediente aún no tiene acuerdos. Añádelos por su referencia para construir la
            línea de tiempo.
          </CardContent>
        </Card>
      ) : (
        <ol className="relative space-y-0">
          {[...porAño.entries()].map(([año, evs]) => (
            <li key={año}>
              <div className="sticky top-14 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur md:top-16">
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {año}
                </span>
              </div>
              <ol className="ml-2 space-y-3 border-l-2 border-border pb-6 pl-5">
                {evs.map((ev) => (
                  <li key={`${ev.kind}-${ev.id}`} className="relative">
                    <span
                      className={`absolute -left-[27px] top-4 size-3 rounded-full border-2 border-background ${
                        ev.kind === "acuerdo" ? "bg-primary" : "bg-muted-foreground/50"
                      }`}
                      aria-hidden
                    />
                    <div className="rounded-2xl border bg-card p-4 shadow-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {ev.kind === "acuerdo" ? (
                              <Gavel className="size-3.5" aria-hidden />
                            ) : (
                              <CheckSquare className="size-3.5" aria-hidden />
                            )}
                            <time dateTime={toDateInput(ev.fecha)}>
                              {formatFecha(ev.fecha)}
                            </time>
                            {ev.kind === "tarea" && ev.assignee ? (
                              <span>· {ev.assignee}</span>
                            ) : null}
                          </div>
                          <Link
                            href={
                              ev.kind === "acuerdo" ? `/acuerdos/${ev.id}` : `/tareas/${ev.id}`
                            }
                            className="mt-1 block text-sm font-medium leading-snug underline-offset-4 hover:underline"
                          >
                            {ev.titulo}
                          </Link>
                          {ev.kind === "acuerdo" ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {ev.public_ref} ·{" "}
                              <Link
                                href={`/actas/${ev.acta_id}`}
                                className="underline-offset-4 hover:underline"
                              >
                                Acta {ev.acta_numero}/{ev.acta_año}
                                {ev.source_page ? `, pág. ${ev.source_page}` : ""}
                              </Link>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <StatusBadge estado={ev.estado} />
                          {secretary && ev.kind === "acuerdo" ? (
                            <form action={removeAcuerdoFromExpediente}>
                              <input type="hidden" name="expedienteId" value={exp.id} />
                              <input type="hidden" name="acuerdoId" value={ev.id} />
                              <button
                                type="submit"
                                className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                              >
                                Quitar
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
