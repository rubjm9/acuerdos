"use client";

import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, multiSelectFilter, type FacetedFilter } from "@/components/ui/data-table";
import { EntityCard, MetaDot } from "@/components/ui/entity-card";
import { Badge } from "@/components/ui/badge";
import { formatFecha, EXPEDIENTE_ESTADOS } from "@/lib/domain";

export type ExpedienteRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: "abierto" | "cerrado";
  area_name: string | null;
  n_acuerdos: number;
  desde: string | null;
  hasta: string | null;
};

function periodo(r: ExpedienteRow): string {
  if (!r.desde || !r.hasta) return "—";
  return r.desde === r.hasta
    ? formatFecha(r.desde)
    : `${formatFecha(r.desde)} — ${formatFecha(r.hasta)}`;
}

function EstadoBadge({ estado }: { estado: ExpedienteRow["estado"] }) {
  return estado === "abierto" ? (
    <Badge className="bg-status-vigor-bg text-status-vigor">Abierto</Badge>
  ) : (
    <Badge variant="secondary">Cerrado</Badge>
  );
}

const columns: ColumnDef<ExpedienteRow, unknown>[] = [
  {
    accessorKey: "titulo",
    header: "Expediente",
    enableHiding: false,
    meta: { label: "Expediente" },
    cell: ({ row }) => (
      <div className="min-w-0 max-w-md">
        <div className="truncate font-medium leading-snug">{row.original.titulo}</div>
        {row.original.descripcion ? (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.original.descripcion}
          </div>
        ) : null}
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
  {
    id: "periodo",
    accessorFn: (r) => r.hasta ?? "",
    header: "Periodo",
    meta: { label: "Periodo" },
    sortingFn: "datetime",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground tabnum">{periodo(row.original)}</span>
    ),
  },
];

export function ExpedientesView({ rows }: { rows: ExpedienteRow[] }) {
  const router = useRouter();

  const areaOptions = Array.from(new Set(rows.map((r) => r.area_name ?? "—")))
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((v) => ({ value: v, label: v }));

  const facets: FacetedFilter[] = [
    {
      columnId: "estado",
      title: "Estado",
      options: Object.entries(EXPEDIENTE_ESTADOS).map(([value, label]) => ({ value, label })),
    },
    { columnId: "area_name", title: "Área", options: areaOptions },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      searchPlaceholder="Filtrar expedientes…"
      facetedFilters={facets}
      initialSorting={[{ id: "periodo", desc: true }]}
      onRowClick={(r) => router.push(`/expedientes/${r.id}`)}
      emptyMessage="No hay expedientes que coincidan con los filtros."
      defaultView="grid"
      viewStorageKey="expedientes"
      renderCard={(r) => (
        <EntityCard
          icon={FolderOpen}
          eyebrow={r.area_name ?? "Sin área"}
          title={r.titulo}
          description={r.descripcion ?? undefined}
          badge={<EstadoBadge estado={r.estado} />}
          meta={
            <>
              <span className="tabnum">
                {r.n_acuerdos} {r.n_acuerdos === 1 ? "acuerdo" : "acuerdos"}
              </span>
              {r.desde && r.hasta ? (
                <>
                  <MetaDot />
                  <span className="tabnum">{periodo(r)}</span>
                </>
              ) : null}
            </>
          }
        />
      )}
    />
  );
}
