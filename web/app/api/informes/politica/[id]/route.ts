import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { queryAsUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ACUERDO_ESTADOS, POLITICA_ESTADOS, type AcuerdoEstado, type PoliticaEstado } from "@/lib/domain";
import { renderPoliticaPdf } from "@/lib/reports/pdf";
import { buildXlsx } from "@/lib/reports/xlsx";

/** Exportación de una Política (PDF o XLSX). RLS: acuerdos no visibles quedan fuera. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/informes/politica/[id]">) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const formato = req.nextUrl.searchParams.get("formato") ?? "pdf";

  const [pol] = await queryAsUser<{
    titulo: string;
    public_ref: string;
    resumen: string | null;
    cuerpo_md: string | null;
    estado: PoliticaEstado;
  }>(
    session.user.id,
    "SELECT titulo, public_ref, resumen, cuerpo_md, estado FROM politicas WHERE id = $1",
    [id]
  );
  if (!pol) return NextResponse.json({ error: "Política no encontrada" }, { status: 404 });

  const acuerdos = await queryAsUser<{
    public_ref: string;
    titulo: string;
    fecha: string;
    estado: AcuerdoEstado;
    acta_numero: number;
    acta_año: number;
    source_page: number | null;
  }>(
    session.user.id,
    `SELECT ac.public_ref, ac.titulo, ac.fecha_adopcion AS fecha, ac.estado,
            a.numero AS acta_numero, a.año AS acta_año, ac.source_page
     FROM politica_acuerdos pa
     JOIN acuerdos ac ON ac.id = pa.acuerdo_id
     JOIN actas a ON a.id = ac.acta_id
     WHERE pa.politica_id = $1
     ORDER BY ac.fecha_adopcion`,
    [id]
  );

  await audit(session.user.id, "export", "politica", id, {
    metadata: { formato, acuerdos: acuerdos.length },
  });

  const cita = (a: (typeof acuerdos)[number]) =>
    `Acta ${a.acta_numero}/${a.acta_año}${a.source_page ? `, pág. ${a.source_page}` : ""}`;
  const filename = `politica-${pol.public_ref}`;

  if (formato === "xlsx") {
    const buffer = await buildXlsx(
      "Política",
      [
        { header: "Referencia", key: "ref", width: 16 },
        { header: "Título", key: "titulo", width: 50 },
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Fuente", key: "cita", width: 22 },
      ],
      acuerdos.map((a) => ({
        ref: a.public_ref,
        titulo: a.titulo,
        fecha: new Date(a.fecha).toLocaleDateString("es-ES"),
        estado: ACUERDO_ESTADOS[a.estado] ?? a.estado,
        cita: cita(a),
      }))
    );
    return fileResponse(buffer, `${filename}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  const buffer = await renderPoliticaPdf({
    titulo: pol.titulo,
    public_ref: pol.public_ref,
    resumen: pol.resumen,
    cuerpo: pol.cuerpo_md,
    estado: POLITICA_ESTADOS[pol.estado] ?? pol.estado,
    generadoPor: session.user.name ?? session.user.email ?? "",
    acuerdos: acuerdos.map((a) => ({
      public_ref: a.public_ref,
      titulo: a.titulo,
      fecha: new Date(a.fecha).toLocaleDateString("es-ES"),
      estado: ACUERDO_ESTADOS[a.estado] ?? a.estado,
      cita: cita(a),
    })),
  });
  return fileResponse(buffer, `${filename}.pdf`, "application/pdf");
}

function fileResponse(buffer: Buffer, filename: string, type: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
