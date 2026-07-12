import type { PoolClient } from "pg";

/**
 * Troceado e indexación de un acuerdo para búsqueda híbrida.
 *
 * 1) Inserta los chunks por SQL de inmediato (la búsqueda por palabras clave
 *    funciona al instante, embedding NULL).
 * 2) Pide al worker que recalcule embeddings en segundo plano; si el worker
 *    no está disponible, la búsqueda semántica se completará más tarde.
 *
 * Los acuerdos restringidos NUNCA pasan por aquí.
 */

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;

export function splitText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= CHUNK_SIZE) return clean ? [clean] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      // preferir cortar en párrafo, luego en frase, luego en espacio
      const slice = clean.slice(start, end);
      const cut =
        Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". ")) + 1;
      if (cut > CHUNK_SIZE * 0.4) end = start + cut;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks.filter(Boolean);
}

export async function indexAcuerdoChunks(
  client: PoolClient,
  acuerdoId: string,
  titulo: string,
  texto: string
) {
  await client.query("DELETE FROM acuerdo_chunks WHERE acuerdo_id = $1", [acuerdoId]);
  const chunks = splitText(`${titulo}\n\n${texto}`);
  for (let i = 0; i < chunks.length; i++) {
    await client.query(
      "INSERT INTO acuerdo_chunks (acuerdo_id, chunk_idx, chunk_text) VALUES ($1, $2, $3)",
      [acuerdoId, i, chunks[i]]
    );
  }
}

/** Recalcular embeddings en el worker (best-effort, en segundo plano). */
export function requestEmbeddings(acuerdoId: string, titulo: string, texto: string) {
  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) return;
  fetch(`${workerUrl}/acuerdos/${acuerdoId}/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titulo, text: texto }),
  }).catch(() => {
    /* el worker puede estar caído; los chunks FTS ya están indexados */
  });
}
