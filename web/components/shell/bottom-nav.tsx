"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MAIN_NAV, SECONDARY_NAV, visibleFor } from "./nav-items";

/**
 * Barra de pestañas inferior (solo móvil). Targets táctiles ≥48px,
 * alcanzables con el pulgar. El quinto botón «Más» abre una hoja con
 * el resto de secciones.
 */
export function BottomNav({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const secondary = visibleFor(SECONDARY_NAV, roles);
  const moreActive = secondary.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  );

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {MAIN_NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              aria-label="Más secciones"
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Menu className="size-5" aria-hidden />
              Más
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]">
              <SheetHeader>
                <SheetTitle>Más secciones</SheetTitle>
              </SheetHeader>
              <ul className="grid grid-cols-2 gap-2 px-4 pb-2">
                {secondary.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <item.icon className="size-5 text-muted-foreground" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
