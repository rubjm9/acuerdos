import { BarChart3, FileSpreadsheet, FileText } from "lucide-react";
import { requireUser } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Informes" };

export default async function InformesPage() {
  const user = await requireUser();
  const [areas, expedientes] = await Promise.all([
    queryAsUser<{ id: string; name: string }>(
      user.id,
      "SELECT id, name FROM areas WHERE is_active ORDER BY name"
    ),
    queryAsUser<{ id: string; titulo: string }>(
      user.id,
      "SELECT id, titulo FROM expedientes ORDER BY updated_at DESC LIMIT 100"
    ),
  ]);

  const selectClass =
    "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Informes"
        description="Exportaciones en PDF y hoja de cálculo, siempre con la cita de origen."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Histórico de expediente */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de un expediente</CardTitle>
            <CardDescription>
              Línea de tiempo completa con cada acuerdo y su acta y página.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/informes/expediente/redirect" method="get" className="space-y-3">
              <label className="sr-only" htmlFor="r-exp">Expediente</label>
              <select
                id="r-exp"
                name="id"
                required
                className={selectClass}
                defaultValue=""
              >
                <option value="" disabled>
                  Selecciona un expediente
                </option>
                {expedientes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.titulo}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="formato" value="pdf" variant="outline">
                  <FileText className="size-4" aria-hidden /> PDF
                </Button>
                <Button type="submit" name="formato" value="xlsx" variant="outline">
                  <FileSpreadsheet className="size-4" aria-hidden /> Hoja de cálculo
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tareas pendientes */}
        <Card>
          <CardHeader>
            <CardTitle>Tareas pendientes</CardTitle>
            <CardDescription>
              Por miembro y por comité, con vencimientos y tareas vencidas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href="/api/informes/tareas?formato=pdf">
                <FileText className="size-4" aria-hidden /> PDF
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/api/informes/tareas?formato=xlsx">
                <FileSpreadsheet className="size-4" aria-hidden /> Hoja de cálculo
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Acuerdos por área */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Acuerdos por área y estado</CardTitle>
            <CardDescription>
              Visión general del estado de los acuerdos, filtrable por área.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/informes/acuerdos" method="get" className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1 space-y-1">
                <label htmlFor="r-area" className="text-xs font-medium">
                  Área (opcional)
                </label>
                <select id="r-area" name="area" className={selectClass} defaultValue="">
                  <option value="">Todas las áreas</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-28 space-y-1">
                <label htmlFor="r-año" className="text-xs font-medium">
                  Año
                </label>
                <input
                  id="r-año"
                  name="año"
                  type="number"
                  min={1990}
                  max={2100}
                  placeholder="Todos"
                  className={selectClass}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" name="formato" value="pdf" variant="outline">
                  <FileText className="size-4" aria-hidden /> PDF
                </Button>
                <Button type="submit" name="formato" value="xlsx" variant="outline">
                  <FileSpreadsheet className="size-4" aria-hidden /> Hoja de cálculo
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <BarChart3 className="size-4" aria-hidden />
        Toda exportación queda registrada en la auditoría. El contenido de áreas restringidas no
        se incluye en los informes.
      </p>
    </div>
  );
}
