import { db } from "@/db";
import { notebooks, sources, notes, messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const [notebook] = await db.select().from(notebooks).where(eq(notebooks.id, id));
  if (!notebook) return Response.json({ error: "Notebook not found" }, { status: 404 });

  const notebookSources = await db
    .select({
      id: sources.id,
      title: sources.title,
      type: sources.type,
      status: sources.status,
      errorMessage: sources.errorMessage,
      charCount: sources.charCount,
      sourceUrl: sources.sourceUrl,
      createdAt: sources.createdAt,
    })
    .from(sources)
    .where(eq(sources.notebookId, id))
    .orderBy(sources.createdAt);

  const notebookMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.notebookId, id))
    .orderBy(messages.createdAt);

  const notebookNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.notebookId, id))
    .orderBy(notes.createdAt);

  return Response.json({
    notebook,
    sources: notebookSources,
    messages: notebookMessages,
    notes: notebookNotes,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const updates: Partial<typeof notebooks.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === "string") updates.title = body.title.slice(0, 255);
  if (typeof body.emoji === "string") updates.emoji = body.emoji.slice(0, 8);
  if (typeof body.description === "string") updates.description = body.description;

  const [updated] = await db.update(notebooks).set(updates).where(eq(notebooks.id, id)).returning();
  if (!updated) return Response.json({ error: "Notebook not found" }, { status: 404 });

  return Response.json({ notebook: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.delete(notebooks).where(eq(notebooks.id, id));
  return Response.json({ ok: true });
}
