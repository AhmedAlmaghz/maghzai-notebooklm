"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronRight, ChevronLeft, Maximize2, Minimize2, Grid, List, Sparkles } from "lucide-react";
import Markdown from "@/components/markdown";

interface Slide {
  title: string;
  content: string;
  notes?: string;
}

function parseSlides(content: string): Slide[] {
  const slides: Slide[] = [];
  
  // Parse slides with ---SLIDE--- format
  const slideMatches = content.split(/---SLIDE---/i).slice(1);
  
  for (const slideContent of slideMatches) {
    const endIndex = slideContent.indexOf("---END---");
    const slideText = endIndex > -1 ? slideContent.slice(0, endIndex) : slideContent;
    
    const lines = slideText.trim().split("\n");
    let title = "";
    let contentLines: string[] = [];
    let notes = "";
    let inNotes = false;
    
    for (const line of lines) {
      if (line.startsWith("## ") || line.startsWith("# ")) {
        title = line.replace(/^#+ /, "").trim();
      } else if (line.includes("ملاحظات المحاضر:") || line.includes("📝")) {
        inNotes = true;
        notes = line.replace(/.*?(ملاحظات المحاضر:|📝)\s*/i, "").trim();
      } else if (inNotes) {
        notes += " " + line.trim();
      } else {
        contentLines.push(line);
      }
    }
    
    if (title || contentLines.length > 0) {
      slides.push({
        title: title || `شريحة ${slides.length + 1}`,
        content: contentLines.join("\n").trim(),
        notes: notes.trim() || undefined,
      });
    }
  }

  // Fallback: parse by ## headers
  if (slides.length === 0) {
    const sections = content.split(/(?=^## )/m);
    for (const section of sections) {
      if (!section.trim()) continue;
      const lines = section.trim().split("\n");
      const title = lines[0]?.replace(/^#+ /, "").trim() || "";
      const content = lines.slice(1).join("\n").trim();
      if (title || content) {
        slides.push({ title, content });
      }
    }
  }

  return slides;
}

export default function PresentationViewer({ content }: { content: string }) {
  const slides = useMemo(() => parseSlides(content), [content]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  const currentSlide = slides[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === " ") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setShowGrid(false);
  };

  if (slides.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">لم يتم العثور على شرائح في هذا المحتوى.</p>
      </div>
    );
  }

  // Grid View Mode
  if (showGrid) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">جميع شرائح العرض ({slides.length})</h3>
          <button
            onClick={() => setShowGrid(false)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            <List size={15} />
            عرض فردي
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {slides.map((slide, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`group relative aspect-video overflow-hidden rounded-2xl border-2 p-4 text-right transition ${
                index === currentIndex
                  ? "border-indigo-600 bg-indigo-50/80 dark:border-indigo-500 dark:bg-indigo-950/60"
                  : "border-slate-200 bg-white hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <span className="absolute left-2.5 top-2.5 rounded-lg bg-slate-900/80 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                {index + 1}
              </span>
              <p className="line-clamp-2 text-xs font-bold text-slate-900 dark:text-white">{slide.title}</p>
              <p className="mt-1 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                {slide.content.replace(/[-*#]/g, "").slice(0, 65)}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Slide View Mode (Normal or Fullscreen)
  const slideContent = (
    <div className={`flex flex-col ${isFullscreen ? "h-screen bg-slate-950 p-8" : ""}`}>
      {/* Slide Card Container */}
      <div
        className={`flex-1 flex flex-col justify-between overflow-y-auto ${
          isFullscreen
            ? "rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-10 text-white shadow-2xl"
            : "rounded-3xl border-2 border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 p-8 shadow-xl dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30"
        }`}
      >
        <div>
          {/* Header Badge */}
          <div className="mb-6 flex items-center justify-between">
            <span
              className={`rounded-full px-3.5 py-1 text-xs font-bold ${
                isFullscreen
                  ? "bg-white/20 text-white"
                  : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              }`}
            >
              شريحة {currentIndex + 1} من {slides.length}
            </span>
          </div>

          {/* Title */}
          <h2
            className={`mb-6 font-black tracking-tight ${
              isFullscreen ? "text-4xl text-white" : "text-2xl text-slate-900 dark:text-white"
            }`}
          >
            {currentSlide?.title}
          </h2>

          {/* Slide Text Content */}
          <div className={`${isFullscreen ? "prose prose-invert prose-lg max-w-none text-slate-100" : ""}`}>
            <Markdown content={currentSlide?.content || ""} />
          </div>
        </div>

        {/* Presenter Notes */}
        {showNotes && currentSlide?.notes && (
          <div
            className={`mt-6 rounded-2xl p-4 text-xs ${
              isFullscreen
                ? "border border-white/20 bg-white/10 text-white/90"
                : "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
            }`}
          >
            <p className="font-bold mb-1">📝 ملاحظات المحاضر:</p>
            <p className="leading-relaxed">{currentSlide.notes}</p>
          </div>
        )}
      </div>

      {/* Toolbar Controls */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid(true)}
            className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            title="عرض المصغرات"
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              showNotes
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            📝 ملاحظات المحاضر
          </button>
        </div>

        {/* Next/Prev Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-30"
          >
            <ChevronRight size={22} />
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? "w-6 bg-indigo-600 dark:bg-indigo-400"
                    : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={currentIndex === slides.length - 1}
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-30"
          >
            <ChevronLeft size={22} />
          </button>
        </div>

        <button
          onClick={toggleFullscreen}
          className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          title="ملء الشاشة"
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
    </div>
  );

  if (isFullscreen) {
    return <div className="fixed inset-0 z-50">{slideContent}</div>;
  }

  return <div className="space-y-4">{slideContent}</div>;
}
