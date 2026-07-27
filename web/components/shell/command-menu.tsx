"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CornerDownLeft,
  Clock,
  FileText,
  Gavel,
  FolderOpen,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { MAIN_NAV, SECONDARY_NAV, visibleFor, type NavItem } from "./nav-items";
import { type AcuerdoEstado } from "@/lib/domain";

/** Normaliza para coincidencia sin acentos ni mayúsculas. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type AcuerdoHit = { id: string; titulo: string; public_ref: string; estado: AcuerdoEstado };
type RecentItem = { href: string; label: string };

const QUICK_ACTIONS: { href: string; label: string; icon: NavItem["icon"] }[] = [
  { href: "/actas/nueva", label: "Nueva acta", icon: FileText },
  { href: "/acuerdos/nuevo", label: "Nuevo acuerdo", icon: Gavel },
  { href: "/expedientes/nuevo", label: "Nuevo expediente", icon: FolderOpen },
  { href: "/tareas/nueva", label: "Nueva tarea", icon: CheckSquare },
];

const RECENT_KEY = "cmdk-recent";

export function CommandMenu({ roles }: { roles: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AcuerdoHit[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const navItems = [...MAIN_NAV, ...visibleFor(SECONDARY_NAV, roles)];

  // Atajo global ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Cargar recientes al abrir
  useEffect(() => {
    if (!open) return;
    try {
      // Recientes persistidos: se leen al abrir la paleta (no SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"));
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent([]);
    }
  }, [open]);

  // Búsqueda en vivo de acuerdos (debounce)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // Limpia resultados al vaciar la consulta.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { results: AcuerdoHit[] };
          setHits(data.results ?? []);
        }
      } catch {
        /* abortado o error: sin resultados en vivo */
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const go = useCallback(
    (href: string, label: string) => {
      setOpen(false);
      setQuery("");
      try {
        const next = [
          { href, label },
          ...recent.filter((r) => r.href !== href),
        ].slice(0, 5);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* almacenamiento no disponible */
      }
      router.push(href);
    },
    [recent, router]
  );

  const nq = norm(query);
  const matchedNav = nq ? navItems.filter((i) => norm(i.label).includes(nq)) : navItems;
  const matchedActions = nq
    ? QUICK_ACTIONS.filter((a) => norm(a.label).includes(nq))
    : QUICK_ACTIONS;

  return (
    <>
      {/* Disparador en el header: caja de búsqueda con pista de atajo */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir paleta de comandos"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-64 md:justify-between"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" aria-hidden />
          <span className="hidden md:inline">Buscar o saltar a…</span>
        </span>
        <kbd className="pointer-events-none hidden items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground md:inline-flex">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Paleta de comandos"
        description="Busca acuerdos, salta a una sección o ejecuta una acción."
      >
        <Command shouldFilter={false}>
        <CommandInput
          placeholder="Buscar acuerdos, secciones y acciones…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Sin coincidencias.</CommandEmpty>

          {/* Resultados de acuerdos en vivo */}
          {query.trim().length >= 2 && (
            <CommandGroup heading="Acuerdos">
              {hits.map((h) => (
                <CommandItem
                  key={h.id}
                  value={`acuerdo-${h.id}`}
                  onSelect={() => go(`/acuerdos/${h.id}`, h.titulo)}
                >
                  <Gavel className="text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{h.titulo}</span>
                  <span className="ml-2 shrink-0 font-mono text-[11px] text-muted-foreground tabnum">
                    {h.public_ref}
                  </span>
                </CommandItem>
              ))}
              <CommandItem
                value="ver-todos"
                onSelect={() => go(`/busqueda?q=${encodeURIComponent(query.trim())}`, "Buscar")}
              >
                <Search className="text-muted-foreground" aria-hidden />
                <span>
                  Ver todos los resultados de «{query.trim()}»
                </span>
                <CommandShortcut>
                  <ArrowRight className="size-3.5" aria-hidden />
                </CommandShortcut>
              </CommandItem>
            </CommandGroup>
          )}

          {/* Recientes (sin consulta) */}
          {!query.trim() && recent.length > 0 && (
            <CommandGroup heading="Recientes">
              {recent.map((r) => (
                <CommandItem key={r.href} value={`recent-${r.href}`} onSelect={() => go(r.href, r.label)}>
                  <Clock className="text-muted-foreground" aria-hidden />
                  <span className="truncate">{r.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {matchedNav.length > 0 && (
            <CommandGroup heading="Ir a">
              {matchedNav.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`nav-${item.href}`}
                  onSelect={() => go(item.href, item.label)}
                >
                  <item.icon className="text-muted-foreground" aria-hidden />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {matchedActions.length > 0 && (
            <CommandGroup heading="Acciones">
              {matchedActions.map((a) => (
                <CommandItem key={a.href} value={`action-${a.href}`} onSelect={() => go(a.href, a.label)}>
                  <a.icon className="text-muted-foreground" aria-hidden />
                  <span>{a.label}</span>
                  <CommandShortcut>
                    <CornerDownLeft className="size-3.5" aria-hidden />
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
