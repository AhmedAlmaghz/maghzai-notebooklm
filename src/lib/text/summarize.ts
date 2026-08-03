/**
 * Lightweight, dependency-free extractive text analysis utilities.
 * Used as a high-quality local fallback whenever no LLM API key is configured,
 * so the product remains fully functional out of the box.
 */

export const ARABIC_STOPWORDS = new Set([
  "من", "الى", "إلى", "على", "في", "عن", "مع", "هذا", "هذه", "ذلك", "تلك",
  "التي", "الذي", "الذين", "و", "أو", "او", "ثم", "قد", "كان", "كانت", "يكون",
  "لم", "لن", "لا", "ما", "كل", "بعض", "غير", "بين", "حتى", "إذا", "اذا",
  "هو", "هي", "هم", "أن", "ان", "إن", "كما", "فى", "له", "لها", "لهم",
]);

export const ENGLISH_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "of", "to", "in", "on",
  "for", "with", "as", "by", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "at", "from", "into", "than",
  "such", "not", "no", "do", "does", "did", "has", "have", "had", "can", "will",
  "would", "should", "could", "may", "might", "we", "you", "they", "he", "she",
]);

export function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?؟])\s+(?=[A-Zأ-ي0-9])|(?<=[.!?؟])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !ARABIC_STOPWORDS.has(w) && !ENGLISH_STOPWORDS.has(w));
}

/** Scores sentences by word-frequency (a simplified TextRank/Luhn hybrid). */
export function extractKeySentences(text: string, count = 5): string[] {
  const sentences = splitSentences(text);
  if (sentences.length <= count) return sentences;

  const freq = new Map<string, number>();
  for (const sentence of sentences) {
    for (const word of tokenize(sentence)) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  const scored = sentences.map((sentence, index) => {
    const words = tokenize(sentence);
    const score = words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.sqrt(words.length + 1);
    // Slight bonus for earlier sentences (usually more topical) and reasonable length.
    const positionBonus = index < sentences.length * 0.3 ? 1.15 : 1;
    return { sentence, score: score * positionBonus, index };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, count);
  top.sort((a, b) => a.index - b.index);
  return top.map((s) => s.sentence);
}

export function topKeywords(text: string, count = 8): string[] {
  const freq = new Map<string, number>();
  for (const word of tokenize(text)) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([w]) => w);
}

export function scoreTextAgainstQuery(text: string, query: string): number {
  const textWords = tokenize(text);
  const queryWords = new Set(tokenize(query));
  if (queryWords.size === 0 || textWords.length === 0) return 0;
  let hits = 0;
  for (const w of textWords) if (queryWords.has(w)) hits++;
  return hits / Math.sqrt(textWords.length);
}
