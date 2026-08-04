import { extractKeySentences, splitSentences, topKeywords } from "@/lib/text/summarize";
import type { RetrievedChunk } from "@/lib/search";
import type { AnswerMode } from "@/lib/types";
import type { WebSearchResult } from "@/lib/web-search";

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
// Default model matches .env.example (gemini-2.0-flash-lite is a real,
// currently-valid model name on the free tier).
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash-lite";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export interface RetryOptions {
  /** Total number of retries after the initial attempt (default 3 → 4 attempts total). */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default 500). */
  baseDelayMs?: number;
  /** Upper bound for the backoff delay in ms (default 8000). */
  maxDelayMs?: number;
}

/**
 * Generic retry helper with exponential backoff + random jitter.
 *
 * - Retries only transient failures: HTTP 429, 5xx, network errors and
 *   timeouts (AbortError). Permanent request errors (4xx other than 429,
 *   e.g. 400/401/403/404) are NOT retried.
 * - The caller is responsible for creating a fresh AbortSignal per attempt;
 *   this helper never reuses an already-aborted signal.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8000;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const shouldRetry = isTransientError(err);
      if (!shouldRetry || attempt >= maxRetries) {
        throw err;
      }

      attempt += 1;
      // Exponential backoff: base * 2^(attempt-1) plus random jitter.
      const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const jitter = Math.random() * exponential * 0.5;
      const delayMs = Math.min(exponential + jitter, maxDelayMs);

      console.log(`[Retry] Attempt ${attempt}/${maxRetries} failed; retrying in ${Math.round(delayMs)}ms`, err);
      await sleep(delayMs);
    }
  }
}

/** Classifies an error as transient (retryable) or permanent. */
export function isTransientError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") {
    return true; // timeout / aborted request
  }
  if (err instanceof TypeError) {
    return true; // network-level failures (fetch rejects with TypeError)
  }
  if (isStatusCode(err)) {
    const status = err.status;
    return status === 429 || status >= 500; // rate limit or server errors
  }
  return false;
}

function isStatusCode(err: unknown): err is { status: number } {
  return typeof err === "object" && err !== null && "status" in err && typeof (err as { status: unknown }).status === "number";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isLLMAvailable(): boolean {
  return Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 10);
}

type GeminiContent = {
  role: "user" | "model";
  parts: { text: string }[];
};

async function callGemini(
  contents: GeminiContent[],
  systemInstruction?: string,
  maxTokens = 2000,
  tools?: unknown[],
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.log("[Gemini] No API key configured");
    return null;
  }

  try {
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    console.log(`[Gemini] Calling model: ${GEMINI_MODEL}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error(`[Gemini] API error ${res.status}:`, responseText);
      return null;
    }

    const data = JSON.parse(responseText);

    if (data.promptFeedback?.blockReason) {
      console.error("[Gemini] Content blocked:", data.promptFeedback.blockReason);
      return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.error("[Gemini] No text in response:", JSON.stringify(data).slice(0, 500));
      return null;
    }

    console.log(`[Gemini] Response received (${text.length} chars)`);
    return text;
  } catch (err) {
    console.error("[Gemini] API call error:", err);
    return null;
  }
}

export type FollowUpSuggestion = {
  text: string;
  type: "expand" | "related" | "example" | "deeper";
};

export type ChatAnswer = {
  answer: string;
  citations: { sourceId: string; sourceTitle: string; snippet: string }[];
  followUps: FollowUpSuggestion[];
  usedAI: boolean;
  usedWebSearch?: boolean;
  /** Source URLs collected from web search in expanded mode (if any). */
  webSources?: string[];
};

const EDUCATIONAL_SYSTEM_PROMPT = `أنت معلّم ومساعد بحثي متميز يشبه NotebookLM. مهمتك الأساسية هي التعليم وشرح المفاهيم بطريقة سهلة وواضحة.

## أسلوب الإجابة:
1. **ابدأ بملخص واضح** للإجابة في جملة أو جملتين
2. **اشرح المفاهيم الأساسية** بلغة بسيطة يفهمها المبتدئ
3. **استخدم أمثلة عملية** لتوضيح الأفكار المجردة
4. **نظّم الإجابة** بعناوين فرعية ونقاط واضحة
5. **استشهد بالمصادر** بصيغة [1] أو [2] عند ذكر معلومة من المقتطفات
6. **أضف سياقاً تعليمياً** يساعد على الفهم العميق

## تنسيق الإجابة:
- استخدم Markdown بشكل فعّال (عناوين، نقاط، **تأكيد**، \`مصطلحات\`)
- اجعل الإجابة شاملة ومفصّلة (3-5 فقرات على الأقل)
- إذا كان هناك معادلات رياضية استخدم $...$ أو $$...$$
- اختم بـ "💡 **خلاصة**" تلخص أهم النقاط

أجب بنفس لغة السؤال. إن لم تجد المعلومة في المصادر، صرّح بذلك واقترح ما يمكن للمستخدم فعله.`;

/**
 * System prompt for "expanded" mode: the model grounds its answer in the
 * selected sources but is explicitly allowed to expand from its own knowledge
 * and to use web search results for a deeper, more detailed reply.
 */
const EXPANDED_SYSTEM_PROMPT = `أنت معلّم ومساعد بحثي متميز يشبه NotebookLM. مهمتك الأساسية هي التعليم وشرح المفاهيم بطريقة سهلة وواضحة.

## أسلوب الإجابة:
1. **ابدأ بملخص واضح** للإجابة في جملة أو جملتين
2. **اشرح المفاهيم الأساسية** بلغة بسيطة يفهمها المبتدئ
3. **استخدم أمثلة عملية** لتوضيح الأفكار المجردة
4. **نظّم الإجابة** بعناوين فرعية ونقاط واضحة
5. **استشهد بالمصادر** بصيغة [1] أو [2] عند ذكر معلومة من المقتطفات
6. **أضف سياقاً تعليمياً** يساعد على الفهم العميق

## الوضع الموسع (Expanded Mode):
أنت تعمل في الوضع الموسع، لذا:
- **استخدم المصادر المحددة كأساس (grounding)** للإجابة، واعتمد عليها أولاً.
- **يمكنك التوسع من معرفتك العامة** لإثراء الإجابة بأمثلة إضافية، تطبيقات عملية، سياق تاريخي، أو شرح أعمق غير موجود في المصادر.
- **استخدم نتائج البحث في الويب** (إن وُجدت في السياق) لدعم الإجابة بمعلومات حديثة أو أمثلة حية.
- إذا طلب المستخدم أمثلة محلولة أو أمثلة عملية غير موجودة في المصادر، قدّمها من معرفتك أو من نتائج الويب.
- **ميّز بوضوح** بين ما هو من المصادر وما هو توسعة من معرفتك أو من الويب، حتى يبقى المستخدم مدركاً لمصدر المعلومة.

## تنسيق الإجابة:
- استخدم Markdown بشكل فعّال (عناوين، نقاط، **تأكيد**، \`مصطلحات\`)
- اجعل الإجابة شاملة ومفصّلة (3-5 فقرات على الأقل)
- إذا كان هناك معادلات رياضية استخدم $...$ أو $$...$$
- اختم بـ "💡 **خلاصة**" تلخص أهم النقاط

أجب بنفس لغة السؤال.`;

/**
 * Builds the reference context string from the retrieved source chunks.
 * Each chunk is labelled with its source title for citation purposes.
 */
export function buildSourcesContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] المصدر: ${c.sourceTitle}\n${c.content}`)
    .join("\n\n---\n\n");
}

/**
 * Builds the web search context string from a web search result (if any).
 * Returns an empty string when there is no web result to include.
 */
export function buildWebContext(webResult: WebSearchResult | null): string {
  if (!webResult || !webResult.content) return "";
  const sources = webResult.sources.length > 0
    ? `\n\nمصادر الويب:\n${webResult.sources.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    : "";
  return `نتائج البحث في الويب:\n\n${webResult.content}${sources}`;
}

/**
 * Returns the appropriate system prompt for the given answer mode.
 * - "sources": strict grounding — the model must not add info outside sources.
 * - "expanded": grounding + permission to expand from memory and web results.
 */
export function buildSystemPrompt(mode: AnswerMode): string {
  if (mode === "expanded") {
    return EXPANDED_SYSTEM_PROMPT;
  }
  return EDUCATIONAL_SYSTEM_PROMPT;
}

/** Answers a user question with educational depth and follow-up suggestions */
export async function answerQuestion(
  question: string,
  chunks: RetrievedChunk[],
  options: {
    mode?: AnswerMode;
    webResult?: WebSearchResult | null;
  } = {},
): Promise<ChatAnswer> {
  const mode: AnswerMode = options.mode ?? "sources";
  const webResult = options.webResult ?? null;

  if (chunks.length === 0) {
    return {
      answer:
        "لا تحتوي المصادر المضافة حالياً على معلومات كافية للإجابة عن هذا السؤال. جرّب إضافة مصادر جديدة أو إعادة صياغة السؤال.",
      citations: [],
      followUps: [
        { text: "أضف مصادر جديدة حول هذا الموضوع", type: "expand" },
        { text: "صِغ السؤال بطريقة مختلفة", type: "related" },
      ],
      usedAI: false,
    };
  }

  // Deduplicate sources for the citation list
  const seen = new Set<string>();
  const citationSources: { sourceId: string; sourceTitle: string; snippet: string }[] = [];
  for (const c of chunks) {
    if (seen.has(c.sourceId)) continue;
    seen.add(c.sourceId);
    citationSources.push({
      sourceId: c.sourceId,
      sourceTitle: c.sourceTitle,
      snippet: c.content.slice(0, 240).trim() + (c.content.length > 240 ? "…" : ""),
    });
  }

  const context = buildSourcesContext(chunks);
  const webContext = buildWebContext(webResult);

  if (isLLMAvailable()) {
    let userPrompt: string;
    if (mode === "expanded") {
      userPrompt = `المقتطفات المرجعية من مصادر المستخدم:\n\n${context}\n\n---\n\n${webContext ? `${webContext}\n\n---\n\n` : ""
        }سؤال المستخدم: ${question}\n\nقدّم إجابة تعليمية شاملة ومفصّلة تشرح المفاهيم بوضوح. استخدم المصادر كأساس، ووسّع من معرفتك أو من نتائج الويب عند الحاجة.`;
    } else {
      userPrompt = `المقتطفات المرجعية من مصادر المستخدم:\n\n${context}\n\n---\n\nسؤال المستخدم: ${question}\n\nقدّم إجابة تعليمية شاملة ومفصّلة تشرح المفاهيم بوضوح. اعتمد فقط على المعلومات الموجودة في المصادر أعلاه ولا تضف معلومات من خارجها.`;
    }

    const result = await callGemini(
      [{ role: "user", parts: [{ text: userPrompt }] }],
      buildSystemPrompt(mode),
      2500,
    );

    if (result) {
      // Generate follow-up suggestions
      const followUps = await generateFollowUpSuggestions(question, result, chunks);

      return {
        answer: result,
        citations: citationSources.slice(0, 6),
        followUps,
        usedAI: true,
        usedWebSearch: mode === "expanded" && Boolean(webResult),
        webSources: mode === "expanded" ? webResult?.sources : undefined,
      };
    }
  }

  // Local extractive fallback
  console.log("[AI] Using local fallback (no Gemini response)");
  const combinedText = chunks.map((c) => c.content).join(" ");
  const relevantSentences = extractKeySentences(combinedText, 6);
  const keywords = topKeywords(combinedText, 5);

  const answerBody = relevantSentences.length
    ? `## الإجابة من المصادر\n\n` +
    relevantSentences.map((s, i) => `- ${s.trim()} [${(i % citationSources.length) + 1}]`).join("\n") +
    `\n\n**الكلمات المفتاحية:** ${keywords.join("، ")}`
    : chunks[0].content.slice(0, 500);

  const answer =
    `${answerBody}\n\n---\n\n` +
    `💡 _تم إنشاء هذه الإجابة تلقائياً عبر التحليل النصي. لإجابات تعليمية أعمق، تأكد من تفعيل GEMINI_API_KEY._`;

  return {
    answer,
    citations: citationSources.slice(0, 6),
    followUps: [
      { text: "اشرح هذا بتفصيل أكثر", type: "expand" },
      { text: `ما علاقة ${keywords[0] || "هذا"} بالموضوع؟`, type: "related" },
    ],
    usedAI: false,
    usedWebSearch: mode === "expanded" && Boolean(webResult),
    webSources: mode === "expanded" ? webResult?.sources : undefined,
  };
}

/** Search the web and expand the answer with external information */
export async function searchWebAndExpand(
  question: string,
  previousAnswer: string,
): Promise<{ expandedContent: string; usedWebSearch: boolean }> {
  if (!isLLMAvailable()) {
    return { expandedContent: "", usedWebSearch: false };
  }

  const systemPrompt = `أنت معلّم ومساعد بحثي متخصص. مهمتك هي توسيع الإجابة السابقة بمعلومات إضافية قيّمة.

## ما يجب فعله:
1. أضف سياقاً تاريخياً أو علمياً أوسع
2. اذكر تطبيقات عملية وأمثلة من الواقع
3. وضّح المفاهيم المعقدة بطرق مختلفة
4. أضف معلومات حديثة أو تطورات في المجال
5. اربط الموضوع بمواضيع أخرى ذات صلة

## التنسيق:
ابدأ بـ "## 🌐 توسعة ومعلومات إضافية" ثم قدّم المحتوى بتنسيق Markdown منظم.`;

  const userPrompt = `السؤال الأصلي: ${question}

الإجابة السابقة:
${previousAnswer.slice(0, 2000)}

---

وسّع هذه الإجابة بمعلومات إضافية تعليمية قيّمة تُثري فهم المتعلم. أضف أمثلة جديدة، سياق تاريخي، تطبيقات عملية، أو معلومات متقدمة.`;

  try {
    // Try with Google Search grounding first (for models that support it)
    let result = await callGemini(
      [{ role: "user", parts: [{ text: userPrompt }] }],
      systemPrompt,
      1800,
      [{ google_search: {} }],
    );

    // If that fails, try without tools
    if (!result) {
      console.log("[AI] Retrying web expansion without search tool");
      result = await callGemini(
        [{ role: "user", parts: [{ text: userPrompt }] }],
        systemPrompt,
        1800,
      );
    }

    if (result) {
      return { expandedContent: result, usedWebSearch: true };
    }
  } catch (err) {
    console.error("[AI] Web search expansion error:", err);

    // Fallback: try without search tool
    try {
      const result = await callGemini(
        [{ role: "user", parts: [{ text: userPrompt }] }],
        systemPrompt,
        1800,
      );
      if (result) {
        return { expandedContent: result, usedWebSearch: true };
      }
    } catch {
      // ignore
    }
  }

  return { expandedContent: "", usedWebSearch: false };
}

/** Generate follow-up suggestions based on the conversation */
async function generateFollowUpSuggestions(
  question: string,
  answer: string,
  chunks: RetrievedChunk[],
): Promise<FollowUpSuggestion[]> {
  if (!isLLMAvailable()) {
    const keywords = topKeywords(chunks.map(c => c.content).join(" "), 3);
    return [
      { text: "اشرح هذا بمزيد من التفصيل", type: "expand" },
      { text: `أعطني أمثلة عملية`, type: "example" },
      keywords[0] ? { text: `ما هو ${keywords[0]} بالضبط؟`, type: "deeper" } : { text: "ما هي المفاهيم الأساسية هنا؟", type: "deeper" },
    ];
  }

  const systemPrompt = `بناءً على السؤال والإجابة، اقترح 4 أسئلة متابعة تساعد المتعلم على:
1. توسيع فهمه للموضوع
2. استكشاف مواضيع مرتبطة
3. الحصول على أمثلة عملية
4. التعمق في المفاهيم

أعد الأسئلة فقط، سؤال في كل سطر، بدون ترقيم أو رموز. اجعلها قصيرة ومباشرة.`;

  const result = await callGemini(
    [{ role: "user", parts: [{ text: `السؤال: ${question}\n\nالإجابة: ${answer.slice(0, 1000)}` }] }],
    systemPrompt,
    300,
  );

  if (result) {
    const suggestions = result
      .split("\n")
      .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
      .filter((l) => l.length > 5 && l.length < 100)
      .slice(0, 4);

    const types: FollowUpSuggestion["type"][] = ["expand", "related", "example", "deeper"];
    return suggestions.map((text, i) => ({
      text,
      type: types[i % types.length],
    }));
  }

  return [
    { text: "اشرح هذا بمزيد من التفصيل", type: "expand" },
    { text: "أعطني أمثلة عملية على ذلك", type: "example" },
    { text: "ما هي المفاهيم المرتبطة بهذا الموضوع؟", type: "related" },
  ];
}

export type StudioKind =
  | "summary"
  | "faq"
  | "study_guide"
  | "timeline"
  | "mindmap"
  | "flashcards"
  | "presentation"
  | "quiz"
  | "glossary"
  | "outline"
  | "comparison"
  | "debate";

const STUDIO_TITLES: Record<StudioKind, string> = {
  summary: "ملخص شامل",
  faq: "أسئلة شائعة",
  study_guide: "دليل دراسي",
  timeline: "الجدول الزمني وأهم النقاط",
  mindmap: "خريطة ذهنية",
  flashcards: "بطاقات تعليمية",
  presentation: "عرض تقديمي",
  quiz: "اختبار قصير",
  glossary: "مسرد المصطلحات",
  outline: "مخطط مقال",
  comparison: "جدول مقارنة",
  debate: "نقاط مناقشة",
};

export function studioTitle(kind: StudioKind): string {
  return STUDIO_TITLES[kind];
}

export async function generateStudioArtifact(
  kind: StudioKind,
  sourcesText: { title: string; content: string }[],
): Promise<{ content: string; usedAI: boolean }> {
  const fullContext = sourcesText
    .map((s) => `## ${s.title}\n${s.content}`)
    .join("\n\n")
    .slice(0, 30000);

  if (isLLMAvailable()) {
    const instructions: Record<StudioKind, string> = {
      summary:
        "اكتب ملخصاً تعليمياً شاملاً وواضحاً لجميع المصادر. استخدم:\n- عناوين فرعية واضحة\n- نقاط مرتبة\n- شرح المفاهيم الصعبة ببساطة\n- أمثلة توضيحية عند الحاجة\n- خلاصة في النهاية",
      faq:
        "أنشئ 8-12 سؤالاً شائعاً مع إجابات تعليمية مفصّلة. اجعل الأسئلة متدرجة من الأساسيات إلى المتقدم. استخدم صيغة:\n### ❓ السؤال\nالإجابة التفصيلية...",
      study_guide:
        "أنشئ دليلاً دراسياً شاملاً يتضمن:\n## 🎯 أهداف التعلم\n## 📚 المفاهيم الأساسية (مع شرح مبسط لكل مفهوم)\n## 📝 مصطلحات مهمة (مع تعريفات واضحة)\n## ✅ نقاط للمراجعة\n## 💡 نصائح للفهم",
      timeline:
        "استخرج تسلسلاً منطقياً أو زمنياً لأهم النقاط والأحداث. استخدم:\n- ترقيم واضح\n- وصف موجز لكل نقطة\n- ربط النقاط ببعضها منطقياً\n- إبراز العلاقات السببية",
      mindmap:
        `أنشئ خريطة ذهنية للمفاهيم الرئيسية باستخدام صيغة Mermaid mindmap. اتبع هذا التنسيق بالضبط:

\`\`\`mermaid
mindmap
  root((الموضوع الرئيسي))
    الفرع الأول
      نقطة فرعية 1
      نقطة فرعية 2
    الفرع الثاني
      نقطة فرعية 1
      نقطة فرعية 2
    الفرع الثالث
      نقطة فرعية 1
\`\`\`

اجعل الخريطة شاملة لأهم المفاهيم مع 4-6 فروع رئيسية وفروع فرعية لكل منها. أضف شرحاً موجزاً بعد الخريطة.`,
      flashcards:
        `أنشئ 10-15 بطاقة تعليمية (Flashcards) للمراجعة والحفظ. كل بطاقة تحتوي على سؤال وجواب.

استخدم هذا التنسيق بالضبط لكل بطاقة:

---CARD---
**السؤال:** [اكتب السؤال هنا]
**الجواب:** [اكتب الجواب هنا]
---END---

اجعل الأسئلة متنوعة بين:
- تعريفات ومصطلحات
- أسئلة فهم
- أسئلة تطبيقية
- أسئلة مقارنة`,
      presentation:
        `أنشئ عرضاً تقديمياً احترافياً من 8-12 شريحة. استخدم هذا التنسيق:

---SLIDE---
## عنوان الشريحة
- النقطة الأولى
- النقطة الثانية
- النقطة الثالثة
📝 ملاحظات المحاضر: [ملاحظات للشرح]
---END---

اجعل العرض يتضمن:
1. شريحة عنوان
2. شريحة أهداف التعلم
3. شرائح المحتوى الرئيسي
4. شريحة ملخص
5. شريحة أسئلة للنقاش

استخدم نقاط قصيرة وواضحة في كل شريحة (3-5 نقاط كحد أقصى).`,
      quiz:
        "أنشئ اختباراً تعليمياً شاملاً من 8-10 أسئلة متنوعة. استخدم هذا التنسيق بالضبط:\n\n---QUIZ---\n## ❓ السؤال 1\n- أ) الخيار الأول\n- ب) الخيار الثاني\n- ج) الخيار الثالث\n- د) الخيار الرابع\n\n**الإجابة الصحيحة:** [الحرف]\n**الشرح:** [شرح مفصل للسبب]\n---END---\n\nاجعل الأسئلة متنوعة بين:\n- أسئلة فهم وتذكر\n- أسئلة تطبيقية\n- أسئلة تحليلية\n- أسئلة تقييمية\n\nتأكد من أن الإجابات واضحة والشروحات تعزز الفهم.",
      glossary:
        "أنشئ مسرداً شاملاً للمصطلحات المهمة. استخدم هذا التنسيق:\n\n## 📖 المصطلح\n**التعريف:** [تعريف واضح ومبسط]\n**مثال:** [مثال عملي من الواقع]\n**العلاقة:** [كيف يرتبط بمفاهيم أخرى]\n\nاجمع 10-15 مصطلحاً أساسياً مرتبطاً بالموضوع. رتبها أبجدياً.",
      outline:
        "أنشئ مخططاً تفصيلياً هرمياً شاملاً. استخدم هذا التنسيق:\n\n# العنوان الرئيسي\n## 1. المقدمة\n### 1.1 الفكرة الرئيسية\n### 1.2 الأهداف\n## 2. المحتوى الرئيسي\n### 2.1 النقطة الأولى\n#### 2.1.1 التفاصيل\n### 2.2 النقطة الثانية\n## 3. الخاتمة\n### 3.1 ملخص النقاط\n### 3.2 التوصيات\n\nاجعل المخطط شاملاً ومنظماً مع 3-5 أقسام رئيسية على الأقل.",
      comparison:
        "أنشئ جدول مقارنة احترافي بين المفاهيم أو العناصر. استخدم:\n\n## 📊 جدول المقارنة\n\n| المعيار | العنصر الأول | العنصر الثاني | الفرق |\n|---------|-------------|-------------|------|\n| المعيار 1 | ... | ... | ... |\n| المعيار 2 | ... | ... | ... |\n| المعيار 3 | ... | ... | ... |\n\nثم أضف تحليلاً نصياً:\n## 📝 التحليل\n### أوجه التشابه\n- ...\n\n### أوجه الاختلاف\n- ...\n\n### الخلاصة\n[توصية أو استنتاج نهائي]",
      debate:
        "أنشئ نقاط مناقشة متوازنة ومحايدة حول الموضوع. استخدم:\n\n## 💬 وجهة النظر المؤيدة\n### الحجة الأولى\n- **الدليل:** ...\n- **المثال:** ...\n- **التأثير:** ...\n\n### الحجة الثانية\n- **الدليل:** ...\n- **المثال:** ...\n\n## 🤔 وجهة النظر المعارضة\n### الحجة الأولى\n- **الدليل:** ...\n- **المثال:** ...\n\n### الحجة الثانية\n- **الدليل:** ...\n- **المثال:** ...\n\n## ⚖️ الخلاصة المتوازنة\n[تحليل موضوعي يوضح متى يُفضل كل وجهة نظر]",
    };
    const system =
      "أنت معلّم متخصص في إنتاج مواد دراسية عالية الجودة. اجعل المحتوى سهل الفهم ومنظماً بشكل جميل باستخدام Markdown.";

    const result = await callGemini(
      [{ role: "user", parts: [{ text: `${instructions[kind]}\n\nالمصادر:\n\n${fullContext}` }] }],
      system,
      3000,
    );
    if (result) return { content: result, usedAI: true };
  }

  // Local fallback
  const combined = sourcesText.map((s) => s.content).join("\n\n");
  const keySentences = extractKeySentences(combined, kind === "faq" ? 10 : 8);
  const keywords = topKeywords(combined, 10);

  let content = "";
  if (kind === "summary") {
    content =
      `## ملخص تلقائي\n\n` +
      keySentences.map((s) => `- ${s.trim()}`).join("\n") +
      `\n\n**الكلمات المفتاحية:** ${keywords.join("، ")}`;
  } else if (kind === "faq") {
    content =
      `## أسئلة وأجوبة\n\n` +
      keySentences.map((s, i) => `### ❓ سؤال ${i + 1}\n${s.trim()}\n`).join("\n");
  } else if (kind === "study_guide") {
    content =
      `## 🎯 دليل دراسي\n\n### المفاهيم الرئيسية\n` +
      keySentences.slice(0, 4).map((s) => `- ${s.trim()}`).join("\n") +
      `\n\n### مصطلحات مهمة\n` +
      keywords.slice(0, 8).map((t) => `- **${t}**`).join("\n");
  } else {
    content =
      `## التسلسل المنطقي\n\n` +
      keySentences.map((s, i) => `${i + 1}. ${s.trim()}`).join("\n");
  }

  return { content, usedAI: false };
}

export async function suggestQuestions(
  sourcesText: { title: string; content: string }[],
): Promise<string[]> {
  if (sourcesText.length === 0) return [];
  const fullContext = sourcesText.map((s) => `## ${s.title}\n${s.content}`).join("\n\n").slice(0, 15000);

  if (isLLMAvailable()) {
    const result = await callGemini(
      [
        {
          role: "user",
          parts: [{ text: `اقترح 4 أسئلة تعليمية ذكية تساعد على فهم المصادر التالية. اجعل الأسئلة متنوعة بين الفهم والتحليل والتطبيق. سؤال واحد في كل سطر بدون ترقيم.\n\n${fullContext}` }],
        },
      ],
      "أنت معلم يقترح أسئلة تحفّز التفكير والفهم العميق.",
      400,
    );
    if (result) {
      return result
        .split("\n")
        .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
        .filter((l) => l.length > 5)
        .slice(0, 4);
    }
  }

  const combined = sourcesText.map((s) => s.content).join(" ");
  const keywords = topKeywords(combined, 4);
  return [
    `ما هي الفكرة الرئيسية حول ${keywords[0] || "هذا الموضوع"}؟`,
    "لخّص لي أهم النقاط بطريقة مبسطة",
    `كيف يمكن تطبيق ${keywords[1] || "هذه المفاهيم"} عملياً؟`,
    "ما هي العلاقة بين المفاهيم المذكورة؟",
  ];
}

export async function generateNotebookTitle(
  sourcesText: { title: string; content: string }[],
): Promise<{ title: string; description: string; emoji: string }> {
  const fallbackTitle = sourcesText[0]?.title?.slice(0, 60) || "دفتر بحث جديد";

  if (isLLMAvailable() && sourcesText.length > 0) {
    const fullContext = sourcesText.map((s) => `## ${s.title}\n${s.content}`).join("\n\n").slice(0, 8000);
    const result = await callGemini(
      [
        {
          role: "user",
          parts: [{ text: `اقترح عنواناً قصيراً (5 كلمات كحد أقصى) ووصفاً من جملة واحدة ورمزاً تعبيرياً واحداً مناسباً للمصادر التالية. أعد الإجابة بصيغة JSON فقط بالشكل: {"title": "...", "description": "...", "emoji": "..."}\n\n${fullContext}` }],
        },
      ],
      undefined,
      250,
    );
    if (result) {
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.title) {
            return {
              title: String(parsed.title).slice(0, 100),
              description: String(parsed.description || "").slice(0, 300),
              emoji: String(parsed.emoji || "📓").slice(0, 4),
            };
          }
        }
      } catch {
        // fall through
      }
    }
  }

  return { title: fallbackTitle, description: "", emoji: "📓" };
}
