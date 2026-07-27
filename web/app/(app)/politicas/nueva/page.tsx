import { requireSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createPolitica } from "../actions";

export const metadata = { title: "Nueva política" };

export default async function NuevaPoliticaPage() {
  const user = await requireSecretary();
  const areas = await queryAsUser<{ id: string; name: string; is_restricted: boolean }>(
    user.id,
    "SELECT id, name, is_restricted FROM areas WHERE is_active ORDER BY is_restricted, name"
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Nueva política"
        description="Consolida la postura de la Asamblea sobre un asunto y reúne los acuerdos que la sustentan."
      />
      <Card>
        <CardContent>
          <form action={createPolitica} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" name="titulo" required maxLength={200} placeholder="Tema de la política" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resumen">Resumen (opcional)</Label>
              <Textarea id="resumen" name="resumen" rows={2} placeholder="Descripción breve para los listados" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_area_id">Área principal (opcional)</Label>
              <select
                id="primary_area_id"
                name="primary_area_id"
                defaultValue=""
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
              <p className="text-xs text-muted-foreground">
                Si eliges un área restringida, la política solo será visible para quien tenga
                acceso a esa área y su cuerpo no se indexará para búsqueda.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Cuerpo de la política</Label>
              <MarkdownEditor
                name="cuerpo_md"
                placeholder={"## Principios\n\n- Primer principio\n- Segundo principio\n\n## Procedimiento\n\n…"}
              />
            </div>
            <Button type="submit" className="w-full min-h-11 sm:w-auto">
              Crear política
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
