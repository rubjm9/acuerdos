import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Gavel, UserRound } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { formatFechaLarga, TAREA_ESTADOS, type TareaEstado } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cambiarEstadoTarea } from "../actions";

type TareaRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: TareaEstado;
  fecha_vencimiento: string | null;
  vencida: boolean;
  acuerdo_id: string;
  acuerdo_ref: string;
  acuerdo_titulo: string;
  assignee: string | null;
  is_mine: boolean;
};

/** Transiciones de estado disponibles según el estado actual. */
const TRANSICIONES: Record<TareaEstado, TareaEstado[]> = {
  abierta: ["en_progreso", "completada", "cancelada"],
  en_progreso: ["completada", "abierta", "cancelada"],
  completada: ["abierta"],
  vencida: ["en_progreso", "completada", "cancelada"],
  cancelada: ["abierta"],
};

export default async function TareaPage({ params }: PageProps<"/tareas/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  const rows = await queryAsUser<TareaRow>(
    user.id,
    `SELECT t.id, t.titulo, t.descripcion, t.estado, t.fecha_vencimiento,
            (t.fecha_vencimiento IS NOT NULL AND t.fecha_vencimiento < CURRENT_DATE
             AND t.estado IN ('abierta','en_progreso')) AS vencida,
            t.acuerdo_id, a.public_ref AS acuerdo_ref, a.titulo AS acuerdo_titulo,
            COALESCE(u.name, c.name) AS assignee,
            (t.assignee_user_id = app_current_user_id()
             OR (t.assignee_committee_id IS NOT NULL AND app_in_committee(t.assignee_committee_id))) AS is_mine
     FROM tareas t
     JOIN acuerdos a ON a.id = t.acuerdo_id
     LEFT JOIN users u ON u.id = t.assignee_user_id
     LEFT JOIN committees c ON c.id = t.assignee_committee_id
     WHERE t.id = $1`,
    [id]
  );

  const t = rows[0];
  if (!t) notFound();

  const canChange = t.is_mine || isSecretary(user);
  const transiciones = TRANSICIONES[t.estado] ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={t.titulo}
        meta={<StatusBadge estado={t.vencida ? "vencida" : t.estado} />}
      />

      <Card>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2.5">
            <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              Responsable: <span className="font-medium">{t.assignee ?? "Sin asignar"}</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              {t.fecha_vencimiento ? (
                <>
                  Vence el{" "}
                  <span className={t.vencida ? "font-medium text-status-anulado" : "font-medium"}>
                    {formatFechaLarga(t.fecha_vencimiento)}
                  </span>
                </>
              ) : (
                "Sin fecha límite"
              )}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Gavel className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              Deriva de{" "}
              <Link
                href={`/acuerdos/${t.acuerdo_id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t.acuerdo_ref}
              </Link>{" "}
              <span className="text-muted-foreground">— {t.acuerdo_titulo}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {t.descripcion ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed">
              {t.descripcion}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {canChange && transiciones.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actualizar estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {transiciones.map((estado) => (
                <form key={estado} action={cambiarEstadoTarea}>
                  <input type="hidden" name="tareaId" value={t.id} />
                  <input type="hidden" name="estado" value={estado} />
                  <Button
                    type="submit"
                    variant={estado === "completada" ? "default" : "outline"}
                    className="min-h-10"
                  >
                    {estado === "completada"
                      ? "Marcar como completada"
                      : `Pasar a «${TAREA_ESTADOS[estado].toLowerCase()}»`}
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
