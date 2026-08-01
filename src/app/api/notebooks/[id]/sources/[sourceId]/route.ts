import { db } from "@/db";
import { notebooks, sources } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await ctx.params;
  const [source] = await db
    .select()
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.notebookId, id)));
  if (!source) return Response.json({ error: "Source not found" }, { status: 404 });
  return Response.json({ source });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await ctx.params;
  await db.delete(sources).where(and(eq(sources.id, sourceId), eq(sources.notebookId, id)));
  await db.update(notebooks).set({ updatedAt: new Date() }).where(eq(notebooks.id, id));
  return Response.json({ ok: true });
}
