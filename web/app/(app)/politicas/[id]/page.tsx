import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Gavel, Library, Pencil, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import {
  formatFecha,
  POLITICA_ESTADOS,
  type AcuerdoEstado,
  type PoliticaEstado,
} from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addAcuerdoToPolitica, removeAcuerdoFromPolitica } from "../actions";

type PoliticaRow = {
  id: string;
  public_ref: string;
  titulo: string;
  resumen: string | null;
  cuerpo_md: string | null;
  estado: PoliticaEstado;
  area_name: string | null;
};

type AcuerdoRow = {
  id: string;
  public_ref: string;
  titulo: string;
  estado: AcuerdoEstado;
  fecha_adopcion: string;
  acta_id: string;
  acta_numero: number;
  acta_año: number;
  source_page: number | null;
};

export default async function PoliticaPage({ params }: PageProps<"/politicas/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  const [politicas, acuerdos] = await Promise.all([
    queryAsUser<PoliticaRow>(
      user.id,
      `SELECT p.id, p.public_ref, p.titulo, p.resumen, p.cuerpo_md, p.estado, a.name AS area_name
       FROM politicas p LEFT JOIN areas a ON a.id = p.primary_area_id
       WHERE p.id = $1`,
      [id]
    ),
    queryAsUser<AcuerdoRow>(
      user.id,
      `SELECT ac.id, ac.public_ref, ac.titulo, ac.estado, ac.fecha_adopcion,
              ac.acta_id, a.numero AS acta_numero, a.año AS acta_año, ac.source_page
       FROM politica_acuerdos pa
       JOIN acuerdos ac ON ac.id = pa.acuerdo_id
       JOIN actas a ON a.id = ac.acta_id
       WHERE pa.politica_id = $1
       ORDER BY ac.fecha_adopcion`,
      [id]
    ),
  ]);

  const p = politicas[0];
  if (!p) notFound();
  const secretary = isSecretary(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.titulo}
        description={p.resumen ?? undefined}
        meta={
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-status-vigor-bg px-2.5 py-0.5 text-xs font-medium text-status-vigor">
              <Library className="size-3" aria-hidden /> Política
            </span>
            {p.estado !== "vigente" ? (
              <Badge variant="secondary">{POLITICA_ESTADOS[p.estado]}</Badge>
            ) : null}
            {p.area_name ? <Badge variant="outline">{p.area_name}</Badge> : null}
            <span className="font-mono text-xs text-muted-foreground">{p.public_ref}</span>
          </>
        }
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <a href={`/api/informes/politica/${p.id}?formato=pdf`}>
                <Download className="size-4" aria-hidden /> Exportar
              </a>
            </Button>
            {secretary ? (
              <Button asChild>
                <Link href={`/politicas/${p.id}/editar`}>
                  <Pencil className="size-4" aria-hidden /> Editar
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Cuerpo de la política (markdown saneado) */}
      <Card>
        <CardContent className="py-5">
          {p.cuerpo_md?.trim() ? (
            <Markdown>{p.cuerpo_md}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta política aún no tiene contenido.{" "}
              {secretary ? (
                <Link href={`/politicas/${p.id}/editar`} className="text-primary underline-offset-4 hover:underline">
                  Redáctala ahora.
                </Link>
              ) : null}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Acuerdos que sustentan la política */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Acuerdos de la política ({acuerdos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {secretary ? (
            <form action={addAcuerdoToPolitica} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="politicaId" value={p.id} />
              <div className="flex-1 space-y-1">
                <Label htmlFor="add-ref" className="text-xs">
                  Añadir acuerdo por referencia
                </Label>
                <Input id="add-ref" name="acuerdoRef" placeholder="ACU-2018-0142" required />
              </div>
              <Button type="submit" variant="outline" className="min-h-9">
                <Plus className="size-4" aria-hidden /> Añadir
              </Button>
            </form>
          ) : null}

          {acuerdos.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              Añade acuerdos por su referencia para sustentar esta política.
            </p>
          ) : (
            <ul className="divide-y">
              {acuerdos.map((ac) => (
                <li key={ac.id} className="flex items-center justify-between gap-3 py-3">
                  <Link
                    href={`/acuerdos/${ac.id}`}
                    className="-mx-2 min-w-0 flex-1 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <Gavel className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate text-sm font-medium">{ac.titulo}</span>
                    </div>
                    <div className="mt-0.5 pl-5.5 text-xs text-muted-foreground">
                      {ac.public_ref} · {formatFecha(ac.fecha_adopcion)} · Acta {ac.acta_numero}/
                      {ac.acta_año}
                      {ac.source_page ? `, pág. ${ac.source_page}` : ""}
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge estado={ac.estado} />
                    {secretary ? (
                      <form action={removeAcuerdoFromPolitica}>
                        <input type="hidden" name="politicaId" value={p.id} />
                        <input type="hidden" name="acuerdoId" value={ac.id} />
                        <button
                          type="submit"
                          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                        >
                          Quitar
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
