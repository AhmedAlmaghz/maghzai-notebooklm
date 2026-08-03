import type { RetrievedChunk } from "@/lib/search";
import type {
    Aspect,
    CoverageReport,
    LocalHit,
    MergedChunk,
    ResearchCorpus,
    WebSearchResult,
} from "@/lib/search/types";

/**
 * Research corpus assembly (spec §4.6, §5.3, §5.4): merges local hits,
 * dedupes/filters/caps web results, and builds the final aspect-interleaved
 * evidence corpus with char budgets.
 */

/** Dedupes by chunkId and unions aspects + subQueryIds; bestScore desc. */
export function mergeLocalHits(hits: LocalHit[]): MergedChunk[] {
    const byId = new Map<string, MergedChunk>();
    for (const hit of hits) {
        for (const chunk of hit.chunks) {
            const existing = byId.get(chunk.chunkId);
            if (!existing) {
                byId.set(chunk.chunkId, {
                    chunkId: chunk.chunkId,
                    sourceId: chunk.sourceId,
                    sourceTitle: chunk.sourceTitle,
                    content: chunk.content,
                    subQueryIds: [hit.subQueryId],
                    aspects: [hit.aspect],
                    bestScore: chunk.rank,
                });
                continue;
            }
            if (!existing.subQueryIds.includes(hit.subQueryId)) {
                existing.subQueryIds.push(hit.subQueryId);
            }
            if (!existing.aspects.includes(hit.aspect)) {
                existing.aspects.push(hit.aspect);
            }
            existing.bestScore = Math.max(existing.bestScore, chunk.rank);
        }
    }
    return [...byId.values()].sort((a, b) => b.bestScore - a.bestScore);
}

/** Normalizes a URI for dedup: lowercase host, strip trailing slash/#fragment/utm_*. */
export function normalizeUri(uri: string): string {
    let u = uri.trim();
    try {
        const url = new URL(u);
        url.hash = "";
        url.search = "";
        url.hostname = url.hostname.toLowerCase();
        u = url.toString().replace(/\/$/, "");
    } catch {
        // Not a valid URL: best-effort normalization
        u = u.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
    }
    return u;
}

/** Keeps the first result per normalized URI (spec §5.3). */
export function dedupeByUri(results: WebSearchResult[]): WebSearchResult[] {
    const seen = new Set<string>();
    const out: WebSearchResult[] = [];
    for (const r of results) {
        const key = normalizeUri(r.uri);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(r);
    }
    return out;
}

/** Drops results with short snippets/titles and exact-duplicate snippets. */
export function filterLowSignal(
    results: WebSearchResult[],
    minSnippetLen = 40,
): WebSearchResult[] {
    const seenSnippets = new Set<string>();
    const out: WebSearchResult[] = [];
    for (const r of results) {
        const snippet = (r.snippet ?? "").trim();
        const title = (r.title ?? "").trim();
        if (snippet.length < minSnippetLen) continue;
        if (title.length < 5) continue;
        const sn = snippet.replace(/\s+/g, " ").toLowerCase();
        if (seenSnippets.has(sn)) continue;
        seenSnippets.add(sn);
        out.push(r);
    }
    return out;
}

/** Keeps the top `maxPerAspect` results per aspect ordered by snippet length. */
export function capPerAspect(
    results: WebSearchResult[],
    maxPerAspect = 5,
): WebSearchResult[] {
    const byAspect = new Map<Aspect, WebSearchResult[]>();
    for (const r of results) {
        const aspect = (r as WebSearchResult & { aspect?: Aspect }).aspect ?? "definition";
        const list = byAspect.get(aspect) ?? [];
        list.push(r);
        byAspect.set(aspect, list);
    }
    const out: WebSearchResult[] = [];
    for (const list of byAspect.values()) {
        const capped = [...list]
            .sort((a, b) => (b.snippet?.length ?? 0) - (a.snippet?.length ?? 0))
            .slice(0, maxPerAspect);
        out.push(...capped);
    }
    return out;
}

/** Coverage check: reports aspects with fewer than `minPerAspect` items. */
export function coverageCheck(
    expectedAspects: Aspect[],
    actual: { aspect: Aspect; count: number }[],
    minPerAspect = 1,
): CoverageReport {
    const counts = new Map<Aspect, number>();
    for (const a of actual) counts.set(a.aspect, (counts.get(a.aspect) ?? 0) + a.count);
    const coveredAspects: Aspect[] = [];
    const missingAspects: Aspect[] = [];
    for (const aspect of expectedAspects) {
        if ((counts.get(aspect) ?? 0) >= minPerAspect) {
            coveredAspects.push(aspect);
        } else {
            missingAspects.push(aspect);
        }
    }
    return { covered: missingAspects.length === 0, coveredAspects, missingAspects };
}

export type MergeCorpusOptions = {
    maxLocal?: number; // default 30 chunks
    maxWebTotal?: number; // default 12,000 chars
    maxLocalChars?: number; // default 15,000 chars
    maxWebPerAspect?: number; // default 5
};

const DEFAULT_OPTIONS: Required<MergeCorpusOptions> = {
    maxLocal: 30,
    maxWebTotal: 12_000,
    maxLocalChars: 15_000,
    maxWebPerAspect: 5,
};

/**
 * Assembles the final aspect-interleaved research corpus with char budgets
 * (spec §5.3). Also drops chunks whose content is too short to be useful.
 */
export function mergeResearchCorpus(
    localChunks: MergedChunk[],
    webResults: WebSearchResult[],
    opts: MergeCorpusOptions = {},
): ResearchCorpus {
    const { maxLocal, maxWebTotal, maxLocalChars, maxWebPerAspect } = {
        ...DEFAULT_OPTIONS,
        ...opts,
    };

    const cappedLocal = localChunks.slice(0, maxLocal);
    const cleanedWeb = capPerAspect(dedupeByUri(filterLowSignal(webResults)), maxWebPerAspect);

    // Char-budget the web results (order preserved).
    let webChars = 0;
    const budgetedWeb: WebSearchResult[] = [];
    for (const r of cleanedWeb) {
        const add = (r.snippet?.length ?? 0) + (r.title?.length ?? 0) + (r.uri?.length ?? 0);
        if (webChars + add > maxWebTotal) break;
        webChars += add;
        budgetedWeb.push(r);
    }

    // Char-budget the local chunks (global cap, still within each aspect).
    let localChars = 0;
    const budgetedLocal: MergedChunk[] = [];
    for (const c of cappedLocal) {
        if (c.content.length < 20) continue;
        if (localChars + c.content.length > maxLocalChars) break;
        localChars += c.content.length;
        budgetedLocal.push(c);
    }

    const aspectSet = new Set<Aspect>([
        ...budgetedLocal.flatMap((c) => c.aspects),
        ...budgetedWeb.map((r) => (r as WebSearchResult & { aspect?: Aspect }).aspect ?? "definition"),
    ]);

    const aspects: { aspect: Aspect; local: MergedChunk[]; web: WebSearchResult[] }[] = [];
    for (const aspect of aspectSet) {
        aspects.push({
            aspect,
            local: budgetedLocal.filter((c) => c.aspects.includes(aspect)),
            web: budgetedWeb.filter(
                (r) => (r as WebSearchResult & { aspect?: Aspect }).aspect === aspect,
            ),
        });
    }

    const totalChars =
        localChars +
        webChars +
        budgetedWeb.reduce((acc, r) => acc + (r.title?.length ?? 0) + (r.uri?.length ?? 0), 0);

    return {
        aspects,
        localTotal: budgetedLocal.length,
        webTotal: budgetedWeb.length,
        totalChars,
    };
}

/** Convenience: tags web results with their aspect before merge. */
export function tagWebResults(
    results: WebSearchResult[],
    aspect: Aspect,
): (WebSearchResult & { aspect: Aspect })[] {
    return results.map((r) => ({ ...r, aspect }));
}

/** Builds the `actual` counts array for coverageCheck from merged chunks + web results. */
export function coverageCounts(
    local: MergedChunk[],
    web: WebSearchResult[],
): { aspect: Aspect; count: number }[] {
    const counts = new Map<Aspect, number>();
    for (const c of local) {
        for (const a of c.aspects) counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    for (const r of web) {
        const aspect = (r as WebSearchResult & { aspect?: Aspect }).aspect ?? "definition";
        counts.set(aspect, (counts.get(aspect) ?? 0) + 1);
    }
    return [...counts.entries()].map(([aspect, count]) => ({ aspect, count }));
}

/** Builds a `RetrievedChunk` from a MergedChunk (for fallback scoring/re-rank). */
export function mergedToRetrieved(c: MergedChunk): RetrievedChunk {
    return {
        chunkId: c.chunkId,
        sourceId: c.sourceId,
        sourceTitle: c.sourceTitle,
        content: c.content,
        rank: c.bestScore,
    };
}
