import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { requireSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { AreaMultiSelect } from "@/components/forms/area-multi-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toDateInput } from "@/lib/domain";
import { approveCandidate, rejectCandidate, reprocessJob } from "../actions";

export const metadata = { title: "Revisión de ingesta" };

type JobRow = {
  id: string;
  original_name: string | null;
  año: number | null;
  status: string;
  error: string | null;
  stats: { pages?: number; actas?: number; candidates?: number; ocr_used?: boolean };
};

type CandidateRow = {
  id: string;
  proposed_titulo: string | null;
  proposed_text: string;
  proposed_date: string | null;
  acta_numero: number | null;
  page: number | null;
  suggested_area_ids: string[];
  suggested_links: { ref_text?: string; tipo?: string; motivo?: string }[];
  review_status: string;
  committed_acuerdo_id: string | null;
};

export default async function RevisionIngestaPage({
  params,
}: PageProps<"/ingesta/[jobId]">) {
  const user = await requireSecretary();
  const { jobId } = await params;

  const [jobs, candidates, areas] = await Promise.all([
    queryAsUser<JobRow>(
      user.id,
      "SELECT id, original_name, año, status, error, stats FROM ingestion_jobs WHERE id = $1",
      [jobId]
    ),
    queryAsUser<CandidateRow>(
      user.id,
      `SELECT id, proposed_titulo, proposed_text, proposed_date, acta_numero, page,
              suggested_area_ids, suggested_links, review_status, committed_acuerdo_id
       FROM extraction_candidates WHERE job_id = $1
       ORDER BY acta_numero NULLS LAST, page NULLS LAST, created_at`,
      [jobId]
    ),
    queryAsUser<{ id: string; name: string; is_restricted: boolean }>(
      user.id,
      "SELECT id, name, is_restricted FROM areas WHERE is_active ORDER BY is_restricted, name"
    ),
  ]);

  const job = jobs[0];
  if (!job) notFound();

  const pendientes = candidates.filter((c) => c.review_status === "pending");
  const revisados = candidates.filter((c) => c.review_status !== "pending");
  const isoDate = (d: string | null) =>
    d ? toDateInput(d) : job.año ? `${job.año}-01-01` : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Revisión: ${job.original_name ?? "documento"}${job.año ? ` (${job.año})` : ""}`}
        description={
          job.status === "failed"
            ? `El procesamiento falló: ${job.error ?? "error desconocido"}`
            : job.status === "processing" || job.status === "uploaded"
              ? "Procesando el documento… recarga en unos instantes."
              : `${pendientes.length} candidatos pendientes de revisión. Nada se publica sin tu aprobación.`
        }
        meta={
          job.stats?.pages ? (
            <span className="text-xs text-muted-foreground">
              {job.stats.pages} páginas · {job.stats.actas ?? 0} actas detectadas ·{" "}
              {job.stats.candidates ?? 0} candidatos
              {job.stats.ocr_used ? " · OCR aplicado" : ""}
            </span>
          ) : undefined
        }
        action={
          job.status === "failed" || job.status === "extracted" ? (
            <form action={reprocessJob}>
              <input type="hidden" name="jobId" value={job.id} />
              <Button type="submit" variant="outline">
                <RefreshCw className="size-4" aria-hidden /> Reprocesar
              </Button>
            </form>
          ) : undefined
        }
      />

      {pendientes.map((c, idx) => (
        <Card key={c.id} className="border-l-4 border-l-primary/50">
          <CardContent>
            <form action={approveCandidate} className="space-y-4">
              <input type="hidden" name="candidateId" value={c.id} />
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Candidato {idx + 1} de {pendientes.length}
                  {c.acta_numero ? ` · Acta ${c.acta_numero}` : ""}
                  {c.page ? ` · pág. ${c.page}` : ""}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`t-${c.id}`}>Título breve</Label>
                <Input
                  id={`t-${c.id}`}
                  name="titulo"
                  required
                  maxLength={200}
                  defaultValue={c.proposed_titulo ?? ""}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`x-${c.id}`}>Texto del acuerdo</Label>
                <Textarea
                  id={`x-${c.id}`}
                  name="texto"
                  required
                  rows={6}
                  defaultValue={c.proposed_text}
                  className="leading-relaxed"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`f-${c.id}`}>Fecha</Label>
                  <Input
                    id={`f-${c.id}`}
                    name="fecha"
                    type="date"
                    required
                    defaultValue={isoDate(c.proposed_date)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`a-${c.id}`}>Nº de acta</Label>
                  <Input
                    id={`a-${c.id}`}
                    name="acta_numero"
                    type="number"
                    min={1}
                    required
                    defaultValue={c.acta_numero ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`p-${c.id}`}>Página</Label>
                  <Input
                    id={`p-${c.id}`}
                    name="page"
                    type="number"
                    min={1}
                    defaultValue={c.page ?? ""}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Áreas sugeridas (edítalas si procede)</Label>
                <AreaMultiSelect areas={areas} defaultSelected={c.suggested_area_ids} />
              </div>

              {c.suggested_links?.length ? (
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <div className="text-xs font-medium text-muted-foreground">
                    Posibles enlaces detectados (confírmalos después desde el acuerdo)
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {c.suggested_links.map((l, i) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{l.ref_text}</span>
                        {l.tipo ? ` · ${l.tipo}` : ""}
                        {l.motivo ? ` — ${l.motivo}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="min-h-10">
                  <CheckCircle2 className="size-4" aria-hidden /> Aprobar y publicar
                </Button>
                <Button
                  type="submit"
                  formAction={rejectCandidate}
                  variant="outline"
                  className="min-h-10 text-destructive hover:text-destructive"
                >
                  <XCircle className="size-4" aria-hidden /> Rechazar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ))}

      {pendientes.length === 0 && (job.status === "extracted" || job.status === "completed") ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 size-6 text-status-cumplido" aria-hidden />
            Revisión completada: no quedan candidatos pendientes.
          </CardContent>
        </Card>
      ) : null}

      {revisados.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Ya revisados ({revisados.length})
          </h2>
          <ul className="space-y-1.5">
            {revisados.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  {c.proposed_titulo ?? c.proposed_text.slice(0, 80)}
                </span>
                {c.review_status === "rejected" ? (
                  <Badge variant="secondary">Rechazado</Badge>
                ) : c.committed_acuerdo_id ? (
                  <Link
                    href={`/acuerdos/${c.committed_acuerdo_id}`}
                    className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Ver acuerdo
                  </Link>
                ) : (
                  <Badge>Aprobado</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Los candidatos rechazados no se publican; puedes reprocesar el documento para
        regenerarlos.
      </p>
    </div>
  );
}
