import Link from "next/link";
import { Gavel, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import {
  formatFecha,
  ACUERDO_ESTADOS,
  ACUERDO_TIPOS,
  type AcuerdoEstado,
  type AcuerdoTipo,
} from "@/lib/domain";
import { acuerdoTipoSql, acuerdoTipoFilterSql } from "@/lib/acuerdo-tipo";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { TipoBadge } from "@/components/tipo-badge";
import { AreaBadges, type AreaChip } from "@/components/area-badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Acuerdos" };

type AcuerdoRow = {
  id: string;
  public_ref: string;
  titulo: string;
  estado: AcuerdoEstado;
  tipo: AcuerdoTipo;
  fecha_adopcion: string;
  acta_numero: number;
  acta_año: number;
  source_page: number | null;
  areas: AreaChip[] | null;
};

export default async function AcuerdosPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; año?: string; estado?: string; tipo?: string }>;
}) {
  const user = await requireUser();
  const { area, año, estado, tipo } = await searchParams;

  const [areas, years, acuerdos] = await Promise.all([
    queryAsUser<{ id: string; name: string }>(
      user.id,
      "SELECT id, name FROM areas WHERE is_active ORDER BY name"
    ),
    queryAsUser<{ año: number }>(
      user.id,
      "SELECT DISTINCT extract(year FROM fecha_adopcion)::int AS año FROM acuerdos ORDER BY año DESC"
    ),
    queryAsUser<AcuerdoRow>(
      user.id,
      `SELECT ac.id, ac.public_ref, ac.titulo, ac.estado, ac.fecha_adopcion,
              a.numero AS acta_numero, a.año AS acta_año, ac.source_page,
              ${acuerdoTipoSql("ac")} AS tipo,
              (SELECT json_agg(json_build_object('id', ar.id, 'name', ar.name, 'is_restricted', ar.is_restricted) ORDER BY ar.name)
               FROM acuerdo_areas aa JOIN areas ar ON ar.id = aa.area_id
               WHERE aa.acuerdo_id = ac.id) AS areas
       FROM acuerdos ac
       JOIN actas a ON a.id = ac.acta_id
       WHERE ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM acuerdo_areas x WHERE x.acuerdo_id = ac.id AND x.area_id = $1::uuid))
         AND ($2::int IS NULL OR extract(year FROM ac.fecha_adopcion)::int = $2::int)
         AND ($3::acuerdo_estado IS NULL OR ac.estado = $3::acuerdo_estado)
         AND ${acuerdoTipoFilterSql(4, "ac")}
       ORDER BY ac.fecha_adopcion DESC, ac.public_ref DESC
       LIMIT 100`,
      [area || null, año ? Number(año) : null, estado || null, tipo || null]
    ),
  ]);

  const selectClass =
    "border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs max-w-full";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acuerdos"
        description="Decisiones formales adoptadas por la Asamblea, con su acta de origen."
        action={
          isSecretary(user) ? (
            <Button asChild>
              <Link href="/acuerdos/nuevo">
                <Plus className="size-4" aria-hidden /> Nuevo acuerdo
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Filtro por tipo (clasificación derivada) */}
      <div role="tablist" aria-label="Tipo de acuerdo" className="flex flex-wrap gap-1.5">
        {[{ v: "", l: "Todos" }, ...Object.entries(ACUERDO_TIPOS).map(([v, l]) => ({ v, l }))].map(
          (f) => {
            const params = new URLSearchParams();
            if (area) params.set("area", area);
            if (año) params.set("año", año);
            if (estado) params.set("estado", estado);
            if (f.v) params.set("tipo", f.v);
            const qs = params.toString();
            return (
              <Link
                key={f.v || "todos"}
                role="tab"
                aria-selected={(tipo ?? "") === f.v}
                href={qs ? `/acuerdos?${qs}` : "/acuerdos"}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                  (tipo ?? "") === f.v
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.l}
              </Link>
            );
          }
        )}
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-center gap-2" action="/acuerdos" method="get">
        {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
        <label className="sr-only" htmlFor="f-area">Filtrar por área</label>
        <select id="f-area" name="area" defaultValue={area ?? ""} className={selectClass}>
          <option value="">Todas las áreas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-año">Filtrar por año</label>
        <select id="f-año" name="año" defaultValue={año ?? ""} className={selectClass}>
          <option value="">Todos los años</option>
          {years.map((y) => (
            <option key={y.año} value={y.año}>{y.año}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-estado">Filtrar por estado</label>
        <select id="f-estado" name="estado" defaultValue={estado ?? ""} className={selectClass}>
          <option value="">Todos los estados</option>
          {Object.entries(ACUERDO_ESTADOS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
        {area || año || estado || tipo ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/acuerdos">Limpiar</Link>
          </Button>
        ) : null}
      </form>

      {acuerdos.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No hay acuerdos que coincidan"
          description="Ajusta los filtros, registra un acuerdo nuevo o incorpora el archivo histórico desde Ingesta."
        />
      ) : (
        <ul className="space-y-2">
          {acuerdos.map((ac) => (
            <li key={ac.id}>
              <Link
                href={`/acuerdos/${ac.id}`}
                className="block space-y-2 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-ring/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">{ac.titulo}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {ac.public_ref} · {formatFecha(ac.fecha_adopcion)} · Acta{" "}
                      {ac.acta_numero}/{ac.acta_año}
                      {ac.source_page ? `, pág. ${ac.source_page}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge estado={ac.estado} />
                    <TipoBadge tipo={ac.tipo} />
                  </div>
                </div>
                <AreaBadges areas={ac.areas ?? []} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {acuerdos.length === 100 ? (
        <p className="text-center text-xs text-muted-foreground">
          Se muestran los 100 más recientes. Usa los filtros o la búsqueda para acotar.
        </p>
      ) : null}
    </div>
  );
}
