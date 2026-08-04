import { NextRequest } from "next/server";
import { createNote, getNotesForNotebook } from "@/lib/services/note-service";
import { requireNotebookAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const access = await requireNotebookAccess(id, "read");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const rows = await getNotesForNotebook(id);
  return Response.json({ notes: rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;

  const access = await requireNotebookAccess(notebookId, "write");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "ملاحظة جديدة";
  const content = typeof body.content === "string" ? body.content : "";
  const kind = typeof body.kind === "string" ? body.kind : "note";

  const note = await createNote({ notebookId, title, content, kind: kind as never });
  return Response.json({ note }, { status: 201 });
}