import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { formatFecha } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Expedientes" };

type ExpedienteRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: "abierto" | "cerrado";
  area_name: string | null;
  n_acuerdos: number;
  desde: string | null;
  hasta: string | null;
};

export default async function ExpedientesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const user = await requireUser();
  const { estado } = await searchParams;

  const expedientes = await queryAsUser<ExpedienteRow>(
    user.id,
    `SELECT e.id, e.titulo, e.descripcion, e.estado, a.name AS area_name,
            (SELECT count(*) FROM expediente_acuerdos ea WHERE ea.expediente_id = e.id)::int AS n_acuerdos,
            (SELECT min(ac.fecha_adopcion) FROM expediente_acuerdos ea
              JOIN acuerdos ac ON ac.id = ea.acuerdo_id WHERE ea.expediente_id = e.id) AS desde,
            (SELECT max(ac.fecha_adopcion) FROM expediente_acuerdos ea
              JOIN acuerdos ac ON ac.id = ea.acuerdo_id WHERE ea.expediente_id = e.id) AS hasta
     FROM expedientes e
     LEFT JOIN areas a ON a.id = e.primary_area_id
     WHERE ($1::expediente_estado IS NULL OR e.estado = $1::expediente_estado)
     ORDER BY e.updated_at DESC
     LIMIT 100`,
    [estado || null]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expedientes"
        description="Hilos temáticos que agrupan acuerdos relacionados a lo largo de los años."
        action={
          isSecretary(user) ? (
            <Button asChild>
              <Link href="/expedientes/nuevo">
                <Plus className="size-4" aria-hidden /> Nuevo expediente
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-1.5">
        {[
          { v: "", l: "Todos" },
          { v: "abierto", l: "Abiertos" },
          { v: "cerrado", l: "Cerrados" },
        ].map((f) => (
          <Link
            key={f.v}
            href={f.v ? `/expedientes?estado=${f.v}` : "/expedientes"}
            className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
              (estado ?? "") === f.v
                ? "border-primary/40 bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.l}
          </Link>
        ))}
      </div>

      {expedientes.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No hay expedientes"
          description="Un expediente reúne los acuerdos de un mismo asunto, aunque estén en actas de años distintos."
        />
      ) : (
        <ul className="space-y-2">
          {expedientes.map((e) => (
            <li key={e.id}>
              <Link
                href={`/expedientes/${e.id}`}
                className="block space-y-1.5 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-ring/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium leading-snug">{e.titulo}</div>
                  {e.estado === "cerrado" ? (
                    <Badge variant="secondary" className="shrink-0">
                      Cerrado
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {e.n_acuerdos} {e.n_acuerdos === 1 ? "acuerdo" : "acuerdos"}
                  {e.desde && e.hasta
                    ? ` · ${formatFecha(e.desde)} — ${formatFecha(e.hasta)}`
                    : ""}
                  {e.area_name ? ` · ${e.area_name}` : ""}
                </div>
                {e.descripcion ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{e.descripcion}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
