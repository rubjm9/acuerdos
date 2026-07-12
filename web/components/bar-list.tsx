import { cn } from "@/lib/utils";

export type BarItem = {
  label: string;
  value: number;
  /** clase de color de la barra (por defecto, primario) */
  barClass?: string;
  href?: string;
};

/**
 * Lista de barras horizontales accesible: cada fila muestra etiqueta y valor
 * (el color es de apoyo, nunca el único indicador). Sin dependencias externas.
 */
export function BarList({
  items,
  emptyLabel = "Sin datos",
}: {
  items: BarItem[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{item.value}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${item.label}: ${item.value}`}
          >
            <div
              className={cn("h-full rounded-full", item.barClass ?? "bg-primary")}
              style={{ width: `${Math.round((item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
