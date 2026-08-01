/**
 * Advanced Text Analysis Service
 * Provides spell checking, suggestions, sentiment analysis, and entity extraction
 */

export interface TextAnalysisResult {
  spellingErrors: SpellingError[];
  suggestions: string[];
  sentiment: SentimentResult;
  entities: Entity[];
  readabilityScore: number;
}

export interface SpellingError {
  word: string;
  position: number;
  suggestions: string[];
  type: "spelling" | "grammar" | "style";
}

export interface SentimentResult {
  score: number; // -1 to 1
  label: "positive" | "negative" | "neutral";
  confidence: number;
}

export interface Entity {
  text: string;
  type: "person" | "organization" | "location" | "date" | "number" | "other";
  position: number;
}

/**
 * Simple spell checker using common Arabic/English mistakes
 */
export function checkSpelling(text: string): SpellingError[] {
  const errors: SpellingError[] = [];
  
  // Common Arabic spelling mistakes
  const arabicMistakes: Record<string, string[]> = {
    "منذ": ["منذ", "منذ"],
    "إلى": ["الى", "إلى"],
    "هذا": ["هذا", "هاذا"],
    "هذه": ["هذه", "هاذه"],
    "الذي": ["اللي", "الذي"],
    "التي": ["التي", "اللي"],
    "كان": ["كان", "كأن"],
    "في": ["في", "فى"],
    "على": ["على", "على"],
  };

  // Common English spelling mistakes
  const englishMistakes: Record<string, string[]> = {
    "the": ["teh", "hte"],
    "and": ["nad", "adn"],
    "is": ["si", "is"],
    "are": ["rae", "re"],
    "was": ["wsa", "saw"],
  };

  const words = text.split(/\s+/);
  let currentPosition = 0;

  for (const word of words) {
    const cleanWord = word.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
    
    if (cleanWord.length < 2) {
      currentPosition += word.length + 1;
      continue;
    }

    // Check Arabic mistakes
    if (/[\u0600-\u06FF]/.test(cleanWord)) {
      for (const [correct, mistakes] of Object.entries(arabicMistakes)) {
        if (mistakes.includes(cleanWord)) {
          errors.push({
            word: cleanWord,
            position: currentPosition,
            suggestions: [correct],
            type: "spelling",
          });
          break;
        }
      }
    } 
    // Check English mistakes
    else {
      for (const [correct, mistakes] of Object.entries(englishMistakes)) {
        if (mistakes.includes(cleanWord)) {
          errors.push({
            word: cleanWord,
            position: currentPosition,
            suggestions: [correct],
            type: "spelling",
          });
          break;
        }
      }
    }

    currentPosition += word.length + 1;
  }

  return errors;
}

/**
 * Generate writing suggestions
 */
export function generateSuggestions(text: string): string[] {
  const suggestions: string[] = [];
  const sentences = text.split(/[.!?؟]/).filter(s => s.trim());
  
  // Check for long sentences
  const longSentences = sentences.filter(s => s.trim().split(/\s+/).length > 30);
  if (longSentences.length > 0) {
    suggestions.push("بعض الجمل طويلة جداً. فكر في تقسيمها لجمل أقصر.");
  }

  // Check for repeated words
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }
  
  const repeatedWords = [...wordFreq.entries()]
    .filter(([_, count]) => count > 5)
    .map(([word]) => word);
  
  if (repeatedWords.length > 0) {
    suggestions.push(`الكلمات المتكررة: ${repeatedWords.slice(0, 3).join(", ")}. فكر في استخدام مرادفات.`);
  }

  // Check for passive voice (simple check)
  const passiveIndicators = ["تم", "كانت", "تمت", "يتم"];
  const hasPassiveVoice = passiveIndicators.some(indicator => text.includes(indicator));
  if (hasPassiveVoice) {
    suggestions.push("النص يحتوي على صيغ مجهولة. فكر في استخدام صيغ فعلية.");
  }

  // Check paragraph length
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const longParagraphs = paragraphs.filter(p => p.trim().split(/\s+/).length > 150);
  if (longParagraphs.length > 0) {
    suggestions.push("بعض الفقرات طويلة جداً. فكر في تقسيمها لفقرات أقصر.");
  }

  return suggestions;
}

/**
 * Simple sentiment analysis
 */
export function analyzeSentiment(text: string): SentimentResult {
  const positiveWords = [
    "ممتاز", "رائع", "جيد", "جميل", "سعيد", "positive", "great", "excellent", 
    "good", "beautiful", "happy", "love", "amazing", "wonderful"
  ];
  
  const negativeWords = [
    "سيء", "مشكلة", "خطأ", "محبط", "negative", "bad", "terrible", "error",
    "problem", "sad", "hate", "awful", "horrible", "wrong"
  ];

  const words = text.toLowerCase().split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
    if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
  }

  const total = positiveCount + negativeCount;
  const score = total === 0 ? 0 : (positiveCount - negativeCount) / total;
  const confidence = total === 0 ? 0 : Math.min(total / 10, 1);

  let label: SentimentResult["label"] = "neutral";
  if (score > 0.2) label = "positive";
  else if (score < -0.2) label = "negative";

  return { score, label, confidence };
}

/**
 * Extract named entities (simple pattern-based)
 */
export function extractEntities(text: string): Entity[] {
  const entities: Entity[] = [];

  // Email pattern
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: "organization",
      position: match.index,
    });
  }

  // Phone number pattern (Arabic/International)
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: "number",
      position: match.index,
    });
  }

  // Date pattern
  const dateRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
  while ((match = dateRegex.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: "date",
      position: match.index,
    });
  }

  // URL pattern
  const urlRegex = /https?:\/\/[\w.-]+\.\w+/g;
  while ((match = urlRegex.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: "organization",
      position: match.index,
    });
  }

  return entities;
}

/**
 * Calculate readability score (Flesch Reading Ease approximation)
 */
export function calculateReadability(text: string): number {
  const sentences = text.split(/[.!?؟]/).filter(s => s.trim());
  const words = text.split(/\s+/).filter(w => w.trim());
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch Reading Ease formula (simplified)
  const score = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Count syllables in a word (approximation)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  
  // Count vowel groups
  const vowels = word.match(/[aeiouأإيى]/g);
  return vowels ? vowels.length : 1;
}

/**
 * Perform complete text analysis
 */
export function analyzeText(text: string): TextAnalysisResult {
  return {
    spellingErrors: checkSpelling(text),
    suggestions: generateSuggestions(text),
    sentiment: analyzeSentiment(text),
    entities: extractEntities(text),
    readabilityScore: calculateReadability(text),
  };
}