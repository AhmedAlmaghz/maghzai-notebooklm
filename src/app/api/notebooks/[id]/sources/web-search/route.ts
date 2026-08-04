import { ingestSource } from "@/lib/services/source-service";
import { requireNotebookAccess } from "@/lib/access";
import { webSearch } from "@/lib/web-search";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Extended timeout for deep search

function geminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim(),
  };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const depth = body.depth === "basic" ? "basic" : "deep";

  if (!query) {
    return Response.json({ error: "الرجاء إدخال موضوع للبحث" }, { status: 400 });
  }

  if (query.length < 3) {
    return Response.json({ error: "موضوع البحث قصير جداً" }, { status: 400 });
  }

  const access = await requireNotebookAccess(notebookId, "write");
  if (!access.ok) {
    return Response.json({ error: access.error }, { status: access.status });
  }

  const { apiKey } = geminiConfig();
  if (!apiKey) {
    return Response.json({
      error: "البحث العميق يتطلب إعداد GEMINI_API_KEY",
    }, { status: 400 });
  }

  try {
    const result = await webSearch(query, depth);

    if (!result) {
      return Response.json({
        error: "تعذر إجراء البحث. حاول مرة أخرى أو استخدم صيغة مختلفة للبحث.",
      }, { status: 400 });
    }

    // Format content with sources
    let formattedContent = result.content;

    if (result.sources.length > 0 && !formattedContent.includes("## المصادر")) {
      formattedContent += "\n\n---\n\n## 🔗 المصادر المستخدمة\n\n";
      formattedContent += result.sources.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join("\n");
    }

    // Store the result as a "text" source with a real, clickable search link.
    const source = await ingestSource({
      notebookId,
      title: result.title,
      type: "text",
      content: formattedContent,
      sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });

    return Response.json({
      source,
      sourcesFound: result.sources.length,
    }, { status: 201 });
  } catch (err) {
    console.error("[WebSearch] Route error:", err);
    return Response.json({ error: "حدث خطأ أثناء البحث" }, { status: 500 });
  }
}
