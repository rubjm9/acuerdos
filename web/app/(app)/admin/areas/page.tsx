import { Lock } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createArea, renameArea, toggleAreaActive } from "../actions";

export const metadata = { title: "Áreas" };

type AreaRow = {
  id: string;
  name: string;
  slug: string;
  is_restricted: boolean;
  is_active: boolean;
  n_acuerdos: number;
};

export default async function AreasPage() {
  const admin = await requireAdmin();
  const areas = await queryAsUser<AreaRow>(
    admin.id,
    `SELECT a.id, a.name, a.slug, a.is_restricted, a.is_active,
            (SELECT count(*) FROM acuerdo_areas aa WHERE aa.area_id = a.id)::int AS n_acuerdos
     FROM areas a ORDER BY a.is_active DESC, a.name`
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Áreas"
        description="Taxonomía temática. Un acuerdo puede pertenecer a varias áreas."
      />

      <Card>
        <CardHeader>
          <CardTitle>Nueva área</CardTitle>
          <CardDescription>
            Las áreas restringidas solo son visibles con acceso explícito y quedan
            bajo auditoría reforzada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createArea} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="area-name">Nombre</Label>
              <Input id="area-name" name="name" required placeholder="Nombre del área" />
            </div>
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" name="is_restricted" className="size-4 accent-primary" />
              Restringida
            </label>
            <Button type="submit">Crear</Button>
          </form>
        </CardContent>
      </Card>

      <ul className="space-y-2">
        {areas.map((a) => (
          <li key={a.id}>
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 ${
                !a.is_active ? "opacity-60" : ""
              }`}
            >
              <form action={renameArea} className="flex flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="areaId" value={a.id} />
                <label className="sr-only" htmlFor={`area-${a.id}`}>
                  Nombre de {a.name}
                </label>
                <Input
                  id={`area-${a.id}`}
                  name="name"
                  defaultValue={a.name}
                  className="max-w-xs"
                />
                {a.is_restricted ? (
                  <Badge className="gap-1 bg-status-anulado-bg text-status-anulado">
                    <Lock className="size-3" aria-hidden /> Restringida
                  </Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {a.n_acuerdos} {a.n_acuerdos === 1 ? "acuerdo" : "acuerdos"}
                </span>
                <Button type="submit" variant="outline" size="sm">
                  Renombrar
                </Button>
              </form>
              <form action={toggleAreaActive}>
                <input type="hidden" name="areaId" value={a.id} />
                <Button type="submit" variant="ghost" size="sm">
                  {a.is_active ? "Archivar" : "Reactivar"}
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
