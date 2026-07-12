import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { queryAsUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { TAREA_ESTADOS, type TareaEstado } from "@/lib/domain";
import { renderTareasPdf } from "@/lib/reports/pdf";
import { buildXlsx } from "@/lib/reports/xlsx";

/** Informe de tareas pendientes por miembro y comité (PDF o XLSX). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const formato = req.nextUrl.searchParams.get("formato") ?? "pdf";

  const rows = await queryAsUser<{
    responsable: string;
    titulo: string;
    acuerdo_ref: string;
    vencimiento: string | null;
    estado: TareaEstado;
    vencida: boolean;
  }>(
    session.user.id,
    `SELECT COALESCE(u.name, c.name, 'Sin asignar') AS responsable,
            t.titulo, a.public_ref AS acuerdo_ref, t.fecha_vencimiento AS vencimiento,
            t.estado,
            (t.fecha_vencimiento IS NOT NULL AND t.fecha_vencimiento < CURRENT_DATE) AS vencida
     FROM tareas t
     JOIN acuerdos a ON a.id = t.acuerdo_id
     LEFT JOIN users u ON u.id = t.assignee_user_id
     LEFT JOIN committees c ON c.id = t.assignee_committee_id
     WHERE t.estado IN ('abierta','en_progreso')
     ORDER BY responsable, t.fecha_vencimiento NULLS LAST`
  );

  await audit(session.user.id, "export", "tareas", null, {
    metadata: { formato, n: rows.length },
  });

  const label = (r: (typeof rows)[number]) =>
    r.vencida ? "Vencida" : TAREA_ESTADOS[r.estado] ?? r.estado;

  if (formato === "xlsx") {
    const buffer = await buildXlsx(
      "Tareas pendientes",
      [
        { header: "Responsable", key: "responsable", width: 26 },
        { header: "Tarea", key: "titulo", width: 50 },
        { header: "Acuerdo", key: "ref", width: 16 },
        { header: "Vencimiento", key: "vencimiento", width: 14 },
        { header: "Estado", key: "estado", width: 14 },
      ],
      rows.map((r) => ({
        responsable: r.responsable,
        titulo: r.titulo,
        ref: r.acuerdo_ref,
        vencimiento: r.vencimiento ? new Date(r.vencimiento).toLocaleDateString("es-ES") : "—",
        estado: label(r),
      }))
    );
    return fileResponse(buffer, "tareas-pendientes.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  const buffer = await renderTareasPdf({
    generadoPor: session.user.name ?? session.user.email ?? "",
    rows: rows.map((r) => ({
      responsable: r.responsable,
      titulo: r.titulo,
      acuerdo_ref: r.acuerdo_ref,
      vencimiento: r.vencimiento,
      estado: label(r),
    })),
  });
  return fileResponse(buffer, "tareas-pendientes.pdf", "application/pdf");
}

function fileResponse(buffer: Buffer, filename: string, type: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
