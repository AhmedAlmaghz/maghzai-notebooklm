import { NextRequest } from "next/server";
import { getNotebookById } from "@/lib/services/notebook-service";
import { getSourcesForNotebook, ingestSource } from "@/lib/services/source-service";
import { extractTextFromHtml } from "@/lib/text/extract";
import { extractVideoId, fetchYouTubeTranscript, formatYouTubeContent, isYouTubeUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await getSourcesForNotebook(id);
  return Response.json({ sources: rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const kind = body.kind as "text" | "url" | "youtube";

  const notebook = await getNotebookById(notebookId);
  if (!notebook) return Response.json({ error: "Notebook not found" }, { status: 404 });

  try {
    if (kind === "text") {
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "ملاحظة نصية";
      const content = typeof body.content === "string" ? body.content : "";
      if (!content.trim()) {
        return Response.json({ error: "المحتوى فارغ" }, { status: 400 });
      }
      const source = await ingestSource({ notebookId, title, type: "text", content });
      return Response.json({ source }, { status: 201 });
    }

    if (kind === "youtube") {
      const url = typeof body.url === "string" ? body.url.trim() : "";
      const videoId = extractVideoId(url);

      if (!videoId) {
        return Response.json({ error: "رابط يوتيوب غير صالح" }, { status: 400 });
      }

      console.log(`[YouTube] Fetching transcript for video: ${videoId}`);
      const result = await fetchYouTubeTranscript(videoId);

      if (!result || !result.transcript) {
        return Response.json({
          error: "تعذر استخراج النص من هذا الفيديو. تأكد من أن الفيديو يحتوي على ترجمة/تعليقات توضيحية."
        }, { status: 400 });
      }

      const content = formatYouTubeContent(result.transcript, result.metadata);

      const source = await ingestSource({
        notebookId,
        title: `🎬 ${result.metadata.title}`,
        type: "url",
        content,
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      });
      return Response.json({ source }, { status: 201 });
    }

    if (kind === "url") {
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!url || !/^https?:\/\//i.test(url)) {
        return Response.json({ error: "رابط غير صالح" }, { status: 400 });
      }

      // Check if it's a YouTube URL and redirect to youtube handler
      if (isYouTubeUrl(url)) {
        const videoId = extractVideoId(url);
        if (videoId) {
          console.log(`[YouTube] Detected YouTube URL, fetching transcript for: ${videoId}`);
          const result = await fetchYouTubeTranscript(videoId);

          if (result && result.transcript) {
            const content = formatYouTubeContent(result.transcript, result.metadata);

            const source = await ingestSource({
              notebookId,
              title: `🎬 ${result.metadata.title}`,
              type: "url",
              content,
              sourceUrl: url,
            });
            return Response.json({ source }, { status: 201 });
          }
        }
      }

      // Regular URL handling
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NotebookAI/1.0)" },
        redirect: "follow",
      }).catch(() => null);

      if (!res || !res.ok) {
        return Response.json({ error: "تعذر الوصول إلى هذا الرابط" }, { status: 400 });
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("text")) {
        return Response.json({ error: "الرابط لا يشير إلى صفحة نصية/ويب مدعومة" }, { status: 400 });
      }

      const html = await res.text();
      const { title, text } = extractTextFromHtml(html);
      if (!text.trim()) {
        return Response.json({ error: "تعذر استخراج نص مفيد من هذه الصفحة" }, { status: 400 });
      }

      const source = await ingestSource({
        notebookId,
        title: title || url,
        type: "url",
        content: text,
        sourceUrl: url,
      });
      return Response.json({ source }, { status: 201 });
    }

    return Response.json({ error: "نوع مصدر غير مدعوم" }, { status: 400 });
  } catch (err) {
    console.error("Failed to add source", err);
    return Response.json({ error: "حدث خطأ أثناء إضافة المصدر" }, { status: 500 });
  }
}