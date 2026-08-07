import { db } from "@/db";
import { sql } from "drizzle-orm";
import { IS_POSTGRES } from "@/db/schema";

export type RetrievedChunk = {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  content: string;
  rank: number;
};

/** Escapes LIKE wildcards so user input is matched literally. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Builds a tsquery string from a user query (PostgreSQL full-text syntax). */
function buildTsQuery(safeQuery: string): string {
  return safeQuery
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 16)
    .map((w) => `${w}:*`)
    .join(" | ");
}

/**
 * Parameterized source-id filter. Uses bound parameters instead of raw string
 * interpolation to avoid SQL injection.
 */
function buildSourceFilter(sourceIds?: string[]) {
  if (!sourceIds || sourceIds.length === 0) return sql``;
  return sql`AND sc.source_id IN (${sql.join(sourceIds.map((id) => sql`${id}`), sql`, `)})`;
}

type ChunkRow = {
  id: string;
  source_id: string;
  content: string;
  title: string;
  rank?: number;
};

function mapRow(row: ChunkRow): RetrievedChunk {
  return {
    chunkId: row.id,
    sourceId: row.source_id,
    sourceTitle: row.title,
    content: row.content,
    rank: Number(row.rank ?? 0),
  };
}

/**
 * Retrieves the most relevant chunks for a query.
 * - PostgreSQL: native full-text search (to_tsvector / ts_rank_cd).
 * - SQLite: LIKE-based matching so the app remains usable without Postgres.
 */
export async function searchChunks(
  notebookId: string,
  query: string,
  limit = 8,
  sourceIds?: string[],
): Promise<RetrievedChunk[]> {
  const safeQuery = query.trim();
  if (!safeQuery) return [];

  const sourceFilter = buildSourceFilter(sourceIds);

  // Over-fetch so we can guarantee at least one chunk per selected source
  // (round-robin coverage) before trimming to the requested limit.
  const fetchLimit = Math.max(limit * 4, 32);

  if (IS_POSTGRES) {
    const tsQuery = buildTsQuery(safeQuery);
    if (!tsQuery) return [];

    const result = await db.execute<ChunkRow & { rank: number }>(sql`
      SELECT sc.id, sc.source_id, sc.content, s.title,
        ts_rank_cd(to_tsvector('simple', sc.content), to_tsquery('simple', ${tsQuery})) AS rank
      FROM source_chunks sc
      JOIN sources s ON s.id = sc.source_id
      WHERE sc.notebook_id = ${notebookId}
        AND to_tsvector('simple', sc.content) @@ to_tsquery('simple', ${tsQuery})
        ${sourceFilter}
      ORDER BY rank DESC
      LIMIT ${fetchLimit}
    `);
    return applyRoundRobin(result.rows.map(mapRow), limit);
  }

  // SQLite: token-based LIKE matching
  const terms = safeQuery.split(/\s+/).filter(Boolean).slice(0, 16);
  if (terms.length === 0) return [];

  const likeConditions = sql.join(
    terms.map((t) => sql`sc.content LIKE ${`%${escapeLike(t)}%`} ESCAPE '\\'`),
    sql` OR `,
  );

  const result = await db.execute<ChunkRow>(sql`
    SELECT sc.id, sc.source_id, sc.content, s.title
    FROM source_chunks sc
    JOIN sources s ON s.id = sc.source_id
    WHERE sc.notebook_id = ${notebookId}
      AND (${likeConditions})
      ${sourceFilter}
    ORDER BY sc.created_at ASC
    LIMIT ${fetchLimit}
  `);
  return applyRoundRobin(result.rows.map(mapRow), limit);
}

/**
 * Round-robin coverage: ensure the best chunk of EACH distinct source is
 * included first, then fill remaining slots by rank up to the limit.
 * This prevents a single high-ranking source from monopolizing the context.
 */
function applyRoundRobin(chunks: RetrievedChunk[], limit: number): RetrievedChunk[] {
  if (chunks.length === 0 || limit <= 0) return [];

  const seenSources = new Set<string>();
  const guaranteed: RetrievedChunk[] = [];
  const rest: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    if (!seenSources.has(chunk.sourceId)) {
      seenSources.add(chunk.sourceId);
      guaranteed.push(chunk);
    } else {
      rest.push(chunk);
    }
  }

  const combined = [...guaranteed, ...rest];
  return combined.slice(0, limit);
}

/** Fallback: if full-text search finds nothing, grab the first chunk of each source. */
export async function fallbackChunks(
  notebookId: string,
  limit = 6,
  sourceIds?: string[],
): Promise<RetrievedChunk[]> {
  const sourceFilter = buildSourceFilter(sourceIds);

  if (IS_POSTGRES) {
    const result = await db.execute<ChunkRow>(sql`
      SELECT DISTINCT ON (sc.source_id) sc.id, sc.source_id, sc.content, s.title
      FROM source_chunks sc
      JOIN sources s ON s.id = sc.source_id
      WHERE sc.notebook_id = ${notebookId}
        ${sourceFilter}
      ORDER BY sc.source_id, sc.chunk_index ASC
      LIMIT ${limit}
    `);
    return result.rows.map(mapRow);
  }

  // SQLite: pick the earliest chunk per source via a correlated subquery
  const result = await db.execute<ChunkRow>(sql`
    SELECT sc.id, sc.source_id, sc.content, s.title
    FROM source_chunks sc
    JOIN sources s ON s.id = sc.source_id
    WHERE sc.notebook_id = ${notebookId}
      ${sourceFilter}
      AND sc.id = (
        SELECT sc2.id FROM source_chunks sc2
        WHERE sc2.source_id = sc.source_id
        ORDER BY sc2.chunk_index ASC
        LIMIT 1
      )
    ORDER BY sc.created_at ASC
    LIMIT ${limit}
  `);
  return result.rows.map(mapRow);
}
