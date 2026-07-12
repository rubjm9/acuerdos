import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { queryAsUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ACUERDO_ESTADOS, type AcuerdoEstado } from "@/lib/domain";
import { renderAcuerdosPdf } from "@/lib/reports/pdf";
import { buildXlsx } from "@/lib/reports/xlsx";

/** Informe de acuerdos por área con visión general de estados (PDF o XLSX). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const formato = req.nextUrl.searchParams.get("formato") ?? "pdf";
  const areaId = req.nextUrl.searchParams.get("area");
  const año = req.nextUrl.searchParams.get("año");

  const [areaRow] = areaId
    ? await queryAsUser<{ name: string }>(
        session.user.id,
        "SELECT name FROM areas WHERE id = $1",
        [areaId]
      )
    : [null];

  const rows = await queryAsUser<{
    public_ref: string;
    titulo: string;
    fecha: string;
    estado: AcuerdoEstado;
    areas: string | null;
    acta_numero: number;
    acta_año: number;
    source_page: number | null;
  }>(
    session.user.id,
    `SELECT ac.public_ref, ac.titulo, ac.fecha_adopcion AS fecha, ac.estado,
            (SELECT string_agg(ar.name, ', ' ORDER BY ar.name)
             FROM acuerdo_areas aa JOIN areas ar ON ar.id = aa.area_id
             WHERE aa.acuerdo_id = ac.id) AS areas,
            a.numero AS acta_numero, a.año AS acta_año, ac.source_page
     FROM acuerdos ac JOIN actas a ON a.id = ac.acta_id
     WHERE ($1::uuid IS NULL OR EXISTS (
            SELECT 1 FROM acuerdo_areas x WHERE x.acuerdo_id = ac.id AND x.area_id = $1::uuid))
       AND ($2::int IS NULL OR extract(year FROM ac.fecha_adopcion)::int = $2::int)
     ORDER BY ac.fecha_adopcion DESC`,
    [areaId || null, año ? Number(año) : null]
  );

  await audit(session.user.id, "export", "acuerdos", areaId, {
    metadata: { formato, n: rows.length, año },
  });

  const resumenMap = new Map<string, number>();
  for (const r of rows) {
    const l = ACUERDO_ESTADOS[r.estado] ?? r.estado;
    resumenMap.set(l, (resumenMap.get(l) ?? 0) + 1);
  }
  const resumen = [...resumenMap.entries()].map(([estado, n]) => ({ estado, n }));

  const titulo = areaRow
    ? `Acuerdos — ${areaRow.name}${año ? ` (${año})` : ""}`
    : `Acuerdos por área${año ? ` (${año})` : ""}`;
  const cita = (r: (typeof rows)[number]) =>
    `Acta ${r.acta_numero}/${r.acta_año}${r.source_page ? `, pág. ${r.source_page}` : ""}`;

  if (formato === "xlsx") {
    const buffer = await buildXlsx(
      "Acuerdos",
      [
        { header: "Referencia", key: "ref", width: 16 },
        { header: "Título", key: "titulo", width: 50 },
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Áreas", key: "areas", width: 32 },
        { header: "Fuente", key: "cita", width: 22 },
      ],
      rows.map((r) => ({
        ref: r.public_ref,
        titulo: r.titulo,
        fecha: new Date(r.fecha).toLocaleDateString("es-ES"),
        estado: ACUERDO_ESTADOS[r.estado] ?? r.estado,
        areas: r.areas ?? "",
        cita: cita(r),
      }))
    );
    return fileResponse(buffer, "acuerdos.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  const buffer = await renderAcuerdosPdf({
    titulo,
    generadoPor: session.user.name ?? session.user.email ?? "",
    resumen,
    rows: rows.map((r) => ({
      public_ref: r.public_ref,
      titulo: r.titulo,
      fecha: r.fecha,
      estado: ACUERDO_ESTADOS[r.estado] ?? r.estado,
      areas: r.areas ?? "",
      cita: cita(r),
    })),
  });
  return fileResponse(buffer, "acuerdos.pdf", "application/pdf");
}

function fileResponse(buffer: Buffer, filename: string, type: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
