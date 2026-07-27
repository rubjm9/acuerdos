import Link from "next/link";
import { ChevronRight, Landmark, ScrollText, Tags, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Administración" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [counts] = await queryAsUser<{ usuarios: number; areas: number; comites: number }>(
    admin.id,
    `SELECT (SELECT count(*) FROM users)::int AS usuarios,
            (SELECT count(*) FROM areas WHERE is_active)::int AS areas,
            (SELECT count(*) FROM committees WHERE is_active)::int AS comites`
  );

  const sections = [
    {
      href: "/admin/usuarios",
      icon: Users,
      title: "Usuarios y roles",
      description: `${counts?.usuarios ?? 0} personas · roles y acceso a áreas restringidas`,
    },
    {
      href: "/admin/areas",
      icon: Tags,
      title: "Áreas",
      description: `${counts?.areas ?? 0} áreas activas · taxonomía editable`,
    },
    {
      href: "/admin/comites",
      icon: Landmark,
      title: "Comités y agencias",
      description: `${counts?.comites ?? 0} comités · miembros y área asociada`,
    },
    {
      href: "/admin/auditoria",
      icon: ScrollText,
      title: "Auditoría",
      description: "Registro completo de actividad, con refuerzo en áreas restringidas",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Administración"
        description="Gestión de personas, permisos y taxonomía de la plataforma."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex min-h-24 items-center justify-between gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:ring-ring/40"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <s.icon className="size-5" aria-hidden />
                </div>
                <div>
                  <div className="font-medium">{s.title}</div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
