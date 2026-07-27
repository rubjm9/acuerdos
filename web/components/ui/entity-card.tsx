import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Ficha «portada» para la vista de rejilla: presenta una entidad (expediente,
 * política, acta) como la cubierta de un dossier — lomo de color, cabecera con
 * referencia, título destacado y datos al pie.
 */
export function EntityCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  meta,
  badge,
  className,
}: {
  icon: LucideIcon;
  /** Referencia o identificador (se muestra en mono sobre el título). */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Datos al pie: recuentos, fechas, área… */
  meta?: ReactNode;
  /** Insignia de estado (esquina superior derecha). */
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:ring-primary/30",
        className
      )}
    >
      {/* Lomo del dossier */}
      <span
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary/80 to-primary/40"
        aria-hidden
      />

      {/* Cabecera con matiz de color */}
      <div className="flex items-start justify-between gap-3 border-b bg-gradient-to-b from-primary/[0.045] to-transparent py-2.5 pl-5 pr-4">
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-4 shrink-0 text-primary/70" aria-hidden />
          {eyebrow ? <span className="truncate font-mono tabnum">{eyebrow}</span> : null}
        </span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
      </div>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col gap-2 py-3.5 pl-5 pr-4">
        <h3 className="font-display text-[1.05rem] font-medium leading-snug text-balance line-clamp-2">
          {title}
        </h3>
        {description ? (
          <p className="line-clamp-3 text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5 text-xs text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Separador de puntos para los metadatos del pie. */
export function MetaDot() {
  return <span aria-hidden>·</span>;
}
