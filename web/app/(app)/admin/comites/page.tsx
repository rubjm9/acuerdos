import { requireAdmin } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createCommittee, setCommitteeMembers } from "../actions";

export const metadata = { title: "Comités y agencias" };

type CommitteeRow = {
  id: string;
  name: string;
  area_name: string | null;
  member_ids: string[];
};

type UserRow = { id: string; name: string };
type AreaRow = { id: string; name: string };

export default async function ComitesPage() {
  const admin = await requireAdmin();
  const [committees, users, areas] = await Promise.all([
    queryAsUser<CommitteeRow>(
      admin.id,
      `SELECT c.id, c.name, a.name AS area_name,
              COALESCE(array_agg(cm.user_id) FILTER (WHERE cm.user_id IS NOT NULL), '{}') AS member_ids
       FROM committees c
       LEFT JOIN areas a ON a.id = c.area_id
       LEFT JOIN committee_members cm ON cm.committee_id = c.id
       WHERE c.is_active
       GROUP BY c.id, a.name ORDER BY c.name`
    ),
    queryAsUser<UserRow>(admin.id, "SELECT id, name FROM users WHERE is_active ORDER BY name"),
    queryAsUser<AreaRow>(
      admin.id,
      "SELECT id, name FROM areas WHERE is_active AND NOT is_restricted ORDER BY name"
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comités y agencias"
        description="Entidades a las que se pueden asignar tareas. Sus miembros ven las tareas del comité."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo comité</CardTitle>
          <CardDescription>Opcionalmente asociado a un área.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCommittee} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="committee-name">Nombre</Label>
              <Input id="committee-name" name="name" required placeholder="Comité de…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="committee-area">Área (opcional)</Label>
              <select
                id="committee-area"
                name="areaId"
                className="border-input h-9 w-full min-w-44 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                defaultValue=""
              >
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Crear</Button>
          </form>
        </CardContent>
      </Card>

      <ul className="space-y-3">
        {committees.map((c) => (
          <li key={c.id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{c.name}</CardTitle>
                {c.area_name ? <CardDescription>Área: {c.area_name}</CardDescription> : null}
              </CardHeader>
              <CardContent>
                <form action={setCommitteeMembers} className="space-y-3">
                  <input type="hidden" name="committeeId" value={c.id} />
                  <div className="text-xs font-medium text-muted-foreground">Miembros</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {users.map((u) => (
                      <label key={u.id} className="flex min-h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="memberIds"
                          value={u.id}
                          defaultChecked={c.member_ids.includes(u.id)}
                          className="size-4 accent-primary"
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                  <Button type="submit" variant="outline" size="sm">
                    Guardar miembros
                  </Button>
                </form>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
