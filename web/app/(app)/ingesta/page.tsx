import Link from "next/link";
import { Inbox, Upload } from "lucide-react";
import { requireSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { formatFecha } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { uploadIngestion } from "./actions";

export const metadata = { title: "Ingesta" };

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  uploaded: { label: "En cola", cls: "bg-secondary text-secondary-foreground" },
  processing: { label: "Procesando", cls: "bg-status-curso-bg text-status-curso" },
  extracted: { label: "Pendiente de revisión", cls: "bg-status-vigor-bg text-status-vigor" },
  completed: { label: "Completada", cls: "bg-status-cumplido-bg text-status-cumplido" },
  failed: { label: "Error", cls: "bg-status-anulado-bg text-status-anulado" },
};

type JobRow = {
  id: string;
  original_name: string | null;
  año: number | null;
  status: string;
  created_at: string;
  pendientes: number;
  aprobados: number;
  rechazados: number;
};

export default async function IngestaPage() {
  const user = await requireSecretary();
  const jobs = await queryAsUser<JobRow>(
    user.id,
    `SELECT j.id, j.original_name, j.año, j.status, j.created_at,
            count(*) FILTER (WHERE ec.review_status = 'pending')::int AS pendientes,
            count(*) FILTER (WHERE ec.review_status IN ('approved','edited'))::int AS aprobados,
            count(*) FILTER (WHERE ec.review_status = 'rejected')::int AS rechazados
     FROM ingestion_jobs j
     LEFT JOIN extraction_candidates ec ON ec.job_id = j.id
     GROUP BY j.id
     ORDER BY j.created_at DESC
     LIMIT 50`
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ingesta de documentos"
        description="Sube la recopilación anual en PDF; la extracción propone acuerdos que la Secretaría revisa y aprueba uno a uno."
      />

      <Card>
        <CardHeader>
          <CardTitle>Nueva ingesta</CardTitle>
          <CardDescription>
            El procesamiento ocurre íntegramente en nuestra infraestructura; ningún contenido
            sale de ella. Ningún acuerdo se publica sin aprobación humana.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={uploadIngestion}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="año">Año</Label>
              <Input
                id="año"
                name="año"
                type="number"
                min={1990}
                max={2100}
                required
                defaultValue={new Date().getFullYear()}
                className="w-28"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="file">Recopilación anual (PDF)</Label>
              <Input id="file" name="file" type="file" accept=".pdf" required />
            </div>
            <Button type="submit" className="min-h-10">
              <Upload className="size-4" aria-hidden /> Subir y procesar
            </Button>
          </form>
        </CardContent>
      </Card>

      {jobs.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Sin ingestas todavía"
          description="Empieza subiendo la recopilación de actas de un año (2015–2026 en la primera fase)."
        />
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => {
            const st = STATUS_LABEL[j.status] ?? STATUS_LABEL.uploaded;
            return (
              <li key={j.id}>
                <Link
                  href={`/ingesta/${j.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-ring/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {j.original_name ?? "Documento"} {j.año ? `· ${j.año}` : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Subido el {formatFecha(j.created_at)}
                      {j.pendientes > 0 ? ` · ${j.pendientes} por revisar` : ""}
                      {j.aprobados > 0 ? ` · ${j.aprobados} aprobados` : ""}
                      {j.rechazados > 0 ? ` · ${j.rechazados} rechazados` : ""}
                    </div>
                  </div>
                  <Badge className={`shrink-0 ${st.cls}`}>{st.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
