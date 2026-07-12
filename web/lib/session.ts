import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/domain";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
};

/** Usuario autenticado o redirección a /acceso. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/acceso");
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    roles: session.user.roles ?? [],
  };
}

export function hasRole(user: SessionUser, ...roles: Role[]): boolean {
  return user.roles.some((r) => roles.includes(r));
}

export function isSecretary(user: SessionUser): boolean {
  return hasRole(user, "secretary", "administrator");
}

export function isAdmin(user: SessionUser): boolean {
  return hasRole(user, "administrator");
}

/** Solo secretaría/administración; si no, redirección al inicio. */
export async function requireSecretary(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isSecretary(user)) redirect("/");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  return user;
}
