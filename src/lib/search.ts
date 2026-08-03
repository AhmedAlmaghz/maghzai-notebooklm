import { db } from "@/db";
import { sql } from "drizzle-orm";

export type RetrievedChunk = {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  content: string;
  rank: number;
};

/**
 * Retrieves the most relevant chunks for a query using PostgreSQL native
 * full-text search (no external embedding API required).
 */
export async function searchChunks(
  notebookId: string,
  query: string,
  limit = 8,
  sourceIds?: string[],
): Promise<RetrievedChunk[]> {
  const safeQuery = query.trim();
  if (!safeQuery) return [];

  const tsQuery = safeQuery
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 16)
    .map((w) => `${w}:*`)
    .join(" | ");

  if (!tsQuery) return [];

  const sourceFilter = sourceIds && sourceIds.length > 0
    ? sql`AND sc.source_id = ANY(${sql.raw(`ARRAY[${sourceIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",")}]`)})`
    : sql``;

  const result = await db.execute<{
    id: string;
    source_id: string;
    content: string;
    title: string;
    rank: number;
  }>(sql`
    SELECT sc.id, sc.source_id, sc.content, s.title,
      ts_rank_cd(to_tsvector('simple', sc.content), to_tsquery('simple', ${tsQuery})) AS rank
    FROM source_chunks sc
    JOIN sources s ON s.id = sc.source_id
    WHERE sc.notebook_id = ${notebookId}
      AND to_tsvector('simple', sc.content) @@ to_tsquery('simple', ${tsQuery})
      ${sourceFilter}
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return result.rows.map((row) => ({
    chunkId: row.id,
    sourceId: row.source_id,
    sourceTitle: row.title,
    content: row.content,
    rank: Number(row.rank),
  }));
}

/** Fallback: if full-text search finds nothing (e.g. stopword-only query), grab first chunks of each source. */
export async function fallbackChunks(
  notebookId: string,
  limit = 6,
): Promise<RetrievedChunk[]> {
  const result = await db.execute<{
    id: string;
    source_id: string;
    content: string;
    title: string;
  }>(sql`
    SELECT DISTINCT ON (sc.source_id) sc.id, sc.source_id, sc.content, s.title
    FROM source_chunks sc
    JOIN sources s ON s.id = sc.source_id
    WHERE sc.notebook_id = ${notebookId}
    ORDER BY sc.source_id, sc.chunk_index ASC
    LIMIT ${limit}
  `);
  return result.rows.map((row) => ({
    chunkId: row.id,
    sourceId: row.source_id,
    sourceTitle: row.title,
    content: row.content,
    rank: 0,
  }));
}

// ---- Deep Search over Sources (facade re-exports) ---------------------------
export type {
  Aspect,
  CoverageReport,
  DeepCitation,
  DeepSearchRequest,
  DeepSearchResult,
  EvidenceItem,
  LocalHit,
  MergedChunk,
  ResearchCorpus,
  SubQuery,
  WebSearchResult,
} from "@/lib/search/types";
export type { DeepSearchEvent, DeepSearchStage } from "@/lib/search/events";
export type {
  DeepSearchRunParams,
} from "@/lib/search/deep-search";
export {
  DEFAULT_OPTIONS as DEEP_SEARCH_DEFAULT_OPTIONS,
  runDeepSearch,
} from "@/lib/search/deep-search";
