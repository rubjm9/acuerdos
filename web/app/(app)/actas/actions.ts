"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSecretary } from "@/lib/session";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { uploadObject, BUCKET_ACTAS } from "@/lib/s3";

const actaSchema = z.object({
  numero: z.coerce.number().int().positive(),
  fecha: z.string().date(),
  estado: z.enum(["borrador", "definitiva", "archivada"]),
});

const MAX_FILE_MB = 50;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

async function storeFile(file: File, año: number, numero: number): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`El archivo supera ${MAX_FILE_MB} MB`);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Solo se admiten PDF o Word");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const key = `actas/${año}/acta-${año}-${String(numero).padStart(3, "0")}.${ext}`;
  await uploadObject(BUCKET_ACTAS, key, Buffer.from(await file.arrayBuffer()), file.type);
  return key;
}

export async function createActa(formData: FormData) {
  const user = await requireSecretary();
  const data = actaSchema.parse({
    numero: formData.get("numero"),
    fecha: formData.get("fecha"),
    estado: formData.get("estado") ?? "definitiva",
  });
  const año = new Date(data.fecha).getFullYear();
  const file = formData.get("file") as File | null;

  const actaId = await withUser(user.id, async (c) => {
    const fileKey = file && file.size > 0 ? await storeFile(file, año, data.numero) : null;
    const res = await c.query(
      `INSERT INTO actas (numero, fecha, año, estado, file_object_key, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.numero, data.fecha, año, data.estado, fileKey, user.id]
    );
    await audit(user.id, "create", "acta", res.rows[0].id, {
      metadata: { numero: data.numero, año },
      client: c,
    });
    return res.rows[0].id as string;
  });

  revalidatePath("/actas");
  redirect(`/actas/${actaId}`);
}

export async function updateActa(formData: FormData) {
  const user = await requireSecretary();
  const actaId = z.string().uuid().parse(formData.get("actaId"));
  const data = actaSchema.parse({
    numero: formData.get("numero"),
    fecha: formData.get("fecha"),
    estado: formData.get("estado"),
  });
  const año = new Date(data.fecha).getFullYear();
  const file = formData.get("file") as File | null;

  await withUser(user.id, async (c) => {
    const fileKey = file && file.size > 0 ? await storeFile(file, año, data.numero) : null;
    if (fileKey) {
      await c.query(
        `UPDATE actas SET numero=$2, fecha=$3, año=$4, estado=$5, file_object_key=$6 WHERE id=$1`,
        [actaId, data.numero, data.fecha, año, data.estado, fileKey]
      );
    } else {
      await c.query(
        `UPDATE actas SET numero=$2, fecha=$3, año=$4, estado=$5 WHERE id=$1`,
        [actaId, data.numero, data.fecha, año, data.estado]
      );
    }
    await audit(user.id, "update", "acta", actaId, { client: c });
  });

  revalidatePath("/actas");
  revalidatePath(`/actas/${actaId}`);
}
