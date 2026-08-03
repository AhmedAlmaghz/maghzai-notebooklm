import { describe, it, expect } from "vitest";
import {
    parseSubQueries,
    fallbackSubQueries,
    decomposeQuestion,
    refineQuery,
    aspectLabel,
} from "@/lib/search/queries";
import { ASPECTS, isAspect } from "@/lib/search/types";
import type { SubQuery } from "@/lib/search/types";

describe("parseSubQueries", () => {
    it("parses a valid JSON payload", () => {
        const raw = JSON.stringify({
            subQueries: [
                { text: "ما هو تعريف الذكاء الاصطناعي؟", aspect: "definition", rationale: "التعريف", expansions: ["الذكاء الاصطناعي"], weight: 0.9 },
                { text: "ما تاريخ تطور الذكاء الاصطناعي؟", aspect: "history", rationale: "التاريخ", expansions: ["تاريخ الذكاء الاصطناعي"], weight: 0.8 },
            ],
        });
        const out = parseSubQueries(raw);
        expect(out).toHaveLength(2);
        expect(out[0]).toMatchObject({ id: "q1", aspect: "definition", weight: 0.9 });
        expect(out[1].id).toBe("q2");
    });

    it("strips markdown code fences", () => {
        const fenced = "```json\n" + JSON.stringify({ subQueries: [{ text: "ما هو التعلم العميق؟", aspect: "mechanism", weight: 0.7 }] }) + "\n```";
        expect(parseSubQueries(fenced)).toHaveLength(1);
    });

    it("rejects invalid aspects and short texts", () => {
        const raw = JSON.stringify({
            subQueries: [
                { text: "سؤال صالح", aspect: "definition" },
                { text: "ab", aspect: "history" },
                { text: "جانب غير صالح", aspect: "bogus" },
            ],
        });
        const out = parseSubQueries(raw);
        expect(out).toHaveLength(1);
        expect(out[0].aspect).toBe("definition");
    });

    it("dedupes repeated aspects", () => {
        const raw = JSON.stringify({
            subQueries: [
                { text: "أول سؤال", aspect: "definition" },
                { text: "سؤال مكرر", aspect: "definition" },
            ],
        });
        expect(parseSubQueries(raw)).toHaveLength(1);
    });

    it("clamps weights into [0.1, 1]", () => {
        const raw = JSON.stringify({
            subQueries: [
                { text: "سؤال أ", aspect: "types", weight: 5 },
                { text: "سؤال ب", aspect: "history", weight: 0 },
            ],
        });
        const out = parseSubQueries(raw);
        expect(out[0].weight).toBe(1);
        expect(out[1].weight).toBe(0.1);
    });

    it("returns [] for non-object / malformed input", () => {
        expect(parseSubQueries("not json")).toEqual([]);
        expect(parseSubQueries("")).toEqual([]);
        expect(parseSubQueries(JSON.stringify({})).length).toBe(0);
    });
});

describe("fallbackSubQueries", () => {
    it("always returns 3..8 sub-queries with valid aspects", () => {
        for (const q of ["ما هو الذكاء الاصطناعي؟", "x", "اشرح نظرية النسبية وتطبيقاتها ومستقبلها"]) {
            const out = fallbackSubQueries(q);
            expect(out.length).toBeGreaterThanOrEqual(3);
            expect(out.length).toBeLessThanOrEqual(8);
            for (const sq of out) {
                expect(isAspect(sq.aspect)).toBe(true);
                expect(sq.text.length).toBeGreaterThan(0);
                expect(sq.id).toMatch(/^q\d+$/);
            }
        }
    });

    it("matches keyword aspects (تاريخ => history)", () => {
        const out = fallbackSubQueries("ما تاريخ تطور الحوسبة؟");
        expect(out.some((sq) => sq.aspect === "history")).toBe(true);
    });

    it("keeps aspects distinct within a single decomposition", () => {
        const out = fallbackSubQueries("ما هو الذكاء الاصطناعي؟");
        const aspects = new Set(out.map((sq) => sq.aspect));
        expect(aspects.size).toBe(out.length);
    });

    it("assigns weights within [0,1]", () => {
        for (const sq of fallbackSubQueries("ما هو التعلم الآلي؟")) {
            expect(sq.weight).toBeGreaterThanOrEqual(0);
            expect(sq.weight).toBeLessThanOrEqual(1);
        }
    });
});

describe("aspectLabel", () => {
    it("maps every aspect to a non-empty label", () => {
        for (const a of ASPECTS) {
            expect(aspectLabel(a).length).toBeGreaterThan(0);
        }
    });

    it("falls back to the raw aspect for unknown values", () => {
        expect(aspectLabel("bogus" as never)).toBe("bogus");
    });
});

describe("decomposeQuestion (no LLM key => deterministic fallback)", () => {
    it("returns valid sub-queries without network access", async () => {
        const out = await decomposeQuestion("ما هو الذكاء الاصطناعي؟");
        expect(out.length).toBeGreaterThanOrEqual(3);
        for (const sq of out) {
            expect(isAspect(sq.aspect)).toBe(true);
            expect(typeof sq.text).toBe("string");
        }
    });
});

describe("refineQuery (no LLM key => deterministic rephrase)", () => {
    it("returns a deep variant focused on the missing aspect", async () => {
        const base: SubQuery = {
            id: "q1",
            text: "ما هو الذكاء الاصطناعي؟",
            aspect: "definition",
            rationale: "التعريف",
            expansions: ["الذكاء الاصطناعي"],
            weight: 0.9,
        };
        const out = await refineQuery(base, "statistics");
        expect(out.id).toBe("q1-deep");
        expect(out.aspect).toBe("statistics");
        expect(out.text).toContain(base.text);
        expect(out.expansions.length).toBeGreaterThanOrEqual(1);
        expect(out.weight).toBe(base.weight);
    });
});
