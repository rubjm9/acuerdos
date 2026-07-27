import { CalendarCheck, FolderOpen, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACUERDO_TIPOS, TIPO_BADGE, type AcuerdoTipo } from "@/lib/domain";

const ICON = {
  politica: Library,
  expediente: FolderOpen,
  eventual: CalendarCheck,
} as const;

/** Insignia de la clasificación derivada del acuerdo. */
export function TipoBadge({ tipo, className }: { tipo: AcuerdoTipo; className?: string }) {
  const Icon = ICON[tipo];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap",
        TIPO_BADGE[tipo],
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {ACUERDO_TIPOS[tipo]}
    </span>
  );
}
