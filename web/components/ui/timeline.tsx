import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Timeline vertical para cronologías (auditoría, historial de expediente).
 * Cada punto es un hito con icono opcional, título y metadatos.
 */
export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn("relative space-y-0", className)}>{children}</ol>;
}

export function TimelineItem({
  icon,
  title,
  meta,
  children,
  last = false,
}: {
  icon?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-5">
      {/* Línea conectora */}
      {!last && (
        <span
          className="absolute left-[13px] top-7 bottom-0 w-px bg-border"
          aria-hidden
        />
      )}
      <span className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <div className="min-w-0 text-[15px]">{title}</div>
          {meta ? <div className="text-xs text-muted-foreground tabnum">{meta}</div> : null}
        </div>
        {children ? <div className="mt-1 text-sm text-muted-foreground">{children}</div> : null}
      </div>
    </li>
  );
}
