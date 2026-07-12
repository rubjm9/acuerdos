import Link from "next/link";
import { FolderOpen, Search, SearchX } from "lucide-react";
import { requireUser } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { hybridSearch } from "@/lib/search";
import { audit } from "@/lib/audit";
import { formatFecha, ACUERDO_ESTADOS, type AcuerdoEstado } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AreaBadges } from "@/components/area-badges";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Buscar" };

export default async function BusquedaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; area?: string; año?: string; estado?: string }>;
}) {
  const user = await requireUser();
  const { q = "", area, año, estado } = await searchParams;

  const [areas, years] = await Promise.all([
    queryAsUser<{ id: string; name: string }>(
      user.id,
      "SELECT id, name FROM areas WHERE is_active ORDER BY name"
    ),
    queryAsUser<{ año: number }>(
      user.id,
      "SELECT DISTINCT extract(year FROM fecha_adopcion)::int AS año FROM acuerdos ORDER BY año DESC"
    ),
  ]);

  const response = q
    ? await hybridSearch(user.id, q, {
        areaId: area || null,
        año: año ? Number(año) : null,
        estado: (estado as AcuerdoEstado) || null,
      })
    : null;

  if (q) {
    await audit(user.id, "search", "acuerdo", null, {
      metadata: { q, mode: response?.mode, n: response?.results.length ?? 0 },
    });
  }

  const selectClass =
    "border-input h-9 max-w-full rounded-md border bg-transparent px-3 text-sm shadow-xs";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buscar"
        description="Busca por tema, texto libre o referencia exacta (p. ej. ACU-2018-0142 o «acta 12/2020»)."
      />

      <form action="/busqueda" method="get" className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="¿Qué se decidió sobre…?"
              className="min-h-11 pl-10 text-base"
              autoFocus={!q}
              aria-label="Texto de búsqueda"
            />
          </div>
          <Button type="submit" className="min-h-11 px-5">
            Buscar
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="b-area">Área</label>
          <select id="b-area" name="area" defaultValue={area ?? ""} className={selectClass}>
            <option value="">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="b-año">Año</label>
          <select id="b-año" name="año" defaultValue={año ?? ""} className={selectClass}>
            <option value="">Todos los años</option>
            {years.map((y) => (
              <option key={y.año} value={y.año}>{y.año}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="b-estado">Estado</label>
          <select id="b-estado" name="estado" defaultValue={estado ?? ""} className={selectClass}>
            <option value="">Todos los estados</option>
            {Object.entries(ACUERDO_ESTADOS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </form>

      {!q ? (
        <EmptyState
          icon={Search}
          title="Busca en todo el histórico"
          description="Combina texto libre con los filtros de área, año y estado. Los resultados citan siempre el acta y la página de origen."
        />
      ) : response && response.results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          description="Prueba con otras palabras, revisa los filtros o busca por referencia exacta."
        />
      ) : response ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {response.results.length}{" "}
            {response.results.length === 1 ? "resultado" : "resultados"}
            {response.mode === "exact" ? " · coincidencia exacta" : ""}
          </p>
          <ul className="space-y-2">
            {response.results.map((r) => (
              <li key={r.acuerdo_id}>
                <div className="space-y-2.5 rounded-2xl border bg-card p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/acuerdos/${r.acuerdo_id}`}
                      className="min-w-0 text-sm font-medium leading-snug underline-offset-4 hover:underline"
                    >
                      {r.titulo}
                    </Link>
                    <StatusBadge estado={r.estado} className="shrink-0" />
                  </div>

                  {r.snippet && r.snippet !== r.titulo ? (
                    <p
                      className="text-sm leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: r.snippet }}
                    />
                  ) : null}

                  <div className="text-xs text-muted-foreground">
                    {r.public_ref} · {formatFecha(r.fecha_adopcion)} ·{" "}
                    <Link
                      href={`/actas/${r.acta_id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      Acta {r.acta_numero}/{r.acta_año}
                      {r.source_page ? `, pág. ${r.source_page}` : ""}
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <AreaBadges areas={r.areas ?? []} />
                    {r.expedientes?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.expedientes.map((e) => (
                          <Link
                            key={e.id}
                            href={`/expedientes/${e.id}`}
                            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-accent"
                          >
                            <FolderOpen className="size-3" aria-hidden />
                            {e.titulo}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
