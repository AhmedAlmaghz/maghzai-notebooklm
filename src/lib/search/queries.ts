import { requestJson } from "@/lib/search/gemini";
import { ASPECTS, isAspect, type Aspect, type SubQuery } from "@/lib/search/types";
import { topKeywords } from "@/lib/text/summarize";
import { isLLMAvailable } from "@/lib/ai";

/**
 * Multi-query decomposition (query planning): turns one user question into
 * 4–8 aspect-tagged sub-queries with Arabic morphological expansions.
 */

const DECOMPOSITION_SYSTEM_PROMPT = `أنت خبير في هندسة الاستعلامات البحثية العميقة. مهمتك تحليل سؤال المستخدم وتفكيكه إلى
أسئلة فرعية متنوعة تغطي جميع جوانب الموضوع من زوايا متعددة.

القواعد:
1. قدّم من 4 إلى 8 أسئلة فرعية بحسب تعقيد الموضوع.
2. كل سؤال فرعي يجب أن يركز على جانب واحد محدد من الأبعاد التالية:
   definition التعريف والمفهوم، history التاريخ والتطور، types الأنواع والتصنيفات،
   mechanism آلية العمل، applications التطبيقات والاستخدامات، pros_cons المزايا والعيوب،
   statistics الإحصائيات والأرقام، controversies الخلافات والجدل،
   recent_developments آخر التطورات، future_outlook المستقبل والتوقعات،
   comparisons المقارنات، expert_opinions آراء الخبراء.
3. غطّ أبعاداً مختلفة ولا تكرر نفس البعد.
4. لكل سؤال فرعي أضف 2 إلى 4 صيغ مترادفة أو مشتقة (expansions) بلغة السؤال
   لتعويض عدم وجود تحليل صرفي (جذر/وزن) في محرك البحث، مثل:
   كتاب → كتب، الكتب، المؤلفات.
5. أضف وزناً (weight) بين 0 و1 يعبّر عن أهمية هذا البعد بالنسبة لسؤال المستخدم.
6. أعد الناتج بصيغة JSON صرفة بدون أي نص إضافي وبالشكل التالي:

{"subQueries":[{"text":"...","aspect":"definition","rationale":"...","expansions":["..."],"weight":0.9}]}`;

type DecomposeResponse = {
    subQueries?: Array<{
        text?: unknown;
        aspect?: unknown;
        rationale?: unknown;
        expansions?: unknown;
        weight?: unknown;
    }>;
};

/**
 * Strict JSON parse + schema validation of the decomposition response.
 * Strips code fences, validates the Aspect enum, dedupes aspects, clamps
 * weights to [0.1, 1], and filters sub-queries whose text is < 3 chars.
 */
export function parseSubQueries(raw: string): SubQuery[] {
    const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first === -1 || last === -1) return [];
    let data: DecomposeResponse;
    try {
        data = JSON.parse(cleaned.slice(first, last + 1)) as DecomposeResponse;
    } catch {
        return [];
    }
    if (!Array.isArray(data.subQueries)) return [];

    const seenAspects = new Set<Aspect>();
    const out: SubQuery[] = [];
    for (const sq of data.subQueries) {
        if (!sq || typeof sq !== "object") continue;
        const text = typeof sq.text === "string" ? sq.text.trim() : "";
        if (text.length < 3) continue;
        const aspect = sq.aspect;
        if (!isAspect(aspect)) continue;
        if (seenAspects.has(aspect)) continue;
        seenAspects.add(aspect);

        const rationale = typeof sq.rationale === "string" ? sq.rationale.trim() : "";
        const expansions = Array.isArray(sq.expansions)
            ? sq.expansions
                .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
                .map((e) => e.trim())
                .slice(0, 4)
            : [];
        const weightNum = typeof sq.weight === "number" && isFinite(sq.weight) ? sq.weight : 0.5;
        const weight = Math.min(1, Math.max(0.1, weightNum));

        out.push({
            id: `q${out.length + 1}`,
            text,
            aspect,
            rationale,
            expansions,
            weight,
        });
    }
    return out;
}

/** Deterministic local decomposition used when Gemini is unavailable. */
export function fallbackSubQueries(question: string): SubQuery[] {
    const q = question.trim();
    const topic =
        topKeywords(q, 1)[0] ??
        (q.replace(/^(ما هو|ما هي|ماهو|ماهي|اشرح|عرّف|عرف|كيف|لماذا|هل)\s*/i, "").split(/\s+/).slice(0, 3).join(" ") ||
            q.slice(0, 40));

    const keywordAspects: { pattern: RegExp; aspect: Aspect; label: string }[] = [
        { pattern: /تاريخ|التطور|نشأة|مراحل/i, aspect: "history", label: "التاريخ والتطور" },
        { pattern: /مزايا|عيوب|فوائد|سلبيات|إيجابيات/i, aspect: "pros_cons", label: "المزايا والعيوب" },
        { pattern: /أنواع|تصنيف|أقسام|أشكال/i, aspect: "types", label: "الأنواع والتصنيفات" },
        { pattern: /كيف|آلية|طريقة عمل|يعمل/i, aspect: "mechanism", label: "آلية العمل" },
        { pattern: /تطبيقات|استخدامات|مجالات/i, aspect: "applications", label: "التطبيقات والاستخدامات" },
        { pattern: /إحصائيات|أرقام|أعداد/i, aspect: "statistics", label: "الإحصائيات والأرقام" },
        { pattern: /خلاف|جدل|انتقادات|مشاكل|مخاوف/i, aspect: "controversies", label: "الخلافات والجدل" },
        { pattern: /مستقبل|توقعات|مستجدات/i, aspect: "future_outlook", label: "المستقبل والتوقعات" },
        { pattern: /مقارنة|فرق|بين/i, aspect: "comparisons", label: "المقارنات" },
        { pattern: /رأي|آراء|خبراء/i, aspect: "expert_opinions", label: "آراء الخبراء" },
        { pattern: /آخر|حديث|جديد/i, aspect: "recent_developments", label: "التطورات الحديثة" },
    ];

    const matched = keywordAspects
        .filter((k) => k.pattern.test(q))
        .map((k) => ({ ...k, expansions: expansionsFor(k.label, topic) }));

    const uniqueAspects = new Set<Aspect>(matched.map((m) => m.aspect));

    const templates: { aspect: Aspect; label: string; make: (t: string) => string }[] = [
        { aspect: "definition", label: "التعريف والمفهوم", make: (t) => `ما هو تعريف ${t}؟` },
        { aspect: "history", label: "التاريخ والتطور", make: (t) => `ما تاريخ تطور ${t}؟` },
        { aspect: "mechanism", label: "آلية العمل", make: (t) => `كيف يعمل ${t}؟` },
        { aspect: "applications", label: "التطبيقات والاستخدامات", make: (t) => `ما هي التطبيقات العملية لـ ${t}؟` },
        { aspect: "pros_cons", label: "المزايا والعيوب", make: (t) => `ما هي مزايا وعيوب ${t}؟` },
        { aspect: "future_outlook", label: "المستقبل والتوقعات", make: (t) => `ما مستقبل ${t} وتوقعاته؟` },
    ];

    const queries: SubQuery[] = [];
    const used = new Set<Aspect>();

    // Keyword-matched queries first.
    for (const m of matched.slice(0, 4)) {
        used.add(m.aspect);
        queries.push({
            id: `q${queries.length + 1}`,
            text: m.label === "الخلافات والجدل" ? `ما هي الخلافات والجدل حول ${topic}؟` : `${m.label} لـ ${topic}`,
            aspect: m.aspect,
            rationale: m.label,
            expansions: m.expansions,
            weight: 0.9,
        });
    }

    // Fill remaining slots with generic templates, skipping used aspects.
    for (const t of templates) {
        if (queries.length >= 5) break;
        if (used.has(t.aspect) || uniqueAspects.has(t.aspect)) continue;
        used.add(t.aspect);
        queries.push({
            id: `q${queries.length + 1}`,
            text: t.make(topic),
            aspect: t.aspect,
            rationale: t.label,
            expansions: expansionsFor(t.label, topic),
            weight: 0.7,
        });
    }

    // Guarantee at least 3 sub-queries even for weird input.
    if (queries.length < 3) {
        const fallback: { aspect: Aspect; label: string; make: (t: string) => string }[] = [
            { aspect: "definition", label: "التعريف والمفهوم", make: (t) => `ما هو تعريف ${t}؟` },
            { aspect: "history", label: "التاريخ والتطور", make: (t) => `ما تاريخ تطور ${t}؟` },
            { aspect: "applications", label: "التطبيقات والاستخدامات", make: (t) => `ما هي التطبيقات العملية لـ ${t}؟` },
        ];
        for (const t of fallback) {
            if (queries.length >= 3) break;
            if (used.has(t.aspect)) continue;
            used.add(t.aspect);
            queries.push({
                id: `q${queries.length + 1}`,
                text: t.make(topic),
                aspect: t.aspect,
                rationale: t.label,
                expansions: expansionsFor(t.label, topic),
                weight: 0.6,
            });
        }
    }

    return queries.slice(0, 8);
}

function expansionsFor(label: string, topic: string): string[] {
    const variants = [`${topic}`, `${topic} بشكل عام`, `معلومات عن ${topic}`];
    return [topic, ...variants.filter((v) => v !== topic)].slice(0, 3);
}

/** Gemini-driven decomposition with local fallback. */
export async function decomposeQuestion(
    question: string,
    signal?: AbortSignal,
): Promise<SubQuery[]> {
    if (isLLMAvailable()) {
        const userPrompt = `سؤال المستخدم: ${question}

لغة السؤال تحدد لغة الأسئلة الفرعية. إن كان السؤال عربياً فاكتب الأسئلة الفرعية بالعربية.
حلّل السؤال وفكّكه إلى أسئلة فرعية وفق التعليمات.`;

        const raw = await requestJson<DecomposeResponse>({
            system: DECOMPOSITION_SYSTEM_PROMPT,
            contents: userPrompt,
            maxTokens: 1500,
            signal,
            temperature: 0.6,
        });

        if (raw) {
            const parsed = parseSubQueries(JSON.stringify(raw));
            if (parsed.length >= 3) return parsed;
        }
        console.log("[DeepSearch] Gemini decomposition failed; using fallback");
    }
    return fallbackSubQueries(question);
}

const REFINE_SYSTEM_PROMPT = `أنت خبير في صياغة استعلامات البحث. مهمتك إعادة صياغة سؤال بحثي
ليتركّز حصراً على جانب محدد من الموضوع، مع إضافة صيغ مترادفة جديدة.

أعد الناتج بصيغة JSON صرفة بالشكل:
{"text":"...","aspect":"...","rationale":"...","expansions":["..."],"weight":0.9}`;

/**
 * Round-2 re-targeting: rephrases a base sub-query to focus on a missing
 * aspect, including 2 new expansions. Falls back to the base query on failure.
 */
export async function refineQuery(
    baseQuery: SubQuery,
    missingAspect: Aspect,
    signal?: AbortSignal,
): Promise<SubQuery> {
    if (isLLMAvailable()) {
        const userPrompt = `السؤال الأساسي: ${baseQuery.text}
الجانب المطلوب التركيز عليه حصراً: ${missingAspect}

أعد صياغة السؤال ليركز حصراً على هذا الجانب، وأضف 2 إلى 3 صيغ مترادفة أو مشتقة جديدة بلغة السؤال.`;

        const raw = await requestJson<{
            text?: unknown;
            aspect?: unknown;
            rationale?: unknown;
            expansions?: unknown;
            weight?: unknown;
        }>({
            system: REFINE_SYSTEM_PROMPT,
            contents: userPrompt,
            maxTokens: 600,
            signal,
            temperature: 0.5,
        });

        if (raw && typeof raw.text === "string" && raw.text.trim().length >= 3) {
            const parsed = parseSubQueries(JSON.stringify(raw));
            if (parsed.length > 0) {
                return {
                    ...baseQuery,
                    ...parsed[0],
                    id: `${baseQuery.id}-deep`,
                    aspect: missingAspect,
                };
            }
        }
    }
    // Fallback: deterministic rephrase targeting the missing aspect.
    return {
        ...baseQuery,
        id: `${baseQuery.id}-deep`,
        aspect: missingAspect,
        text: `${baseQuery.text} — ${aspectLabel(missingAspect)}`,
        rationale: `إعادة تركيز على: ${aspectLabel(missingAspect)}`,
        expansions: [...baseQuery.expansions, aspectLabel(missingAspect)].slice(0, 4),
        weight: baseQuery.weight,
    };
}

const ASPECT_LABELS: Record<Aspect, string> = {
    definition: "التعريف والمفهوم",
    history: "التاريخ والتطور",
    types: "الأنواع والتصنيفات",
    mechanism: "آلية العمل",
    applications: "التطبيقات والاستخدامات",
    pros_cons: "المزايا والعيوب",
    statistics: "الإحصائيات والأرقام",
    controversies: "الخلافات والجدل",
    recent_developments: "التطورات الحديثة",
    future_outlook: "المستقبل والتوقعات",
    comparisons: "المقارنات",
    expert_opinions: "آراء الخبراء",
};

export function aspectLabel(aspect: Aspect): string {
    return ASPECT_LABELS[aspect] ?? aspect;
}

export { ASPECTS };
