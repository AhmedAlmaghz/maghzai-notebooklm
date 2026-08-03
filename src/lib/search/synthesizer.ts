import { callGemini } from "@/lib/ai";
import { splitMarkdownAndJson } from "@/lib/search/gemini";
import { extractKeySentences, topKeywords } from "@/lib/text/summarize";
import type { FollowUpSuggestion } from "@/lib/ai";
import {
    ASPECTS,
    isAspect,
    type Aspect,
    type DeepCitation,
    type EvidenceItem,
    type ResearchCorpus,
    type SubQuery,
} from "@/lib/search/types";

/**
 * Multi-aspect synthesis: turns the merged research corpus into a single
 * markdown answer with a JSON metadata footer (citations / follow-ups / gaps).
 * Falls back to a purely extractive local answer when Gemini is unavailable.
 */

// Re-export so the spec §6.4 signature is satisfied from this module too.
export { splitMarkdownAndJson };

/** Map of evidence id -> evidence item used to reject hallucinated citations. */
export type EvidenceMap = Map<number, EvidenceItem>;

export type SynthesisResult = {
    markdown: string; // full answer body
    citations: DeepCitation[];
    followUps: FollowUpSuggestion[]; // reuse type from ai.ts
    gaps: Aspect[]; // aspects with no evidence
    usedAI: boolean;
};

/** Arabic-first academic synthesis system prompt (spec §6.2). */
export const SYNTHESIS_SYSTEM_PROMPT = `أنت باحث أكاديمي متخصص في التوليف والتركيب العلمي (Synthesis). مهمتك بناء إجابة شاملة وعميقة
تجمع بين المصادر المحلية للمستخدم ومعلومات الويب الموثوقة، وتغطي الموضوع من جميع جوانبه.

## بنية الإجابة (Markdown بالعربية ما لم يكن السؤال بلغة أخرى):

# ملخص تنفيذي
فقرة أو فقرتان تلخصان الموضوع بأكمله بأهم النتائج.

## 📖 التعريف والمفهوم
شرح دقيق للمفهوم مع أمثلة.

## 📜 التاريخ والتطور
أهم المحطات الزمنية والتطورات.

## 🗂️ الأنواع والتصنيفات
تصنيفات واضحة مع مقارنات موجزة. (إن وُجدت أدلة)

## ⚙️ آلية العمل
كيف يعمل الموضوع/النظام خطوة بخطوة. (إن وُجدت أدلة)

## 🛠️ التطبيقات والاستخدامات
تطبيقات عملية وأمثلة واقعية.

## ⚖️ المزايا والعيوب
جدول أو نقاط متوازنة لكل من المزايا والتحديات.

## 📊 إحصائيات وأرقام مهمة
أرقام محددة مع مصدرها. (فقط إن وُجدت في الأدلة — لا تخترع أرقاماً)

## 🧭 التحليل النقدي
وجهات النظر المتضاربة، مدى موثوقية المصادر، والفجوات المعرفية.

## 🔮 التطورات الحديثة والتوقعات المستقبلية
آخر المستجدات والاتجاهات المتوقعة.

## ❓ ثغرات واقتراحات للتعمق
ما لم تجده في الأدلة، وما يمكن للمستخدم البحث فيه أكثر.

## 💡 خلاصة
أهم 3-5 نقاط للاحتفاظ بها.

## قواعد الاستشهاد:
1. كل معلومة تُنسب إلى رقم المصدر بين قوسين مربعين مثل [1] أو [2].
2. استشهد بالأرقام المطابقة لقائمة الأدلة المقدمة لك حصراً.
3. إن كان السؤال عن رأي أو إحصائية فلا تذكر معلومة دون سند من الأدلة.
4. إن لم تجد أدلة لجانب معين، اكتب في قسمه: "لم تتوفر أدلة كافية في المصادر الحالية"
   وأضف الجانب إلى قسم الثغرات.

## اللغة:
أجب بلغة سؤال المستخدم. استخدم أسلوباً أكاديمياً واضحاً مع Markdown منسق وعناوين فرعية.

## في نهاية الإجابة تماماً، أضف كتلة JSON فقط بالشكل التالي (بدون أي نص بعدها):

{"citations":[{"id":1,"sourceTitle":"...","snippet":"..."}],
 "followUps":[{"text":"...","type":"expand"}],
 "gaps":["statistics"]}

يجب أن تكون الـ JSON صالحة تماماً ولا تحتوي على تعليقات.`;

/** Arabic section headers used by the extractive fallback. */
const ASPECT_HEADERS: Record<Aspect, string> = {
    definition: "📖 التعريف والمفهوم",
    history: "📜 التاريخ والتطور",
    types: "🗂️ الأنواع والتصنيفات",
    mechanism: "⚙️ آلية العمل",
    applications: "🛠️ التطبيقات والاستخدامات",
    pros_cons: "⚖️ المزايا والعيوب",
    statistics: "📊 إحصائيات وأرقام مهمة",
    controversies: "🧭 التحليل النقدي",
    recent_developments: "🔮 التطورات الحديثة",
    future_outlook: "🔮 التوقعات المستقبلية",
    comparisons: "⚖️ المقارنات",
    expert_opinions: "🧑‍⚖️ آراء الخبراء",
};

/**
 * Flattens the corpus into a numbered evidence list (local first, then web)
 * exactly as it will be presented to the model, and builds the id -> item map
 * used to reject hallucinated citations.
 */
export function buildEvidenceItems(
    corpus: ResearchCorpus,
): { items: EvidenceItem[]; map: EvidenceMap } {
    const items: EvidenceItem[] = [];
    let nextId = 1;

    for (const group of corpus.aspects) {
        for (const chunk of group.local) {
            items.push({
                id: nextId++,
                kind: "local",
                sourceId: chunk.sourceId,
                sourceTitle: chunk.sourceTitle,
                content: chunk.content,
                aspect: group.aspect,
            });
        }
    }
    for (const group of corpus.aspects) {
        for (const web of group.web) {
            items.push({
                id: nextId++,
                kind: "web",
                sourceTitle: web.title || web.uri || "مصدر ويب",
                content: web.snippet,
                aspect: group.aspect,
                uri: web.uri,
            });
        }
    }

    return { items, map: new Map(items.map((i) => [i.id, i])) };
}

/** Assembles the user prompt exactly per spec §6.2. */
export function buildSynthesisPrompt(
    question: string,
    subQueries: SubQuery[],
    items: EvidenceItem[],
): string {
    const lines: string[] = [];
    lines.push(`سؤال المستخدم: ${question}`);
    lines.push("");
    lines.push("أبعاد البحث المخططة:");
    for (const sq of subQueries) {
        lines.push(`- ${sq.aspect}: ${sq.text}`);
    }
    lines.push("");
    lines.push("الأدلة المحلية (من مصادر المستخدم):");
    for (const item of items) {
        if (item.kind !== "local") continue;
        lines.push(`[${item.id}] المصدر: ${item.sourceTitle}`);
        lines.push(item.content);
        lines.push("");
    }
    lines.push("الأدلة من الويب:");
    for (const item of items) {
        if (item.kind !== "web") continue;
        lines.push(`[${item.id}] ${item.sourceTitle} — ${item.uri ?? ""}`);
        lines.push(item.content);
        lines.push("");
    }
    lines.push("راجع كل قسم في بنية الإجابة أعلاه، واستشهد بالأدلة المناسبة، ثم أضف كتلة JSON في النهاية.");
    return lines.join("\n");
}

/**
 * Validates the JSON footer of the synthesis response. Any invalid entry is
 * dropped, and citations are intersected with the evidence map so a
 * hallucinated id is never emitted.
 */
export function parseSynthesisJson(
    raw: unknown,
    evidenceMap: EvidenceMap,
): Partial<SynthesisResult> {
    const result: Partial<SynthesisResult> = {};
    if (!raw || typeof raw !== "object") return result;
    const obj = raw as Record<string, unknown>;

    if (Array.isArray(obj.citations)) {
        const citations: DeepCitation[] = [];
        for (const entry of obj.citations) {
            if (!entry || typeof entry !== "object") continue;
            const e = entry as Record<string, unknown>;
            const id = typeof e.id === "number" ? e.id : Number(e.id);
            if (!Number.isFinite(id)) continue;
            const evidence = evidenceMap.get(id);
            if (!evidence) continue; // hallucinated id — drop

            citations.push({
                id,
                kind: evidence.kind,
                sourceId: evidence.sourceId,
                sourceTitle:
                    typeof e.sourceTitle === "string" && e.sourceTitle.trim().length > 0
                        ? e.sourceTitle
                        : evidence.sourceTitle,
                snippet:
                    typeof e.snippet === "string" && e.snippet.trim().length > 0
                        ? e.snippet
                        : evidence.content,
                uri: evidence.uri,
            });
        }
        // Dedupe by id, preserving order.
        const seen = new Set<number>();
        result.citations = citations.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });
    }

    if (Array.isArray(obj.followUps)) {
        const followUps: FollowUpSuggestion[] = [];
        for (const entry of obj.followUps) {
            if (!entry || typeof entry !== "object") continue;
            const e = entry as Record<string, unknown>;
            const text = typeof e.text === "string" ? e.text.trim() : "";
            if (!text) continue;
            const type =
                e.type === "expand" || e.type === "related" || e.type === "example" || e.type === "deeper"
                    ? e.type
                    : "related";
            followUps.push({ text, type });
        }
        result.followUps = followUps.slice(0, 5);
    }

    if (Array.isArray(obj.gaps)) {
        const gaps: Aspect[] = [];
        for (const g of obj.gaps) {
            if (isAspect(g)) gaps.push(g);
        }
        result.gaps = [...new Set(gaps)];
    }

    return result;
}

/** Local extractive fallback: key sentences per aspect under headers. */
export function buildExtractiveFallback(
    corpus: ResearchCorpus,
): SynthesisResult {
    const sections: string[] = [];
    const citations: DeepCitation[] = [];
    const gaps: Aspect[] = [];
    let nextId = 1;

    for (const group of corpus.aspects) {
        const local = group.local;
        if (local.length === 0) {
            gaps.push(group.aspect);
            continue;
        }
        const header = ASPECT_HEADERS[group.aspect] ?? group.aspect;
        sections.push(`## ${header}`);
        const usedChunks = local.slice(0, 2);
        const paragraph: string[] = [];
        for (const chunk of usedChunks) {
            const id = nextId++;
            citations.push({
                id,
                kind: "local",
                sourceId: chunk.sourceId,
                sourceTitle: chunk.sourceTitle,
                snippet: chunk.content.slice(0, 200),
            });
            const sentences = extractKeySentences(chunk.content, 3);
            for (const s of sentences) paragraph.push(`${s} [${id}]`);
        }
        if (paragraph.length > 0) {
            sections.push(paragraph.join(" "));
            sections.push("");
        } else {
            gaps.push(group.aspect);
        }
    }

    // Follow-up suggestions generated from the top keywords of the corpus.
    const corpusText = corpus.aspects
        .flatMap((g) => [...g.local.map((c) => c.content), ...g.web.map((w) => w.snippet)])
        .join(" ");
    const followUps: FollowUpSuggestion[] = topKeywords(corpusText, 9)
        .slice(0, 3)
        .map((kw) => ({ text: kw, type: "deeper" as const }));

    const markdown =
        sections.length > 0
            ? sections.join("\n").trim()
            : "لم تتوفر أدلة كافية في المصادر الحالية.";

    return { markdown, citations, followUps, gaps, usedAI: false };
}

/**
 * Runs the single-call synthesis: markdown answer + JSON metadata footer.
 * Returns the extractive fallback whenever Gemini is unavailable or the
 * response cannot be parsed.
 */
export async function synthesizeDeepAnswer(
    question: string,
    corpus: ResearchCorpus,
    subQueries: SubQuery[],
    signal?: AbortSignal,
): Promise<SynthesisResult> {
    const { items, map } = buildEvidenceItems(corpus);
    const userPrompt = buildSynthesisPrompt(question, subQueries, items);

    const raw = await callGemini(
        [{ role: "user", parts: [{ text: userPrompt }] }],
        SYNTHESIS_SYSTEM_PROMPT,
        8000,
        undefined,
        { signal, temperature: 0.7 },
    );

    if (raw && raw.trim().length > 0) {
        const { markdown, json } = splitMarkdownAndJson(raw);
        if (markdown.trim().length > 0) {
            const parsed = parseSynthesisJson(json, map);
            return {
                markdown: markdown.trim(),
                citations: parsed.citations ?? [],
                followUps: parsed.followUps ?? [],
                gaps: parsed.gaps ?? [],
                usedAI: true,
            };
        }
    }

    return buildExtractiveFallback(corpus);
}
