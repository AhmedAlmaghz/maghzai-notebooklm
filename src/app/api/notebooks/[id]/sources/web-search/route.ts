import { db } from "@/db";
import { notebooks } from "@/db/schema";
import { ingestSource } from "@/lib/sources";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Extended timeout for deep search

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface SearchResult {
  title: string;
  content: string;
  sources: string[];
}

async function deepWebSearch(query: string, depth: "basic" | "deep" = "deep"): Promise<SearchResult | null> {
  if (!GEMINI_API_KEY) {
    console.error("[WebSearch] No Gemini API key");
    return null;
  }

  const systemPrompt = depth === "deep" 
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

  try {
    const body = {
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: depth === "deep" ? 8000 : 3000,
      },
    };

    console.log(`[WebSearch] Starting ${depth} search for: ${query}`);

    const res = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[WebSearch] API error: ${res.status}`, errorText);
      
      // Retry without search tool if it fails
      console.log("[WebSearch] Retrying without search tool...");
      delete (body as Record<string, unknown>).tools;
      
      const retryRes = await fetch(
        `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      
      if (!retryRes.ok) {
        console.error("[WebSearch] Retry also failed");
        return null;
      }
      
      const retryData = await retryRes.json();
      const content = retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (content) {
        return {
          title: `بحث: ${query}`,
          content,
          sources: ["تم إنشاء المحتوى بواسطة الذكاء الاصطناعي"],
        };
      }
      return null;
    }

    const data = await res.json();
    
    // Extract grounding metadata if available
    const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
    const searchSources: string[] = [];
    
    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) {
          searchSources.push(chunk.web.uri);
        }
      }
    }
    
    if (groundingMetadata?.webSearchQueries) {
      console.log("[WebSearch] Queries used:", groundingMetadata.webSearchQueries);
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!content) {
      console.error("[WebSearch] No content in response");
      return null;
    }

    console.log(`[WebSearch] Success - ${content.length} chars, ${searchSources.length} sources`);

    return {
      title: `🔍 بحث عميق: ${query}`,
      content,
      sources: searchSources.length > 0 ? searchSources : ["بحث ويب عبر Google"],
    };
  } catch (err) {
    console.error("[WebSearch] Error:", err);
    return null;
  }
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

  const [notebook] = await db.select().from(notebooks).where(eq(notebooks.id, notebookId));
  if (!notebook) {
    return Response.json({ error: "الدفتر غير موجود" }, { status: 404 });
  }

  if (!GEMINI_API_KEY) {
    return Response.json({ 
      error: "البحث العميق يتطلب إعداد GEMINI_API_KEY" 
    }, { status: 400 });
  }

  try {
    const result = await deepWebSearch(query, depth);

    if (!result) {
      return Response.json({ 
        error: "تعذر إجراء البحث. حاول مرة أخرى أو استخدم صيغة مختلفة للبحث." 
      }, { status: 400 });
    }

    // Format content with sources
    let formattedContent = result.content;
    
    if (result.sources.length > 0 && !formattedContent.includes("## المصادر")) {
      formattedContent += "\n\n---\n\n## 🔗 المصادر المستخدمة\n\n";
      formattedContent += result.sources.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join("\n");
    }

    const source = await ingestSource({
      notebookId,
      title: result.title,
      type: "url",
      content: formattedContent,
      sourceUrl: `web-search://${encodeURIComponent(query)}`,
    });

    await db.update(notebooks).set({ updatedAt: new Date() }).where(eq(notebooks.id, notebookId));

    return Response.json({ 
      source,
      sourcesFound: result.sources.length,
    }, { status: 201 });

  } catch (err) {
    console.error("[WebSearch] Route error:", err);
    return Response.json({ error: "حدث خطأ أثناء البحث" }, { status: 500 });
  }
}
