import type { FollowUpSuggestion } from "@/lib/ai";
import type { RetrievedChunk } from "@/lib/search";

/** The 12-dimension aspect vocabulary used to decompose a user question. */
export const ASPECTS = [
  "definition",
  "history",
  "types",
  "mechanism",
  "applications",
  "pros_cons",
  "statistics",
  "controversies",
  "recent_developments",
  "future_outlook",
  "comparisons",
  "expert_opinions",
] as const;

export type Aspect = (typeof ASPECTS)[number];

export function isAspect(value: unknown): value is Aspect {
  return typeof value === "string" && (ASPECTS as readonly string[]).includes(value);
}

/** A decomposed research sub-query targeting a single aspect of the topic. */
export type SubQuery = {
  id: string; // `q1`..`qN`
  text: string; // the actual search query (Arabic-first)
  aspect: Aspect;
  rationale: string; // short Arabic justification
  expansions: string[]; // synonym / morphological variants (2-4 per sub-query)
  weight: number; // 0..1 — importance for fusion weighting
};

/** A chunk retrieved for one sub-query, with its fused score. */
export type LocalHit = {
  subQueryId: string;
  aspect: Aspect;
  chunks: RetrievedChunk[];
};

/** A local chunk merged across sub-queries (deduped by chunkId). */
export type MergedChunk = {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  content: string;
  subQueryIds: string[];
  aspects: Aspect[];
  bestScore: number; // best fused score across sub-queries
};

/** A single web search result (grounding chunk or external provider). */
export type WebSearchResult = {
  title: string;
  uri: string;
  snippet: string; // groundingChunk snippet or search result snippet
  content?: string; // optional fuller text
  publishedDate?: string; // optional
  aspect?: Aspect; // aspect tag assigned during exploration / corpus assembly
};

/** A citation that can be persisted & rendered for a deep-search answer. */
export type DeepCitation = {
  id: number; // matches [1]..[N] used inline
  kind: "local" | "web";
  sourceId?: string; // local source id (kind = local)
  sourceTitle: string;
  snippet: string;
  uri?: string; // web URL (kind = web)
};

/** Evidence fed to the synthesizer: every item is numbered [1]..[N]. */
export type EvidenceItem = {
  id: number;
  kind: "local" | "web";
  sourceId?: string;
  sourceTitle: string;
  content: string; // chunk text (local) or snippet (web)
  aspect: Aspect;
  uri?: string;
};

/** Merged research corpus assembled aspect-by-aspect. */
export type ResearchCorpus = {
  aspects: { aspect: Aspect; local: MergedChunk[]; web: WebSearchResult[] }[];
  localTotal: number;
  webTotal: number;
  totalChars: number;
};

export type CoverageReport = {
  covered: boolean;
  coveredAspects: Aspect[];
  missingAspects: Aspect[];
};

export type DeepSearchRequest = {
  question: string; // required, 3..500 chars
  sourceIds?: string[]; // optional; undefined = all sources
  includeWeb?: boolean; // default true
  depth?: "basic" | "deep"; // default "deep"
  embed?: boolean; // default false (opt-in embeddings)
};

export type DeepSearchResult = {
  markdown: string;
  citations: DeepCitation[];
  followUps: FollowUpSuggestion[];
  gaps: Aspect[];
  usedAI: boolean;
  usedWebSearch: boolean;
  localChunks: number;
  webResults: number;
};
