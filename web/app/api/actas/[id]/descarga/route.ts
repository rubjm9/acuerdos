import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { queryAsUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { presignDownload, BUCKET_ACTAS } from "@/lib/s3";

/**
 * Descarga del archivo original de un acta.
 * El PDF completo puede contener acuerdos de áreas restringidas, por lo que
 * la descarga se limita a administrator/secretary/member y SIEMPRE se audita.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/actas/[id]/descarga">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  const canDownload = ["administrator", "secretary", "member"].some((r) =>
    (roles as string[]).includes(r)
  );
  if (!canDownload) {
    return NextResponse.json({ error: "Sin permiso de descarga" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const rows = await queryAsUser<{
    file_object_key: string | null;
    numero: number;
    año: number;
  }>(session.user.id, "SELECT file_object_key, numero, año FROM actas WHERE id = $1", [id]);

  const acta = rows[0];
  if (!acta) return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  if (!acta.file_object_key) {
    return NextResponse.json({ error: "El acta no tiene archivo adjunto" }, { status: 404 });
  }

  await audit(session.user.id, "download", "acta", id, {
    metadata: { numero: acta.numero, año: acta.año },
  });

  const url = await presignDownload(
    BUCKET_ACTAS,
    acta.file_object_key,
    `acta-${acta.año}-${acta.numero}.pdf`
  );
  return NextResponse.redirect(url);
}
