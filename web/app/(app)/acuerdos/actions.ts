"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PoolClient } from "pg";
import { requireSecretary, requireUser } from "@/lib/session";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { encryptField } from "@/lib/crypto";
import { indexAcuerdoChunks, requestEmbeddings } from "@/lib/chunks";
import { LINK_TIPOS } from "@/lib/domain";

const acuerdoSchema = z.object({
  titulo: z.string().trim().min(3).max(200),
  texto: z.string().trim().min(10),
  fecha_adopcion: z.string().date(),
  acta_id: z.string().uuid(),
  source_page: z.coerce.number().int().positive().optional().nullable(),
  estado: z.enum(["en_vigor", "en_curso", "cumplido", "superado", "anulado"]),
  areaIds: z.array(z.string().uuid()).min(1, "Selecciona al menos un área"),
});

/** ¿Alguna de las áreas seleccionadas es restringida? */
async function anyRestricted(client: PoolClient, areaIds: string[]): Promise<boolean> {
  const res = await client.query(
    "SELECT EXISTS (SELECT 1 FROM areas WHERE id = ANY($1) AND is_restricted) AS r",
    [areaIds]
  );
  return res.rows[0].r as boolean;
}

function parseAcuerdoForm(formData: FormData) {
  return acuerdoSchema.parse({
    titulo: formData.get("titulo"),
    texto: formData.get("texto"),
    fecha_adopcion: formData.get("fecha_adopcion"),
    acta_id: formData.get("acta_id"),
    source_page: formData.get("source_page") || null,
    estado: formData.get("estado") ?? "en_vigor",
    areaIds: formData.getAll("areaIds").map(String),
  });
}

export async function createAcuerdo(formData: FormData) {
  const user = await requireSecretary();
  const data = parseAcuerdoForm(formData);
  const año = new Date(data.fecha_adopcion).getFullYear();

  const acuerdoId = await withUser(user.id, async (c) => {
    const restricted = await anyRestricted(c, data.areaIds);
    const refRes = await c.query("SELECT next_public_ref($1) AS ref", [año]);
    const publicRef = refRes.rows[0].ref as string;

    const res = await c.query(
      `INSERT INTO acuerdos
         (public_ref, titulo, full_text, full_text_enc, fecha_adopcion, acta_id, source_page, estado, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        publicRef,
        data.titulo,
        restricted ? null : data.texto,
        restricted ? encryptField(data.texto) : null,
        data.fecha_adopcion,
        data.acta_id,
        data.source_page,
        data.estado,
        user.id,
      ]
    );
    const id = res.rows[0].id as string;

    for (const areaId of data.areaIds) {
      await c.query("INSERT INTO acuerdo_areas (acuerdo_id, area_id) VALUES ($1, $2)", [
        id,
        areaId,
      ]);
    }

    // El contenido restringido (Art. 9) jamás entra en índices de búsqueda
    if (!restricted) {
      await indexAcuerdoChunks(c, id, data.titulo, data.texto);
    }

    await audit(user.id, "create", "acuerdo", id, {
      restricted,
      metadata: { public_ref: publicRef },
      client: c,
    });
    return id;
  });

  const restrictedNow = await withUser(user.id, async (c) => {
    const r = await c.query("SELECT is_restricted FROM acuerdos WHERE id = $1", [acuerdoId]);
    return Boolean(r.rows[0]?.is_restricted);
  });
  if (!restrictedNow) requestEmbeddings(acuerdoId, data.titulo, data.texto);

  revalidatePath("/acuerdos");
  redirect(`/acuerdos/${acuerdoId}`);
}

export async function updateAcuerdo(formData: FormData) {
  const user = await requireSecretary();
  const acuerdoId = z.string().uuid().parse(formData.get("acuerdoId"));
  const data = parseAcuerdoForm(formData);

  await withUser(user.id, async (c) => {
    const restricted = await anyRestricted(c, data.areaIds);

    await c.query(
      `UPDATE acuerdos SET
         titulo = $2,
         full_text = $3,
         full_text_enc = $4,
         fecha_adopcion = $5,
         acta_id = $6,
         source_page = $7,
         estado = $8
       WHERE id = $1`,
      [
        acuerdoId,
        data.titulo,
        restricted ? null : data.texto,
        restricted ? encryptField(data.texto) : null,
        data.fecha_adopcion,
        data.acta_id,
        data.source_page,
        data.estado,
      ]
    );

    await c.query("DELETE FROM acuerdo_areas WHERE acuerdo_id = $1", [acuerdoId]);
    for (const areaId of data.areaIds) {
      await c.query("INSERT INTO acuerdo_areas (acuerdo_id, area_id) VALUES ($1, $2)", [
        acuerdoId,
        areaId,
      ]);
    }

    if (restricted) {
      // si pasó a restringido, purgar cualquier rastro del índice
      await c.query("DELETE FROM acuerdo_chunks WHERE acuerdo_id = $1", [acuerdoId]);
    } else {
      await indexAcuerdoChunks(c, acuerdoId, data.titulo, data.texto);
    }

    await audit(user.id, "update", "acuerdo", acuerdoId, { restricted, client: c });
  });

  const restrictedNow = await withUser(user.id, async (c) => {
    const r = await c.query("SELECT is_restricted FROM acuerdos WHERE id = $1", [acuerdoId]);
    return Boolean(r.rows[0]?.is_restricted);
  });
  const d = parseAcuerdoForm(formData);
  if (!restrictedNow) requestEmbeddings(acuerdoId, d.titulo, d.texto);

  revalidatePath("/acuerdos");
  revalidatePath(`/acuerdos/${acuerdoId}`);
}

export async function cambiarEstadoAcuerdo(formData: FormData) {
  const user = await requireSecretary();
  const acuerdoId = z.string().uuid().parse(formData.get("acuerdoId"));
  const estado = z
    .enum(["en_vigor", "en_curso", "cumplido", "superado", "anulado"])
    .parse(formData.get("estado"));
  await withUser(user.id, async (c) => {
    await c.query("UPDATE acuerdos SET estado = $2 WHERE id = $1", [acuerdoId, estado]);
    await audit(user.id, "update", "acuerdo", acuerdoId, {
      metadata: { estado },
      client: c,
    });
  });
  revalidatePath(`/acuerdos/${acuerdoId}`);
}

// ---------------------------------------------------------------------------
// Enlaces tipados entre acuerdos (el hilo histórico)
// ---------------------------------------------------------------------------

export async function createLink(formData: FormData) {
  const user = await requireSecretary();
  const fromId = z.string().uuid().parse(formData.get("fromId"));
  const tipo = z
    .enum(Object.keys(LINK_TIPOS) as [string, ...string[]])
    .parse(formData.get("tipo"));
  const targetRef = z.string().trim().min(3).parse(formData.get("targetRef"));

  await withUser(user.id, async (c) => {
    // resolver destino por referencia pública (ACU-YYYY-NNNN) o UUID
    const target = await c.query(
      `SELECT id FROM acuerdos WHERE public_ref = $1 OR id::text = $1`,
      [targetRef.toUpperCase().startsWith("ACU") ? targetRef.toUpperCase() : targetRef]
    );
    if (target.rows.length === 0) {
      throw new Error(`No se encontró el acuerdo «${targetRef}»`);
    }
    const toId = target.rows[0].id as string;
    await c.query(
      `INSERT INTO acuerdo_links (from_acuerdo_id, to_acuerdo_id, tipo, confirmed, created_by)
       VALUES ($1, $2, $3, true, $4)
       ON CONFLICT (from_acuerdo_id, to_acuerdo_id, tipo) DO UPDATE SET confirmed = true`,
      [fromId, toId, tipo, user.id]
    );
    await audit(user.id, "create", "acuerdo_link", `${fromId}->${toId}`, {
      metadata: { tipo },
      client: c,
    });
  });
  revalidatePath(`/acuerdos/${fromId}`);
}

export async function removeLink(formData: FormData) {
  const user = await requireSecretary();
  const linkId = z.string().uuid().parse(formData.get("linkId"));
  const fromId = z.string().uuid().parse(formData.get("fromId"));
  await withUser(user.id, async (c) => {
    await c.query("DELETE FROM acuerdo_links WHERE id = $1", [linkId]);
    await audit(user.id, "delete", "acuerdo_link", linkId, { client: c });
  });
  revalidatePath(`/acuerdos/${fromId}`);
}

export async function confirmLink(formData: FormData) {
  const user = await requireSecretary();
  const linkId = z.string().uuid().parse(formData.get("linkId"));
  const fromId = z.string().uuid().parse(formData.get("fromId"));
  await withUser(user.id, async (c) => {
    await c.query("UPDATE acuerdo_links SET confirmed = true WHERE id = $1", [linkId]);
    await audit(user.id, "update", "acuerdo_link", linkId, {
      metadata: { confirmed: true },
      client: c,
    });
  });
  revalidatePath(`/acuerdos/${fromId}`);
}

// ---------------------------------------------------------------------------
// Registro de lectura de acuerdos restringidos (auditoría reforzada)
// ---------------------------------------------------------------------------

export async function auditRestrictedView(acuerdoId: string) {
  const user = await requireUser();
  await audit(user.id, "view", "acuerdo", acuerdoId, { restricted: true });
}
