import Link from "next/link";
import { Gavel } from "lucide-react";
import { requireUser } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/domain";
import { DesktopSidebar } from "@/components/shell/sidebar-nav";
import { BottomNav } from "@/components/shell/bottom-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { CommandMenu } from "@/components/shell/command-menu";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const roleLabel = user.roles.map((r) => ROLES[r as Role] ?? r).join(" · ");

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/acceso" });
  }

  return (
    <div className="app-canvas flex min-h-dvh w-full">
      {/* Enlace para saltar al contenido (accesibilidad por teclado) */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      {/* Barra lateral — escritorio */}
      <DesktopSidebar roles={user.roles} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:h-16 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href="/" className="flex items-center gap-2 md:hidden">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Gavel className="size-4" aria-hidden />
              </div>
              <span className="font-display text-lg leading-none tracking-tight">Acuerdos</span>
            </Link>
            <Breadcrumbs className="hidden md:flex" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CommandMenu roles={user.roles} />
            <ThemeToggle />
            <NotificationsBell />
            <UserMenu
              name={user.name}
              email={user.email}
              roleLabel={roleLabel}
              signOutAction={doSignOut}
            />
          </div>
        </header>

        {/* Contenido: padding inferior extra en móvil para la barra de pestañas */}
        <main
          id="contenido"
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 md:px-8 md:pb-14 md:pt-10"
        >
          {children}
        </main>
      </div>

      <BottomNav roles={user.roles} />
    </div>
  );
}
