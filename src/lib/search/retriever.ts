import { db } from "@/db";
import { IS_POSTGRES, sourceChunks, sources } from "@/db/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getEmbeddingProvider } from "@/lib/search/embedding";
import {
    diceCoefficient,
    idf,
    mmrSelect,
    normalizeScores,
    rrfFuse,
    normalizeRrf,
    scoreHybrid,
    tokenizeLight,
    weightedTokenOverlap,
    type FusionWeights,
} from "@/lib/search/rerank";
import type { RetrievedChunk } from "@/lib/search";
import type { LocalHit, SubQuery } from "@/lib/search/types";

/**
 * Hybrid local retriever (spec §4). Fetches candidate chunks via portable
 * Drizzle SQL (no `sql.raw` with user input), fuses FTS + n-gram + token
 * signals client-side, and re-ranks with MMR for cross-source diversity.
 */

/** Centralized PostgreSQL detection (spec §13.4). */
export function isPostgres(): boolean {
    return IS_POSTGRES;
}

/** Throws an `AbortError` when the signal is already aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        throw err;
    }
}

export type CandidateRow = RetrievedChunk;

/**
 * Tiny seam so unit tests can inject an in-memory array instead of touching
 * the DB (spec §10 "Mocking boundary").
 */
export interface ChunkRepository {
    query(
        notebookId: string,
        sourceIds: string[] | undefined,
        tokens: string[],
        limit: number,
    ): Promise<RetrievedChunk[]>;
    firstPerSource(notebookId: string, limit: number): Promise<RetrievedChunk[]>;
}

/** Default repository backed by the Drizzle `db` client (portable SQL). */
export class DrizzleChunkRepository implements ChunkRepository {
    async query(
        notebookId: string,
        sourceIds: string[] | undefined,
        tokens: string[],
        limit: number,
    ): Promise<RetrievedChunk[]> {
        const conds: ReturnType<typeof eq>[] = [eq(sourceChunks.notebookId, notebookId)];
        if (sourceIds && sourceIds.length > 0) {
            conds.push(inArray(sourceChunks.sourceId, sourceIds) as never);
        }
        if (tokens.length > 0) {
            // lower() like works on both PostgreSQL and SQLite and is parameterized.
            const likeConds = tokens.map((t) =>
                sql`lower(${sourceChunks.content}) like ${`%${t.toLowerCase()}%`}`,
            );
            conds.push(or(...likeConds) as never);
        }

        const rows = await db
            .select({
                id: sourceChunks.id,
                source_id: sourceChunks.sourceId,
                content: sourceChunks.content,
                title: sources.title,
            })
            .from(sourceChunks)
            .innerJoin(sources, eq(sourceChunks.sourceId, sources.id))
            .where(and(...conds))
            .limit(limit);

        return rows.map((row) => ({
            chunkId: row.id,
            sourceId: row.source_id,
            sourceTitle: row.title,
            content: row.content,
            rank: 0, // FTS rank added by the optional PG FTS pass
        }));
    }

    async firstPerSource(notebookId: string, limit: number): Promise<RetrievedChunk[]> {
        // Portable approximation of `DISTINCT ON (source_id) ... ORDER BY chunk_index`:
        // fetch first `limit * 4` ordered chunks and dedupe by source in JS.
        const rows = await db
            .select({
                id: sourceChunks.id,
                source_id: sourceChunks.sourceId,
                content: sourceChunks.content,
                title: sources.title,
            })
            .from(sourceChunks)
            .innerJoin(sources, eq(sourceChunks.sourceId, sources.id))
            .where(eq(sourceChunks.notebookId, notebookId))
            .orderBy(sourceChunks.chunkIndex)
            .limit(Math.min(limit * 4, 200));

        const seen = new Set<string>();
        const out: RetrievedChunk[] = [];
        for (const row of rows) {
            if (seen.has(row.source_id)) continue;
            seen.add(row.source_id);
            out.push({
                chunkId: row.id,
                sourceId: row.source_id,
                sourceTitle: row.title,
                content: row.content,
                rank: 0,
            });
            if (out.length >= limit) break;
        }
        return out;
    }
}

/** Default instance for production use. */
export const defaultChunkRepository = new DrizzleChunkRepository();

/** Optional PostgreSQL FTS pass: adds ts_rank_cd candidates (spec §4.3). */
async function fetchFtsCandidates(
    notebookId: string,
    sourceIds: string[] | undefined,
    queryText: string,
    limit: number,
): Promise<RetrievedChunk[]> {
    if (!isPostgres()) return [];
    const tsQuery = queryText
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 16)
        .map((w) => `${w}:*`)
        .join(" | ");
    if (!tsQuery) return [];

    const conds: ReturnType<typeof eq>[] = [
        eq(sourceChunks.notebookId, notebookId) as never,
        sql`to_tsvector('simple', ${sourceChunks.content}) @@ to_tsquery('simple', ${tsQuery})` as never,
    ];
    if (sourceIds && sourceIds.length > 0) {
        conds.push(inArray(sourceChunks.sourceId, sourceIds) as never);
    }

    const rows = await db
        .select({
            id: sourceChunks.id,
            source_id: sourceChunks.sourceId,
            content: sourceChunks.content,
            title: sources.title,
        })
        .from(sourceChunks)
        .innerJoin(sources, eq(sourceChunks.sourceId, sources.id))
        .where(and(...conds))
        .orderBy(
            sql`ts_rank_cd(to_tsvector('simple', ${sourceChunks.content}), to_tsquery('simple', ${tsQuery})) desc`,
        )
        .limit(limit);

    return rows.map((row) => ({
        chunkId: row.id,
        sourceId: row.source_id,
        sourceTitle: row.title,
        content: row.content,
        rank: 0, // real rank computed later; FTS only widens the candidate pool
    }));
}

export type LocalRetrieverOptions = {
    notebookId: string;
    sourceIds?: string[];
    fusionStrategy?: "weighted" | "rrf";
    candidateLimit?: number; // default 300 chunks fetched per sub-query
    embed?: boolean; // use embedding provider if available
    weights?: FusionWeights;
    repository?: ChunkRepository;
};

const DEFAULT_FUSION_WEIGHTS: Required<FusionWeights> = { fts: 0.5, ngram: 0.3, token: 0.2 };

/** Per-sub-query scoring against the query text AND its expansions (max). */
function scoreChunkSignals(
    chunkText: string,
    queryTexts: string[],
    idfs: Map<string, number>,
    ftsRank = 0,
): { fts: number; ngram: number; token: number } {
    let ngram = 0;
    let token = 0;
    for (const q of queryTexts) {
        ngram = Math.max(ngram, diceCoefficient(chunkText, q));
        token = Math.max(
            token,
            weightedTokenOverlap(tokenizeLight(chunkText), tokenizeLight(q), idfs),
        );
    }
    return { fts: ftsRank, ngram, token };
}

/** Weighted normalized-sum fusion across a candidate set. */
function fuseWeighted(
    candidates: RetrievedChunk[],
    signals: { fts: number; ngram: number; token: number }[],
    weights: Required<FusionWeights>,
): number[] {
    const ftsNorm = normalizeScores(signals.map((s) => s.fts));
    const ngramNorm = normalizeScores(signals.map((s) => s.ngram));
    const tokenNorm = normalizeScores(signals.map((s) => s.token));
    return signals.map((_, i) => {
        // FTS rank is 0 for non-PG; weight it only when any FTS signal is present.
        const ftsW = Math.max(...signals.map((s) => s.fts)) > 0 ? weights.fts : 0;
        const sum = ftsW + weights.ngram + weights.token;
        if (sum === 0) return 0;
        return (
            (ftsW * ftsNorm[i] + weights.ngram * ngramNorm[i] + weights.token * tokenNorm[i]) /
            sum
        );
    });
}

/** RRF fusion with an optional 4th embedding-cosine signal (spec §4.2). */
function fuseRrf(
    candidates: RetrievedChunk[],
    signals: { fts: number; ngram: number; token: number }[],
    embeddingScores: number[] | null,
): number[] {
    const rankLists: string[][] = [];
    const pushRankList = (values: number[]) => {
        rankLists.push(
            candidates
                .map((c, i) => ({ id: c.chunkId, v: values[i] }))
                .sort((a, b) => b.v - a.v)
                .map((x) => x.id),
        );
    };
    pushRankList(signals.map((s) => s.fts));
    pushRankList(signals.map((s) => s.ngram));
    pushRankList(signals.map((s) => s.token));
    if (embeddingScores) pushRankList(embeddingScores);

    const rrf = normalizeRrf(rrfFuse(rankLists, 60));
    return candidates.map((c) => rrf.get(c.chunkId) ?? 0);
}

export async function fetchCandidates(
    notebookId: string,
    sourceIds: string[] | undefined,
    queryTokens: string[],
    limit: number,
): Promise<RetrievedChunk[]> {
    const repo = defaultChunkRepository;
    const byLike = await repo.query(notebookId, sourceIds, queryTokens, limit);
    if (byLike.length > 0) return byLike;
    // Empty-token / no-match fallback: first chunk per source (spec §4.3).
    return repo.firstPerSource(notebookId, limit);
}

/**
 * Retrieves relevant local chunks for each sub-query using hybrid fusion + MMR.
 * Returns one `LocalHit` per sub-query (possibly with an empty chunks array).
 */
export async function retrieveLocalChunks(
    subQueries: SubQuery[],
    opts: LocalRetrieverOptions,
    signal?: AbortSignal,
): Promise<LocalHit[]> {
    const {
        notebookId,
        sourceIds,
        fusionStrategy = "weighted",
        candidateLimit = 300,
        embed = false,
        weights,
    } = opts;
    const repository = opts.repository ?? defaultChunkRepository;
    const fusionWeights: Required<FusionWeights> = { ...DEFAULT_FUSION_WEIGHTS, ...weights };
    const useEmbedding = embed ? getEmbeddingProvider() : null;

    const hits: LocalHit[] = [];
    const embedCache = new Map<string, number[]>(); // chunkId -> vector (across sub-queries)

    for (const subQuery of subQueries) {
        throwIfAborted(signal);
        if (!subQuery.text.trim()) {
            hits.push({ subQueryId: subQuery.id, aspect: subQuery.aspect, chunks: [] });
            continue;
        }

        const queryTexts = [
            subQuery.text,
            ...(subQuery.expansions ?? []).filter((e) => e.trim().length > 0),
        ];
        const tokens = Array.from(
            new Set(queryTexts.flatMap((t) => tokenizeLight(t)).map((t) => t.toLowerCase())),
        );

        let candidates = await repository.query(notebookId, sourceIds, tokens, candidateLimit);
        if (candidates.length === 0) {
            candidates = await repository.firstPerSource(notebookId, candidateLimit);
        }
        if (candidates.length === 0) {
            hits.push({ subQueryId: subQuery.id, aspect: subQuery.aspect, chunks: [] });
            continue;
        }

        // Optional PG FTS widens the pool with lexical-exact candidates.
        if (isPostgres() && tokens.length > 0) {
            const ftsPool = await fetchFtsCandidates(notebookId, sourceIds, subQuery.text, candidateLimit);
            const known = new Set(candidates.map((c) => c.chunkId));
            for (const fc of ftsPool) {
                if (!known.has(fc.chunkId)) candidates.push(fc);
            }
        }
        if (candidates.length > candidateLimit) candidates = candidates.slice(0, candidateLimit);

        // IDF over the candidate pool for weighted token overlap.
        const docs = candidates.map((c) => tokenizeLight(c.content));
        const allTokens = Array.from(new Set(docs.flat()));
        const idfs = idf(allTokens, docs);

        // Embedding cosine (4th signal) when enabled and available.
        let embeddingScores: number[] | null = null;
        if (useEmbedding && useEmbedding.isAvailable()) {
            const missing = candidates.filter((c) => !embedCache.has(c.chunkId));
            const vectors = await useEmbedding.embed(
                [subQuery.text, ...queryTexts.slice(1), ...missing.map((c) => c.content)],
                signal,
            );
            if (vectors && vectors.length === queryTexts.length + missing.length) {
                const qVecs = vectors.slice(0, queryTexts.length);
                missing.forEach((c, i) => embedCache.set(c.chunkId, vectors[queryTexts.length + i]));
                embeddingScores = candidates.map((c) => {
                    const v = embedCache.get(c.chunkId);
                    if (!v) return 0;
                    let best = 0;
                    for (const qv of qVecs) best = Math.max(best, useEmbedding.cosine(qv, v));
                    return best;
                });
            }
        }

        const signals = candidates.map((c) =>
            scoreChunkSignals(c.content, queryTexts, idfs, c.rank),
        );

        const strategy = useEmbedding && useEmbedding.isAvailable() ? "rrf" : fusionStrategy;
        const fused =
            strategy === "rrf"
                ? fuseRrf(candidates, signals, embeddingScores)
                : fuseWeighted(candidates, signals, fusionWeights);

        const scored = candidates.map((c, i) => ({
            ...c,
            rank: fused[i],
        }));
        scored.sort((a, b) => b.rank - a.rank);

        const selected = mmrSelect(scored, {
            lambda: 0.7,
            relevance: (c) => c.rank,
            k: 6,
            maxPerSource: 3,
        });

        hits.push({
            subQueryId: subQuery.id,
            aspect: subQuery.aspect,
            chunks: selected,
        });
    }

    return hits;
}
