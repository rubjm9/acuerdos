"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Gavel, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_GROUPS, visibleFor, type NavItem } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-lg text-[15px] font-medium transition-colors",
        collapsed ? "justify-center px-0" : "px-2.5",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      )}
    >
      {/* Indicador de activo (barra izquierda) */}
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
          aria-hidden
        />
      ) : null}
      <item.icon className="size-4.5 shrink-0" strokeWidth={active ? 2.3 : 2} aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/** Barra lateral de escritorio: secciones con encabezado + colapsar a iconos. */
export function DesktopSidebar({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Preferencia de UI persistida: se lee tras montar (no disponible en SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar md:flex",
        mounted && "transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex h-16 items-center gap-2.5", collapsed ? "justify-center px-0" : "px-4")}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Gavel className="size-4.5" aria-hidden />
        </div>
        {!collapsed && (
          <span className="font-display text-[1.35rem] leading-none tracking-tight">Acuerdos</span>
        )}
      </div>

      <nav aria-label="Navegación principal" className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {SIDEBAR_GROUPS.map((group, gi) => {
          const items = visibleFor(group.items, roles);
          if (items.length === 0) return null;
          return (
            <div key={group.label ?? `grp-${gi}`} className="space-y-0.5">
              {group.label &&
                (collapsed ? (
                  <div className="mx-2 my-2 border-t border-sidebar-border" aria-hidden />
                ) : (
                  <div className="label-eyebrow px-2.5 pb-1.5 pt-1 text-muted-foreground/70">
                    {group.label}
                  </div>
                ))}
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
          className={cn(
            "flex min-h-9 w-full items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
            collapsed ? "justify-center px-0" : "px-2.5"
          )}
        >
          {collapsed ? (
            <PanelLeft className="size-4.5 shrink-0" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4.5 shrink-0" aria-hidden />
          )}
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
