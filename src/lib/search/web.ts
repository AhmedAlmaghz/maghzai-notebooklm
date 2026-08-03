import { callGeminiRaw } from "@/lib/search/gemini";
import { refineQuery } from "@/lib/search/queries";
import { coverageCheck } from "@/lib/search/corpus";
import { throwIfAborted } from "@/lib/search/retriever";
import type { DeepSearchEvent } from "@/lib/search/events";
import type { Aspect, SubQuery, WebSearchResult } from "@/lib/search/types";

/**
 * Web exploration (spec §5). The pipeline owns the research corpus via a
 * pluggable `WebSearcher`; the default `GeminiGroundingWebSearcher` returns
 * the grounding chunks themselves (not generated prose).
 */

export interface WebSearcher {
    readonly name: string; // "gemini-grounding" | "tavily" | ...
    readonly requiresApiKey: boolean;
    search(query: string, signal?: AbortSignal): Promise<WebSearchResult[]>;
}

const GROUNDING_SYSTEM_PROMPT = `أنت محرك بحث. مهمتك البحث في الويب عن المعلومات الدقيقة المتعلقة
بالسؤال المطلوب. لا تكتب مقالاً ولا تلخّص — فقط نفّذ البحث واجمع نتائج موثوقة.`;

/** Default searcher backed by Gemini's `google_search` grounding tool. */
export class GeminiGroundingWebSearcher implements WebSearcher {
    readonly name = "gemini-grounding";
    readonly requiresApiKey = true;

    async search(query: string, signal?: AbortSignal): Promise<WebSearchResult[]> {
        throwIfAborted(signal);
        if (!query.trim()) return [];

        const tools = [{ google_search: {} }];
        let raw = await callGeminiRaw({
            system: GROUNDING_SYSTEM_PROMPT,
            contents: `ابحث في الويب عن المعلومات الدقيقة المتعلقة بالسؤال التالي: ${query}`,
            maxTokens: 1500,
            tools,
            signal,
            temperature: 0.2,
        });

        // Retry once without tools on failure (spec §5.1).
        if (raw.groundingChunks.length === 0) {
            raw = await callGeminiRaw({
                system: GROUNDING_SYSTEM_PROMPT,
                contents: `ابحث في الويب عن المعلومات الدقيقة المتعلقة بالسؤال التالي: ${query}`,
                maxTokens: 1500,
                signal,
                temperature: 0.2,
            });
        }

        if (raw.groundingChunks.length === 0) return [];

        return raw.groundingChunks.map((c) => ({
            title: c.title || `بحث: ${query}`,
            uri: c.uri,
            snippet: c.snippet || raw.searchQueries[0] || query,
        }));
    }
}

export function getWebSearcher(): WebSearcher {
    const provider = (process.env.WEB_SEARCH_PROVIDER || "gemini").toLowerCase();
    if (provider === "tavily") {
        // Tavily is a future provider; until implemented, fall back to Gemini grounding.
        return new GeminiGroundingWebSearcher();
    }
    return new GeminiGroundingWebSearcher();
}

export type WebExplorationResult = {
    subQueryId: string;
    aspect: Aspect;
    results: WebSearchResult[]; // tagged with aspect
    queriesRun: string[];
    deepened: boolean;
};

export type ExploreSubQueryOptions = {
    maxRounds?: number; // default 2
    minResultsPerAspect?: number; // default 3
    signal?: AbortSignal;
};

/**
 * Per-sub-query iterative web exploration (spec §5.2). Up to `maxRounds`
 * searches: round 1 on the base query; round 2 (deepen) re-targets a missing
 * aspect via `refineQuery`. Never throws out of the loop.
 */
export async function exploreSubQuery(
  searcher: WebSearcher,
  subQuery: SubQuery,
  opts: ExploreSubQueryOptions = {},
  onEvent?: (evt: DeepSearchEvent) => void,
): Promise<WebExplorationResult> {
  const { maxRounds = 2, minResultsPerAspect = 3, signal } = opts;
  const allResults: WebSearchResult[] = [];
  const queriesRun: string[] = [];
  let deepened = false;
  let currentQuery = subQuery.text;

  // A result can be tagged with the sub-query's aspect (single-aspect per query).
  const seen = new Set<string>();

  for (let round = 1; round <= maxRounds; round++) {
    throwIfAborted(signal);
    if (!currentQuery) break;

    let results: WebSearchResult[];
    try {
      results = await searcher.search(currentQuery, signal);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      console.error("[Web] search failed:", err);
      break;
    }

    if (results.length === 0) break;
    queriesRun.push(currentQuery);
    onEvent?.({
      type: "progress",
      done: round,
      total: maxRounds,
      label: `جارٍ البحث في الويب: ${currentQuery.slice(0, 60)}`,
    });

    for (const r of results) {
      const key = r.uri;
      if (seen.has(key)) continue;
      seen.add(key);
      allResults.push({ ...r, aspect: subQuery.aspect });
    }

    const counts = [{ aspect: subQuery.aspect, count: allResults.length }];
    const coverage = coverageCheck([subQuery.aspect], counts, minResultsPerAspect);
    if (coverage.covered) break;

    // Round 2 (deepen): rephrase to target the missing aspect.
    if (round < maxRounds) {
      const missing = coverage.missingAspects[0];
      if (!missing) break;
      const refined = await refineQuery(subQuery, missing, signal);
      currentQuery = refined.text;
      deepened = true;
      throwIfAborted(signal);
    }
  }

  return {
    subQueryId: subQuery.id,
    aspect: subQuery.aspect,
    results: allResults,
    queriesRun,
    deepened,
  };
}
