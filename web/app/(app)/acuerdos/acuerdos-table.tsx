"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, multiSelectFilter, type FacetedFilter } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { StatusBadge } from "@/components/status-badge";
import { TipoBadge } from "@/components/tipo-badge";
import { AreaBadges, type AreaChip } from "@/components/area-badges";
import { Button } from "@/components/ui/button";
import {
  formatFechaLarga,
  formatFecha,
  ACUERDO_ESTADOS,
  ACUERDO_TIPOS,
  type AcuerdoEstado,
  type AcuerdoTipo,
} from "@/lib/domain";

export type AcuerdoRow = {
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

const FACETS: FacetedFilter[] = [
  {
    columnId: "estado",
    title: "Estado",
    options: Object.entries(ACUERDO_ESTADOS).map(([value, label]) => ({ value, label })),
  },
  {
    columnId: "tipo",
    title: "Tipo",
    options: Object.entries(ACUERDO_TIPOS).map(([value, label]) => ({ value, label })),
  },
];

const columns: ColumnDef<AcuerdoRow, unknown>[] = [
  {
    accessorKey: "titulo",
    header: "Acuerdo",
    enableHiding: false,
    meta: { label: "Acuerdo" },
    cell: ({ row }) => (
      <div className="min-w-0 max-w-md">
        <div className="truncate font-medium leading-snug">{row.original.titulo}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground tabnum">
          {row.original.public_ref} · Acta {row.original.acta_numero}/{row.original.acta_año}
          {row.original.source_page ? `, pág. ${row.original.source_page}` : ""}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "estado",
    header: "Estado",
    meta: { label: "Estado" },
    filterFn: multiSelectFilter,
    cell: ({ row }) => <StatusBadge estado={row.original.estado} />,
  },
  {
    accessorKey: "tipo",
    header: "Tipo",
    meta: { label: "Tipo" },
    filterFn: multiSelectFilter,
    cell: ({ row }) => <TipoBadge tipo={row.original.tipo} />,
  },
  {
    accessorKey: "fecha_adopcion",
    header: "Fecha",
    meta: { label: "Fecha" },
    sortingFn: "datetime",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground tabnum">
        {formatFecha(row.original.fecha_adopcion)}
      </span>
    ),
  },
  {
    id: "areas",
    header: "Áreas",
    meta: { label: "Áreas" },
    enableSorting: false,
    cell: ({ row }) => <AreaBadges areas={row.original.areas ?? []} />,
  },
];

export function AcuerdosTable({ rows }: { rows: AcuerdoRow[] }) {
  const [selected, setSelected] = useState<AcuerdoRow | null>(null);

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        searchPlaceholder="Filtrar por título o referencia…"
        facetedFilters={FACETS}
        initialSorting={[{ id: "fecha_adopcion", desc: true }]}
        onRowClick={setSelected}
        emptyMessage="No hay acuerdos que coincidan con los filtros."
      />

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.titulo}
        description={selected ? `${selected.public_ref}` : undefined}
        footer={
          selected ? (
            <Button asChild className="w-full">
              <Link href={`/acuerdos/${selected.id}`}>
                Abrir ficha completa
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : null
        }
      >
        {selected ? (
          <dl className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge estado={selected.estado} />
              <TipoBadge tipo={selected.tipo} />
            </div>
            <Field label="Fecha de adopción" value={formatFechaLarga(selected.fecha_adopcion)} />
            <div className="space-y-1">
              <dt className="label-eyebrow text-muted-foreground">
                Acta de origen
              </dt>
              <dd className="inline-flex items-center gap-1.5">
                <FileText className="size-4 text-muted-foreground" aria-hidden />
                Acta {selected.acta_numero}/{selected.acta_año}
                {selected.source_page ? `, pág. ${selected.source_page}` : ""}
              </dd>
            </div>
            {selected.areas?.length ? (
              <div className="space-y-1.5">
                <dt className="label-eyebrow text-muted-foreground">
                  Áreas
                </dt>
                <dd>
                  <AreaBadges areas={selected.areas} />
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </DetailDrawer>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="label-eyebrow text-muted-foreground">{label}</dt>
      <dd className="tabnum">{value}</dd>
    </div>
  );
}
