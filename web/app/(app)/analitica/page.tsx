import Link from "next/link";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import {
  ACUERDO_ESTADOS,
  formatFecha,
  type AcuerdoEstado,
} from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { BarList, type BarItem } from "@/components/bar-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Analítica" };

const ESTADO_BAR: Record<AcuerdoEstado, string> = {
  en_vigor: "bg-status-vigor",
  en_curso: "bg-status-curso",
  cumplido: "bg-status-cumplido",
  superado: "bg-status-superado",
  anulado: "bg-status-anulado",
};

type EstadoRow = { estado: AcuerdoEstado; n: number };
type AreaRow = {
  name: string;
  is_restricted: boolean;
  n_acuerdos: number;
  tareas_abiertas: number;
  tareas_vencidas: number;
  pct_completadas: number | null;
};
type ResponsableRow = { responsable: string; abiertas: number; vencidas: number };
type EstancadoRow = {
  id: string;
  public_ref: string;
  titulo: string;
  fecha_adopcion: string;
  meses: number;
};

export default async function AnaliticaPage() {
  const user = await requireUser();

  const [estados, areas, responsables, estancados, tareaResumen] = await Promise.all([
    queryAsUser<EstadoRow>(
      user.id,
      `SELECT estado, count(*)::int AS n FROM acuerdos GROUP BY estado`
    ),
    queryAsUser<AreaRow>(
      user.id,
      `SELECT ar.name, ar.is_restricted,
              count(DISTINCT ac.id)::int AS n_acuerdos,
              count(DISTINCT t.id) FILTER (WHERE t.estado IN ('abierta','en_progreso'))::int AS tareas_abiertas,
              count(DISTINCT t.id) FILTER (
                WHERE t.estado IN ('abierta','en_progreso')
                  AND t.fecha_vencimiento IS NOT NULL AND t.fecha_vencimiento < CURRENT_DATE
              )::int AS tareas_vencidas,
              CASE WHEN count(DISTINCT t.id) = 0 THEN NULL
                   ELSE round(100.0 * count(DISTINCT t.id) FILTER (WHERE t.estado = 'completada')
                        / count(DISTINCT t.id)) END AS pct_completadas
       FROM areas ar
       JOIN acuerdo_areas aa ON aa.area_id = ar.id
       JOIN acuerdos ac ON ac.id = aa.acuerdo_id
       LEFT JOIN tareas t ON t.acuerdo_id = ac.id
       WHERE ar.is_active
       GROUP BY ar.id, ar.name, ar.is_restricted
       ORDER BY n_acuerdos DESC`
    ),
    queryAsUser<ResponsableRow>(
      user.id,
      `SELECT COALESCE(u.name, c.name, 'Sin asignar') AS responsable,
              count(*) FILTER (WHERE t.estado IN ('abierta','en_progreso'))::int AS abiertas,
              count(*) FILTER (
                WHERE t.estado IN ('abierta','en_progreso')
                  AND t.fecha_vencimiento IS NOT NULL AND t.fecha_vencimiento < CURRENT_DATE
              )::int AS vencidas
       FROM tareas t
       LEFT JOIN users u ON u.id = t.assignee_user_id
       LEFT JOIN committees c ON c.id = t.assignee_committee_id
       GROUP BY responsable
       HAVING count(*) FILTER (WHERE t.estado IN ('abierta','en_progreso')) > 0
       ORDER BY abiertas DESC
       LIMIT 12`
    ),
    // Acuerdos "en curso" adoptados hace más de 12 meses sin resolver
    queryAsUser<EstancadoRow>(
      user.id,
      `SELECT id, public_ref, titulo, fecha_adopcion,
              (extract(year FROM age(CURRENT_DATE, fecha_adopcion)) * 12
               + extract(month FROM age(CURRENT_DATE, fecha_adopcion)))::int AS meses
       FROM acuerdos
       WHERE estado = 'en_curso' AND fecha_adopcion < CURRENT_DATE - interval '12 months'
       ORDER BY fecha_adopcion
       LIMIT 10`
    ),
    queryAsUser<{ abiertas: number; vencidas: number; completadas: number }>(
      user.id,
      `SELECT count(*) FILTER (WHERE estado IN ('abierta','en_progreso'))::int AS abiertas,
              count(*) FILTER (WHERE estado IN ('abierta','en_progreso')
                    AND fecha_vencimiento < CURRENT_DATE)::int AS vencidas,
              count(*) FILTER (WHERE estado = 'completada')::int AS completadas
       FROM tareas`
    ),
  ]);

  const estadoMap = new Map(estados.map((e) => [e.estado, e.n]));
  const estadoBars: BarItem[] = (Object.keys(ACUERDO_ESTADOS) as AcuerdoEstado[]).map((e) => ({
    label: ACUERDO_ESTADOS[e],
    value: estadoMap.get(e) ?? 0,
    barClass: ESTADO_BAR[e],
  }));

  const areaBars: BarItem[] = areas.map((a) => ({
    label: a.name,
    value: a.n_acuerdos,
  }));

  const t = tareaResumen[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analítica"
        description="Seguimiento del estado de los acuerdos y de las tareas por área y responsable."
      />

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Acuerdos", value: estados.reduce((s, e) => s + e.n, 0) },
          { label: "En curso", value: estadoMap.get("en_curso") ?? 0 },
          { label: "Tareas abiertas", value: t?.abiertas ?? 0 },
          { label: "Tareas vencidas", value: t?.vencidas ?? 0, alert: (t?.vencidas ?? 0) > 0 },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border bg-card p-4 shadow-xs">
            <div
              className={`text-2xl font-semibold tabular-nums tracking-tight ${
                m.alert ? "text-status-anulado" : ""
              }`}
            >
              {m.value}
            </div>
            <div className="text-xs text-muted-foreground">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acuerdos por estado</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={estadoBars} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acuerdos por área</CardTitle>
            <CardDescription>Áreas con más decisiones registradas.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={areaBars.slice(0, 10)} emptyLabel="Aún no hay acuerdos por área." />
          </CardContent>
        </Card>
      </div>

      {/* Acuerdos estancados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-status-curso" aria-hidden />
            Acuerdos en curso sin resolver
          </CardTitle>
          <CardDescription>
            En curso y adoptados hace más de un año. Candidatos a revisión o cierre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estancados.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No hay acuerdos en curso con más de un año de antigüedad.
            </p>
          ) : (
            <ul className="divide-y">
              {estancados.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/acuerdos/${e.id}`}
                    className="-mx-2 flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{e.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.public_ref} · {formatFecha(e.fecha_adopcion)}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-status-curso-bg px-2.5 py-0.5 text-xs font-medium text-status-curso">
                      {e.meses} meses
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Seguimiento por área */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
            Seguimiento por área
          </CardTitle>
          <CardDescription>Cumplimiento de las tareas derivadas de cada área.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-140 text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-6 py-2 font-medium">Área</th>
                  <th className="px-3 py-2 text-right font-medium">Acuerdos</th>
                  <th className="px-3 py-2 text-right font-medium">Tareas abiertas</th>
                  <th className="px-3 py-2 text-right font-medium">Vencidas</th>
                  <th className="px-6 py-2 text-right font-medium">% completadas</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td className="px-6 py-2.5 font-medium">{a.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{a.n_acuerdos}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{a.tareas_abiertas}</td>
                    <td
                      className={`px-3 py-2.5 text-right tabular-nums ${
                        a.tareas_vencidas > 0 ? "font-semibold text-status-anulado" : ""
                      }`}
                    >
                      {a.tareas_vencidas}
                    </td>
                    <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground">
                      {a.pct_completadas === null ? "—" : `${a.pct_completadas}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Carga por responsable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carga por responsable</CardTitle>
          <CardDescription>Tareas abiertas por persona y comité (con vencidas).</CardDescription>
        </CardHeader>
        <CardContent>
          {responsables.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No hay tareas abiertas.</p>
          ) : (
            <ul className="space-y-2.5">
              {responsables.map((r) => {
                const max = Math.max(1, ...responsables.map((x) => x.abiertas));
                return (
                  <li key={r.responsable} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{r.responsable}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-semibold">{r.abiertas}</span>
                        {r.vencidas > 0 ? (
                          <span className="text-status-anulado"> · {r.vencidas} vencidas</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-status-anulado"
                        style={{ width: `${Math.round((r.vencidas / max) * 100)}%` }}
                      />
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${Math.round(((r.abiertas - r.vencidas) / max) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
