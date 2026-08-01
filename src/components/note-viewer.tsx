"use client";

import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { X, Save, Loader2, Pencil, Eye, Download } from "lucide-react";
import type { NoteItem } from "@/lib/types";
import Markdown from "@/components/markdown";

const MindmapViewer = lazy(() => import("@/components/mindmap-viewer"));
const FlashcardsViewer = lazy(() => import("@/components/flashcards-viewer"));
const PresentationViewer = lazy(() => import("@/components/presentation-viewer"));

function LoadingFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
    </div>
  );
}

export default function NoteViewer({
  notebookId,
  note,
  onClose,
  onUpdated,
}: {
  notebookId: string;
  note: NoteItem;
  onClose: () => void;
  onUpdated: (note: NoteItem) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [mode, setMode] = useState<"view" | "edit">(
    ["mindmap", "flashcards", "presentation"].includes(note.kind) ? "view" : "edit"
  );
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setMode(["mindmap", "flashcards", "presentation"].includes(note.kind) ? "view" : "edit");
  }, [note.id, note.kind]);

  function scheduleSave(nextTitle: string, nextContent: string) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/notebooks/${notebookId}/notes/${note.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle, content: nextContent }),
        });
        const data = await res.json();
        if (data.note) onUpdated(data.note);
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  const handleExport = () => {
    const blob = new Blob([`# ${title}\n\n${content}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getKindLabel = () => {
    switch (note.kind) {
      case "mindmap": return "🗺️ خريطة ذهنية";
      case "flashcards": return "🎴 بطاقات تعليمية";
      case "presentation": return "📊 عرض تقديمي";
      case "summary": return "📝 ملخص";
      case "faq": return "❓ أسئلة شائعة";
      case "study_guide": return "📚 دليل دراسي";
      case "timeline": return "⏱️ جدول زمني";
      default: return "📄 ملاحظة";
    }
  };

  const renderContent = () => {
    if (mode === "edit") {
      return (
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            scheduleSave(title, e.target.value);
          }}
          placeholder="اكتب ملاحظتك هنا... (يدعم Markdown)"
          className="h-full w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 outline-none"
        />
      );
    }

    switch (note.kind) {
      case "mindmap":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <MindmapViewer content={content} />
          </Suspense>
        );
      case "flashcards":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <FlashcardsViewer content={content} />
          </Suspense>
        );
      case "presentation":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <PresentationViewer content={content} />
          </Suspense>
        );
      default:
        return <Markdown content={content || "*لا يوجد محتوى بعد*"} />;
    }
  };

  const isInteractiveKind = ["mindmap", "flashcards", "presentation"].includes(note.kind);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm animate-fade-in">
      <div className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl dark:bg-slate-900 transition-colors duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {getKindLabel()}
              </span>
            </div>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                scheduleSave(e.target.value, content);
              }}
              className="w-full truncate bg-transparent text-xl font-bold text-slate-900 dark:text-white outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin text-slate-400" />}
            
            <button
              onClick={() => setMode(mode === "edit" ? "view" : "edit")}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              {mode === "edit" ? <Eye size={14} /> : <Pencil size={14} />}
              {mode === "edit" ? "معاينة" : "تحرير"}
            </button>
            
            <button
              onClick={handleExport}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              title="تصدير ملف Markdown"
            >
              <Download size={16} />
            </button>
            
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 dark:border-slate-800">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Save size={12} /> يُحفظ التغيير تلقائياً
          </span>
          {isInteractiveKind && mode === "view" && (
            <span className="text-xs text-slate-400 font-medium">
              💡 اضغط على "تحرير" لتعديل المحتوى الخام
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
