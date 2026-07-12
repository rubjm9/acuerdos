import { cn } from "@/lib/utils";
import {
  ACUERDO_ESTADOS,
  TAREA_ESTADOS,
  ESTADO_BADGE,
  type AcuerdoEstado,
  type TareaEstado,
} from "@/lib/domain";

/**
 * Badge de estado: color de apoyo + SIEMPRE etiqueta de texto
 * (el color nunca es el único indicador).
 */
export function StatusBadge({
  estado,
  className,
}: {
  estado: AcuerdoEstado | TareaEstado;
  className?: string;
}) {
  const label =
    (ACUERDO_ESTADOS as Record<string, string>)[estado] ??
    (TAREA_ESTADOS as Record<string, string>)[estado] ??
    estado;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        ESTADO_BADGE[estado],
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
