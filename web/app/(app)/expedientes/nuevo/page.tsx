import { requireSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createExpediente } from "../actions";

export const metadata = { title: "Nuevo expediente" };

export default async function NuevoExpedientePage() {
  const user = await requireSecretary();
  const areas = await queryAsUser<{ id: string; name: string; is_restricted: boolean }>(
    user.id,
    "SELECT id, name, is_restricted FROM areas WHERE is_active ORDER BY is_restricted, name"
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Nuevo expediente"
        description="Crea un hilo para seguir un asunto a lo largo del tiempo."
      />
      <Card>
        <CardContent>
          <form action={createExpediente} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" name="titulo" required maxLength={200} placeholder="Asunto del expediente" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Textarea id="descripcion" name="descripcion" rows={3} />
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
                Si eliges un área restringida, el expediente solo será visible para quien tenga
                acceso a esa área.
              </p>
            </div>
            <Button type="submit" className="w-full min-h-11 sm:w-auto">
              Crear expediente
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
