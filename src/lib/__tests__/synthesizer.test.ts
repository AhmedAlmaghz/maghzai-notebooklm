import { describe, it, expect, vi, beforeEach } from "vitest";
import { callGemini } from "@/lib/ai";
import {
  buildEvidenceItems,
  buildSynthesisPrompt,
  parseSynthesisJson,
  buildExtractiveFallback,
  synthesizeDeepAnswer,
  splitMarkdownAndJson,
  SYNTHESIS_SYSTEM_PROMPT,
} from "@/lib/search/synthesizer";
import type { ResearchCorpus, SubQuery } from "@/lib/search/types";

vi.mock("@/lib/ai", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...mod,
    callGemini: vi.fn(),
  };
});

const subQueries: SubQuery[] = [
  {
    id: "q1",
    text: "ما هو الذكاء الاصطناعي؟",
    aspect: "definition",
    rationale: "التعريف",
    expansions: ["الذكاء الاصطناعي"],
    weight: 0.9,
  },
  {
    id: "q2",
    text: "ما تاريخ تطور الذكاء الاصطناعي؟",
    aspect: "history",
    rationale: "التاريخ",
    expansions: ["تاريخ الذكاء الاصطناعي"],
    weight: 0.8,
  },
];

function makeCorpus(): ResearchCorpus {
  return {
    aspects: [
      {
        aspect: "definition",
        local: [
          {
            chunkId: "c1",
            sourceId: "s1",
            sourceTitle: "مصدر التعريف",
            content:
              "الذكاء الاصطناعي هو فرع من علوم الحاسوب يهتم ببناء أنظمة تحاكي القدرات المعرفية البشرية. يشمل تعلم الآلة ومعالجة اللغة الطبيعية والرؤية الحاسوبية.",
            subQueryIds: ["q1"],
            aspects: ["definition"],
            bestScore: 0.9,
          },
        ],
        web: [
          {
            title: "مقال الويب عن الذكاء الاصطناعي",
            uri: "https://example.com/ai",
            snippet: "يُعرَّف الذكاء الاصطناعي بأنه محاكاة الذكاء البشري في الآلات.",
            aspect: "definition",
          },
        ],
      },
      {
        aspect: "history",
        local: [
          {
            chunkId: "c2",
            sourceId: "s2",
            sourceTitle: "مصدر التاريخ",
            content:
              "بدأت أبحاث الذكاء الاصطناعي في مؤتمر دارتموث عام 1956. شهد المجال فترات ازدهار وخمود عبر العقود.",
            subQueryIds: ["q2"],
            aspects: ["history"],
            bestScore: 0.8,
          },
        ],
        web: [],
      },
    ],
    localTotal: 2,
    webTotal: 1,
    totalChars: 320,
  };
}

describe("buildEvidenceItems", () => {
  it("numbers evidence local-first then web", () => {
    const { items } = buildEvidenceItems(makeCorpus());
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(items[0].kind).toBe("local");
    expect(items[1].kind).toBe("local");
    expect(items[2].kind).toBe("web");
    expect(items[2].uri).toBe("https://example.com/ai");
  });

  it("builds a complete id -> item map", () => {
    const { items, map } = buildEvidenceItems(makeCorpus());
    for (const item of items) {
      expect(map.get(item.id)).toBe(item);
    }
  });
});

describe("buildSynthesisPrompt", () => {
  it("includes the question, aspects, and evidence with [id] markers", () => {
    const corpus = makeCorpus();
    const { items } = buildEvidenceItems(corpus);
    const prompt = buildSynthesisPrompt("ما هو الذكاء الاصطناعي؟", subQueries, items);
    expect(prompt).toContain("ما هو الذكاء الاصطناعي؟");
    expect(prompt).toContain("definition: ما هو الذكاء الاصطناعي؟");
    expect(prompt).toContain("[1]");
    expect(prompt).toContain("[3]");
    expect(prompt).toContain("مصدر التعريف");
    expect(prompt).toContain("https://example.com/ai");
  });
});

describe("parseSynthesisJson", () => {
  it("keeps only citations whose ids exist in the evidence map", () => {
    const { map } = buildEvidenceItems(makeCorpus());
    const parsed = parseSynthesisJson(
      {
        citations: [
          { id: 1, sourceTitle: "تعريف", snippet: "نص" },
          { id: 99, sourceTitle: "هلوسة", snippet: "لا وجود لها" },
        ],
        followUps: [
          { text: "تعمق أكثر", type: "expand" },
          { text: "مثال", type: "bogus" },
        ],
        gaps: ["statistics", "statistics", "bogus"],
      },
      map,
    );
    expect(parsed.citations).toHaveLength(1);
    expect(parsed.citations?.[0].id).toBe(1);
    expect(parsed.citations?.[0].kind).toBe("local");
    expect(parsed.followUps).toEqual([
      { text: "تعمق أكثر", type: "expand" },
      { text: "مثال", type: "related" },
    ]);
    expect(parsed.gaps).toEqual(["statistics"]);
  });

  it("caps follow-ups at 5", () => {
    const { map } = buildEvidenceItems(makeCorpus());
    const parsed = parseSynthesisJson(
      {
        followUps: Array.from({ length: 8 }, (_, i) => ({ text: `سؤال ${i}`, type: "related" })),
      },
      map,
    );
    expect(parsed.followUps).toHaveLength(5);
  });

  it("returns an empty result for non-object input", () => {
    const { map } = buildEvidenceItems(makeCorpus());
    expect(parseSynthesisJson(null, map)).toEqual({});
    expect(parseSynthesisJson("x", map)).toEqual({});
  });
});

describe("buildExtractiveFallback", () => {
  it("produces markdown, local citations, gaps and follow-ups without AI", () => {
    const corpus = makeCorpus();
    const fallback = buildExtractiveFallback(corpus);
    expect(fallback.usedAI).toBe(false);
    expect(fallback.markdown).toContain("📖 التعريف والمفهوم");
    expect(fallback.markdown).toContain("📜 التاريخ والتطور");
    expect(fallback.citations.length).toBeGreaterThan(0);
    for (const c of fallback.citations) {
      expect(c.kind).toBe("local");
      expect(c.snippet.length).toBeGreaterThan(0);
    }
    expect(fallback.gaps).toEqual([]);
  });

  it("flags empty aspects as gaps", () => {
    const corpus = makeCorpus();
    corpus.aspects.push({ aspect: "statistics", local: [], web: [] });
    const fallback = buildExtractiveFallback(corpus);
    expect(fallback.gaps).toContain("statistics");
  });
});

describe("synthesizeDeepAnswer", () => {
  beforeEach(() => {
    vi.mocked(callGemini).mockReset();
  });

  it("parses the AI markdown + JSON footer into a SynthesisResult", async () => {
    vi.mocked(callGemini).mockResolvedValue(
      "# ملخص\n\nإجابة شاملة [1].\n\n```json\n{" +
        JSON.stringify({
          citations: [{ id: 1, sourceTitle: "مصدر التعريف", snippet: "الذكاء الاصطناعي هو فرع..." }],
          followUps: [{ text: "تعمق في التاريخ", type: "deeper" }],
          gaps: [],
        }) +
        "}\n```",
    );
    const result = await synthesizeDeepAnswer("ما هو الذكاء الاصطناعي؟", makeCorpus(), subQueries);
    expect(result.usedAI).toBe(true);
    expect(result.markdown).toContain("إجابة شاملة");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].id).toBe(1);
    expect(result.citations[0].kind).toBe("local");
    expect(result.followUps[0].type).toBe("deeper");
  });

  it("falls back to extractive synthesis when Gemini returns nothing", async () => {
    vi.mocked(callGemini).mockResolvedValue("");
    const result = await synthesizeDeepAnswer("ما هو الذكاء الاصطناعي؟", makeCorpus(), subQueries);
    expect(result.usedAI).toBe(false);
    expect(result.markdown).toContain("📖 التعريف والمفهوم");
  });

  it("falls back when the AI output has no parseable JSON", async () => {
    vi.mocked(callGemini).mockResolvedValue("# فقط نص بلا JSON");
    const result = await synthesizeDeepAnswer("ما هو الذكاء الاصطناعي؟", makeCorpus(), subQueries);
    expect(result.usedAI).toBe(false);
  });
});

describe("splitMarkdownAndJson", () => {
  it("splits a fenced JSON block from the tail", () => {
    const { markdown, json } = splitMarkdownAndJson(
      "## ملخص\n\nنص.\n```json\n{\"citations\":[]}\n```",
    );
    expect(markdown).toContain("## ملخص");
    expect(json).toEqual({ citations: [] });
  });

  it("parses a bare trailing JSON object", () => {
    const { markdown, json } = splitMarkdownAndJson("نص إجابة.\n\n{\"gaps\":[\"history\"]}");
    expect(markdown.trim()).toBe("نص إجابة.");
    expect(json).toEqual({ gaps: ["history"] });
  });

  it("returns raw text with null json when nothing parses", () => {
    const { markdown, json } = splitMarkdownAndJson("مجرد نص");
    expect(markdown).toBe("مجرد نص");
    expect(json).toBeNull();
  });
});

describe("SYNTHESIS_SYSTEM_PROMPT", () => {
  it("includes the citation and JSON footer rules", () => {
    expect(SYNTHESIS_SYSTEM_PROMPT).toContain("ملخص تنفيذي");
    expect(SYNTHESIS_SYSTEM_PROMPT).toContain("[1]");
    expect(SYNTHESIS_SYSTEM_PROMPT).toContain('"citations"');
    expect(SYNTHESIS_SYSTEM_PROMPT).toContain("الثغرات");
  });
});
