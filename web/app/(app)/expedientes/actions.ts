"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSecretary } from "@/lib/session";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function createExpediente(formData: FormData) {
  const user = await requireSecretary();
  const titulo = z.string().trim().min(3).max(200).parse(formData.get("titulo"));
  const descripcion = z.string().trim().max(2000).optional().parse(formData.get("descripcion") || undefined);
  const primaryAreaId = formData.get("primary_area_id")
    ? z.string().uuid().parse(formData.get("primary_area_id"))
    : null;

  const id = await withUser(user.id, async (c) => {
    const res = await c.query(
      `INSERT INTO expedientes (titulo, descripcion, primary_area_id, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [titulo, descripcion ?? null, primaryAreaId, user.id]
    );
    await audit(user.id, "create", "expediente", res.rows[0].id, { client: c });
    return res.rows[0].id as string;
  });

  revalidatePath("/expedientes");
  redirect(`/expedientes/${id}`);
}

export async function addAcuerdoToExpediente(formData: FormData) {
  const user = await requireSecretary();
  const expedienteId = z.string().uuid().parse(formData.get("expedienteId"));
  const ref = z.string().trim().min(3).parse(formData.get("acuerdoRef"));

  await withUser(user.id, async (c) => {
    const target = await c.query(
      "SELECT id FROM acuerdos WHERE public_ref = $1 OR id::text = $1",
      [ref.toUpperCase().startsWith("ACU") ? ref.toUpperCase() : ref]
    );
    if (target.rows.length === 0) throw new Error(`No se encontró el acuerdo «${ref}»`);
    await c.query(
      `INSERT INTO expediente_acuerdos (expediente_id, acuerdo_id, added_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [expedienteId, target.rows[0].id, user.id]
    );
    await audit(user.id, "update", "expediente", expedienteId, {
      metadata: { added: target.rows[0].id },
      client: c,
    });
  });

  revalidatePath(`/expedientes/${expedienteId}`);
}

export async function removeAcuerdoFromExpediente(formData: FormData) {
  const user = await requireSecretary();
  const expedienteId = z.string().uuid().parse(formData.get("expedienteId"));
  const acuerdoId = z.string().uuid().parse(formData.get("acuerdoId"));

  await withUser(user.id, async (c) => {
    await c.query(
      "DELETE FROM expediente_acuerdos WHERE expediente_id = $1 AND acuerdo_id = $2",
      [expedienteId, acuerdoId]
    );
    await audit(user.id, "update", "expediente", expedienteId, {
      metadata: { removed: acuerdoId },
      client: c,
    });
  });

  revalidatePath(`/expedientes/${expedienteId}`);
}

export async function cambiarEstadoExpediente(formData: FormData) {
  const user = await requireSecretary();
  const expedienteId = z.string().uuid().parse(formData.get("expedienteId"));
  const estado = z.enum(["abierto", "cerrado"]).parse(formData.get("estado"));

  await withUser(user.id, async (c) => {
    await c.query("UPDATE expedientes SET estado = $2 WHERE id = $1", [expedienteId, estado]);
    await audit(user.id, "update", "expediente", expedienteId, {
      metadata: { estado },
      client: c,
    });
  });

  revalidatePath(`/expedientes/${expedienteId}`);
  revalidatePath("/expedientes");
}
