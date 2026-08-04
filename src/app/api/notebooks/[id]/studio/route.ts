import { db } from "@/db";
import { notes, sources } from "@/db/schema";
import { generateStudioArtifact, studioTitle, type StudioKind } from "@/lib/ai";
import { requireNotebookAccess } from "@/lib/access";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_KINDS: StudioKind[] = ["summary", "faq", "study_guide", "timeline", "mindmap", "flashcards", "presentation", "quiz", "glossary", "outline", "comparison", "debate"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;

  const access = await requireNotebookAccess(notebookId, "write");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const kind = body.kind as StudioKind;
  const sourceIds: string[] | undefined = Array.isArray(body.sourceIds) && body.sourceIds.length > 0
    ? body.sourceIds
    : undefined;

  if (!VALID_KINDS.includes(kind)) {
    return Response.json({ error: "نوع غير مدعوم" }, { status: 400 });
  }

  const availableSources = await db
    .select({ id: sources.id, title: sources.title, content: sources.content })
    .from(sources)
    .where(eq(sources.notebookId, notebookId));

  // Use only the selected sources when provided; otherwise use all sources.
  const selectedSet = sourceIds && sourceIds.length > 0 ? new Set(sourceIds) : null;
  const filteredSources = selectedSet
    ? availableSources.filter((s) => selectedSet.has(s.id))
    : availableSources;

  if (filteredSources.length === 0) {
    return Response.json({ error: "أضف مصدراً واحداً على الأقل أولاً" }, { status: 400 });
  }

  const artifactSources = filteredSources.map(({ title, content }) => ({ title, content }));

  const { content, usedAI } = await generateStudioArtifact(kind, artifactSources);

  const [note] = await db
    .insert(notes)
    .values({
      notebookId,
      title: studioTitle(kind),
      content,
      kind,
    })
    .returning();

  return Response.json({ note, usedAI }, { status: 201 });
}
