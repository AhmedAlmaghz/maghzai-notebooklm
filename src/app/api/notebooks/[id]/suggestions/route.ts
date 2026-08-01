import { db } from "@/db";
import { sources } from "@/db/schema";
import { suggestQuestions } from "@/lib/ai";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const availableSources = await db
    .select({ title: sources.title, content: sources.content })
    .from(sources)
    .where(eq(sources.notebookId, id));

  const questions = await suggestQuestions(availableSources);
  return Response.json({ questions });
}
