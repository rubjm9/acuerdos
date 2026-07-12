import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { formatFecha, ACTA_ESTADOS } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Actas" };

type ActaRow = {
  id: string;
  numero: number;
  fecha: string;
  año: number;
  estado: keyof typeof ACTA_ESTADOS;
  has_file: boolean;
  n_acuerdos: number;
};

export default async function ActasPage({
  searchParams,
}: {
  searchParams: Promise<{ año?: string }>;
}) {
  const user = await requireUser();
  const { año } = await searchParams;

  const [years, actas] = await Promise.all([
    queryAsUser<{ año: number }>(user.id, "SELECT DISTINCT año FROM actas ORDER BY año DESC"),
    queryAsUser<ActaRow>(
      user.id,
      `SELECT a.id, a.numero, a.fecha, a.año, a.estado,
              (a.file_object_key IS NOT NULL OR a.compilation_año IS NOT NULL) AS has_file,
              (SELECT count(*) FROM acuerdos ac WHERE ac.acta_id = a.id)::int AS n_acuerdos
       FROM actas a
       WHERE ($1::int IS NULL OR a.año = $1::int)
       ORDER BY a.fecha DESC, a.numero DESC
       LIMIT 200`,
      [año ? Number(año) : null]
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Actas"
        description="Registro de reuniones y documento original de cada una."
        action={
          isSecretary(user) ? (
            <Button asChild>
              <Link href="/actas/nueva">
                <Plus className="size-4" aria-hidden /> Nueva acta
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Filtro por año */}
      {years.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/actas"
            className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
              !año ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos
          </Link>
          {years.map((y) => (
            <Link
              key={y.año}
              href={`/actas?año=${y.año}`}
              className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                año === String(y.año)
                  ? "border-primary/40 bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {y.año}
            </Link>
          ))}
        </div>
      ) : null}

      {actas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay actas registradas"
          description="Crea una acta manualmente o utiliza la ingesta de documentos para incorporar el archivo histórico."
          action={
            isSecretary(user) ? (
              <Button asChild variant="outline">
                <Link href="/ingesta">Ir a ingesta</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {actas.map((a) => (
            <li key={a.id}>
              <Link
                href={`/actas/${a.id}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-ring/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <FileText className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">
                      Acta {a.numero}/{a.año}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatFecha(a.fecha)} · {a.n_acuerdos}{" "}
                      {a.n_acuerdos === 1 ? "acuerdo" : "acuerdos"}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.estado !== "definitiva" ? (
                    <Badge variant="secondary">{ACTA_ESTADOS[a.estado]}</Badge>
                  ) : null}
                  {!a.has_file ? <Badge variant="outline">Sin archivo</Badge> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
