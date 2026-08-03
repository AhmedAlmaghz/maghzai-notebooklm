import { charNgrams } from "@/lib/search/rerank";

/**
 * Optional, pluggable embedding providers. The pipeline works fully without
 * them (pure n-gram fusion); when enabled they add a 4th signal via RRF.
 * Both providers return `null` instead of throwing on failure.
 */

export interface EmbeddingProvider {
    readonly name: string;
    isAvailable(): boolean;
    /** Returns L2-normalized vectors, or null on failure. */
    embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null>;
    cosine(a: number[], b: number[]): number;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const EMBED_MODEL = "models/text-embedding-004";

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function l2Normalize(v: number[]): number[] {
    let sum = 0;
    for (const x of v) sum += x * x;
    const norm = Math.sqrt(sum);
    if (norm === 0) return v;
    return v.map((x) => x / norm);
}

/**
 * Zero-dependency deterministic embedding: hashed char n-gram bag vector.
 * 512-dim fixed-size sparse vector, L2-normalized. Deterministic across runs.
 */
export class NGramEmbeddingProvider implements EmbeddingProvider {
    readonly name = "ngram";
    private static readonly DIM = 512;

    isAvailable(): boolean {
        return true;
    }

    async embed(texts: string[], _signal?: AbortSignal): Promise<number[][] | null> {
        try {
            return texts.map((t) => this.embedOne(t));
        } catch {
            return null;
        }
    }

    private embedOne(text: string): number[] {
        const vec = new Array<number>(NGramEmbeddingProvider.DIM).fill(0);
        const grams = [...charNgrams(text, 2), ...charNgrams(text, 3)];
        for (const g of grams) {
            const idx = this.hash(g) % NGramEmbeddingProvider.DIM;
            vec[idx] += 1;
        }
        return l2Normalize(vec);
    }

    private hash(s: string): number {
        let h = 2166136261; // FNV-1a 32-bit
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    cosine(a: number[], b: number[]): number {
        return cosineSimilarity(a, b);
    }
}

/** Gemini `text-embedding-004` provider via the free-tier embedContent endpoint. */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
    readonly name = "gemini";
    private static readonly BATCH = 20;

    constructor(
        private readonly apiKey = GEMINI_API_KEY,
        private readonly baseUrl = GEMINI_BASE_URL,
    ) { }

    isAvailable(): boolean {
        return Boolean(this.apiKey && this.apiKey.length > 10);
    }

    async embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null> {
        if (!this.isAvailable()) return null;
        if (texts.length === 0) return [];
        try {
            const out: number[][] = [];
            for (let i = 0; i < texts.length; i += GeminiEmbeddingProvider.BATCH) {
                const batch = texts.slice(i, i + GeminiEmbeddingProvider.BATCH);
                const vectors = await this.embedBatch(batch, signal);
                if (!vectors) return null;
                out.push(...vectors);
            }
            return out;
        } catch (err) {
            console.error("[Embedding] Gemini embedContent failed:", err);
            return null;
        }
    }

    private async embedBatch(texts: string[], signal?: AbortSignal): Promise<number[][] | null> {
        const url = `${this.baseUrl}/${EMBED_MODEL}:embedContent?key=${this.apiKey}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: EMBED_MODEL,
                content: { parts: [{ text: texts.join("\n\n") }] },
            }),
            signal,
        });
        if (!res.ok) {
            console.error(`[Embedding] embedContent error ${res.status}`);
            return null;
        }
        const data = (await res.json()) as {
            embedding?: { values?: number[] };
        };
        const values = data.embedding?.values;
        if (!values || values.length === 0) return null;
        // Same single vector applied to all texts in the batch (batch not fully
        // supported by the free endpoint without a TaskType; keep it simple).
        return texts.map(() => l2Normalize(values));
    }

    cosine(a: number[], b: number[]): number {
        return cosineSimilarity(a, b);
    }
}

/**
 * Reads `DEEP_SEARCH_EMBEDDINGS` (off|gemini|ngram, default off).
 * Returns null when off or unset so the pipeline degrades to n-gram fusion.
 */
export function getEmbeddingProvider(): EmbeddingProvider | null {
    const mode = (process.env.DEEP_SEARCH_EMBEDDINGS || "off").toLowerCase();
    if (mode === "gemini") return new GeminiEmbeddingProvider();
    if (mode === "ngram") return new NGramEmbeddingProvider();
    return null;
}
