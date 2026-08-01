"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { ZoomIn, ZoomOut, RotateCcw, Download, Maximize2, Minimize2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function MindmapViewer({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      mindmap: {
        useMaxWidth: true,
        padding: 20,
      },
      themeVariables: {
        fontFamily: "Cairo, system-ui, -apple-system, sans-serif",
        fontSize: "14px",
      },
    });

    async function renderMermaid() {
      // Extract mermaid code from markdown code blocks
      const mermaidMatch = content.match(/```mermaid\n?([\s\S]*?)```/);
      const mermaidCode = mermaidMatch ? mermaidMatch[1].trim() : content;

      if (!mermaidCode || !mermaidCode.includes("mindmap")) {
        setError("لم يتم العثور على خريطة ذهنية صالحة في هذا النص.");
        return;
      }

      try {
        const id = `mindmap-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidCode);
        setSvgContent(svg);
        setError(null);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError("حدث خطأ أثناء رسم الخريطة الذهنية");
      }
    }

    renderMermaid();
  }, [content, isDark]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.4));
  const handleReset = () => setScale(1);

  const handleDownload = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindmap.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/30">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
        <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-white dark:bg-slate-900 p-4 text-left font-mono text-xs text-slate-600 dark:text-slate-400">
          {content.slice(0, 500)}
        </pre>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-50 bg-white dark:bg-slate-950 p-6" : ""}`}>
      {/* Controls Bar */}
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomOut}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            title="تصغير"
          >
            <ZoomOut size={18} />
          </button>
          <span className="min-w-[3.5rem] text-center font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            title="تكبير"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleReset}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            title="إعادة ضبط"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 transition"
            title="تحميل SVG"
          >
            <Download size={15} />
            تصدير SVG
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            title={isFullscreen ? "إغلاق ملء الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="overflow-auto rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/40 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40"
        style={{ maxHeight: isFullscreen ? "calc(100vh - 120px)" : "520px" }}
      >
        {svgContent ? (
          <div
            className="flex min-h-[350px] items-center justify-center transition-transform duration-200"
            style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="flex h-72 items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-indigo-900 dark:border-t-indigo-400" />
          </div>
        )}
      </div>
    </div>
  );
}
