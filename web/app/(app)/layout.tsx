import Link from "next/link";
import { Gavel } from "lucide-react";
import { requireUser } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/domain";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { BottomNav } from "@/components/shell/bottom-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationsBell } from "@/components/shell/notifications-bell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const roleLabel = user.roles.map((r) => ROLES[r as Role] ?? r).join(" · ");

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/acceso" });
  }

  return (
    <div className="flex min-h-dvh w-full">
      {/* Barra lateral — escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gavel className="size-4.5" aria-hidden />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Acuerdos</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav roles={user.roles} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:h-16 md:px-8">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Gavel className="size-4" aria-hidden />
            </div>
            <span className="font-semibold tracking-tight">Acuerdos</span>
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
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
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-12">
          {children}
        </main>
      </div>

      <BottomNav roles={user.roles} />
    </div>
  );
}
