import { notFound } from "next/navigation";
import { requireSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { decryptField } from "@/lib/crypto";
import { ACUERDO_ESTADOS, toDateInput, type AcuerdoEstado } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { AreaMultiSelect } from "@/components/forms/area-multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { updateAcuerdo } from "../../actions";

export const metadata = { title: "Editar acuerdo" };

type Row = {
  id: string;
  public_ref: string;
  titulo: string;
  full_text: string | null;
  full_text_enc: Buffer | null;
  fecha_adopcion: string;
  estado: AcuerdoEstado;
  is_restricted: boolean;
  source_page: number | null;
  acta_id: string;
  area_ids: string[];
};

export default async function EditarAcuerdoPage({
  params,
}: PageProps<"/acuerdos/[id]/editar">) {
  const user = await requireSecretary();
  const { id } = await params;

  const [rows, actas, areas] = await Promise.all([
    queryAsUser<Row>(
      user.id,
      `SELECT ac.id, ac.public_ref, ac.titulo, ac.full_text, ac.full_text_enc,
              ac.fecha_adopcion, ac.estado, ac.is_restricted, ac.source_page, ac.acta_id,
              COALESCE((SELECT array_agg(area_id) FROM acuerdo_areas WHERE acuerdo_id = ac.id), '{}') AS area_ids
       FROM acuerdos ac WHERE ac.id = $1`,
      [id]
    ),
    queryAsUser<{ id: string; numero: number; año: number }>(
      user.id,
      "SELECT id, numero, año FROM actas ORDER BY fecha DESC LIMIT 200"
    ),
    queryAsUser<{ id: string; name: string; is_restricted: boolean }>(
      user.id,
      "SELECT id, name, is_restricted FROM areas WHERE is_active ORDER BY is_restricted, name"
    ),
  ]);

  const ac = rows[0];
  if (!ac) notFound();

  const texto =
    ac.is_restricted && ac.full_text_enc
      ? decryptField(Buffer.from(ac.full_text_enc))
      : ac.full_text ?? "";

  const fecha = toDateInput(ac.fecha_adopcion);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Editar ${ac.public_ref}`}
        description="La referencia pública es permanente y no se puede cambiar."
      />
      <Card>
        <CardContent>
          <form action={updateAcuerdo} className="space-y-5">
            <input type="hidden" name="acuerdoId" value={ac.id} />
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título breve</Label>
              <Input id="titulo" name="titulo" required maxLength={200} defaultValue={ac.titulo} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="texto">Texto íntegro</Label>
              <Textarea
                id="texto"
                name="texto"
                required
                rows={10}
                defaultValue={texto}
                className="leading-relaxed"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="acta_id">Acta de origen</Label>
                <select
                  id="acta_id"
                  name="acta_id"
                  required
                  defaultValue={ac.acta_id}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  {actas.map((a) => (
                    <option key={a.id} value={a.id}>
                      Acta {a.numero}/{a.año}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source_page">Página en el acta</Label>
                <Input
                  id="source_page"
                  name="source_page"
                  type="number"
                  min={1}
                  defaultValue={ac.source_page ?? ""}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fecha_adopcion">Fecha de adopción</Label>
                <Input id="fecha_adopcion" name="fecha_adopcion" type="date" required defaultValue={fecha} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estado">Estado</Label>
                <select
                  id="estado"
                  name="estado"
                  defaultValue={ac.estado}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  {Object.entries(ACUERDO_ESTADOS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Áreas</Label>
              <AreaMultiSelect areas={areas} defaultSelected={ac.area_ids} />
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
