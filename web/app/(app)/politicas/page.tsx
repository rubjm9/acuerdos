import Link from "next/link";
import { Library, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { POLITICA_ESTADOS, type PoliticaEstado } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Políticas" };

type PoliticaRow = {
  id: string;
  public_ref: string;
  titulo: string;
  resumen: string | null;
  estado: PoliticaEstado;
  area_name: string | null;
  n_acuerdos: number;
};

export default async function PoliticasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const user = await requireUser();
  const { estado } = await searchParams;

  const politicas = await queryAsUser<PoliticaRow>(
    user.id,
    `SELECT p.id, p.public_ref, p.titulo, p.resumen, p.estado, a.name AS area_name,
            (SELECT count(*) FROM politica_acuerdos pa WHERE pa.politica_id = p.id)::int AS n_acuerdos
     FROM politicas p
     LEFT JOIN areas a ON a.id = p.primary_area_id
     WHERE ($1::politica_estado IS NULL OR p.estado = $1::politica_estado)
     ORDER BY p.updated_at DESC
     LIMIT 100`,
    [estado || null]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Políticas"
        description="Documentos vivos que consolidan la postura de la Asamblea sobre cada asunto, agrupando sus acuerdos."
        action={
          isSecretary(user) ? (
            <Button asChild>
              <Link href="/politicas/nueva">
                <Plus className="size-4" aria-hidden /> Nueva política
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-1.5">
        {[{ v: "", l: "Todas" }, ...Object.entries(POLITICA_ESTADOS).map(([v, l]) => ({ v, l }))].map(
          (f) => (
            <Link
              key={f.v || "todas"}
              href={f.v ? `/politicas?estado=${f.v}` : "/politicas"}
              className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                (estado ?? "") === f.v
                  ? "border-primary/40 bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.l}
            </Link>
          )
        )}
      </div>

      {politicas.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No hay políticas"
          description="Una política reúne los acuerdos sobre una misma temática y añade un texto que consolida la postura general."
        />
      ) : (
        <ul className="space-y-2">
          {politicas.map((p) => (
            <li key={p.id}>
              <Link
                href={`/politicas/${p.id}`}
                className="block space-y-1.5 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-ring/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm font-medium leading-snug">{p.titulo}</div>
                  {p.estado !== "vigente" ? (
                    <Badge variant="secondary" className="shrink-0">
                      {POLITICA_ESTADOS[p.estado]}
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.public_ref} · {p.n_acuerdos} {p.n_acuerdos === 1 ? "acuerdo" : "acuerdos"}
                  {p.area_name ? ` · ${p.area_name}` : ""}
                </div>
                {p.resumen ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.resumen}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
