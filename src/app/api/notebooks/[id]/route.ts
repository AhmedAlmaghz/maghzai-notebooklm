import { db } from "@/db";
import { sources, notes, messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import {
  deleteNotebook,
  updateNotebook,
} from "@/lib/services/notebook-service";
import { requireNotebookAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const access = await requireNotebookAccess(id, "read");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
  const notebook = access.notebook;

  const [notebookSources, notebookMessages, notebookNotes] = await Promise.all([
    db
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
      .orderBy(sources.createdAt),
    db.select().from(messages).where(eq(messages.notebookId, id)).orderBy(messages.createdAt),
    db.select().from(notes).where(eq(notes.notebookId, id)).orderBy(notes.createdAt),
  ]);

  return Response.json({
    notebook,
    sources: notebookSources,
    messages: notebookMessages,
    notes: notebookNotes,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const access = await requireNotebookAccess(id, "write");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));

  const updates: { title?: string; emoji?: string; description?: string } = {};
  if (typeof body.title === "string") updates.title = body.title.slice(0, 255);
  if (typeof body.emoji === "string") updates.emoji = body.emoji.slice(0, 8);
  if (typeof body.description === "string") updates.description = body.description;

  const updated = await updateNotebook(id, updates);
  if (!updated) return Response.json({ error: "Notebook not found" }, { status: 404 });

  return Response.json({ notebook: updated });
}

/**
 * DELETE /api/notebooks/[id]
 *
 * Performs a soft delete by default: the notebook is moved to the trash
 * (`deletedAt` is set) and can be restored later.
 *
 * To permanently remove it, send `{ permanent: true }` in the request body.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // `allowDeleted: true` lets this handler reach trashed notebooks so they can
  // be permanently deleted (soft delete of a live notebook also goes through
  // this handler, and live notebooks are unaffected by the flag).
  const access = await requireNotebookAccess(id, "write", { allowDeleted: true });
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));

  if (body && body.permanent === true) {
    const { permanentlyDeleteNotebook } = await import("@/lib/services/notebook-service");
    await permanentlyDeleteNotebook(id);
    return Response.json({ ok: true, permanent: true });
  }

  const notebook = await deleteNotebook(id);
  if (!notebook) return Response.json({ error: "Notebook not found" }, { status: 404 });

  return Response.json({
    ok: true,
    soft: true,
    notebook: {
      ...notebook,
      createdAt:
        typeof notebook.createdAt === "string" ? notebook.createdAt : (notebook.createdAt as Date).toISOString(),
      updatedAt:
        typeof notebook.updatedAt === "string" ? notebook.updatedAt : (notebook.updatedAt as Date).toISOString(),
    },
  });
}
