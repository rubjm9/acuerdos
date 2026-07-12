import { requireSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { ACUERDO_ESTADOS } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { AreaMultiSelect } from "@/components/forms/area-multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createAcuerdo } from "../actions";

export const metadata = { title: "Nuevo acuerdo" };

export default async function NuevoAcuerdoPage({
  searchParams,
}: {
  searchParams: Promise<{ acta?: string }>;
}) {
  const user = await requireSecretary();
  const { acta } = await searchParams;

  const [actas, areas] = await Promise.all([
    queryAsUser<{ id: string; numero: number; año: number; fecha: string }>(
      user.id,
      "SELECT id, numero, año, fecha FROM actas ORDER BY fecha DESC LIMIT 100"
    ),
    queryAsUser<{ id: string; name: string; is_restricted: boolean }>(
      user.id,
      "SELECT id, name, is_restricted FROM areas WHERE is_active ORDER BY is_restricted, name"
    ),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nuevo acuerdo"
        description="Registra una decisión formal con su acta de origen y sus áreas."
      />
      <Card>
        <CardContent>
          <form action={createAcuerdo} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título breve</Label>
              <Input
                id="titulo"
                name="titulo"
                required
                maxLength={200}
                placeholder="Resumen en una línea (visible en listados)"
              />
              <p className="text-xs text-muted-foreground">
                Si el acuerdo pertenece a un área restringida, evita datos personales en el título.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="texto">Texto íntegro del acuerdo</Label>
              <Textarea id="texto" name="texto" required rows={8} className="leading-relaxed" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="acta_id">Acta de origen</Label>
                <select
                  id="acta_id"
                  name="acta_id"
                  required
                  defaultValue={acta ?? ""}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="" disabled>
                    Selecciona un acta
                  </option>
                  {actas.map((a) => (
                    <option key={a.id} value={a.id}>
                      Acta {a.numero}/{a.año}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source_page">Página en el acta (opcional)</Label>
                <Input id="source_page" name="source_page" type="number" min={1} placeholder="p. ej. 4" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fecha_adopcion">Fecha de adopción</Label>
                <Input id="fecha_adopcion" name="fecha_adopcion" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estado">Estado</Label>
                <select
                  id="estado"
                  name="estado"
                  defaultValue="en_vigor"
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
              <Label>Áreas (una o varias)</Label>
              <AreaMultiSelect areas={areas} />
              <p className="text-xs text-muted-foreground">
                Si seleccionas un área restringida, el texto se guarda cifrado y no entra en el
                índice de búsqueda.
              </p>
            </div>

            <Button type="submit" className="w-full min-h-11 sm:w-auto">
              Crear acuerdo
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
