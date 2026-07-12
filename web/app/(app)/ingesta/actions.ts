"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSecretary } from "@/lib/session";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { encryptField } from "@/lib/crypto";
import { indexAcuerdoChunks, requestEmbeddings } from "@/lib/chunks";
import { uploadObject, BUCKET_ACTAS } from "@/lib/s3";

const MAX_FILE_MB = 100;

/** Sube una recopilación anual (o acta suelta) y lanza el procesado en el worker. */
export async function uploadIngestion(formData: FormData) {
  const user = await requireSecretary();
  const año = z.coerce.number().int().min(1990).max(2100).parse(formData.get("año"));
  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("Selecciona un archivo PDF");
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Máximo ${MAX_FILE_MB} MB`);
  if (file.type !== "application/pdf") throw new Error("Solo se admite PDF en la ingesta");

  const key = `ingesta/${año}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  await uploadObject(BUCKET_ACTAS, key, Buffer.from(await file.arrayBuffer()), file.type);

  const jobId = await withUser(user.id, async (c) => {
    // registrar también como recopilación anual disponible
    await c.query(
      `INSERT INTO year_compilations (año, file_object_key)
       VALUES ($1, $2) ON CONFLICT (año) DO UPDATE SET file_object_key = $2`,
      [año, key]
    );
    const res = await c.query(
      `INSERT INTO ingestion_jobs (source_file_key, original_name, año, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [key, file.name, año, user.id]
    );
    await audit(user.id, "create", "ingestion_job", res.rows[0].id, {
      metadata: { año, file: file.name },
      client: c,
    });
    return res.rows[0].id as string;
  });

  // lanzar procesado (asíncrono en el worker)
  const workerUrl = process.env.WORKER_URL;
  if (workerUrl) {
    fetch(`${workerUrl}/jobs/${jobId}/process`, { method: "POST" }).catch(() => {
      /* si el worker está caído se puede relanzar desde la UI */
    });
  }

  revalidatePath("/ingesta");
  redirect(`/ingesta/${jobId}`);
}

export async function reprocessJob(formData: FormData) {
  const user = await requireSecretary();
  const jobId = z.string().uuid().parse(formData.get("jobId"));
  await withUser(user.id, async (c) => {
    await c.query(
      "UPDATE ingestion_jobs SET status = 'uploaded', error = NULL WHERE id = $1",
      [jobId]
    );
    await c.query("DELETE FROM extraction_candidates WHERE job_id = $1 AND review_status = 'pending'", [jobId]);
  });
  const workerUrl = process.env.WORKER_URL;
  if (workerUrl) {
    await fetch(`${workerUrl}/jobs/${jobId}/process`, { method: "POST" }).catch(() => {});
  }
  revalidatePath(`/ingesta/${jobId}`);
  revalidatePath("/ingesta");
}

const approveSchema = z.object({
  candidateId: z.string().uuid(),
  titulo: z.string().trim().min(3).max(200),
  texto: z.string().trim().min(10),
  fecha: z.string().date(),
  acta_numero: z.coerce.number().int().positive(),
  page: z.coerce.number().int().positive().optional().nullable(),
  areaIds: z.array(z.string().uuid()).min(1),
});

/**
 * Aprobación humana obligatoria: convierte un candidato en acuerdo definitivo.
 * Crea el acta (referenciando la recopilación anual) si aún no existe.
 */
export async function approveCandidate(formData: FormData) {
  const user = await requireSecretary();
  const data = approveSchema.parse({
    candidateId: formData.get("candidateId"),
    titulo: formData.get("titulo"),
    texto: formData.get("texto"),
    fecha: formData.get("fecha"),
    acta_numero: formData.get("acta_numero"),
    page: formData.get("page") || null,
    areaIds: formData.getAll("areaIds").map(String),
  });
  const año = new Date(data.fecha).getFullYear();

  const { acuerdoId, jobId, restricted } = await withUser(user.id, async (c) => {
    const cand = await c.query(
      "SELECT job_id, suggested_links FROM extraction_candidates WHERE id = $1 AND review_status = 'pending'",
      [data.candidateId]
    );
    if (cand.rows.length === 0) throw new Error("El candidato ya fue revisado");
    const jobId = cand.rows[0].job_id as string;
    const suggestedLinks = (cand.rows[0].suggested_links ?? []) as {
      ref_text?: string;
      tipo?: string;
    }[];

    // acta: buscar o crear apuntando a la recopilación anual
    let actaRes = await c.query("SELECT id FROM actas WHERE año = $1 AND numero = $2", [
      año,
      data.acta_numero,
    ]);
    if (actaRes.rows.length === 0) {
      actaRes = await c.query(
        `INSERT INTO actas (numero, fecha, año, source_type, compilation_año, page_start, created_by)
         VALUES ($1, $2, $3, 'annual_compilation',
                 (SELECT año FROM year_compilations WHERE año = $3), $4, $5)
         RETURNING id`,
        [data.acta_numero, data.fecha, año, data.page, user.id]
      );
    }
    const actaId = actaRes.rows[0].id as string;

    const restricted = (
      await c.query(
        "SELECT EXISTS (SELECT 1 FROM areas WHERE id = ANY($1) AND is_restricted) AS r",
        [data.areaIds]
      )
    ).rows[0].r as boolean;

    const refRes = await c.query("SELECT next_public_ref($1) AS ref", [año]);
    const acuerdoRes = await c.query(
      `INSERT INTO acuerdos
         (public_ref, titulo, full_text, full_text_enc, fecha_adopcion, acta_id, source_page, estado, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'en_vigor', $8) RETURNING id`,
      [
        refRes.rows[0].ref,
        data.titulo,
        restricted ? null : data.texto,
        restricted ? encryptField(data.texto) : null,
        data.fecha,
        actaId,
        data.page,
        user.id,
      ]
    );
    const acuerdoId = acuerdoRes.rows[0].id as string;

    for (const areaId of data.areaIds) {
      await c.query("INSERT INTO acuerdo_areas (acuerdo_id, area_id) VALUES ($1, $2)", [
        acuerdoId,
        areaId,
      ]);
    }

    if (!restricted) {
      await indexAcuerdoChunks(c, acuerdoId, data.titulo, data.texto);
    }

    // Enlaces AUTO-SUGERIDOS: se crean SIN confirmar (confirmed=false) para que
    // la Secretaría los revise en la ficha del acuerdo. Nunca se auto-confirman.
    const LINK_TIPOS = new Set([
      "deriva_de",
      "continua",
      "modifica",
      "sustituye_a",
      "relacionado_con",
    ]);
    const REF_RE = /ACU-\d{4}-\d{4}/i;
    let sugeridos = 0;
    for (const link of suggestedLinks) {
      const refMatch = (link.ref_text ?? "").toUpperCase().match(REF_RE);
      if (!refMatch) continue;
      const tipo = LINK_TIPOS.has(link.tipo ?? "") ? link.tipo : "relacionado_con";
      const target = await c.query(
        "SELECT id FROM acuerdos WHERE public_ref = $1 AND id <> $2",
        [refMatch[0], acuerdoId]
      );
      if (target.rows.length === 0) continue; // el acuerdo referenciado aún no existe
      const inserted = await c.query(
        `INSERT INTO acuerdo_links (from_acuerdo_id, to_acuerdo_id, tipo, confirmed, created_by)
         VALUES ($1, $2, $3, false, $4)
         ON CONFLICT (from_acuerdo_id, to_acuerdo_id, tipo) DO NOTHING
         RETURNING id`,
        [acuerdoId, target.rows[0].id, tipo, user.id]
      );
      if ((inserted.rowCount ?? 0) > 0) sugeridos++;
    }

    await c.query(
      `UPDATE extraction_candidates
       SET review_status = 'approved', reviewed_by = $2, reviewed_at = now(), committed_acuerdo_id = $3
       WHERE id = $1`,
      [data.candidateId, user.id, acuerdoId]
    );

    if (sugeridos > 0) {
      await audit(user.id, "create", "acuerdo_link", acuerdoId, {
        metadata: { via: "ingesta", sugeridos, confirmed: false },
        client: c,
      });
    }

    await audit(user.id, "create", "acuerdo", acuerdoId, {
      restricted,
      metadata: { via: "ingesta", candidate: data.candidateId },
      client: c,
    });

    return { acuerdoId, jobId, restricted };
  });

  if (!restricted) requestEmbeddings(acuerdoId, data.titulo, data.texto);

  revalidatePath(`/ingesta/${jobId}`);
}

export async function rejectCandidate(formData: FormData) {
  const user = await requireSecretary();
  const candidateId = z.string().uuid().parse(formData.get("candidateId"));
  const jobId = await withUser(user.id, async (c) => {
    const res = await c.query(
      `UPDATE extraction_candidates
       SET review_status = 'rejected', reviewed_by = $2, reviewed_at = now()
       WHERE id = $1 AND review_status = 'pending'
       RETURNING job_id`,
      [candidateId, user.id]
    );
    await audit(user.id, "update", "extraction_candidate", candidateId, {
      metadata: { review: "rejected" },
      client: c,
    });
    return res.rows[0]?.job_id as string | undefined;
  });
  if (jobId) revalidatePath(`/ingesta/${jobId}`);
}
