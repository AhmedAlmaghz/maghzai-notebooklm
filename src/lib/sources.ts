import { db } from "@/db";
import { sourceChunks, sources } from "@/db/schema";
import { splitIntoChunks } from "@/lib/text/chunk";
import { normalizeWhitespace } from "@/lib/text/extract";

export async function ingestSource(params: {
  notebookId: string;
  title: string;
  type: "text" | "url" | "pdf" | "file";
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

  return source;
}
