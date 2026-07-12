"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type AreaOption = { id: string; name: string; is_restricted: boolean };

/**
 * Selector multi-etiqueta de áreas como chips pulsables.
 * Envía un input hidden `areaIds` por cada selección.
 */
export function AreaMultiSelect({
  areas,
  defaultSelected = [],
  name = "areaIds",
}: {
  areas: AreaOption[];
  defaultSelected?: string[];
  name?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {areas.map((a) => {
        const on = selected.has(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            aria-pressed={on}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
              on
                ? a.is_restricted
                  ? "border-status-anulado/40 bg-status-anulado-bg text-status-anulado"
                  : "border-primary/40 bg-accent text-accent-foreground"
                : "border-input text-muted-foreground hover:border-ring/50 hover:text-foreground"
            )}
          >
            {a.is_restricted ? <Lock className="size-3.5" aria-hidden /> : null}
            {a.name}
          </button>
        );
      })}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}
