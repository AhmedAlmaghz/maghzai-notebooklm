import { db } from "@/db";
import { messages, sources } from "@/db/schema";
import { answerQuestion } from "@/lib/ai";
import { fallbackChunks, searchChunks } from "@/lib/search";
import { webSearch } from "@/lib/web-search";
import { requireNotebookAccess } from "@/lib/access";
import type { AnswerMode } from "@/lib/types";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const access = await requireNotebookAccess(id, "read");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const rows = await db.select().from(messages).where(eq(messages.notebookId, id)).orderBy(messages.createdAt);
  return Response.json({ messages: rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;

  const access = await requireNotebookAccess(notebookId, "write");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const sourceIds: string[] | undefined = Array.isArray(body.sourceIds) && body.sourceIds.length > 0
    ? body.sourceIds
    : undefined;
  // Answer mode: default to "sources" for backwards compatibility. If an
  // unknown value is passed, fall back to "sources" as well.
  const mode: AnswerMode = body.mode === "expanded" ? "expanded" : "sources";

  if (!question) {
    return Response.json({ error: "الرجاء كتابة سؤال" }, { status: 400 });
  }

  const availableSources = await db.select().from(sources).where(eq(sources.notebookId, notebookId));
  if (availableSources.length === 0) {
    return Response.json({ error: "أضف مصدراً واحداً على الأقل قبل بدء المحادثة" }, { status: 400 });
  }

  await db.insert(messages).values({ notebookId, role: "user", content: question });

  let chunks = await searchChunks(notebookId, question, 16, sourceIds);
  if (chunks.length === 0) {
    chunks = await fallbackChunks(notebookId, 8, sourceIds);
  }

  // In expanded mode, attempt a web search to enrich the answer. A web search
  // failure must NOT break the answer — the model continues from the sources
  // (and its own memory via the expanded system prompt).
  let webResult: Awaited<ReturnType<typeof webSearch>> = null;
  if (mode === "expanded") {
    try {
      webResult = await webSearch(question, "basic");
    } catch (err) {
      console.error("[Chat] Web search failed (expanded mode), continuing with sources:", err);
      webResult = null;
    }
  }

  const result = await answerQuestion(question, chunks, { mode, webResult });

  const [assistantMessage] = await db
    .insert(messages)
    .values({
      notebookId,
      role: "assistant",
      content: result.answer,
      citations: result.citations,
    })
    .returning();

  return Response.json({
    message: assistantMessage,
    usedAI: result.usedAI,
    usedWebSearch: result.usedWebSearch,
    webSources: result.webSources,
    followUps: result.followUps,
    mode,
  });
}
