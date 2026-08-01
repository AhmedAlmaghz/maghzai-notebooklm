import { NextRequest } from "next/server";
import { deleteNote, updateNote } from "@/lib/services/note-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id, noteId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const updates: { title?: string; content?: string; kind?: never } = {};
  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.content === "string") updates.content = body.content;

  const updated = await updateNote(id, noteId, updates);
  if (!updated) return Response.json({ error: "Note not found" }, { status: 404 });
  return Response.json({ note: updated });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id, noteId } = await ctx.params;
  await deleteNote(id, noteId);
  return Response.json({ ok: true });
}