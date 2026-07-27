import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, Plus } from "lucide-react";
import { requireUser, isSecretary, hasRole } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { formatFechaLarga, ACTA_ESTADOS, type AcuerdoEstado } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ActaRow = {
  id: string;
  numero: number;
  fecha: string;
  año: number;
  estado: keyof typeof ACTA_ESTADOS;
  file_object_key: string | null;
  compilation_año: number | null;
  page_start: number | null;
};

type AcuerdoRow = {
  id: string;
  public_ref: string;
  titulo: string;
  estado: AcuerdoEstado;
  source_page: number | null;
};

export default async function ActaPage({ params }: PageProps<"/actas/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  const [actas, acuerdos] = await Promise.all([
    queryAsUser<ActaRow>(
      user.id,
      `SELECT id, numero, fecha, año, estado, file_object_key, compilation_año, page_start
       FROM actas WHERE id = $1`,
      [id]
    ),
    queryAsUser<AcuerdoRow>(
      user.id,
      `SELECT id, public_ref, titulo, estado, source_page
       FROM acuerdos WHERE acta_id = $1 ORDER BY source_page NULLS LAST, public_ref`,
      [id]
    ),
  ]);

  const acta = actas[0];
  if (!acta) notFound();

  const canDownload = hasRole(user, "administrator", "secretary", "member");
  const hasFile = Boolean(acta.file_object_key);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Acta ${acta.numero}/${acta.año}`}
        description={`Reunión del ${formatFechaLarga(acta.fecha)}`}
        meta={
          acta.estado !== "definitiva" ? (
            <Badge variant="secondary">{ACTA_ESTADOS[acta.estado]}</Badge>
          ) : undefined
        }
        action={
          <div className="flex gap-2">
            {hasFile && canDownload ? (
              <Button asChild variant="outline">
                <a href={`/api/actas/${acta.id}/descarga`}>
                  <Download className="size-4" aria-hidden /> Documento original
                </a>
              </Button>
            ) : null}
            {isSecretary(user) ? (
              <Button asChild>
                <Link href={`/acuerdos/nuevo?acta=${acta.id}`}>
                  <Plus className="size-4" aria-hidden /> Añadir acuerdo
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {acta.compilation_año ? (
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          Esta acta forma parte de la recopilación anual de {acta.compilation_año}
          {acta.page_start ? `, a partir de la página ${acta.page_start}` : ""}.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            Acuerdos de esta acta ({acuerdos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {acuerdos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Esta acta aún no tiene acuerdos registrados.
            </p>
          ) : (
            <ul className="divide-y">
              {acuerdos.map((ac) => (
                <li key={ac.id}>
                  <Link
                    href={`/acuerdos/${ac.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg py-3 -mx-2 px-2 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{ac.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        {ac.public_ref}
                        {ac.source_page ? ` · pág. ${ac.source_page}` : ""}
                      </div>
                    </div>
                    <StatusBadge estado={ac.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!hasFile ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" aria-hidden />
          Esta acta no tiene documento adjunto.
        </p>
      ) : null}
    </div>
  );
}
