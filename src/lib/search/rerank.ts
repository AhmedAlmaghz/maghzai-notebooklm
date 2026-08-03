import type { RetrievedChunk } from "@/lib/search";
import { ARABIC_STOPWORDS, ENGLISH_STOPWORDS } from "@/lib/text/summarize";

/**
 * Pure scoring, fusion and re-ranking primitives. No I/O, fully unit-testable.
 */

/** Unicode-safe character n-grams (default bigrams n=2). */
export function charNgrams(text: string, n = 2): string[] {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length < n) return [cleaned];
    const grams: string[] = [];
    for (let i = 0; i <= cleaned.length - n; i++) {
        grams.push(cleaned.slice(i, i + n));
    }
    return grams;
}

/** n-gram multiset as a Map<gram, count>. */
export function ngramMultiset(text: string, n = 2): Map<string, number> {
    const map = new Map<string, number>();
    for (const g of charNgrams(text, n)) {
        map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
}

/** n-gram Set for a given n (checklist-compatible signature). */
export function ngramSet(text: string, n = 2): Set<string> {
    return new Set(charNgrams(text, n));
}

/** Sørensen–Dice alias matching the checklist signature. */
export function sorensenDice(a: string, b: string): number {
    return diceCoefficient(a, b);
}

/**
 * Sørensen–Dice coefficient on bigram + trigram multisets.
 * Returns 0..1; robust to Arabic affixes (كتاب vs الكتب share bigrams).
 */
export function diceCoefficient(a: string, b: string): number {
    if (!a || !b) return 0;
    const bigramsA = ngramMultiset(a, 2);
    const bigramsB = ngramMultiset(b, 2);
    const trigramsA = ngramMultiset(a, 3);
    const trigramsB = ngramMultiset(b, 3);

    let intersection = 0;
    let total = 0;
    for (const map of [bigramsA, bigramsB, trigramsA, trigramsB]) {
        for (const count of map.values()) total += count;
    }
    if (total === 0) return 0;

    const intersect = (x: Map<string, number>, y: Map<string, number>) => {
        let s = 0;
        for (const [k, c] of x) {
            const c2 = y.get(k);
            if (c2 !== undefined) s += Math.min(c, c2);
        }
        return s;
    };
    intersection =
        intersect(bigramsA, bigramsB) + intersect(trigramsA, trigramsB);

    return (2 * intersection) / total;
}

/** Lightweight tokenization reusing the existing Arabic/English stopword lists. */
export function tokenizeLight(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !ARABIC_STOPWORDS.has(w) && !ENGLISH_STOPWORDS.has(w));
}

/** Jaccard coefficient on token sets: |A∩B| / |A∪B|. */
export function jaccardTokens(a: string, b: string): number {
    const A = new Set(tokenizeLight(a));
    const B = new Set(tokenizeLight(b));
    if (A.size === 0 || B.size === 0) return 0;
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    const union = A.size + B.size - inter;
    return union === 0 ? 0 : inter / union;
}

/** IDF computed over a corpus of tokenized documents. */
export function idf(tokens: string[], corpus: string[][]): Map<string, number> {
    const df = new Map<string, number>();
    for (const doc of corpus) {
        const seen = new Set(doc);
        for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
    }
    const n = Math.max(corpus.length, 1);
    const out = new Map<string, number>();
    for (const t of tokens) {
        const d = df.get(t) ?? 0;
        out.set(t, Math.log((n + 1) / (d + 1)) + 1);
    }
    return out;
}

/**
 * Weighted token overlap: sum of IDF weights of query tokens present in chunk,
 * divided by the total IDF of all query tokens (0..1).
 */
export function weightedTokenOverlap(
    chunkTokens: string[],
    queryTokens: string[],
    idfs: Map<string, number>,
): number {
    if (queryTokens.length === 0) return 0;
    const chunkSet = new Set(chunkTokens);
    let hit = 0;
    let total = 0;
    for (const t of queryTokens) {
        const w = idfs.get(t) ?? 1;
        total += w;
        if (chunkSet.has(t)) hit += w;
    }
    return total === 0 ? 0 : hit / total;
}

/**
 * Checklist-compatible token overlap with IDF over an optional corpus.
 * When `corpus` is omitted, corpus = [text] so IDF defaults to 1 per token.
 */
export function tokenOverlapWithIdf(
    text: string,
    query: string,
    corpus?: string[],
): number {
    const queryTokens = tokenizeLight(query);
    const chunkTokens = tokenizeLight(text);
    const docs = corpus ? corpus.map((c) => tokenizeLight(c)) : [chunkTokens];
    const allTokens = new Set<string>(docs.flat());
    const idfs = idf([...allTokens], docs);
    return weightedTokenOverlap(chunkTokens, queryTokens, idfs);
}

/** Normalizes a value to 0..1 using min-max over the provided list. */
export function normalize(value: number, list: number[]): number {
    const max = Math.max(...list);
    const min = Math.min(...list);
    if (max === min) return 0;
    return (value - min) / (max - min);
}

/** Min-max normalizes every value of the list to 0..1 (spec §9.1 `normalizeScores`). */
export function normalizeScores(scores: number[]): number[] {
    if (scores.length === 0) return scores;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    if (max === min) return scores.map(() => 1);
    return scores.map((v) => (v - min) / (max - min));
}

export type HybridScores = { fts: number; ngram: number; token: number; fused: number };
export type FusionWeights = { fts?: number; ngram?: number; token?: number };

/**
 * Weighted hybrid fusion. `ftsRank` is optional (0 when not on PostgreSQL).
 * The returned scores are raw; normalization happens at the set level.
 */
export function hybridFuse(
    chunkText: string,
    queryText: string,
    opts: { ftsRank?: number; tokenOverlap?: number; weights?: FusionWeights },
): HybridScores {
    const weights: Required<FusionWeights> = {
        fts: opts.weights?.fts ?? 0.5,
        ngram: opts.weights?.ngram ?? 0.3,
        token: opts.weights?.token ?? 0.2,
    };
    const fts = opts.ftsRank ?? 0;
    const ngram = diceCoefficient(chunkText, queryText);
    const token = opts.tokenOverlap ?? jaccardTokens(chunkText, queryText);
    const fused = weights.fts * fts + weights.ngram * ngram + weights.token * token;
    return { fts, ngram, token, fused };
}

/**
 * Spec §4.2 `scoreHybrid`: computes the three raw signals plus the fused score.
 * When `idfs` is provided, the token signal uses IDF weighting, else plain Jaccard.
 */
export function scoreHybrid(
    chunkText: string,
    queryText: string,
    opts: { ftsRank?: number; idfs?: Map<string, number> },
): HybridScores {
    const chunkTokens = tokenizeLight(chunkText);
    const queryTokens = tokenizeLight(queryText);
    const token = opts.idfs
        ? weightedTokenOverlap(chunkTokens, queryTokens, opts.idfs)
        : jaccardTokens(chunkText, queryText);
    return hybridFuse(chunkText, queryText, {
        ftsRank: opts.ftsRank,
        tokenOverlap: token,
    });
}

/**
 * Reciprocal Rank Fusion over a list of rank-lists (each is an array of ids,
 * best first). Returns a Map<id, rrfScore>.
 */
export function rrfFuse(
    rankLists: string[][],
    k = 60,
): Map<string, number> {
    const scores = new Map<string, number>();
    for (const list of rankLists) {
        list.forEach((id, idx) => {
            scores.set(id, (scores.get(id) ?? 0) + 1 / (k + idx + 1));
        });
    }
    return scores;
}

/** Normalized 0..1 RRF score given a raw RRF map. */
export function normalizeRrf(scores: Map<string, number>): Map<string, number> {
    const max = Math.max(...scores.values(), 0);
    if (max === 0) return scores;
    const out = new Map<string, number>();
    for (const [k, v] of scores) out.set(k, v / max);
    return out;
}

export type MmrOptions = {
    lambda?: number; // default 0.7
    diversityMetric?: (a: RetrievedChunk, b: RetrievedChunk) => number;
    relevance?: (c: RetrievedChunk) => number;
    k?: number; // chunks to keep, default 6
    maxPerSource?: number; // default 3
};

/**
 * Greedy Maximal Marginal Relevance selection with a hard per-source cap.
 * Returns diverse chunks across sources while preferring relevance.
 */
export function mmrSelect(
    candidates: RetrievedChunk[],
    opts: MmrOptions = {},
): RetrievedChunk[] {
    const {
        lambda = 0.7,
        diversityMetric = (a, b) => diceCoefficient(a.content, b.content),
        relevance = (c) => c.rank,
        k = 6,
        maxPerSource = 3,
    } = opts;

    if (candidates.length === 0 || k <= 0) return [];

    // Sort by relevance desc, then greedily select.
    const sorted = [...candidates].sort(
        (a, b) => relevance(b) - relevance(a),
    );
    const selected: RetrievedChunk[] = [];
    const sourceCounts = new Map<string, number>();
    const pool = [...sorted];

    while (selected.length < k && pool.length > 0) {
        let bestIdx = -1;
        let bestScore = -Infinity;
        for (let i = 0; i < pool.length; i++) {
            const d = pool[i];
            const sourceCount = sourceCounts.get(d.sourceId) ?? 0;
            if (sourceCount >= maxPerSource) continue; // hard cap
            let penalty = 0;
            for (const s of selected) {
                const sim = diversityMetric(d, s);
                if (sim > penalty) penalty = sim;
            }
            const mmr = lambda * relevance(d) - (1 - lambda) * penalty;
            if (mmr > bestScore) {
                bestScore = mmr;
                bestIdx = i;
            }
        }
        if (bestIdx === -1) break; // no candidate fits (all capped)
        const [chosen] = pool.splice(bestIdx, 1);
        selected.push(chosen);
        sourceCounts.set(chosen.sourceId, (sourceCounts.get(chosen.sourceId) ?? 0) + 1);
    }

    return selected;
}
