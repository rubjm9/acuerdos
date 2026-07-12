"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { MAIN_NAV, SECONDARY_NAV, visibleFor, type NavItem } from "./nav-items";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      )}
    >
      <item.icon className="size-4.5" strokeWidth={active ? 2.3 : 2} aria-hidden />
      {item.label}
    </Link>
  );
}

/** Navegación lateral (escritorio). */
export function SidebarNav({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-1 px-3">
      {MAIN_NAV.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
      <Separator className="my-2" />
      {visibleFor(SECONDARY_NAV, roles).map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
