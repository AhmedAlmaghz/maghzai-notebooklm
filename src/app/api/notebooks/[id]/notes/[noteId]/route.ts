import { db } from "@/db";
import { notes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id, noteId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const updates: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.content === "string") updates.content = body.content;

  const [updated] = await db
    .update(notes)
    .set(updates)
    .where(and(eq(notes.id, noteId), eq(notes.notebookId, id)))
    .returning();

  if (!updated) return Response.json({ error: "Note not found" }, { status: 404 });
  return Response.json({ note: updated });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id, noteId } = await ctx.params;
  await db.delete(notes).where(and(eq(notes.id, noteId), eq(notes.notebookId, id)));
  return Response.json({ ok: true });
}
