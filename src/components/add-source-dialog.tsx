"use client";

import { useRef, useState } from "react";
import { X, FileText, Link2, Type, Upload, Loader2, PlayCircle, Search, Globe, Sparkles } from "lucide-react";
import type { SourceItem } from "@/lib/types";

type Tab = "text" | "url" | "youtube" | "file" | "web-search";

export default function AddSourceDialog({
  notebookId,
  onClose,
  onAdded,
}: {
  notebookId: string;
  onClose: () => void;
  onAdded: (source: SourceItem) => void;
}) {
  const [tab, setTab] = useState<Tab>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDepth, setSearchDepth] = useState<"basic" | "deep">("deep");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submitText() {
    if (!content.trim()) {
      setError("الرجاء إدخال نص المصدر");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "text", title: title || "ملاحظة نصية", content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشلت الإضافة");
      onAdded(data.source);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء حفظ المصدر النصي");
    } finally {
      setLoading(false);
    }
  }

  async function submitUrl() {
    if (!url.trim()) {
      setError("الرجاء إدخال رابط صحيح");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "url", url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشلت الإضافة");
      onAdded(data.source);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء جلب الرابط");
    } finally {
      setLoading(false);
    }
  }

  async function submitYoutube() {
    if (!youtubeUrl.trim()) {
      setError("الرجاء إدخال رابط يوتيوب صحيح");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "youtube", url: youtubeUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل استخراج نص الفيديو");
      onAdded(data.source);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء استخراج النص من يوتيوب");
    } finally {
      setLoading(false);
    }
  }

  async function submitFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/notebooks/${notebookId}/sources/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل رفع الملف");
      onAdded(data.source);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء رفع وتحليل الملف");
    } finally {
      setLoading(false);
    }
  }

  async function submitWebSearch() {
    if (!searchQuery.trim()) {
      setError("الرجاء إدخال موضوع للبحث");
      return;
    }
    if (searchQuery.length < 3) {
      setError("موضوع البحث قصير جداً (3 أحرف على الأقل)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/web-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, depth: searchDepth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل البحث");
      onAdded(data.source);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء تنفيذ البحث العميق");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-colors duration-200">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">إضافة مصدر جديد للدفتر</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">حدد نوع المصدر المطلوب لتحليله ومحادثته</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-slate-950">
          {[
            { key: "text" as Tab, label: "نص", icon: Type },
            { key: "url" as Tab, label: "رابط مقال", icon: Link2 },
            { key: "youtube" as Tab, label: "يوتيوب", icon: PlayCircle },
            { key: "file" as Tab, label: "ملف / PDF", icon: Upload },
            { key: "web-search" as Tab, label: "بحث عميق", icon: Search },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(null); }}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl py-2.5 px-3 text-xs font-bold transition ${
                tab === key
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Text Tab */}
        {tab === "text" && (
          <div className="space-y-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان المصدر (مثال: ملخص الفصل الأول)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="الصق نص مستندك هنا..."
              rows={7}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            {error && <p className="text-xs font-bold text-red-500">{error}</p>}
            <button
              onClick={submitText}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              حفظ وإضافة المصدر
            </button>
          </div>
        )}

        {/* URL Tab */}
        {tab === "url" && (
          <div className="space-y-4">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              dir="ltr"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              💡 يقبل روابط المقالات والموقع لاستخراج النص تلقائياً.
            </p>
            {error && <p className="text-xs font-bold text-red-500">{error}</p>}
            <button
              onClick={submitUrl}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              جلب واستخراج النص
            </button>
          </div>
        )}

        {/* YouTube Tab */}
        {tab === "youtube" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-3.5 dark:border-rose-900/50 dark:bg-rose-950/30">
              <PlayCircle size={24} className="text-rose-600 dark:text-rose-400" />
              <div>
                <p className="text-xs font-bold text-rose-900 dark:text-rose-200">استخراج النص التلقائي من يوتيوب</p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300">أدخل رابط فيديو ليتم استخراج محاداثاته المكتوبة</p>
              </div>
            </div>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              dir="ltr"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            {error && <p className="text-xs font-bold text-red-500">{error}</p>}
            <button
              onClick={submitYoutube}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "جارٍ استخراج نص الفيديو..." : "استخراج نص الفيديو"}
            </button>
          </div>
        )}

        {/* File Drag Drop Tab */}
        {tab === "file" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) submitFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed py-14 text-center transition ${
                dragOver
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-slate-300 hover:border-indigo-400 dark:border-slate-800 dark:hover:border-indigo-700"
              }`}
            >
              {loading ? (
                <Loader2 size={32} className="animate-spin text-indigo-600 dark:text-indigo-400" />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <FileText size={28} />
                </div>
              )}
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {loading ? "جارٍ تحليل ومعالجة الملف..." : "اسحب ملفاً هنا أو اضغط لتحديد الملف"}
              </p>
              <p className="text-xs text-slate-400">يدعم ملفات PDF والنصوص (.txt, .md) حتى 20 ميجابايت</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,text/plain,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) submitFile(file);
                }}
              />
            </div>
            {error && <p className="text-xs font-bold text-red-500">{error}</p>}
          </div>
        )}

        {/* Web Deep Search Tab */}
        {tab === "web-search" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900/40">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
                <Globe size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">البحث العميق في الويب</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">يجمع أفضل المقالات والمعلومات عن أي موضوع تطلبه</p>
              </div>
            </div>

            <div className="relative">
              <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="أدخل عنوان الموضوع الذي تود تجميعه..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pr-10 pl-4 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    e.preventDefault();
                    submitWebSearch();
                  }
                }}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">عمق البحث المطلوب:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSearchDepth("basic")}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-xs font-bold transition ${
                    searchDepth === "basic"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-300"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400"
                  }`}
                >
                  <Search size={15} />
                  بحث سريع
                </button>
                <button
                  onClick={() => setSearchDepth("deep")}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-xs font-bold transition ${
                    searchDepth === "deep"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-300"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400"
                  }`}
                >
                  <Sparkles size={15} />
                  بحث عميق مفصّل
                </button>
              </div>
            </div>

            {error && <p className="text-xs font-bold text-red-500">{error}</p>}

            <button
              onClick={submitWebSearch}
              disabled={loading || !searchQuery.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>جارٍ تجميع ومسح صفحات الإنترنت...</span>
                </>
              ) : (
                <>
                  <Globe size={18} />
                  <span>ابدأ التجميع وإضافة المصدر</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
