import { Lock, ScrollText } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "Auditoría" };

const ACTION_LABEL: Record<string, string> = {
  create: "Creación",
  update: "Modificación",
  delete: "Eliminación",
  view: "Lectura",
  download: "Descarga",
  search: "Búsqueda",
  export: "Exportación",
  login: "Acceso",
};

type AuditRow = {
  id: string;
  actor: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  restricted: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; pagina?: string }>;
}) {
  const admin = await requireAdmin();
  const { filtro, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);
  const PAGE_SIZE = 50;

  const rows = await queryAsUser<AuditRow>(
    admin.id,
    `SELECT al.id, u.name AS actor, al.action, al.entity_type, al.entity_id,
            al.restricted, al.metadata, al.created_at
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.actor_user_id
     WHERE ($1::text IS NULL OR ($1 = 'restringido' AND al.restricted))
     ORDER BY al.created_at DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    [filtro === "restringido" ? "restringido" : null]
  );

  const hasMore = rows.length > PAGE_SIZE;
  const visible = rows.slice(0, PAGE_SIZE);
  const fmt = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Auditoría"
        description="Registro inmutable de actividad. Los eventos sobre áreas restringidas incluyen también las lecturas."
      />

      <div className="flex gap-1.5">
        <Link
          href="/admin/auditoria"
          className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
            !filtro ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Todo
        </Link>
        <Link
          href="/admin/auditoria?filtro=restringido"
          className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors ${
            filtro === "restringido"
              ? "border-primary/40 bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="size-3" aria-hidden /> Solo áreas restringidas
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Sin eventos"
          description="La actividad de la plataforma aparecerá aquí a medida que ocurra."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Persona</th>
                <th className="px-4 py-2.5 font-medium">Acción</th>
                <th className="px-4 py-2.5 font-medium">Objeto</th>
                <th className="px-4 py-2.5 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                    {fmt.format(new Date(r.created_at))}
                  </td>
                  <td className="px-4 py-2.5">{r.actor ?? "Sistema"}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      {ACTION_LABEL[r.action] ?? r.action}
                      {r.restricted ? (
                        <Badge className="gap-1 bg-status-anulado-bg text-status-anulado">
                          <Lock className="size-2.5" aria-hidden /> restringido
                        </Badge>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.entity_type}</td>
                  <td className="max-w-64 truncate px-4 py-2.5 text-xs text-muted-foreground">
                    {Object.keys(r.metadata ?? {}).length > 0
                      ? JSON.stringify(r.metadata)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/admin/auditoria?${filtro ? `filtro=${filtro}&` : ""}pagina=${page - 1}`}
            >
              Anteriores
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {hasMore ? (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/admin/auditoria?${filtro ? `filtro=${filtro}&` : ""}pagina=${page + 1}`}
            >
              Siguientes
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
