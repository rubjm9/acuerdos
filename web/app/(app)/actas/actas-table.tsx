"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, multiSelectFilter, type FacetedFilter } from "@/components/ui/data-table";
import { EntityCard, MetaDot } from "@/components/ui/entity-card";
import { Badge } from "@/components/ui/badge";
import { formatFecha, ACTA_ESTADOS } from "@/lib/domain";

export type ActaRow = {
  id: string;
  numero: number;
  fecha: string;
  año: number;
  estado: keyof typeof ACTA_ESTADOS;
  has_file: boolean;
  n_acuerdos: number;
};

const columns: ColumnDef<ActaRow, unknown>[] = [
  {
    id: "acta",
    accessorFn: (r) => `Acta ${r.numero}/${r.año}`,
    header: "Acta",
    enableHiding: false,
    meta: { label: "Acta" },
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <FileText className="size-4.5 text-muted-foreground" aria-hidden />
        </div>
        <span className="font-medium tabnum">
          Acta {row.original.numero}/{row.original.año}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "fecha",
    header: "Fecha",
    meta: { label: "Fecha" },
    sortingFn: "datetime",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground tabnum">
        {formatFecha(row.original.fecha)}
      </span>
    ),
  },
  {
    accessorKey: "n_acuerdos",
    header: "Acuerdos",
    meta: { label: "Acuerdos" },
    cell: ({ row }) => (
      <span className="text-muted-foreground tabnum">{row.original.n_acuerdos}</span>
    ),
  },
  {
    accessorKey: "estado",
    header: "Estado",
    meta: { label: "Estado" },
    filterFn: multiSelectFilter,
    cell: ({ row }) => <Badge variant="secondary">{ACTA_ESTADOS[row.original.estado]}</Badge>,
  },
  {
    id: "archivo",
    accessorFn: (r) => (r.has_file ? "con" : "sin"),
    header: "Archivo",
    meta: { label: "Archivo" },
    enableSorting: false,
    cell: ({ row }) =>
      row.original.has_file ? (
        <Badge variant="outline" className="text-muted-foreground">
          Disponible
        </Badge>
      ) : (
        <Badge variant="outline" className="border-status-curso/40 text-status-curso">
          Sin archivo
        </Badge>
      ),
  },
];

export function ActasTable({ rows }: { rows: ActaRow[] }) {
  const router = useRouter();

  const facets: FacetedFilter[] = [
    {
      columnId: "estado",
      title: "Estado",
      options: Object.entries(ACTA_ESTADOS).map(([value, label]) => ({ value, label })),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      searchPlaceholder="Filtrar actas…"
      facetedFilters={facets}
      initialSorting={[{ id: "fecha", desc: true }]}
      onRowClick={(r) => router.push(`/actas/${r.id}`)}
      emptyMessage="No hay actas que coincidan."
      defaultView="table"
      viewStorageKey="actas"
      renderCard={(r) => (
        <EntityCard
          icon={FileText}
          eyebrow={`Acta ${r.numero}/${r.año}`}
          title={formatFecha(r.fecha)}
          badge={
            r.estado !== "definitiva" ? (
              <Badge variant="secondary">{ACTA_ESTADOS[r.estado]}</Badge>
            ) : (
              <Badge className="bg-status-cumplido-bg text-status-cumplido">Definitiva</Badge>
            )
          }
          meta={
            <>
              <span className="tabnum">
                {r.n_acuerdos} {r.n_acuerdos === 1 ? "acuerdo" : "acuerdos"}
              </span>
              <MetaDot />
              <span>{r.has_file ? "Con archivo" : "Sin archivo"}</span>
            </>
          }
        />
      )}
    />
  );
}
