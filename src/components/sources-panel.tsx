"use client";

import { useState, useMemo } from "react";
import { Plus, FileText, Globe, FileType2, File, Trash2, AlertCircle, CheckSquare, Square, PlayCircle, Search, CheckCircle2, Loader2 } from "lucide-react";
import type { SourceItem } from "@/lib/types";
import AddSourceDialog from "@/components/add-source-dialog";

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  text: FileType2,
  url: Globe,
  pdf: FileText,
  file: File,
  youtube: PlayCircle,
};

function getSourceIcon(source: SourceItem) {
  if (source.title.startsWith("🎬") || source.sourceUrl?.includes("youtube.com") || source.sourceUrl?.includes("youtu.be")) {
    return PlayCircle;
  }
  return TYPE_ICON[source.type] || FileText;
}

export default function SourcesPanel({
  notebookId,
  sources,
  setSources,
  selectedIds,
  onToggleSelect,
  onViewSource,
}: {
  notebookId: string;
  sources: SourceItem[];
  setSources: React.Dispatch<React.SetStateAction<SourceItem[]>>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onViewSource: (source: SourceItem) => void;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const filteredSources = useMemo(() => {
    if (!filterQuery.trim()) return sources;
    const q = filterQuery.toLowerCase();
    return sources.filter((s) => s.title.toLowerCase().includes(q));
  }, [sources, filterQuery]);

  const totalChars = useMemo(() => {
    return sources.reduce((acc, s) => acc + (s.charCount || 0), 0);
  }, [sources]);

  const allSelected = sources.length > 0 && selectedIds.size === sources.length;

  function toggleSelectAll() {
    if (allSelected) {
      sources.forEach((s) => {
        if (selectedIds.has(s.id)) onToggleSelect(s.id);
      });
    } else {
      sources.forEach((s) => {
        if (!selectedIds.has(s.id)) onToggleSelect(s.id);
      });
    }
  }

  async function deleteSource(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("حذف هذا المصدر؟")) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/notebooks/${notebookId}/sources/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">المصادر</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {sources.length}
          </span>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-950/80 dark:text-indigo-300 dark:hover:bg-indigo-900"
        >
          <Plus size={15} />
          إضافة مصدر
        </button>
      </div>

      {/* Filter and Selection bar if sources exist */}
      {sources.length > 0 && (
        <div className="border-b border-slate-100 px-3 py-2 space-y-2 dark:border-slate-800/60">
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="تصفية المصادر..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-8 pl-3 text-xs outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1 hover:text-indigo-600 font-semibold transition"
            >
              {allSelected ? <CheckSquare size={13} className="text-indigo-600" /> : <Square size={13} />}
              <span>{allSelected ? "إلغاء التحديد" : "تحديد الكل"}</span>
            </button>

            <span>{totalChars.toLocaleString("en-US")} حرف إجمالي</span>
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-3">
        {sources.length === 0 ? (
          <button
            onClick={() => setShowDialog(true)}
            className="flex w-full flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 py-12 text-slate-400 transition hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500"
          >
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <FileText size={22} />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">لا توجد مصادر بعد</span>
            <span className="text-[11px] text-slate-400">اضغط لإضافة ملف، كتاب، رابط أو فيديو</span>
          </button>
        ) : filteredSources.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">لا توجد مصادر تطابق البحث</p>
        ) : (
          <ul className="space-y-2">
            {filteredSources.map((source) => {
              const Icon = getSourceIcon(source);
              const selected = selectedIds.has(source.id);
              return (
                <li key={source.id}>
                  <div
                    onClick={() => onViewSource(source)}
                    className={`group flex cursor-pointer items-start gap-2.5 rounded-2xl p-2.5 transition border ${
                      selected
                        ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/60 dark:bg-indigo-950/30"
                        : "border-slate-100 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800/50 dark:bg-slate-900/50 dark:hover:bg-slate-800/80"
                    }`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleSelect(source.id); }}
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600 transition"
                      aria-label="تحديد المصدر"
                    >
                      {selected ? (
                        <CheckSquare size={17} className="text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Square size={17} />
                      )}
                    </button>

                    <div className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400">
                      <Icon size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">{source.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                        {source.status === "processing" && (
                          <span className="flex items-center gap-1 text-amber-500">
                            <Loader2 size={10} className="animate-spin" /> جارٍ المعالجة…
                          </span>
                        )}
                        {source.status === "error" && (
                          <span className="flex items-center gap-1 text-red-500 font-semibold">
                            <AlertCircle size={10} /> خطأ
                          </span>
                        )}
                        {source.status === "ready" && (
                          <span className="flex items-center gap-1 font-mono">
                            <CheckCircle2 size={10} className="text-emerald-500" />
                            {source.charCount.toLocaleString("en-US")} حرف
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => deleteSource(source.id, e)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50 group-hover:opacity-100"
                      title="حذف المصدر"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer hint */}
      {sources.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {selectedIds.size > 0
            ? `📌 ${selectedIds.size} مصدر محدد للدردشة`
            : "💡 لم يتم تحديد مصادر — سيتم البحث في كل المصادر"}
        </div>
      )}

      {showDialog && (
        <AddSourceDialog
          notebookId={notebookId}
          onClose={() => setShowDialog(false)}
          onAdded={(source) => setSources((prev) => [...prev, source])}
        />
      )}
    </div>
  );
}
