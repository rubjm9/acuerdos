import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { queryAsUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ACUERDO_ESTADOS, type AcuerdoEstado } from "@/lib/domain";
import { renderExpedientePdf } from "@/lib/reports/pdf";
import { buildXlsx } from "@/lib/reports/xlsx";

/**
 * Exportación del histórico de un expediente (PDF o XLSX).
 * RLS: los acuerdos restringidos no visibles quedan fuera automáticamente;
 * el texto íntegro cifrado nunca se exporta desde aquí.
 */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/informes/expediente/[id]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const formato = req.nextUrl.searchParams.get("formato") ?? "pdf";

  const [exp] = await queryAsUser<{ titulo: string; descripcion: string | null }>(
    session.user.id,
    "SELECT titulo, descripcion FROM expedientes WHERE id = $1",
    [id]
  );
  if (!exp) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const items = await queryAsUser<{
    fecha: string;
    titulo: string;
    public_ref: string;
    estado: AcuerdoEstado;
    acta_numero: number;
    acta_año: number;
    source_page: number | null;
    full_text: string | null;
  }>(
    session.user.id,
    `SELECT ac.fecha_adopcion AS fecha, ac.titulo, ac.public_ref, ac.estado,
            a.numero AS acta_numero, a.año AS acta_año, ac.source_page, ac.full_text
     FROM expediente_acuerdos ea
     JOIN acuerdos ac ON ac.id = ea.acuerdo_id
     JOIN actas a ON a.id = ac.acta_id
     WHERE ea.expediente_id = $1
     ORDER BY ac.fecha_adopcion`,
    [id]
  );

  await audit(session.user.id, "export", "expediente", id, {
    metadata: { formato, items: items.length },
  });

  const cita = (i: (typeof items)[number]) =>
    `Acta ${i.acta_numero}/${i.acta_año}${i.source_page ? `, pág. ${i.source_page}` : ""}`;
  const filename = `expediente-${exp.titulo.slice(0, 40).replace(/[^\wáéíóúñ-]+/gi, "_")}`;

  if (formato === "xlsx") {
    const buffer = await buildXlsx(
      "Expediente",
      [
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Referencia", key: "ref", width: 16 },
        { header: "Título", key: "titulo", width: 50 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Fuente", key: "cita", width: 22 },
      ],
      items.map((i) => ({
        fecha: new Date(i.fecha).toLocaleDateString("es-ES"),
        ref: i.public_ref,
        titulo: i.titulo,
        estado: estadoLabel(i.estado),
        cita: cita(i),
      }))
    );
    return fileResponse(buffer, `${filename}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  const buffer = await renderExpedientePdf({
    titulo: exp.titulo,
    descripcion: exp.descripcion,
    generadoPor: session.user.name ?? session.user.email ?? "",
    items: items.map((i) => ({
      fecha: i.fecha,
      titulo: i.titulo,
      public_ref: i.public_ref,
      estado: estadoLabel(i.estado),
      cita: cita(i),
      texto: i.full_text ? truncate(i.full_text, 600) : undefined,
    })),
  });
  return fileResponse(buffer, `${filename}.pdf`, "application/pdf");
}

function estadoLabel(e: AcuerdoEstado): string {
  return ACUERDO_ESTADOS[e] ?? e;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function fileResponse(buffer: Buffer, filename: string, type: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
