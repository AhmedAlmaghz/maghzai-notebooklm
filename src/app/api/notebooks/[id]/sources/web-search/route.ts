import { ingestSource } from "@/lib/services/source-service";
import { requireNotebookAccess } from "@/lib/access";
import { withRetry } from "@/lib/ai";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Extended timeout for deep search

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_FETCH_TIMEOUT_MS = 60000;

/** Error carrying an HTTP status, so withRetry can classify transient 429/5xx. */
class HttpStatusError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

// Read env vars lazily per request so changes / missing keys don't break module load.
function geminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim(),
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash-lite",
  };
}

interface SearchResult {
  title: string;
  content: string;
  sources: string[];
}

async function callGemini(query: string, depth: "basic" | "deep", withTools: boolean) {
  const { apiKey, model } = geminiConfig();
  if (!apiKey) return null;

  const systemPrompt =
    depth === "deep"
      ? `أنت باحث متخصص في جمع المعلومات الشاملة من الويب. مهمتك:

1. ابحث بعمق عن الموضوع المطلوب
2. اجمع معلومات من مصادر متعددة وموثوقة
3. نظّم المعلومات بشكل منطقي ومترابط
4. اذكر الحقائق والإحصائيات المهمة
5. قدّم نظرة شاملة تغطي جميع جوانب الموضوع

## تنسيق الإجابة:
- استخدم عناوين وفقرات منظمة
- اذكر الأرقام والتواريخ الدقيقة
- قدّم معلومات متعمقة وليست سطحية
- اكتب بأسلوب أكاديمي واضح
- الطول المطلوب: 1500-3000 كلمة على الأقل

في النهاية، أضف قسم "## المصادر" يحتوي على قائمة بالمواقع والمصادر التي استخدمتها.`
      : `أنت باحث يجمع معلومات أساسية عن موضوع معين. قدّم ملخصاً شاملاً مع ذكر المصادر.`;

  const userPrompt = `ابحث في الويب واجمع معلومات شاملة ومفصّلة عن الموضوع التالي:

"${query}"

اجعل البحث عميقاً وشاملاً يغطي:
- التعريف والمفهوم الأساسي
- التاريخ والتطور
- الأنواع والتصنيفات (إن وجدت)
- التطبيقات والاستخدامات
- المزايا والتحديات
- آخر التطورات والأبحاث
- الإحصائيات والأرقام المهمة
- المستقبل والتوقعات`;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: depth === "deep" ? 8000 : 3000,
    },
  };
  if (withTools) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(
    `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEMINI_FETCH_TIMEOUT_MS),
    },
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[WebSearch] API error: ${res.status}`, errorText);
    // Transient failures (rate limit / server errors) are thrown so the
    // unified retry policy backs off and retries. Permanent client errors
    // (400/401/403/404) return null, preserving the previous behaviour:
    // the strategy falls back to the tool-less attempt or fails gracefully.
    if (res.status === 429 || res.status >= 500) {
      throw new HttpStatusError(res.status, `Gemini API error ${res.status}: ${errorText}`);
    }
    return null;
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) return null;

  const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
  const searchSources: string[] = [];
  if (groundingMetadata?.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web?.uri) {
        searchSources.push(chunk.web.uri);
      }
    }
  }

  return { content, sources: searchSources };
}

async function deepWebSearch(query: string, depth: "basic" | "deep" = "deep"): Promise<SearchResult | null> {
  console.log(`[WebSearch] Starting ${depth} search for: ${query}`);

  // Unified retry policy around the whole "try with tools, then without tools"
  // strategy. Every attempt (including the tool-less fallback) gets its own
  // fresh AbortSignal and participates in the same exponential backoff, so a
  // transient rate-limit or 5xx during the fallback is retried too.
  const strategy = withRetry(
    async () => {
      // First attempt with the google_search grounding tool.
      const withTools = await callGemini(query, depth, true);
      if (withTools) {
        return {
          title: `🔍 بحث عميق: ${query}`,
          content: withTools.content,
          sources: withTools.sources.length > 0 ? withTools.sources : ["بحث ويب عبر Google"],
        } as SearchResult;
      }

      // Fall back to a tool-less attempt (some models don't support grounding).
      console.log("[WebSearch] Retrying without search tool...");
      const withoutTools = await callGemini(query, depth, false);
      if (withoutTools) {
        return {
          title: `بحث: ${query}`,
          content: withoutTools.content,
          sources: ["تم إنشاء المحتوى بواسطة الذكاء الاصطناعي"],
        } as SearchResult;
      }

      // No content from either attempt: treat as a transient failure so the
      // whole strategy is retried with backoff.
      throw new Error("Gemini returned no content");
    },
    { maxRetries: 3, baseDelayMs: 500, maxDelayMs: 8000 },
  );

  return strategy;
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
    const result = await deepWebSearch(query, depth);

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
