import { db } from "@/db";
import { messages, notebooks, notes, sources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import NotebookWorkspace from "@/components/notebook-workspace";
import { requireNotebookAccess } from "@/lib/access";
import type { ChatMessage, NoteItem, SourceItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Columns needed by the workspace UI. Excludes the large `content` field. */
const sourceListColumns = {
  id: sources.id,
  notebookId: sources.notebookId,
  title: sources.title,
  type: sources.type,
  sourceUrl: sources.sourceUrl,
  status: sources.status,
  errorMessage: sources.errorMessage,
  charCount: sources.charCount,
  createdAt: sources.createdAt,
};

export default async function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Enforce the same resource-level authorization as the API routes:
  // public notebooks are viewable by anyone, owned notebooks only by their
  // owner. Unauthorized visitors get a 404 (notFound) so existence is hidden.
  const access = await requireNotebookAccess(id, "read");
  if (!access.ok) notFound();

  const [sourceRows, messageRows, noteRows] = await Promise.all([
    db.select(sourceListColumns).from(sources).where(eq(sources.notebookId, id)).orderBy(sources.createdAt),
    db.select().from(messages).where(eq(messages.notebookId, id)).orderBy(messages.createdAt),
    db.select().from(notes).where(eq(notes.notebookId, id)).orderBy(notes.createdAt),
  ]);

  const initialSources = sourceRows.map((s) => ({
    ...s,
    createdAt: typeof s.createdAt === "string" ? s.createdAt : (s.createdAt as Date).toISOString(),
  })) as unknown as SourceItem[];

  const initialMessages = messageRows.map((m) => {
    let citations = m.citations;
    if (typeof citations === "string") {
      try {
        citations = JSON.parse(citations);
      } catch {
        citations = null;
      }
    }
    return {
      ...m,
      citations: citations ?? null,
      createdAt: typeof m.createdAt === "string" ? m.createdAt : (m.createdAt as Date).toISOString(),
    };
  }) as unknown as ChatMessage[];

  const initialNotes = noteRows.map((n) => ({
    ...n,
    createdAt: typeof n.createdAt === "string" ? n.createdAt : (n.createdAt as Date).toISOString(),
    updatedAt: typeof n.updatedAt === "string" ? n.updatedAt : (n.updatedAt as Date).toISOString(),
  })) as unknown as NoteItem[];

  return (
    <NotebookWorkspace
      notebook={{
        ...access.notebook,
        createdAt: typeof access.notebook.createdAt === "string" ? access.notebook.createdAt : (access.notebook.createdAt as Date).toISOString(),
        updatedAt: typeof access.notebook.updatedAt === "string" ? access.notebook.updatedAt : (access.notebook.updatedAt as Date).toISOString(),
      }}
      initialSources={initialSources}
      initialMessages={initialMessages}
      initialNotes={initialNotes}
    />
  );
}
