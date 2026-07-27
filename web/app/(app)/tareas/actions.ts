"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSecretary, requireUser } from "@/lib/session";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyUser, notifyCommittee } from "@/lib/notify";

/** FormData envía "" en selects sin valor; Zod .uuid() lo rechaza como "Invalid UUID". */
function optionalUuid(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

const tareaSchema = z
  .object({
    acuerdo_id: z.string().uuid("Selecciona un acuerdo válido"),
    titulo: z.string().trim().min(3).max(200),
    descripcion: z.string().trim().max(4000).optional().nullable(),
    assignee_user_id: z.string().uuid().optional().nullable(),
    assignee_committee_id: z.string().uuid().optional().nullable(),
    fecha_vencimiento: z.string().date().optional().nullable(),
  })
  .refine((d) => d.assignee_user_id || d.assignee_committee_id, {
    message: "Asigna la tarea a una persona o a un comité",
  });

function parseTareaForm(formData: FormData) {
  const assignee = String(formData.get("assignee") ?? "");
  const [kind, id] = assignee.split(":");
  const acuerdoId = optionalUuid(formData.get("acuerdo_id"));
  if (!acuerdoId) {
    throw new Error("Selecciona el acuerdo de origen de la tarea");
  }
  return tareaSchema.parse({
    acuerdo_id: acuerdoId,
    titulo: formData.get("titulo"),
    descripcion: formData.get("descripcion") || null,
    assignee_user_id: kind === "u" ? id : null,
    assignee_committee_id: kind === "c" ? id : null,
    fecha_vencimiento: formData.get("fecha_vencimiento") || null,
  });
}

export async function createTarea(formData: FormData) {
  const user = await requireSecretary();
  const data = parseTareaForm(formData);

  const tareaId = await withUser(user.id, async (c) => {
    const res = await c.query(
      `INSERT INTO tareas
         (acuerdo_id, titulo, descripcion, assignee_user_id, assignee_committee_id, fecha_vencimiento, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.acuerdo_id,
        data.titulo,
        data.descripcion,
        data.assignee_user_id,
        data.assignee_committee_id,
        data.fecha_vencimiento,
        user.id,
      ]
    );
    await audit(user.id, "create", "tarea", res.rows[0].id, { client: c });
    return res.rows[0].id as string;
  });

  // Aviso al asignado (nunca incluye contenido restringido)
  if (data.assignee_user_id && data.assignee_user_id !== user.id) {
    await notifyUser(
      data.assignee_user_id,
      "tarea_asignada",
      "Nueva tarea asignada",
      data.titulo,
      `/tareas/${tareaId}`
    );
  } else if (data.assignee_committee_id) {
    await notifyCommittee(
      data.assignee_committee_id,
      "tarea_asignada",
      "Nueva tarea para el comité",
      data.titulo,
      `/tareas/${tareaId}`
    );
  }

  revalidatePath("/tareas");
  redirect(`/tareas/${tareaId}`);
}

export async function updateTarea(formData: FormData) {
  const user = await requireSecretary();
  const tareaId = z.string().uuid().parse(formData.get("tareaId"));
  const data = parseTareaForm(formData);

  await withUser(user.id, async (c) => {
    await c.query(
      `UPDATE tareas SET titulo=$2, descripcion=$3, assignee_user_id=$4,
              assignee_committee_id=$5, fecha_vencimiento=$6
       WHERE id=$1`,
      [
        tareaId,
        data.titulo,
        data.descripcion,
        data.assignee_user_id,
        data.assignee_committee_id,
        data.fecha_vencimiento,
      ]
    );
    await audit(user.id, "update", "tarea", tareaId, { client: c });
  });

  revalidatePath(`/tareas/${tareaId}`);
  revalidatePath("/tareas");
}

/** El propio asignado (o secretaría) actualiza el estado. RLS lo garantiza. */
export async function cambiarEstadoTarea(formData: FormData) {
  const user = await requireUser();
  const tareaId = z.string().uuid().parse(formData.get("tareaId"));
  const estado = z
    .enum(["abierta", "en_progreso", "completada", "vencida", "cancelada"])
    .parse(formData.get("estado"));

  await withUser(user.id, async (c) => {
    const res = await c.query("UPDATE tareas SET estado = $2 WHERE id = $1 RETURNING id", [
      tareaId,
      estado,
    ]);
    if (res.rowCount === 0) throw new Error("Sin permiso para actualizar esta tarea");
    await audit(user.id, "update", "tarea", tareaId, { metadata: { estado }, client: c });
  });

  revalidatePath(`/tareas/${tareaId}`);
  revalidatePath("/tareas");
}
