import {
  CircleDot,
  Clock,
  CheckCircle2,
  MinusCircle,
  Ban,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACUERDO_ESTADOS,
  TAREA_ESTADOS,
  ESTADO_BADGE,
  type AcuerdoEstado,
  type TareaEstado,
} from "@/lib/domain";

/** Icono por estado: codificación redundante (nunca solo color). */
const ESTADO_ICON: Record<AcuerdoEstado | TareaEstado, LucideIcon> = {
  en_vigor: CircleDot,
  en_curso: Clock,
  cumplido: CheckCircle2,
  superado: MinusCircle,
  anulado: Ban,
  abierta: CircleDot,
  en_progreso: Clock,
  completada: CheckCircle2,
  vencida: AlertTriangle,
  cancelada: MinusCircle,
};

/**
 * Badge de estado: icono + color de apoyo + SIEMPRE etiqueta de texto
 * (el color nunca es el único indicador — accesible para daltonismo).
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
  const Icon = ESTADO_ICON[estado] ?? CircleDot;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap",
        ESTADO_BADGE[estado],
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
