import Link from "next/link";
import { CheckSquare, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { formatFecha, type TareaEstado } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tareas" };

type TareaRow = {
  id: string;
  titulo: string;
  estado: TareaEstado;
  fecha_vencimiento: string | null;
  vencida: boolean;
  acuerdo_ref: string;
  assignee: string | null;
};

const VISTAS = [
  { key: "mias", label: "Mis tareas" },
  { key: "todas", label: "Todas" },
  { key: "vencidas", label: "Vencidas" },
  { key: "completadas", label: "Completadas" },
] as const;

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; area?: string; asignado?: string }>;
}) {
  const user = await requireUser();
  const { vista = "mias", area, asignado } = await searchParams;

  const [areas, asignables, tareas] = await Promise.all([
    queryAsUser<{ id: string; name: string }>(
      user.id,
      "SELECT id, name FROM areas WHERE is_active ORDER BY name"
    ),
    queryAsUser<{ key: string; name: string }>(
      user.id,
      `SELECT 'u:' || id AS key, name FROM users WHERE is_active
       UNION ALL SELECT 'c:' || id, name FROM committees WHERE is_active
       ORDER BY name`
    ),
    queryAsUser<TareaRow>(
      user.id,
      `SELECT t.id, t.titulo, t.estado, t.fecha_vencimiento,
              (t.fecha_vencimiento IS NOT NULL AND t.fecha_vencimiento < CURRENT_DATE
               AND t.estado IN ('abierta','en_progreso')) AS vencida,
              a.public_ref AS acuerdo_ref,
              COALESCE(u.name, c.name) AS assignee
       FROM tareas t
       JOIN acuerdos a ON a.id = t.acuerdo_id
       LEFT JOIN users u ON u.id = t.assignee_user_id
       LEFT JOIN committees c ON c.id = t.assignee_committee_id
       WHERE
         CASE $1
           WHEN 'mias' THEN t.estado IN ('abierta','en_progreso')
             AND (t.assignee_user_id = app_current_user_id()
                  OR (t.assignee_committee_id IS NOT NULL AND app_in_committee(t.assignee_committee_id)))
           WHEN 'vencidas' THEN t.estado IN ('abierta','en_progreso')
             AND t.fecha_vencimiento IS NOT NULL AND t.fecha_vencimiento < CURRENT_DATE
           WHEN 'completadas' THEN t.estado IN ('completada','cancelada')
           ELSE t.estado IN ('abierta','en_progreso')
         END
         AND ($2::uuid IS NULL OR EXISTS (
              SELECT 1 FROM acuerdo_areas aa WHERE aa.acuerdo_id = t.acuerdo_id AND aa.area_id = $2::uuid))
         AND ($3::text IS NULL
              OR ($3 LIKE 'u:%' AND t.assignee_user_id::text = substring($3 from 3))
              OR ($3 LIKE 'c:%' AND t.assignee_committee_id::text = substring($3 from 3)))
       ORDER BY t.fecha_vencimiento NULLS LAST, t.created_at DESC
       LIMIT 100`,
      [vista, area || null, asignado || null]
    ),
  ]);

  function href(v: string) {
    const p = new URLSearchParams();
    if (v !== "mias") p.set("vista", v);
    if (area) p.set("area", area);
    if (asignado) p.set("asignado", asignado);
    const qs = p.toString();
    return qs ? `/tareas?${qs}` : "/tareas";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tareas"
        description="Encargos derivados de los acuerdos, con responsable y vencimiento."
        action={
          isSecretary(user) ? (
            <Button asChild>
              <Link href="/tareas/nueva">
                <Plus className="size-4" aria-hidden /> Nueva tarea
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Vistas */}
      <div role="tablist" aria-label="Vistas de tareas" className="flex flex-wrap gap-1.5">
        {VISTAS.map((v) => (
          <Link
            key={v.key}
            role="tab"
            aria-selected={vista === v.key}
            href={href(v.key)}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
              vista === v.key
                ? "border-primary/40 bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-center gap-2" action="/tareas" method="get">
        <input type="hidden" name="vista" value={vista} />
        <label className="sr-only" htmlFor="t-area">Filtrar por área</label>
        <select
          id="t-area"
          name="area"
          defaultValue={area ?? ""}
          className="border-input h-9 max-w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="">Todas las áreas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="t-asignado">Filtrar por asignado</label>
        <select
          id="t-asignado"
          name="asignado"
          defaultValue={asignado ?? ""}
          className="border-input h-9 max-w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="">Cualquier responsable</option>
          {asignables.map((a) => (
            <option key={a.key} value={a.key}>{a.name}</option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
      </form>

      {tareas.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={vista === "mias" ? "No tienes tareas pendientes" : "No hay tareas en esta vista"}
          description="Las tareas se crean desde un acuerdo o desde el botón «Nueva tarea»."
        />
      ) : (
        <ul className="space-y-2">
          {tareas.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tareas/${t.id}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-ring/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.titulo}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t.acuerdo_ref} · {t.assignee ?? "Sin asignar"}
                    {t.fecha_vencimiento ? ` · vence ${formatFecha(t.fecha_vencimiento)}` : ""}
                  </div>
                </div>
                <StatusBadge estado={t.vencida ? "vencida" : t.estado} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
