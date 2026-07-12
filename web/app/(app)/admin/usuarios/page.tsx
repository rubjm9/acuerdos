import { requireAdmin } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { ROLES, type Role } from "@/lib/domain";
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
import {
  createUser,
  toggleUserActive,
  setUserRole,
  grantAreaAccess,
  revokeAreaAccess,
} from "../actions";

export const metadata = { title: "Usuarios" };

type UserRow = {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  roles: Role[];
  restricted_areas: { id: string; name: string }[] | null;
};

type AreaRow = { id: string; name: string };

export default async function UsuariosPage() {
  const admin = await requireAdmin();
  const [users, restrictedAreas] = await Promise.all([
    queryAsUser<UserRow>(
      admin.id,
      `SELECT u.id, u.email, u.name, u.is_active,
              COALESCE(array_agg(DISTINCT ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles,
              (SELECT json_agg(json_build_object('id', a.id, 'name', a.name))
               FROM user_area_access uaa JOIN areas a ON a.id = uaa.area_id
               WHERE uaa.user_id = u.id AND a.is_restricted AND uaa.can_view) AS restricted_areas
       FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
       GROUP BY u.id ORDER BY u.name`
    ),
    queryAsUser<AreaRow>(
      admin.id,
      "SELECT id, name FROM areas WHERE is_restricted AND is_active ORDER BY name"
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios y roles"
        description="Alta de personas, asignación de rol y acceso a las áreas restringidas."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva persona</CardTitle>
          <CardDescription>
            Podrá iniciar sesión con su cuenta de Google del dominio autorizado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createUser} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Nombre</Label>
              <Input id="new-name" name="name" required placeholder="Nombre y apellidos" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" name="email" type="email" required placeholder="nombre@bahai.es" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role">Rol</Label>
              <select
                id="new-role"
                name="role"
                className="border-input h-9 w-full min-w-36 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                defaultValue="member"
              >
                {Object.entries(ROLES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="min-h-9">
              Crear
            </Button>
          </form>
        </CardContent>
      </Card>

      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id}>
            <Card className={!u.is_active ? "opacity-60" : undefined}>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {u.name}
                      {!u.is_active ? <Badge variant="secondary">Desactivado</Badge> : null}
                    </div>
                    <div className="text-sm text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={setUserRole} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        Rol de {u.name}
                      </label>
                      <select
                        id={`role-${u.id}`}
                        name="role"
                        defaultValue={u.roles[0] ?? "member"}
                        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                      >
                        {Object.entries(ROLES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="outline" size="sm">
                        Guardar
                      </Button>
                    </form>
                    <form action={toggleUserActive}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {u.is_active ? "Desactivar" : "Reactivar"}
                      </Button>
                    </form>
                  </div>
                </div>

                {restrictedAreas.length > 0 ? (
                  <div className="rounded-xl bg-muted/50 p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      Acceso a áreas restringidas
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {restrictedAreas.map((a) => {
                        const has = (u.restricted_areas ?? []).some((ra) => ra.id === a.id);
                        return (
                          <form key={a.id} action={has ? revokeAreaAccess : grantAreaAccess}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="areaId" value={a.id} />
                            <button
                              type="submit"
                              aria-pressed={has}
                              className={
                                has
                                  ? "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-3 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/70"
                                  : "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-dashed px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-solid hover:text-foreground"
                              }
                            >
                              <span
                                className={
                                  has ? "size-1.5 rounded-full bg-primary" : "size-1.5 rounded-full bg-border"
                                }
                                aria-hidden
                              />
                              {a.name}
                              <span className="sr-only">{has ? " — retirar acceso" : " — conceder acceso"}</span>
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
