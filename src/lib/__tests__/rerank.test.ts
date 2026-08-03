import { describe, it, expect } from "vitest";
import {
    charNgrams,
    ngramMultiset,
    ngramSet,
    diceCoefficient,
    sorensenDice,
    tokenizeLight,
    jaccardTokens,
    idf,
    weightedTokenOverlap,
    tokenOverlapWithIdf,
    normalize,
    normalizeScores,
    hybridFuse,
    scoreHybrid,
    rrfFuse,
    normalizeRrf,
    mmrSelect,
} from "@/lib/search/rerank";
import type { RetrievedChunk } from "@/lib/search";

describe("charNgrams", () => {
    it("produces overlapping n-grams", () => {
        expect(charNgrams("abc", 2)).toEqual(["ab", "bc"]);
    });

    it("returns the whole string when shorter than n", () => {
        expect(charNgrams("a", 2)).toEqual(["a"]);
    });

    it("handles empty input", () => {
        expect(charNgrams("", 2)).toEqual([]);
    });
});

describe("ngramMultiset / ngramSet", () => {
    it("counts repeated grams", () => {
        const map = ngramMultiset("abab", 2);
        expect(map.get("ab")).toBe(2);
        expect(map.get("ba")).toBe(1);
    });

    it("ngramSet returns unique grams", () => {
        expect([...ngramSet("abab", 2)].sort()).toEqual(["ab", "ba"]);
    });
});

describe("diceCoefficient", () => {
    it("returns 1 for identical strings", () => {
        expect(diceCoefficient("الذكاء الاصطناعي", "الذكاء الاصطناعي")).toBe(1);
    });

    it("returns 0 for empty inputs", () => {
        expect(diceCoefficient("", "x")).toBe(0);
        expect(diceCoefficient("", "")).toBe(0);
    });

    it("is > 0 for Arabic affix variants (كتاب / الكتب)", () => {
        const d = diceCoefficient("كتاب", "الكتب");
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThan(1);
    });

    it("is symmetric", () => {
        const d1 = diceCoefficient("الذكاء الاصطناعي", "تعلم الآلة");
        expect(diceCoefficient("تعلم الآلة", "الذكاء الاصطناعي")).toBe(d1);
    });

    it("sorensenDice is an alias", () => {
        expect(sorensenDice("أ", "ب")).toBe(diceCoefficient("أ", "ب"));
    });
});

describe("tokenizeLight", () => {
    it("filters Arabic stopwords", () => {
        expect(tokenizeLight("ما هو تعريف الذكاء الاصطناعي")).toContain("الذكاء");
        expect(tokenizeLight("ما هو تعريف الذكاء الاصطناعي")).not.toContain("ما");
        expect(tokenizeLight("ما هو تعريف الذكاء الاصطناعي")).not.toContain("هو");
    });

    it("filters English stopwords and normalizes case", () => {
        expect(tokenizeLight("The Quick Fox and the lazy dog")).toContain("fox");
        expect(tokenizeLight("The Quick Fox and the lazy dog")).not.toContain("the");
        expect(tokenizeLight("The Quick Fox and the lazy dog")).not.toContain("and");
    });
});

describe("jaccardTokens", () => {
    it("computes set overlap", () => {
        expect(jaccardTokens("كتاب الكتب", "كتاب")).toBeCloseTo(0.5);
    });

    it("returns 0 when either side tokenizes empty", () => {
        expect(jaccardTokens("", "كتاب")).toBe(0);
    });
});

describe("idf / weightedTokenOverlap", () => {
    it("gives rare tokens more weight", () => {
        const corpus = [["كتاب"], ["كتاب"], ["قلم"]];
        const weights = idf(["كتاب", "قلم"], corpus);
        expect(weights.get("قلم") ?? 0).toBeGreaterThan(weights.get("كتاب") ?? 0);
    });

    it("weightedTokenOverlap is 1 when all query tokens hit", () => {
        const idfs = new Map<string, number>([
            ["كتاب", 1.5],
            ["علم", 2],
        ]);
        expect(weightedTokenOverlap(["كتاب", "علم"], ["كتاب", "علم"], idfs)).toBe(1);
    });

    it("tokenOverlapWithIdf without corpus defaults to idf 1", () => {
        expect(tokenOverlapWithIdf("كتاب", "كتاب")).toBe(1);
    });
});

describe("normalize / normalizeScores", () => {
    it("min-maxes a single value list to 0", () => {
        expect(normalize(3, [3, 3, 3])).toBe(0);
    });

    it("normalizeScores maps distinct values to 0..1", () => {
        expect(normalizeScores([10, 20])).toEqual([0, 1]);
    });

    it("normalizeScores handles all-equal to 1", () => {
        expect(normalizeScores([5, 5, 5])).toEqual([1, 1, 1]);
    });
});

describe("hybridFuse / scoreHybrid", () => {
    it("uses default weights with fts only", () => {
        const s = hybridFuse("أ", "ب", { ftsRank: 1 });
        expect(s.fts).toBe(1);
        expect(s.fused).toBeCloseTo(0.5); // 0.5*1 + 0.3*0 + 0.2*0
    });

    it("accepts custom weights", () => {
        const s = hybridFuse("أ", "ب", { ftsRank: 1, weights: { fts: 1, ngram: 0, token: 0 } });
        expect(s.fused).toBe(1);
    });

    it("scoreHybrid without fts uses ngram + token only", () => {
        const s = scoreHybrid("كتاب", "كتاب", {});
        expect(s.ngram).toBe(1);
        expect(s.fused).toBeCloseTo(0.5); // 0.3 + 0.2
    });
});

describe("rrfFuse / normalizeRrf", () => {
    it("scores shared ids higher", () => {
        const scores = rrfFuse([
            ["a", "b", "c"],
            ["b", "a", "d"],
        ]);
        expect(scores.get("a")).toBeGreaterThan(scores.get("c") ?? 0);
        expect(scores.get("b")).toBeGreaterThan(scores.get("d") ?? 0);
    });

    it("normalizeRrf maps max to 1", () => {
        const norm = normalizeRrf(
            new Map([
                ["a", 0.05],
                ["b", 0.1],
            ]),
        );
        expect(norm.get("a")).toBeCloseTo(0.5);
        expect(norm.get("b")).toBe(1);
    });
});

describe("mmrSelect", () => {
    const chunks: RetrievedChunk[] = [
        { chunkId: "c1", sourceId: "s1", sourceTitle: "S1", content: "الذكاء الاصطناعي تعلم الآلة", rank: 1 },
        { chunkId: "c2", sourceId: "s1", sourceTitle: "S1", content: "شبكات عصبية عميقة", rank: 0.9 },
        { chunkId: "c3", sourceId: "s1", sourceTitle: "S1", content: "معالجة اللغة الطبيعية", rank: 0.8 },
        { chunkId: "c4", sourceId: "s2", sourceTitle: "S2", content: "روبوتات مستقلة", rank: 0.7 },
        { chunkId: "c5", sourceId: "s2", sourceTitle: "S2", content: "رؤية حاسوبية", rank: 0.6 },
        { chunkId: "c6", sourceId: "s3", sourceTitle: "S3", content: "أخلاقيات الذكاء الاصطناعي", rank: 0.5 },
    ];

    it("returns empty for empty input", () => {
        expect(mmrSelect([], { k: 5 })).toEqual([]);
    });

    it("respects the k cap", () => {
        expect(mmrSelect(chunks, { k: 3, lambda: 1 })).toHaveLength(3);
    });

    it("respects maxPerSource", () => {
        const selected = mmrSelect(chunks, { k: 6, lambda: 1, maxPerSource: 2 });
        const counts = new Map<string, number>();
        for (const c of selected) counts.set(c.sourceId, (counts.get(c.sourceId) ?? 0) + 1);
        for (const n of counts.values()) expect(n).toBeLessThanOrEqual(2);
    });
});
