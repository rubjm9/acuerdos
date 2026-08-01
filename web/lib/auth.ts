import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { ownerPool } from "@/lib/db";
import type { Role } from "@/lib/domain";

/**
 * Autenticación:
 *  - Producción: Google Workspace OIDC restringido a AUTH_ALLOWED_DOMAIN.
 *    Solo metadatos de identidad (email) transitan por Google; jamás contenido.
 *  - Desarrollo: login por email (AUTH_DEV_LOGIN=true), sin contraseña.
 *
 * El usuario DEBE existir en `users` y estar activo (aprovisionamiento por
 * Administración). Excepción: si la tabla está vacía, el primer login crea
 * el primer administrador (bootstrap).
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: Role[];
    } & DefaultSession["user"];
  }
}

const allowedDomain = process.env.AUTH_ALLOWED_DOMAIN ?? "bahai.es";

async function resolveUser(email: string, name: string | null, googleSub?: string) {
  const client = await ownerPool.connect();
  try {
    const existing = await client.query(
      "SELECT id, is_active FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      if (!existing.rows[0].is_active) return null;
      if (googleSub) {
        await client.query(
          "UPDATE users SET google_sub = COALESCE(google_sub, $2) WHERE id = $1",
          [existing.rows[0].id, googleSub]
        );
      }
      return existing.rows[0].id as string;
    }
    // Bootstrap: primer usuario => administrador
    const count = await client.query("SELECT count(*)::int AS n FROM users");
    if (count.rows[0].n === 0) {
      const created = await client.query(
        "INSERT INTO users (email, name, google_sub) VALUES ($1, $2, $3) RETURNING id",
        [email.toLowerCase(), name ?? email, googleSub ?? null]
      );
      await client.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'administrator')", [
        created.rows[0].id,
      ]);
      return created.rows[0].id as string;
    }
    return null; // no aprovisionado
  } finally {
    client.release();
  }
}

async function loadRoles(userId: string): Promise<Role[]> {
  const res = await ownerPool.query("SELECT role FROM user_roles WHERE user_id = $1", [userId]);
  return res.rows.map((r) => r.role as Role);
}

const providers = [];

if (process.env.AUTH_GOOGLE_ID) {
  providers.push(
    Google({
      authorization: { params: { hd: allowedDomain, prompt: "select_account" } },
    })
  );
}

if (process.env.AUTH_DEV_LOGIN === "true") {
  providers.push(
    Credentials({
      id: "dev",
      name: "Desarrollo (email)",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase();
        if (!email) return null;
        const userId = await resolveUser(email, email.split("@")[0]);
        if (!userId) return null;
        const res = await ownerPool.query("SELECT name FROM users WHERE id = $1", [userId]);
        return { id: userId, email, name: res.rows[0]?.name ?? email.split("@")[0] };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  // Vercel / proxies: Auth.js necesita confiar en el host de AUTH_URL.
  trustHost: true,
  pages: { signIn: "/acceso" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // Defensa en profundidad: el parámetro hd no es garantía; verificamos.
        const email = user.email ?? "";
        const hd = (profile as { hd?: string } | null)?.hd;
        if (!email.endsWith(`@${allowedDomain}`) || hd !== allowedDomain) return false;
        const userId = await resolveUser(email, user.name ?? null, account.providerAccountId);
        if (!userId) return false;
        (user as { id?: string }).id = userId;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        token.roles = await loadRoles(user.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.roles = (token.roles as Role[]) ?? [];
      }
      return session;
    },
  },
});
