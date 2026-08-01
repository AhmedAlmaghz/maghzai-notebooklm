"use client";

import { useState } from "react";
import { X, Globe, FileText, Copy, Check } from "lucide-react";
import type { SourceItem } from "@/lib/types";

export default function SourceViewer({
  source,
  content,
  onClose,
}: {
  source: SourceItem;
  content: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm animate-fade-in">
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-900 transition-colors duration-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{source.title}</h3>
            {source.sourceUrl && (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                dir="ltr"
              >
                <Globe size={13} /> {source.sourceUrl}
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            {content && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                title="نسخ المحتوى"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? "تم النسخ" : "نسخ"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {content === null ? (
            <div className="grid h-40 place-items-center text-slate-400">
              <FileText className="animate-pulse" size={28} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-mono">
              {content}
            </p>
          )}
        </div>

        {content && (
          <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-3 text-xs text-slate-400 font-medium">
            {source.charCount.toLocaleString("en-US")} حرف إجمالي
          </div>
        )}
      </div>
    </div>
  );
}
