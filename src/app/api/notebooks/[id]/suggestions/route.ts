import { db } from "@/db";
import { sources } from "@/db/schema";
import { suggestQuestions } from "@/lib/ai";
import { requireNotebookAccess } from "@/lib/access";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const access = await requireNotebookAccess(id, "read");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const sourceIdsParam = req.nextUrl.searchParams.get("sourceIds");
  const sourceIds = sourceIdsParam
    ? sourceIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const availableSources = await db
    .select({ id: sources.id, title: sources.title, content: sources.content })
    .from(sources)
    .where(eq(sources.notebookId, id));

  // Use only the selected sources when provided; otherwise use all sources.
  const selectedSet = sourceIds && sourceIds.length > 0 ? new Set(sourceIds) : null;
  const filteredSources = selectedSet
    ? availableSources.filter((s) => selectedSet.has(s.id))
    : availableSources;

  const questions = await suggestQuestions(
    filteredSources.map(({ title, content }) => ({ title, content })),
  );
  return Response.json({ questions });
}
