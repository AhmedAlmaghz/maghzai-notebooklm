"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronRight, ChevronLeft, RotateCcw, Shuffle, Check, X, Eye, EyeOff, Sparkles, Award } from "lucide-react";

interface Flashcard {
  question: string;
  answer: string;
}

function parseFlashcards(content: string): Flashcard[] {
  const cards: Flashcard[] = [];

  // Parse cards with ---CARD--- format. Treat EOF as an implicit ---END---
  // so the last card is retained even if the closing delimiter is missing.
  const cardMatches = content.split(/---CARD---/i).slice(1);

  for (const cardContent of cardMatches) {
    const endIndex = cardContent.indexOf("---END---");
    const cardText = endIndex > -1 ? cardContent.slice(0, endIndex) : cardContent;

    const questionMatch = cardText.match(/\*\*السؤال:\*\*\s*([\s\S]*?)(?=\*\*الجواب:\*\*|$)/i);
    const answerMatch = cardText.match(/\*\*الجواب:\*\*\s*([\s\S]*?)$/i);

    if (questionMatch && answerMatch) {
      cards.push({
        question: questionMatch[1].trim(),
        answer: answerMatch[1].trim(),
      });
    }
  }

  // Fallback: try parsing Q/A format
  if (cards.length === 0) {
    const lines = content.split("\n");
    let currentQ = "";
    let currentA = "";
    
    for (const line of lines) {
      if (line.includes("السؤال:") || line.includes("س:") || line.match(/^\d+\./)) {
        if (currentQ && currentA) {
          cards.push({ question: currentQ, answer: currentA });
        }
        currentQ = line.replace(/.*?(السؤال:|س:|\d+\.)\s*/i, "").replace(/\*\*/g, "").trim();
        currentA = "";
      } else if (line.includes("الجواب:") || line.includes("ج:")) {
        currentA = line.replace(/.*?(الجواب:|ج:)\s*/i, "").replace(/\*\*/g, "").trim();
      } else if (currentA) {
        currentA += " " + line.trim();
      }
    }
    if (currentQ && currentA) {
      cards.push({ question: currentQ, answer: currentA });
    }
  }

  return cards;
}

export default function FlashcardsViewer({ content }: { content: string }) {
  const cards = useMemo(() => parseFlashcards(content), [content]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<number>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<number>>(new Set());
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const activeIndices = isShuffled && shuffledIndices.length > 0 ? shuffledIndices : cards.map((_, i) => i);
  const currentCardIndex = activeIndices[currentIndex];
  const currentCard = cards[currentCardIndex];

  // Keyboard navigation shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "1") {
        markAsUnknown();
      } else if (e.key === "2") {
        markAsKnown();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndices.length, currentCardIndex]);

  const handleNext = () => {
    setIsFlipped(false);
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % activeIndices.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + activeIndices.length) % activeIndices.length);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleShuffle = () => {
    const indices = [...cards.keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledIndices(indices);
    setIsShuffled(true);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards(new Set());
    setUnknownCards(new Set());
    setIsShuffled(false);
    setShuffledIndices([]);
  };

  const markAsKnown = () => {
    setKnownCards((prev) => new Set([...prev, currentCardIndex]));
    setUnknownCards((prev) => {
      const next = new Set(prev);
      next.delete(currentCardIndex);
      return next;
    });
    handleNext();
  };

  const markAsUnknown = () => {
    setUnknownCards((prev) => new Set([...prev, currentCardIndex]));
    setKnownCards((prev) => {
      const next = new Set(prev);
      next.delete(currentCardIndex);
      return next;
    });
    handleNext();
  };

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">لم يتم العثور على بطاقات تعليمية مقروءة في هذا المحتوى.</p>
      </div>
    );
  }

  const isCompleted = knownCards.size + unknownCards.size === cards.length && cards.length > 0;

  return (
    <div className="space-y-5 max-w-2xl mx-auto py-2">
      {/* Progress Bar & Badges */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>مستوى التقدم في الدراسة</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check size={14} /> أعرف ({knownCards.size})
            </span>
            <span className="flex items-center gap-1 text-rose-500">
              <X size={14} /> لا أعرف ({unknownCards.size})
            </span>
            <span className="text-slate-400">/ {cards.length}</span>
          </div>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="flex h-full transition-all duration-300">
            <div
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${(knownCards.size / cards.length) * 100}%` }}
            />
            <div
              className="bg-rose-400 transition-all duration-300"
              style={{ width: `${(unknownCards.size / cards.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Completion Banner */}
      {isCompleted && (
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white shadow-lg animate-fade-in">
          <Award size={28} />
          <div>
            <p className="text-sm font-bold">أحسنت! أتممت مراجعة كل البطاقات 🎉</p>
            <p className="text-xs text-emerald-100">درجة إتقانك: {Math.round((knownCards.size / cards.length) * 100)}%</p>
          </div>
        </div>
      )}

      {/* Toolbar Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleShuffle}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              isShuffled
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <Shuffle size={14} />
            خلط البطاقات
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
          >
            <RotateCcw size={14} />
            إعادة البدء
          </button>
        </div>

        <button
          onClick={() => setShowAnswer(!showAnswer)}
          className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
        >
          {showAnswer ? <EyeOff size={14} /> : <Eye size={14} />}
          {showAnswer ? "إخفاء الإجابة" : "إظهار الإجابة"}
        </button>
      </div>

      {/* 3D Flip Flashcard */}
      <div className="perspective-1000">
        <div
          onClick={handleFlip}
          className={`relative min-h-[300px] cursor-pointer transition-transform duration-500 ${
            isFlipped ? "[transform:rotateY(180deg)]" : ""
          }`}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Question Front Side */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 p-8 shadow-xl dark:border-indigo-900/80 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/80"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="mb-4 rounded-full bg-indigo-100 px-3.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              بطاقة {currentIndex + 1} من {activeIndices.length}
            </span>
            <p className="text-center text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
              {currentCard?.question}
            </p>

            {showAnswer && !isFlipped && (
              <div className="mt-5 rounded-2xl bg-white/90 p-4 text-sm text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700">
                <span className="font-bold text-emerald-600 block mb-1">الجواب:</span>
                {currentCard?.answer}
              </div>
            )}

            <span className="mt-6 flex items-center gap-1 text-[11px] font-bold text-slate-400">
              <Sparkles size={13} /> انقر أو اضغط المسافة لقلب البطاقة
            </span>
          </div>

          {/* Answer Back Side */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/80 p-8 shadow-xl [transform:rotateY(180deg)] dark:border-emerald-900/80 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/80"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="mb-4 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              الإجابة الصحيحة
            </span>
            <p className="text-center text-lg font-medium text-slate-900 dark:text-white leading-relaxed">
              {currentCard?.answer}
            </p>
            <span className="mt-6 text-[11px] font-bold text-slate-400">انقر للرجوع إلى السؤال</span>
          </div>
        </div>
      </div>

      {/* Navigation Buttons and Rating */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={handlePrev}
          className="flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
        >
          <ChevronRight size={18} />
          السابق
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={markAsUnknown}
            className="flex items-center gap-1.5 rounded-2xl bg-rose-100 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 transition"
            title="اختصار المفتاح: 1"
          >
            <X size={16} />
            لا أعرف (1)
          </button>
          <button
            onClick={markAsKnown}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-100 px-4 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 transition"
            title="اختصار المفتاح: 2"
          >
            <Check size={16} />
            أعرف (2)
          </button>
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
        >
          التالي
          <ChevronLeft size={18} />
        </button>
      </div>
    </div>
  );
}
