import Link from "next/link";
import { requireSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createTarea } from "../actions";

export const metadata = { title: "Nueva tarea" };

export default async function NuevaTareaPage({
  searchParams,
}: {
  searchParams: Promise<{ acuerdo?: string }>;
}) {
  const user = await requireSecretary();
  const { acuerdo } = await searchParams;

  const [acuerdos, usuarios, comites] = await Promise.all([
    queryAsUser<{ id: string; public_ref: string; titulo: string }>(
      user.id,
      "SELECT id, public_ref, titulo FROM acuerdos ORDER BY fecha_adopcion DESC LIMIT 200"
    ),
    queryAsUser<{ id: string; name: string }>(
      user.id,
      "SELECT id, name FROM users WHERE is_active ORDER BY name"
    ),
    queryAsUser<{ id: string; name: string }>(
      user.id,
      "SELECT id, name FROM committees WHERE is_active ORDER BY name"
    ),
  ]);

  const acuerdoDefault =
    acuerdo && acuerdos.some((a) => a.id === acuerdo) ? acuerdo : "";

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <PageHeader
        title="Nueva tarea"
        description="Todo encargo deriva de un acuerdo y tiene un responsable."
      />
      <Card>
        <CardContent>
          {acuerdos.length === 0 ? (
            <div className="space-y-3 py-2 text-sm text-muted-foreground">
              <p>
                No hay acuerdos todavía. Crea un acuerdo primero y luego podrás
                asignarle tareas.
              </p>
              <Button asChild>
                <Link href="/acuerdos/nuevo">Crear acuerdo</Link>
              </Button>
            </div>
          ) : (
            <form action={createTarea} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="acuerdo_id">Acuerdo de origen</Label>
                <select
                  id="acuerdo_id"
                  name="acuerdo_id"
                  required
                  defaultValue={acuerdoDefault}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="">Selecciona un acuerdo</option>
                  {acuerdos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.public_ref} — {a.titulo.slice(0, 70)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  name="titulo"
                  required
                  maxLength={200}
                  placeholder="Qué hay que hacer"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="descripcion">Descripción (opcional)</Label>
                <Textarea id="descripcion" name="descripcion" rows={4} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="assignee">Responsable</Label>
                  <select
                    id="assignee"
                    name="assignee"
                    required
                    defaultValue=""
                    className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="">Persona o comité</option>
                    <optgroup label="Personas">
                      {usuarios.map((u) => (
                        <option key={u.id} value={`u:${u.id}`}>
                          {u.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Comités y agencias">
                      {comites.map((c) => (
                        <option key={c.id} value={`c:${c.id}`}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fecha_vencimiento">Fecha límite (opcional)</Label>
                  <Input id="fecha_vencimiento" name="fecha_vencimiento" type="date" />
                </div>
              </div>

              <Button type="submit" className="w-full min-h-11 sm:w-auto">
                Crear tarea
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
