"use client";

import { useRouter } from "next/navigation";
import { Library } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, multiSelectFilter, type FacetedFilter } from "@/components/ui/data-table";
import { EntityCard, MetaDot } from "@/components/ui/entity-card";
import { Badge } from "@/components/ui/badge";
import { POLITICA_ESTADOS, type PoliticaEstado } from "@/lib/domain";

export type PoliticaRow = {
  id: string;
  public_ref: string;
  titulo: string;
  resumen: string | null;
  estado: PoliticaEstado;
  area_name: string | null;
  n_acuerdos: number;
};

function EstadoBadge({ estado }: { estado: PoliticaEstado }) {
  const cls: Record<PoliticaEstado, string> = {
    vigente: "bg-status-cumplido-bg text-status-cumplido",
    en_revision: "bg-status-curso-bg text-status-curso",
    derogada: "bg-status-anulado-bg text-status-anulado",
  };
  return <Badge className={cls[estado]}>{POLITICA_ESTADOS[estado]}</Badge>;
}

const columns: ColumnDef<PoliticaRow, unknown>[] = [
  {
    accessorKey: "titulo",
    header: "Política",
    enableHiding: false,
    meta: { label: "Política" },
    cell: ({ row }) => (
      <div className="min-w-0 max-w-md">
        <div className="truncate font-medium leading-snug">{row.original.titulo}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground tabnum">
          {row.original.public_ref}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "estado",
    header: "Estado",
    meta: { label: "Estado" },
    filterFn: multiSelectFilter,
    cell: ({ row }) => <EstadoBadge estado={row.original.estado} />,
  },
  {
    id: "area_name",
    accessorFn: (r) => r.area_name ?? "—",
    header: "Área",
    meta: { label: "Área" },
    filterFn: multiSelectFilter,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.area_name ?? "—"}</span>
    ),
  },
  {
    accessorKey: "n_acuerdos",
    header: "Acuerdos",
    meta: { label: "Acuerdos" },
    cell: ({ row }) => <span className="text-muted-foreground tabnum">{row.original.n_acuerdos}</span>,
  },
];

export function PoliticasView({ rows }: { rows: PoliticaRow[] }) {
  const router = useRouter();

  const areaOptions = Array.from(new Set(rows.map((r) => r.area_name ?? "—")))
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((v) => ({ value: v, label: v }));

  const facets: FacetedFilter[] = [
    {
      columnId: "estado",
      title: "Estado",
      options: Object.entries(POLITICA_ESTADOS).map(([value, label]) => ({ value, label })),
    },
    { columnId: "area_name", title: "Área", options: areaOptions },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      searchPlaceholder="Filtrar políticas…"
      facetedFilters={facets}
      initialSorting={[{ id: "titulo", desc: false }]}
      onRowClick={(r) => router.push(`/politicas/${r.id}`)}
      emptyMessage="No hay políticas que coincidan con los filtros."
      defaultView="grid"
      viewStorageKey="politicas"
      renderCard={(r) => (
        <EntityCard
          icon={Library}
          eyebrow={r.public_ref}
          title={r.titulo}
          description={r.resumen ?? undefined}
          badge={<EstadoBadge estado={r.estado} />}
          meta={
            <>
              <span className="tabnum">
                {r.n_acuerdos} {r.n_acuerdos === 1 ? "acuerdo" : "acuerdos"}
              </span>
              {r.area_name ? (
                <>
                  <MetaDot />
                  <span className="truncate">{r.area_name}</span>
                </>
              ) : null}
            </>
          }
        />
      )}
    />
  );
}
