import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type AreaChip = { id: string; name: string; is_restricted: boolean };

/** Chips de área; las restringidas llevan candado. */
export function AreaBadges({ areas, className }: { areas: AreaChip[]; className?: string }) {
  if (!areas?.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {areas.map((a) => (
        <span
          key={a.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
            a.is_restricted
              ? "bg-status-anulado-bg text-status-anulado"
              : "bg-secondary text-secondary-foreground"
          )}
        >
          {a.is_restricted ? <Lock className="size-3" aria-hidden /> : null}
          {a.name}
        </span>
      ))}
    </div>
  );
}
