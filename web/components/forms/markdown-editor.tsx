"use client";

import { useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

/**
 * Editor de markdown con pestañas Editar / Vista previa. Envía el contenido en
 * un <textarea name=...> normal (compatible con server actions).
 */
export function MarkdownEditor({
  name,
  defaultValue = "",
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"editar" | "vista">("editar");

  const tabBtn = (active: boolean) =>
    cn(
      "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
      active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button type="button" onClick={() => setTab("editar")} className={tabBtn(tab === "editar")}>
          <Pencil className="size-4" aria-hidden /> Editar
        </button>
        <button type="button" onClick={() => setTab("vista")} className={tabBtn(tab === "vista")}>
          <Eye className="size-4" aria-hidden /> Vista previa
        </button>
      </div>

      {/* El textarea permanece montado (conserva el valor y lo envía el form) */}
      <Textarea
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={16}
        className={cn("font-mono text-sm leading-relaxed", tab !== "editar" && "hidden")}
      />
      {tab === "vista" ? (
        <div className="min-h-40 rounded-md border bg-card p-4">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Nada que previsualizar todavía.</p>
          )}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Admite Markdown: <code className="rounded bg-muted px-1">## Título</code>, listas con{" "}
        <code className="rounded bg-muted px-1">-</code>, <code className="rounded bg-muted px-1">**negrita**</code>, enlaces y tablas.
      </p>
    </div>
  );
}
