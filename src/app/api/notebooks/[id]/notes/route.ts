import { NextRequest } from "next/server";
import { createNote, getNotesForNotebook } from "@/lib/services/note-service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await getNotesForNotebook(id);
  return Response.json({ notes: rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "ملاحظة جديدة";
  const content = typeof body.content === "string" ? body.content : "";
  const kind = typeof body.kind === "string" ? body.kind : "note";

  const note = await createNote({ notebookId, title, content, kind: kind as never });
  return Response.json({ note }, { status: 201 });
}