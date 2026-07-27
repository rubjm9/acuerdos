"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type Column,
  type Row,
  type FilterFn,
} from "@tanstack/react-table";
import {
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  ListFilter,
  Rows3,
  Rows4,
  Check,
  X,
  Search,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Filtro multi-selección para columnas de valor único (estado, tipo…). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const multiSelectFilter: FilterFn<any> = (row, columnId, value: string[]) => {
  if (!value?.length) return true;
  return value.includes(String(row.getValue(columnId)));
};

export type FacetedFilter = {
  columnId: string;
  title: string;
  options: { label: string; value: string }[];
};

export type ViewMode = "grid" | "table";

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Filtrar…",
  facetedFilters = [],
  onRowClick,
  initialSorting = [],
  emptyMessage = "Sin resultados.",
  getRowId,
  renderCard,
  defaultView = "table",
  viewStorageKey,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  facetedFilters?: FacetedFilter[];
  onRowClick?: (row: TData) => void;
  initialSorting?: SortingState;
  emptyMessage?: string;
  getRowId?: (row: TData) => string;
  /** Si se aporta, se habilita la vista rejilla y el conmutador. */
  renderCard?: (row: TData) => ReactNode;
  defaultView?: ViewMode;
  /** Clave para recordar la vista elegida por el usuario. */
  viewStorageKey?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [dense, setDense] = useState(false);
  const [view, setView] = useState<ViewMode>(defaultView);
  const [focus, setFocus] = useState(-1);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const canGrid = Boolean(renderCard);

  useEffect(() => {
    // Preferencias de UI persistidas (no disponibles en SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDense(localStorage.getItem("table-dense") === "1");
    if (!viewStorageKey) return;
    const stored = localStorage.getItem(`view:${viewStorageKey}`);
    if (stored === "grid" || stored === "table") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView(stored);
    }
  }, [viewStorageKey]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    getRowId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;
  const hasFilters = columnFilters.length > 0 || globalFilter.length > 0;
  const gridMode = canGrid && view === "grid";

  function toggleDense() {
    setDense((d) => {
      localStorage.setItem("table-dense", d ? "0" : "1");
      return !d;
    });
  }

  function changeView(next: ViewMode) {
    setView(next);
    if (viewStorageKey) localStorage.setItem(`view:${viewStorageKey}`, next);
  }

  // Navegación por teclado en tabla: ↑/↓ o j/k mueven fila; Enter abre.
  function onKeyDown(e: React.KeyboardEvent) {
    if (["ArrowDown", "j"].includes(e.key)) {
      e.preventDefault();
      setFocus((f) => Math.min(rows.length - 1, f + 1));
    } else if (["ArrowUp", "k"].includes(e.key)) {
      e.preventDefault();
      setFocus((f) => Math.max(0, f - 1));
    } else if (e.key === "Enter" && focus >= 0 && rows[focus]) {
      onRowClick?.(rows[focus].original);
    }
  }

  useEffect(() => {
    if (focus < 0 || gridMode) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-row-index="${focus}"]`);
    el?.focus();
  }, [focus, gridMode]);

  const pad = dense ? "py-1.5" : "py-2.5";
  const sortableColumns = table.getAllColumns().filter((c) => c.getCanSort());
  const activeSort = sorting[0];

  return (
    <div className="space-y-3">
      {/* Barra de herramientas: búsqueda + filtros + vista */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-8"
            aria-label="Filtrar"
          />
        </div>

        {facetedFilters.map((f) => {
          const column = table.getColumn(f.columnId);
          if (!column) return null;
          return (
            <FacetFilterButton key={f.columnId} column={column} title={f.title} options={f.options} />
          );
        })}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              table.resetColumnFilters();
              setGlobalFilter("");
            }}
          >
            Limpiar <X className="size-3.5" aria-hidden />
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Ordenación explícita (en rejilla no hay cabeceras que pulsar) */}
          {gridMode && sortableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">Ordenar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sortableColumns.map((c) => {
                  const label = (c.columnDef.meta as { label?: string })?.label ?? c.id;
                  const isActive = activeSort?.id === c.id;
                  return (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => setSorting([{ id: c.id, desc: isActive ? !activeSort.desc : true }])}
                    >
                      <span className="flex-1">{label}</span>
                      {isActive &&
                        (activeSort.desc ? (
                          <ChevronDown className="size-3.5" aria-hidden />
                        ) : (
                          <ChevronUp className="size-3.5" aria-hidden />
                        ))}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!gridMode && (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={toggleDense}
                aria-label={dense ? "Vista cómoda" : "Vista compacta"}
                title={dense ? "Vista cómoda" : "Vista compacta"}
              >
                {dense ? <Rows3 className="size-4" aria-hidden /> : <Rows4 className="size-4" aria-hidden />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Columnas</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .filter((c) => c.getCanHide())
                    .map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c.id}
                        checked={c.getIsVisible()}
                        onCheckedChange={(v) => c.toggleVisibility(!!v)}
                      >
                        {(c.columnDef.meta as { label?: string })?.label ?? c.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {/* Conmutador rejilla / tabla */}
          {canGrid && (
            <div
              role="group"
              aria-label="Modo de vista"
              className="inline-flex overflow-hidden rounded-lg border bg-card"
            >
              <button
                type="button"
                onClick={() => changeView("grid")}
                aria-pressed={gridMode}
                aria-label="Ver como rejilla"
                title="Rejilla"
                className={cn(
                  "flex size-8 items-center justify-center transition-colors",
                  gridMode
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <LayoutGrid className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => changeView("table")}
                aria-pressed={!gridMode}
                aria-label="Ver como tabla"
                title="Tabla"
                className={cn(
                  "flex size-8 items-center justify-center border-l transition-colors",
                  !gridMode
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <TableIcon className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contenido: rejilla de fichas o tabla densa */}
      {gridMode ? (
        rows.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row: Row<TData>) => (
              <li key={row.id} className="contents">
                {onRowClick ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onRowClick(row.original)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row.original);
                      }
                    }}
                    className="lift cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {renderCard!(row.original)}
                  </div>
                ) : (
                  <div className="lift rounded-xl">{renderCard!(row.original)}</div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed bg-card py-14 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      const facet = facetedFilters.find((f) => f.columnId === header.column.id);
                      return (
                        <TableHead
                          key={header.id}
                          className="label-eyebrow h-10 whitespace-nowrap text-muted-foreground"
                        >
                          {header.isPlaceholder ? null : (
                            <span className="inline-flex items-center gap-0.5">
                              {canSort ? (
                                <button
                                  type="button"
                                  onClick={header.column.getToggleSortingHandler()}
                                  className="inline-flex items-center gap-1.5 rounded transition-colors hover:text-foreground"
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  {sorted === "asc" ? (
                                    <ChevronUp className="size-3.5" aria-hidden />
                                  ) : sorted === "desc" ? (
                                    <ChevronDown className="size-3.5" aria-hidden />
                                  ) : (
                                    <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
                                  )}
                                </button>
                              ) : (
                                flexRender(header.column.columnDef.header, header.getContext())
                              )}
                              {/* Filtro desde la propia cabecera */}
                              {facet ? (
                                <HeaderFacetFilter
                                  column={header.column}
                                  title={facet.title}
                                  options={facet.options}
                                />
                              ) : null}
                            </span>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody ref={bodyRef} onKeyDown={onKeyDown}>
                {rows.length ? (
                  rows.map((row: Row<TData>, i) => (
                    <TableRow
                      key={row.id}
                      data-row-index={i}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      onFocus={() => setFocus(i)}
                      className={cn(
                        "outline-none",
                        onRowClick &&
                          "cursor-pointer focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn("align-middle", pad)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={columns.length}
                      className="h-28 text-center text-sm text-muted-foreground"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground tabnum">
        {rows.length} de {data.length} {data.length === 1 ? "registro" : "registros"}
      </p>
    </div>
  );
}

/** Filtro facetado compacto, embebido en la cabecera de la tabla. */
function HeaderFacetFilter<TData>({
  column,
  title,
  options,
}: {
  column: Column<TData, unknown>;
  title: string;
  options: { label: string; value: string }[];
}) {
  const selected = new Set((column.getFilterValue() as string[]) ?? []);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrar por ${title}`}
          title={`Filtrar por ${title}`}
          className={cn(
            "flex size-5 items-center justify-center rounded transition-colors",
            selected.size > 0
              ? "text-primary"
              : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
          )}
        >
          <ListFilter className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5">
        <OptionList column={column} options={options} selected={selected} />
      </PopoverContent>
    </Popover>
  );
}

function FacetFilterButton<TData>({
  column,
  title,
  options,
}: {
  column: Column<TData, unknown>;
  title: string;
  options: { label: string; value: string }[];
}) {
  const selected = new Set((column.getFilterValue() as string[]) ?? []);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <ListFilter className="size-3.5" aria-hidden />
          {title}
          {selected.size > 0 && (
            <span className="ml-1 rounded bg-primary/10 px-1.5 text-[11px] font-medium text-primary tabnum">
              {selected.size}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5">
        <OptionList column={column} options={options} selected={selected} />
      </PopoverContent>
    </Popover>
  );
}

function OptionList<TData>({
  column,
  options,
  selected,
}: {
  column: Column<TData, unknown>;
  options: { label: string; value: string }[];
  selected: Set<string>;
}) {
  return (
    <div className="space-y-0.5">
      {options.map((opt) => {
        const on = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              const next = new Set(selected);
              if (on) next.delete(opt.value);
              else next.add(opt.value);
              column.setFilterValue(next.size ? Array.from(next) : undefined);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded border",
                on ? "border-primary bg-primary text-primary-foreground" : "border-input"
              )}
            >
              {on && <Check className="size-3" aria-hidden />}
            </span>
            {opt.label}
          </button>
        );
      })}
      {selected.size > 0 && (
        <>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => column.setFilterValue(undefined)}
            className="w-full rounded-md px-2 py-1.5 text-center text-sm text-muted-foreground hover:bg-muted"
          >
            Limpiar filtro
          </button>
        </>
      )}
    </div>
  );
}
