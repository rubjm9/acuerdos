import { notFound } from "next/navigation";
import { requireSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { POLITICA_ESTADOS, type PoliticaEstado } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { updatePolitica } from "../../actions";

export const metadata = { title: "Editar política" };

type Row = {
  id: string;
  public_ref: string;
  titulo: string;
  resumen: string | null;
  cuerpo_md: string | null;
  estado: PoliticaEstado;
  primary_area_id: string | null;
};

export default async function EditarPoliticaPage({
  params,
}: PageProps<"/politicas/[id]/editar">) {
  const user = await requireSecretary();
  const { id } = await params;

  const [rows, areas] = await Promise.all([
    queryAsUser<Row>(
      user.id,
      `SELECT id, public_ref, titulo, resumen, cuerpo_md, estado, primary_area_id
       FROM politicas WHERE id = $1`,
      [id]
    ),
    queryAsUser<{ id: string; name: string; is_restricted: boolean }>(
      user.id,
      "SELECT id, name, is_restricted FROM areas WHERE is_active ORDER BY is_restricted, name"
    ),
  ]);

  const p = rows[0];
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Editar ${p.public_ref}`}
        description="La referencia pública es permanente y no se puede cambiar."
      />
      <Card>
        <CardContent>
          <form action={updatePolitica} className="space-y-5">
            <input type="hidden" name="politicaId" value={p.id} />
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" name="titulo" required maxLength={200} defaultValue={p.titulo} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resumen">Resumen</Label>
              <Textarea id="resumen" name="resumen" rows={2} defaultValue={p.resumen ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="primary_area_id">Área principal</Label>
                <select
                  id="primary_area_id"
                  name="primary_area_id"
                  defaultValue={p.primary_area_id ?? ""}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="">Sin área principal</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.is_restricted ? " (restringida)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estado">Estado</Label>
                <select
                  id="estado"
                  name="estado"
                  defaultValue={p.estado}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  {Object.entries(POLITICA_ESTADOS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cuerpo de la política</Label>
              <MarkdownEditor name="cuerpo_md" defaultValue={p.cuerpo_md ?? ""} />
            </div>
            <Button type="submit" className="w-full min-h-11 sm:w-auto">
              Guardar cambios
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
