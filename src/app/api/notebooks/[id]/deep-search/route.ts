import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runDeepSearch } from "@/lib/search/deep-search";
import { serializeEvent, type DeepSearchEvent } from "@/lib/search/events";
import { getNotebookById } from "@/lib/services/notebook-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Deepest run budget; the 60s node default would truncate (§8.5).
export const maxDuration = 300;

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;

function errorCode(err: unknown): { code: string; message: string } {
  if (err instanceof Error && err.name === "AbortError") {
    return { code: "aborted", message: "تم إلغاء البحث العميق" };
  }
  return { code: "internal", message: "حدث خطأ أثناء البحث العميق" };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  // 1. Validate + authorize: notebook exists AND owned by the current user (§11.4).
  //    Legacy notebooks with a null userId remain accessible (matches getNotebooksForUser).
  const user = await getCurrentUser();
  const notebook = await getNotebookById(notebookId);
  if (!notebook || (notebook.userId && notebook.userId !== user?.id)) {
    return Response.json({ error: "الدفتر غير موجود" }, { status: 404 });
  }

  // 2. Validate body (400s).
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < MIN_QUESTION_LENGTH || question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `السؤال يجب أن يكون بين ${MIN_QUESTION_LENGTH} و ${MAX_QUESTION_LENGTH} حرفاً` },
      { status: 400 },
    );
  }

  const sourceIds =
    Array.isArray(body.sourceIds) && body.sourceIds.every((s: unknown) => typeof s === "string")
      ? (body.sourceIds as string[])
      : undefined;
  if (body.sourceIds !== undefined && sourceIds === undefined) {
    return Response.json({ error: "sourceIds يجب أن يكون مصفوفة من النصوص" }, { status: 400 });
  }

  const includeWeb = body.includeWeb === undefined ? true : Boolean(body.includeWeb);
  const depth = body.depth === "basic" ? "basic" : body.depth === "deep" ? "deep" : undefined;
  if (body.depth !== undefined && depth === undefined) {
    return Response.json({ error: "depth يجب أن يكون basic أو deep" }, { status: 400 });
  }
  const embed = body.embed === undefined ? false : Boolean(body.embed);

  // 3. No hard GEMINI_API_KEY block: the orchestrator degrades gracefully to a
  //    local-only run when web search needs a key that isn't configured (§8.5).

  // 4. NDJSON stream (§8.2).
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (evt: DeepSearchEvent) => {
        controller.enqueue(encoder.encode(serializeEvent(evt)));
      };
      try {
        await runDeepSearch({
          notebookId,
          question,
          sourceIds,
          includeWeb,
          depth,
          embed,
          onEvent: enqueue,
          signal: req.signal,
        });
      } catch (err) {
        // Abort: client already left — close without an error/done event (§8.3).
        if (!req.signal.aborted) {
          const { code, message } = errorCode(err);
          enqueue({ type: "error", code, message });
        }
      } finally {
        // Emit `done` exactly once, then close the stream (§8.2).
        if (!req.signal.aborted) {
          enqueue({ type: "done" });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
