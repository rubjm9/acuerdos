import { requireSecretary } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ACTA_ESTADOS } from "@/lib/domain";
import { createActa } from "../actions";

export const metadata = { title: "Nueva acta" };

export default async function NuevaActaPage() {
  await requireSecretary();

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <PageHeader
        title="Nueva acta"
        description="Registra una reunión y adjunta su documento original (PDF o Word)."
      />
      <Card>
        <CardContent>
          <form action={createActa} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" name="numero" type="number" min={1} required placeholder="p. ej. 12" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha de la reunión</Label>
                <Input id="fecha" name="fecha" type="date" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estado">Estado</Label>
              <select
                id="estado"
                name="estado"
                defaultValue="definitiva"
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                {Object.entries(ACTA_ESTADOS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file">Documento original (opcional)</Label>
              <Input id="file" name="file" type="file" accept=".pdf,.doc,.docx" />
              <p className="text-xs text-muted-foreground">
                PDF o Word, máximo 50 MB. Se guarda cifrado en el almacenamiento de la UE.
              </p>
            </div>
            <Button type="submit" className="w-full min-h-11 sm:w-auto">
              Crear acta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
