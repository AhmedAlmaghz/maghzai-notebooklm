import { db } from "@/db";
import { messages } from "@/db/schema";
import { isLLMAvailable } from "@/lib/ai";
import type { FollowUpSuggestion } from "@/lib/ai";
import {
    capPerAspect,
    coverageCheck,
    coverageCounts,
    dedupeByUri,
    filterLowSignal,
    mergeLocalHits,
    mergeResearchCorpus,
} from "@/lib/search/corpus";
import type { DeepSearchEvent } from "@/lib/search/events";
import { decomposeQuestion } from "@/lib/search/queries";
import { throwIfAborted } from "@/lib/search/retriever";
import { retrieveLocalChunks } from "@/lib/search/retriever";
import { synthesizeDeepAnswer } from "@/lib/search/synthesizer";
import type {
    Aspect,
    DeepCitation,
    DeepSearchResult,
    LocalHit,
    MergedChunk,
    SubQuery,
    WebSearchResult,
} from "@/lib/search/types";
import { exploreSubQuery, getWebSearcher } from "@/lib/search/web";

/**
 * Deep-search orchestrator (spec §9.2). Wires the 6-stage pipeline
 * (planning → retrieving → exploring → merging → synthesizing → done),
 * emits NDJSON events, and persists the outcome as a ChatMessage pair.
 */

export interface DeepSearchRunParams {
    notebookId: string;
    question: string;
    sourceIds?: string[];
    includeWeb?: boolean;
    depth?: "basic" | "deep";
    embed?: boolean;
    onEvent: (evt: DeepSearchEvent) => void;
    signal?: AbortSignal;
}

/** Pipeline knobs (spec §8.5). */
export const DEFAULT_OPTIONS = {
    maxSubQueries: 8,
    webMinResultsPerAspect: 3,
    webBackoffMs: 300,
    localCandidateLimit: 300,
} as const;

/** Insert the user question + assistant deep answer as a ChatMessage pair. */
export async function persistDeepSearchMessages(
    notebookId: string,
    question: string,
    result: DeepSearchResult,
): Promise<void> {
    await db.insert(messages).values({ notebookId, role: "user", content: question });
    await db.insert(messages).values({
        notebookId,
        role: "assistant",
        content: result.markdown,
        citations: result.citations,
    });
}

/** Small delay between sequential web searches to be polite to the provider. */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs the full pipeline. Throws an `AbortError` (name = "AbortError") when
 * the signal aborts at any stage boundary — the route then closes the stream
 * without persisting anything.
 */
export async function runDeepSearch(
    params: DeepSearchRunParams,
): Promise<DeepSearchResult> {
    const {
        notebookId,
        question,
        sourceIds,
        includeWeb = true,
        depth = "deep",
        embed = false,
        onEvent,
        signal,
    } = params;
    const startedAt = Date.now();

    // ---- Stage 1: planning -------------------------------------------------
    onEvent({ type: "stage", stage: "planning", message: "تحليل السؤال وتفكيكه إلى أسئلة فرعية..." });
    const subQueries = (await decomposeQuestion(question, signal)).slice(
        0,
        DEFAULT_OPTIONS.maxSubQueries,
    );
    subQueries.forEach((sq, index) => {
        onEvent({
            type: "subquery",
            index: index + 1,
            total: subQueries.length,
            text: sq.text,
            aspect: sq.aspect,
            rationale: sq.rationale,
        });
    });
    throwIfAborted(signal);

    // ---- Stage 2: retrieving (local sources) --------------------------------
    onEvent({ type: "stage", stage: "retrieving", message: "البحث في مصادر دفترك..." });
    const localHits: LocalHit[] = await retrieveLocalChunks(
        subQueries,
        { notebookId, sourceIds, embed, candidateLimit: DEFAULT_OPTIONS.localCandidateLimit },
        signal,
    );
    const mergedLocal: MergedChunk[] = mergeLocalHits(localHits);
    onEvent({
        type: "progress",
        done: subQueries.length,
        total: subQueries.length,
        label: `تم العثور على ${mergedLocal.length} مقطعاً محلياً`,
    });
    throwIfAborted(signal);

    // ---- Stage 3: exploring (web) -------------------------------------------
    let webResults: WebSearchResult[] = [];
    let usedWebSearch = false;
    if (includeWeb && depth === "deep") {
        onEvent({ type: "stage", stage: "exploring", message: "استكشاف الويب..." });
        const searcher = getWebSearcher();
        if (searcher.requiresApiKey && !isLLMAvailable()) {
            // No API key: degrade gracefully to local-only synthesis.
            console.log("[DeepSearch] No LLM key — skipping web exploration");
        } else {
            const collected: WebSearchResult[] = [];
            for (let i = 0; i < subQueries.length; i++) {
                throwIfAborted(signal);
                const res = await exploreSubQuery(
                    searcher,
                    subQueries[i],
                    {
                        maxRounds: 2,
                        minResultsPerAspect: DEFAULT_OPTIONS.webMinResultsPerAspect,
                        signal,
                    },
                    onEvent,
                );
                collected.push(...res.results);
                onEvent({
                    type: "progress",
                    done: i + 1,
                    total: subQueries.length,
                    label: `تم استكشاف الويب: ${subQueries[i].text.slice(0, 60)}`,
                });
                throwIfAborted(signal);
                if (i < subQueries.length - 1) {
                    await sleep(DEFAULT_OPTIONS.webBackoffMs);
                    throwIfAborted(signal);
                }
            }
            webResults = capPerAspect(dedupeByUri(filterLowSignal(collected)));
            usedWebSearch = webResults.length > 0;
        }
    }
    throwIfAborted(signal);

    // ---- Stage 4: merging ---------------------------------------------------
    onEvent({ type: "stage", stage: "merging", message: "دمج وتنقية الأدلة..." });
    const corpus = mergeResearchCorpus(mergedLocal, webResults);
    const expectedAspects = subQueries.map((sq) => sq.aspect);
    const coverage = coverageCheck(expectedAspects, coverageCounts(mergedLocal, webResults));
    throwIfAborted(signal);

    // ---- Stage 5: synthesizing ----------------------------------------------
    onEvent({ type: "stage", stage: "synthesizing", message: "كتابة الإجابة الشاملة..." });
    const synthesis = await synthesizeDeepAnswer(question, corpus, subQueries, signal);
    throwIfAborted(signal);

    const result: DeepSearchResult = {
        markdown: synthesis.markdown,
        citations: synthesis.citations,
        followUps: synthesis.followUps,
        gaps: synthesis.gaps.length > 0 ? synthesis.gaps : coverage.missingAspects,
        usedAI: synthesis.usedAI,
        usedWebSearch,
        localChunks: corpus.localTotal,
        webResults: corpus.webTotal,
    };

    // ---- Stage 6: emit + persist --------------------------------------------
    onEvent({ type: "answer", text: result.markdown });
    onEvent({ type: "citations", citations: result.citations });
    onEvent({ type: "followups", followUps: result.followUps });
    onEvent({ type: "gaps", gaps: result.gaps });
    onEvent({
        type: "meta",
        totalTimeMs: Date.now() - startedAt,
        localChunks: result.localChunks,
        webResults: result.webResults,
        usedAI: result.usedAI,
        usedWebSearch: result.usedWebSearch,
    });

    // Persist only after full success (spec §8.3/§8.4 — abort discards).
    await persistDeepSearchMessages(notebookId, question, result);

    return result;
}
