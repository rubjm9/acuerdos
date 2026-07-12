import { queryAsUser } from "@/lib/db";
import type { AcuerdoEstado } from "@/lib/domain";

/**
 * Búsqueda híbrida sobre acuerdo_chunks:
 *
 *   1. Atajo de coincidencia exacta (ACU-YYYY-NNNN, «acta 12/2020»).
 *   2. Recuperación densa (pgvector, embedding BGE-M3 vía worker) +
 *      dispersa (FTS español) fusionadas con Reciprocal Rank Fusion.
 *   3. Re-ranking con cross-encoder autoalojado (TEI), si está disponible.
 *
 * Toda consulta pasa por RLS con la identidad del usuario: el contenido de
 * áreas restringidas jamás aparece (además, nunca se indexa).
 */

export type SearchFilters = {
  areaId?: string | null;
  año?: number | null;
  estado?: AcuerdoEstado | null;
};

export type SearchResult = {
  acuerdo_id: string;
  public_ref: string;
  titulo: string;
  estado: AcuerdoEstado;
  fecha_adopcion: string;
  acta_id: string;
  acta_numero: number;
  acta_año: number;
  source_page: number | null;
  snippet: string;
  score: number;
  expedientes: { id: string; titulo: string }[] | null;
  areas: { id: string; name: string; is_restricted: boolean }[] | null;
};

export type SearchResponse = {
  results: SearchResult[];
  mode: "exact" | "hybrid" | "keyword";
  reranked: boolean;
};

const RRF_K = 60;
const CANDIDATES = 40;
const RESULTS = 20;

/** Embedding de la consulta vía worker autoalojado; null si no hay TEI. */
async function embedQuery(q: string): Promise<number[] | null> {
  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) return null;
  try {
    const res = await fetch(`${workerUrl}/search/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: q }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding: number[] | null };
    return data.embedding;
  } catch {
    return null;
  }
}

/** Re-ranking con cross-encoder (TEI /rerank). Devuelve índices ordenados. */
async function rerank(query: string, texts: string[]): Promise<number[] | null> {
  const url = process.env.TEI_RERANK_URL;
  if (!url || texts.length === 0) return null;
  try {
    const res = await fetch(`${url}/rerank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, texts, truncate: true }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { index: number; score: number }[];
    return data.sort((a, b) => b.score - a.score).map((d) => d.index);
  } catch {
    return null;
  }
}

const METADATA_SELECT = `
  ac.id AS acuerdo_id, ac.public_ref, ac.titulo, ac.estado, ac.fecha_adopcion,
  ac.acta_id, a.numero AS acta_numero, a.año AS acta_año, ac.source_page,
  (SELECT json_agg(json_build_object('id', e.id, 'titulo', e.titulo))
   FROM expediente_acuerdos ea JOIN expedientes e ON e.id = ea.expediente_id
   WHERE ea.acuerdo_id = ac.id) AS expedientes,
  (SELECT json_agg(json_build_object('id', ar.id, 'name', ar.name, 'is_restricted', ar.is_restricted) ORDER BY ar.name)
   FROM acuerdo_areas aa JOIN areas ar ON ar.id = aa.area_id
   WHERE aa.acuerdo_id = ac.id) AS areas`;

const FILTER_WHERE = `
  AND ($2::uuid IS NULL OR EXISTS (
       SELECT 1 FROM acuerdo_areas f WHERE f.acuerdo_id = ac.id AND f.area_id = $2::uuid))
  AND ($3::int IS NULL OR extract(year FROM ac.fecha_adopcion)::int = $3::int)
  AND ($4::acuerdo_estado IS NULL OR ac.estado = $4::acuerdo_estado)`;

/** Coincidencia exacta: referencia de acuerdo o número de acta. */
async function exactMatch(
  userId: string,
  q: string,
  filters: SearchFilters
): Promise<SearchResult[] | null> {
  const refMatch = q.trim().match(/^acu[-\s]?(\d{4})[-\s]?(\d{1,4})$/i);
  const actaMatch = q.trim().match(/^acta\s+(\d{1,4})(?:\s*\/\s*(\d{4}))?$/i);

  if (refMatch) {
    const ref = `ACU-${refMatch[1]}-${refMatch[2].padStart(4, "0")}`;
    const rows = await queryAsUser<SearchResult>(
      userId,
      `SELECT ${METADATA_SELECT}, ac.titulo AS snippet, 1.0 AS score
       FROM acuerdos ac JOIN actas a ON a.id = ac.acta_id
       WHERE ac.public_ref = $1 ${FILTER_WHERE}`,
      [ref, filters.areaId ?? null, filters.año ?? null, filters.estado ?? null]
    );
    return rows.length > 0 ? rows : null;
  }

  if (actaMatch) {
    const rows = await queryAsUser<SearchResult>(
      userId,
      `SELECT ${METADATA_SELECT}, ac.titulo AS snippet, 1.0 AS score
       FROM acuerdos ac JOIN actas a ON a.id = ac.acta_id
       WHERE a.numero = $5 AND ($6::int IS NULL OR a.año = $6::int) ${FILTER_WHERE}
       ORDER BY ac.source_page NULLS LAST
       LIMIT ${RESULTS}`,
      [
        "",
        filters.areaId ?? null,
        filters.año ?? null,
        filters.estado ?? null,
        Number(actaMatch[1]),
        actaMatch[2] ? Number(actaMatch[2]) : null,
      ]
    );
    return rows.length > 0 ? rows : null;
  }

  return null;
}

export async function hybridSearch(
  userId: string,
  q: string,
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  const query = q.trim();
  if (!query) return { results: [], mode: "keyword", reranked: false };

  // 1) atajo exacto
  const exact = await exactMatch(userId, query, filters);
  if (exact) return { results: exact, mode: "exact", reranked: false };

  // 2) recuperación densa + dispersa con fusión RRF
  const embedding = await embedQuery(query);
  const vectorLiteral = embedding ? `[${embedding.join(",")}]` : null;

  const rows = await queryAsUser<SearchResult & { chunk_text: string }>(
    userId,
    `WITH kw AS (
       SELECT ch.id, ch.acuerdo_id, ch.chunk_text,
              row_number() OVER (ORDER BY ts_rank_cd(ch.tsv, websearch_to_tsquery('spanish', $1)) DESC) AS rnk
       FROM acuerdo_chunks ch
       WHERE ch.tsv @@ websearch_to_tsquery('spanish', $1)
       LIMIT ${CANDIDATES}
     ),
     vec AS (
       SELECT ch.id, ch.acuerdo_id, ch.chunk_text,
              row_number() OVER (ORDER BY ch.embedding <=> $5::vector) AS rnk
       FROM acuerdo_chunks ch
       WHERE $5::text IS NOT NULL AND ch.embedding IS NOT NULL
       ORDER BY ch.embedding <=> $5::vector
       LIMIT ${CANDIDATES}
     ),
     fused AS (
       SELECT COALESCE(kw.id, vec.id) AS chunk_id,
              COALESCE(kw.acuerdo_id, vec.acuerdo_id) AS acuerdo_id,
              COALESCE(kw.chunk_text, vec.chunk_text) AS chunk_text,
              COALESCE(1.0 / (${RRF_K} + kw.rnk), 0) + COALESCE(1.0 / (${RRF_K} + vec.rnk), 0) AS score
       FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
     ),
     best AS (
       SELECT DISTINCT ON (acuerdo_id) acuerdo_id, chunk_text, score
       FROM fused ORDER BY acuerdo_id, score DESC
     )
     SELECT ${METADATA_SELECT},
            ts_headline('spanish', b.chunk_text, websearch_to_tsquery('spanish', $1),
                        'StartSel=«««, StopSel=»»», MaxWords=40, MinWords=20, MaxFragments=1') AS snippet,
            b.chunk_text,
            b.score
     FROM best b
     JOIN acuerdos ac ON ac.id = b.acuerdo_id
     JOIN actas a ON a.id = ac.acta_id
     WHERE true ${FILTER_WHERE}
     ORDER BY b.score DESC
     LIMIT ${RESULTS}`,
    [
      query,
      filters.areaId ?? null,
      filters.año ?? null,
      filters.estado ?? null,
      vectorLiteral,
    ]
  );

  // 3) re-ranking con cross-encoder (mejora el orden final)
  let ordered = rows;
  let reranked = false;
  const order = await rerank(
    query,
    rows.map((r) => r.chunk_text)
  );
  if (order) {
    ordered = order.map((i) => rows[i]).filter(Boolean);
    reranked = true;
  }

  return {
    results: ordered.map((r) => {
      const { chunk_text: _omit, ...rest } = r;
      void _omit;
      return { ...rest, snippet: sanitizeSnippet(rest.snippet) };
    }),
    mode: embedding ? "hybrid" : "keyword",
    reranked,
  };
}

/**
 * El texto del chunk puede contener HTML: se escapa todo y solo después se
 * convierten los marcadores de ts_headline en <b>. El resultado es seguro
 * para renderizar como HTML.
 */
function sanitizeSnippet(raw: string): string {
  const escaped = raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return escaped.replaceAll("«««", "<b>").replaceAll("»»»", "</b>");
}
