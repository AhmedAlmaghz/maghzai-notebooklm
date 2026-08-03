import type { FollowUpSuggestion } from "@/lib/ai";
import type { Aspect, DeepCitation } from "@/lib/search/types";

/**
 * NDJSON streaming protocol (spec §7.1). Each event serializes to exactly one
 * JSON line ending with `\n`. `readNdjsonStream` handles chunked/partial lines.
 */

export type DeepSearchStage =
  | "planning"
  | "retrieving"
  | "exploring"
  | "merging"
  | "synthesizing"
  | "done"
  | "error";

export type DeepSearchEvent =
  | { type: "stage"; stage: DeepSearchStage; message?: string }
  | { type: "subquery"; index: number; total: number; text: string; aspect: Aspect; rationale?: string }
  | { type: "progress"; done: number; total: number; label?: string }
  | { type: "token"; text: string } // reserved (Option B streaming)
  | { type: "answer"; text: string }
  | { type: "citations"; citations: DeepCitation[] }
  | { type: "followups"; followUps: FollowUpSuggestion[] }
  | { type: "gaps"; gaps: Aspect[] }
  | {
      type: "meta";
      totalTimeMs: number;
      localChunks: number;
      webResults: number;
      usedAI: boolean;
      usedWebSearch: boolean;
    }
  | { type: "error"; code: string; message: string }
  | { type: "done" };

/** Serializes an event to a single NDJSON line (JSON.stringify + "\n"). */
export function serializeEvent(evt: DeepSearchEvent): string {
  return `${JSON.stringify(evt)}\n`;
}

/**
 * Reads an NDJSON response stream line-by-line, invoking `onEvent` per line.
 * Tolerates chunked/partial lines: buffers bytes and splits on `\n`.
 */
export async function readNdjsonStream(
  res: Response,
  onEvent: (evt: DeepSearchEvent) => void,
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep the last partial line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onEvent(JSON.parse(trimmed) as DeepSearchEvent);
      } catch {
        // Ignore malformed lines; keep the stream alive.
      }
    }
  }

  // Flush any remaining buffered content.
  const tail = buffer.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail) as DeepSearchEvent);
    } catch {
      // ignore
    }
  }
}
