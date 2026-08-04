import { db } from "@/db";
import { sources, sourceChunks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { splitIntoChunks } from "@/lib/text/chunk";
import { normalizeWhitespace } from "@/lib/text/extract";
import { touchNotebook } from "./notebook-service";

export type SourceType = "text" | "url" | "pdf" | "file" | "youtube";

/** List columns exclude the potentially large `content` field. */
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

export async function getSourcesForNotebook(notebookId: string) {
  return db
    .select(sourceListColumns)
    .from(sources)
    .where(eq(sources.notebookId, notebookId))
    .orderBy(sources.createdAt);
}

export async function getSourceById(notebookId: string, sourceId: string) {
  const [source] = await db
    .select()
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.notebookId, notebookId)))
    .limit(1);
  return source || null;
}

export async function ingestSource(params: {
  notebookId: string;
  title: string;
  type: SourceType;
  content: string;
  sourceUrl?: string;
}) {
  const cleanContent = normalizeWhitespace(params.content);

  const [source] = await db
    .insert(sources)
    .values({
      notebookId: params.notebookId,
      title: params.title.slice(0, 500) || "مصدر بلا عنوان",
      type: params.type,
      content: cleanContent,
      sourceUrl: params.sourceUrl,
      status: cleanContent ? "ready" : "error",
      errorMessage: cleanContent ? null : "تعذر استخراج أي نص من هذا المصدر.",
      charCount: cleanContent.length,
    })
    .returning();

  if (cleanContent) {
    const chunks = splitIntoChunks(cleanContent);
    if (chunks.length > 0) {
      await db.insert(sourceChunks).values(
        chunks.map((content, index) => ({
          sourceId: source.id,
          notebookId: params.notebookId,
          chunkIndex: index,
          content,
        })),
      );
    }
  }

  await touchNotebook(params.notebookId);
  return source;
}

/**
 * Deletes a source only if it belongs to the given notebook.
 * Returns true when a row was actually removed.
 */
export async function deleteSource(notebookId: string, sourceId: string): Promise<boolean> {
  const deleted = await db
    .delete(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.notebookId, notebookId)))
    .returning({ id: sources.id });

  if (deleted.length > 0) {
    await touchNotebook(notebookId);
  }
  return deleted.length > 0;
}
