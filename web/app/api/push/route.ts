import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withUser } from "@/lib/db";

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

/** Alta de suscripción push del usuario actual. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const body = subSchema.parse(await req.json());
  await withUser(session.user.id, async (c) => {
    await c.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
      [session.user.id, body.endpoint, body.keys.p256dh, body.keys.auth]
    );
  });
  return NextResponse.json({ ok: true });
}

/** Baja de la suscripción. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await req.json());
  await withUser(session.user.id, async (c) => {
    await c.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
  });
  return NextResponse.json({ ok: true });
}
