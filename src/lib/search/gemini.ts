import { callGemini, type GeminiOptions } from "@/lib/ai";

/**
 * Thin, typed JSON wrapper around the shared `callGemini` in `src/lib/ai.ts`.
 * Never duplicates the fetch logic — all Gemini calls go through `callGemini`.
 */

export type GeminiJsonRequest = {
    system?: string;
    contents: string; // single user message
    maxTokens?: number;
    signal?: AbortSignal;
    temperature?: number;
};

/**
 * Calls Gemini and returns the parsed JSON object, or null on any failure
 * (no API key, network error, malformed JSON).
 */
export async function requestJson<T>({
    system,
    contents,
    maxTokens = 2000,
    signal,
    temperature,
}: GeminiJsonRequest): Promise<T | null> {
    const text = await callGemini(
        [{ role: "user", parts: [{ text: contents }] }],
        system,
        maxTokens,
        undefined,
        {
            signal,
            temperature,
            responseMimeType: "application/json",
        } satisfies GeminiOptions,
    );
    if (!text) return null;
    return parseJsonSafe<T>(text);
}

export type GeminiRawRequest = {
    system?: string;
    contents: string;
    maxTokens?: number;
    tools?: unknown[];
    signal?: AbortSignal;
    temperature?: number;
};

export type GeminiRawResponse = {
    text: string | null;
    groundingChunks: { title: string; uri: string; snippet: string }[];
    searchQueries: string[];
};

/**
 * Calls Gemini with optional tools (e.g. google_search grounding) and returns
 * the extracted text plus grounding metadata from the raw response body.
 * Never throws — returns nulls/empty arrays on failure.
 */
export async function callGeminiRaw({
    system,
    contents,
    maxTokens = 2000,
    tools,
    signal,
    temperature,
}: GeminiRawRequest): Promise<GeminiRawResponse> {
    const rawText = await callGemini(
        [{ role: "user", parts: [{ text: contents }] }],
        system,
        maxTokens,
        tools,
        { signal, temperature, raw: true },
    );
    if (!rawText) return { text: null, groundingChunks: [], searchQueries: [] };

    let data: unknown;
    try {
        data = JSON.parse(rawText);
    } catch {
        return { text: null, groundingChunks: [], searchQueries: [] };
    }

    const candidates = (data as { candidates?: unknown })?.candidates;
    const first = Array.isArray(candidates) ? (candidates[0] as Record<string, unknown> | undefined) : undefined;
    const groundingMetadata = (first?.groundingMetadata ?? {}) as Record<string, unknown>;

    const chunks = Array.isArray(groundingMetadata.groundingChunks)
        ? (groundingMetadata.groundingChunks as Record<string, unknown>[])
        : [];
    const groundingChunks = chunks
        .map((c) => {
            const web = (c.web ?? {}) as { title?: unknown; uri?: unknown; snippet?: unknown };
            return {
                title: typeof web.title === "string" ? web.title : "",
                uri: typeof web.uri === "string" ? web.uri : "",
                snippet: typeof web.snippet === "string" ? web.snippet : "",
            };
        })
        .filter((c) => c.uri.length > 0);

    const searchQueries = Array.isArray(groundingMetadata.webSearchQueries)
        ? (groundingMetadata.webSearchQueries as unknown[]).filter(
            (q): q is string => typeof q === "string",
        )
        : [];

    const content = first?.content as { parts?: { text?: unknown }[] } | undefined;
    const text =
        typeof content?.parts?.[0]?.text === "string" ? content.parts[0].text.trim() : null;

    return { text, groundingChunks, searchQueries };
}

/**
 * Splits a raw Gemini synthesis response into markdown body + trailing JSON.
 * The JSON may be fenced (```json ... ```) or a bare `{...}` object at the end.
 */
export function splitMarkdownAndJson(
    raw: string,
): { markdown: string; json: unknown | null } {
    if (!raw) return { markdown: "", json: null };

    // 1) Last fenced json block.
    const fenced = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    if (fenced.length > 0) {
        const last = fenced[fenced.length - 1];
        const jsonText = last[1].trim();
        const parsed = parseJsonSafe<unknown>(jsonText);
        if (parsed !== null) {
            const before = raw.slice(0, last.index ?? 0).trim();
            return { markdown: before, json: parsed };
        }
    }

    // 2) Last `{...}` object after the markdown body.
    const braceBlocks = [...raw.matchAll(/\{[\s\S]*\}/g)];
    if (braceBlocks.length > 0) {
        const last = braceBlocks[braceBlocks.length - 1];
        const parsed = parseJsonSafe<unknown>(last[0]);
        if (parsed !== null) {
            const before = raw.slice(0, last.index ?? 0).trim();
            return { markdown: before, json: parsed };
        }
    }

    return { markdown: raw.trim(), json: null };
}

/**
 * Parses a JSON string defensively: strips code fences, extracts the first
 * balanced JSON object, and returns null instead of throwing.
 */
export function parseJsonSafe<T>(text: string): T | null {
    if (!text) return null;
    let cleaned = text.trim();

    // Strip surrounding ```json fences.
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
        return null;
    }
    const candidate = cleaned.slice(first, last + 1);
    try {
        return JSON.parse(candidate) as T;
    } catch {
        return null;
    }
}
