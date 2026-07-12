"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PoolClient } from "pg";
import { requireSecretary } from "@/lib/session";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { indexPoliticaChunks, requestPoliticaEmbeddings } from "@/lib/chunks";

const tituloSchema = z.string().trim().min(3).max(200);
const resumenSchema = z.string().trim().max(2000).optional();
const cuerpoSchema = z.string().trim().max(50000).optional();

/** ¿El área principal de la política es restringida? (para decidir indexación) */
async function areaRestricted(c: PoolClient, areaId: string | null): Promise<boolean> {
  if (!areaId) return false;
  const r = await c.query("SELECT is_restricted FROM areas WHERE id = $1", [areaId]);
  return Boolean(r.rows[0]?.is_restricted);
}

/**
 * (Re)indexa el cuerpo de la política para búsqueda/asistente, SOLO si su área
 * no es restringida (invariante: el contenido restringido nunca se indexa).
 */
async function reindex(
  c: PoolClient,
  politicaId: string,
  areaId: string | null,
  titulo: string,
  resumen: string | null,
  cuerpo: string | null
) {
  await c.query("DELETE FROM politica_chunks WHERE politica_id = $1", [politicaId]);
  const restricted = await areaRestricted(c, areaId);
  const texto = [titulo, resumen, cuerpo].filter(Boolean).join("\n\n");
  if (restricted || !cuerpo?.trim()) return { indexed: false, texto };
  await indexPoliticaChunks(c, politicaId, texto);
  return { indexed: true, texto };
}

export async function createPolitica(formData: FormData) {
  const user = await requireSecretary();
  const titulo = tituloSchema.parse(formData.get("titulo"));
  const resumen = resumenSchema.parse(formData.get("resumen") || undefined) ?? null;
  const cuerpo = cuerpoSchema.parse(formData.get("cuerpo_md") || undefined) ?? null;
  const primaryAreaId = formData.get("primary_area_id")
    ? z.string().uuid().parse(formData.get("primary_area_id"))
    : null;

  const { id, indexed, texto } = await withUser(user.id, async (c) => {
    const res = await c.query(
      `INSERT INTO politicas (public_ref, titulo, resumen, cuerpo_md, primary_area_id, created_by)
       VALUES (next_politica_ref(), $1, $2, $3, $4, $5) RETURNING id`,
      [titulo, resumen, cuerpo, primaryAreaId, user.id]
    );
    const id = res.rows[0].id as string;
    const { indexed, texto } = await reindex(c, id, primaryAreaId, titulo, resumen, cuerpo);
    await audit(user.id, "create", "politica", id, { client: c });
    return { id, indexed, texto };
  });

  if (indexed) requestPoliticaEmbeddings(id, texto);
  revalidatePath("/politicas");
  redirect(`/politicas/${id}`);
}

export async function updatePolitica(formData: FormData) {
  const user = await requireSecretary();
  const politicaId = z.string().uuid().parse(formData.get("politicaId"));
  const titulo = tituloSchema.parse(formData.get("titulo"));
  const resumen = resumenSchema.parse(formData.get("resumen") || undefined) ?? null;
  const cuerpo = cuerpoSchema.parse(formData.get("cuerpo_md") || undefined) ?? null;
  const estado = z
    .enum(["vigente", "en_revision", "derogada"])
    .parse(formData.get("estado") ?? "vigente");
  const primaryAreaId = formData.get("primary_area_id")
    ? z.string().uuid().parse(formData.get("primary_area_id"))
    : null;

  const { indexed, texto } = await withUser(user.id, async (c) => {
    await c.query(
      `UPDATE politicas SET titulo=$2, resumen=$3, cuerpo_md=$4, primary_area_id=$5, estado=$6
       WHERE id=$1`,
      [politicaId, titulo, resumen, cuerpo, primaryAreaId, estado]
    );
    const { indexed, texto } = await reindex(c, politicaId, primaryAreaId, titulo, resumen, cuerpo);
    await audit(user.id, "update", "politica", politicaId, { client: c });
    return { indexed, texto };
  });

  if (indexed) requestPoliticaEmbeddings(politicaId, texto);
  revalidatePath("/politicas");
  revalidatePath(`/politicas/${politicaId}`);
  redirect(`/politicas/${politicaId}`);
}

export async function addAcuerdoToPolitica(formData: FormData) {
  const user = await requireSecretary();
  const politicaId = z.string().uuid().parse(formData.get("politicaId"));
  const ref = z.string().trim().min(3).parse(formData.get("acuerdoRef"));

  await withUser(user.id, async (c) => {
    const target = await c.query(
      "SELECT id FROM acuerdos WHERE public_ref = $1 OR id::text = $1",
      [ref.toUpperCase().startsWith("ACU") ? ref.toUpperCase() : ref]
    );
    if (target.rows.length === 0) throw new Error(`No se encontró el acuerdo «${ref}»`);
    await c.query(
      `INSERT INTO politica_acuerdos (politica_id, acuerdo_id, added_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [politicaId, target.rows[0].id, user.id]
    );
    await audit(user.id, "update", "politica", politicaId, {
      metadata: { added: target.rows[0].id },
      client: c,
    });
  });
  revalidatePath(`/politicas/${politicaId}`);
}

export async function removeAcuerdoFromPolitica(formData: FormData) {
  const user = await requireSecretary();
  const politicaId = z.string().uuid().parse(formData.get("politicaId"));
  const acuerdoId = z.string().uuid().parse(formData.get("acuerdoId"));
  await withUser(user.id, async (c) => {
    await c.query(
      "DELETE FROM politica_acuerdos WHERE politica_id = $1 AND acuerdo_id = $2",
      [politicaId, acuerdoId]
    );
    await audit(user.id, "update", "politica", politicaId, {
      metadata: { removed: acuerdoId },
      client: c,
    });
  });
  revalidatePath(`/politicas/${politicaId}`);
}
