import { db } from "@/db";
import { sources } from "@/db/schema";
import { suggestQuestions } from "@/lib/ai";
import { requireNotebookAccess } from "@/lib/access";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const access = await requireNotebookAccess(id, "read");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const availableSources = await db
    .select({ title: sources.title, content: sources.content })
    .from(sources)
    .where(eq(sources.notebookId, id));

  const questions = await suggestQuestions(availableSources);
  return Response.json({ questions });
}
