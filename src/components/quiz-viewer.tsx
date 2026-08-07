"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronLeft, RotateCcw, Check, X, Award, Sparkles } from "lucide-react";

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

function parseQuiz(content: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  // Parse quiz with ---QUIZ--- format. Treat EOF as an implicit ---END---
  // so a truncated final question block is still parsed.
  const quizMatches = content.split(/---QUIZ---/i).slice(1);

  for (const quizContent of quizMatches) {
    const endIndex = quizContent.indexOf("---END---");
    const quizText = endIndex > -1 ? quizContent.slice(0, endIndex) : quizContent;

    // Split by ## ❓ to get individual questions
    const questionBlocks = quizText.split(/## ❓/i).filter(Boolean);

    for (const block of questionBlocks) {
      const lines = block.split("\n").filter((l) => l.trim());
      if (lines.length === 0) continue;

      const question = lines[0]?.trim() || "";

      // Extract options (أ), ب), ج), د)). Tolerant of leading bullets/dashes.
      const options: string[] = [];
      const optionRegex = /^[-•*\s]*[أ-د]\)\s*(.+)$/;

      for (const line of lines) {
        const match = line.match(optionRegex);
        if (match) {
          options.push(match[1].trim());
        }
      }

      // Extract correct answer
      const correctMatch = block.match(/\*\*الإجابة الصحيحة:\*\*\s*([أ-د])/i);
      const correctLetter = correctMatch ? correctMatch[1] : "";
      const correctIndex = ["أ", "ب", "ج", "د"].indexOf(correctLetter);

      // Extract explanation
      const explanationMatch = block.match(/\*\*الشرح:\*\*\s*([\s\S]*?)(?=\n\n|$)/i);
      const explanation = explanationMatch ? explanationMatch[1].trim() : "";

      if (question && options.length >= 2) {
        questions.push({
          question,
          options,
          correctAnswer: correctIndex >= 0 ? correctLetter : "",
          explanation,
        });
      }
    }
  }

  // Fallback: try parsing Q/A format
  if (questions.length === 0) {
    const lines = content.split("\n");
    let currentQ = "";
    let currentOptions: string[] = [];
    let currentCorrect = "";
    let currentExplanation = "";

    for (const line of lines) {
      if (line.includes("❓") || line.match(/^##\s*\d+\./)) {
        if (currentQ && currentOptions.length > 0) {
          questions.push({
            question: currentQ,
            options: currentOptions,
            correctAnswer: currentCorrect,
            explanation: currentExplanation,
          });
        }
        currentQ = line.replace(/^##\s*|❓/g, "").trim();
        currentOptions = [];
        currentCorrect = "";
        currentExplanation = "";
      } else if (line.match(/^[-•*\s]*[أ-د]\)/)) {
        currentOptions.push(line.replace(/^[-•*\s]*[أ-د]\)\s*/, "").trim());
      } else if (line.includes("الإجابة الصحيحة")) {
        const match = line.match(/([أ-د])/);
        if (match) currentCorrect = match[1];
      } else if (line.includes("الشرح")) {
        currentExplanation = line.replace(/.*الشرح:\s*/i, "").trim();
      }
    }
    if (currentQ && currentOptions.length > 0) {
      questions.push({
        question: currentQ,
        options: currentOptions,
        correctAnswer: currentCorrect,
        explanation: currentExplanation,
      });
    }
  }

  return questions;
}

export default function QuizViewer({ content }: { content: string }) {
  const questions = useMemo(() => parseQuiz(content), [content]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isCompleted, setIsCompleted] = useState(false);
  const [shuffledQuestions, setShuffledQuestions] = useState<number[]>([]);
  const [isShuffled, setIsShuffled] = useState(false);

  // Shuffle questions on mount
  useState(() => {
    const indices = [...questions.keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledQuestions(indices);
  });

  const activeIndices = isShuffled && shuffledQuestions.length > 0 ? shuffledQuestions : questions.map((_, i) => i);
  const currentQuestionIndex = activeIndices[currentIndex];
  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer !== null) return; // Already answered

    setSelectedAnswer(answer);
    setShowExplanation(true);

    const isCorrect = answer === currentQuestion.correctAnswer;
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
  };

  const handleNext = () => {
    if (currentIndex < activeIndices.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore({ correct: 0, total: 0 });
    setIsCompleted(false);
    
    // Reshuffle
    const indices = [...questions.keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledQuestions(indices);
  };

  const handleShuffle = () => {
    const indices = [...questions.keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledQuestions(indices);
    setIsShuffled(true);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">لم يتم العثور على أسئلة اختبار صالحة في هذا المحتوى.</p>
      </div>
    );
  }

  if (isCompleted) {
    const percentage = Math.round((score.correct / score.total) * 100);
    const grade = percentage >= 90 ? "ممتاز" : percentage >= 75 ? "جيد جداً" : percentage >= 60 ? "جيد" : "يحتاج مراجعة";

    return (
      <div className="space-y-6 max-w-2xl mx-auto py-6">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white shadow-xl animate-fade-in">
          <Award size={48} className="animate-bounce" />
          <div className="text-center">
            <h3 className="text-2xl font-black mb-2">أحسنت! أكملت الاختبار 🎉</h3>
            <p className="text-indigo-100">درجتك: {score.correct} / {score.total} ({percentage}%)</p>
            <p className="text-lg font-bold mt-2">التقدير: {grade}</p>
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition"
          >
            <RotateCcw size={18} />
            إعادة الاختبار
          </button>
          <button
            onClick={handleShuffle}
            className="flex items-center gap-2 rounded-2xl border-2 border-indigo-600 px-6 py-3 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition"
          >
            <Sparkles size={18} />
            أسئلة جديدة
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">خطأ في تحميل السؤال</p>
      </div>
    );
  }

  const correctIndex = ["أ", "ب", "ج", "د"].indexOf(currentQuestion.correctAnswer);

  return (
    <div className="space-y-5 max-w-2xl mx-auto py-2">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>السؤال {currentIndex + 1} من {activeIndices.length}</span>
          <span className="text-indigo-600 dark:text-indigo-400">
            النتيجة: {score.correct} / {score.total}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / activeIndices.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-6 text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
          {currentQuestion.question}
        </h3>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            const letter = ["أ", "ب", "ج", "د"][index];
            const isSelected = selectedAnswer === letter;
            const isCorrect = letter === currentQuestion.correctAnswer;
            const showCorrect = selectedAnswer !== null && isCorrect;
            const showWrong = isSelected && !isCorrect;

            return (
              <button
                key={index}
                onClick={() => handleAnswerSelect(letter)}
                disabled={selectedAnswer !== null}
                className={`w-full rounded-2xl border-2 p-4 text-right transition ${
                  showCorrect
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                    : showWrong
                    ? "border-red-500 bg-red-50 dark:bg-red-950/40"
                    : selectedAnswer === null
                    ? "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-800 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
                    : "border-slate-200 opacity-50 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold ${
                    showCorrect ? "bg-emerald-600 text-white" : showWrong ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    {letter}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">{option}</span>
                  {showCorrect && <Check size={20} className="text-emerald-600" />}
                  {showWrong && <X size={20} className="text-red-600" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExplanation && currentQuestion.explanation && (
          <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/40">
            <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">💡 الشرح:</p>
            <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">{currentQuestion.explanation}</p>
          </div>
        )}

        {/* Navigation */}
        {selectedAnswer !== null && (
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:text-slate-300 transition"
            >
              <ChevronRight size={18} />
              السابق
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-bold text-white hover:from-indigo-700 hover:to-purple-700 transition"
            >
              {currentIndex === activeIndices.length - 1 ? "إنهاء" : "التالي"}
              <ChevronLeft size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}