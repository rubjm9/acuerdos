import { cn } from "@/lib/utils";

/**
 * Cabecera de página consistente: título + descripción + acción principal.
 * Todas las páginas de objeto siguen esta plantilla.
 */
export function PageHeader({
  title,
  description,
  action,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        <h1 className="font-display text-[2rem] font-medium tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-base leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
