"use client";

import { useState } from "react";
import { 
  FileStack, HelpCircle, GraduationCap, Clock3, Loader2, StickyNote, Plus, Trash2,
  Network, Layers, Presentation, Sparkles, Headphones
} from "lucide-react";
import type { NoteItem, NoteKind } from "@/lib/types";

const BASIC_ACTIONS: { kind: NoteKind; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { kind: "summary", label: "ملخص شامل", icon: FileStack },
  { kind: "faq", label: "أسئلة شائعة", icon: HelpCircle },
  { kind: "study_guide", label: "دليل دراسي", icon: GraduationCap },
  { kind: "timeline", label: "جدول زمني", icon: Clock3 },
];

const ADVANCED_ACTIONS: { kind: NoteKind; label: string; icon: React.ComponentType<{ size?: number }>; color: string }[] = [
  { kind: "mindmap", label: "خريطة ذهنية", icon: Network, color: "from-purple-600 to-indigo-600" },
  { kind: "flashcards", label: "بطاقات تعليمية", icon: Layers, color: "from-emerald-600 to-teal-600" },
  { kind: "presentation", label: "عرض تقديمي", icon: Presentation, color: "from-orange-500 to-rose-600" },
  { kind: "quiz", label: "اختبار قصير", icon: HelpCircle, color: "from-blue-600 to-cyan-600" },
  { kind: "glossary", label: "مسرد المصطلحات", icon: FileStack, color: "from-violet-600 to-purple-600" },
  { kind: "outline", label: "مخطط مقال", icon: Layers, color: "from-sky-600 to-blue-600" },
  { kind: "comparison", label: "جدول مقارنة", icon: Network, color: "from-amber-600 to-orange-600" },
  { kind: "debate", label: "نقاط مناقشة", icon: Presentation, color: "from-pink-600 to-rose-600" },
];

const KIND_ICON: Record<NoteKind, React.ComponentType<{ size?: number; className?: string }>> = {
  note: StickyNote,
  summary: FileStack,
  faq: HelpCircle,
  study_guide: GraduationCap,
  timeline: Clock3,
  mindmap: Network,
  flashcards: Layers,
  presentation: Presentation,
  quiz: HelpCircle,
  glossary: FileStack,
  outline: Layers,
  comparison: Network,
  debate: Presentation,
};

const KIND_COLORS: Record<NoteKind, string> = {
  note: "text-slate-500",
  summary: "text-blue-500 dark:text-blue-400",
  faq: "text-purple-500 dark:text-purple-400",
  study_guide: "text-emerald-500 dark:text-emerald-400",
  timeline: "text-amber-500 dark:text-amber-400",
  mindmap: "text-indigo-500 dark:text-indigo-400",
  flashcards: "text-teal-500 dark:text-teal-400",
  presentation: "text-rose-500 dark:text-rose-400",
  quiz: "text-cyan-500 dark:text-cyan-400",
  glossary: "text-violet-500 dark:text-violet-400",
  outline: "text-sky-500 dark:text-sky-400",
  comparison: "text-orange-500 dark:text-orange-400",
  debate: "text-pink-500 dark:text-pink-400",
};

export default function StudioPanel({
  notebookId,
  notes,
  setNotes,
  hasSources,
  onOpenNote,
  onTriggerAudioPlayer,
}: {
  notebookId: string;
  notes: NoteItem[];
  setNotes: React.Dispatch<React.SetStateAction<NoteItem[]>>;
  hasSources: boolean;
  onOpenNote: (note: NoteItem) => void;
  onTriggerAudioPlayer?: () => void;
}) {
  const [generating, setGenerating] = useState<NoteKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(kind: NoteKind) {
    if (!hasSources) {
      setError("أضف مصدراً واحداً على الأقل أولاً لإنشاء المحتوى");
      return;
    }
    setError(null);
    setGenerating(kind);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/studio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التوليد");
      setNotes((prev) => [...prev, data.note]);
      onOpenNote(data.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء التوليد");
    } finally {
      setGenerating(null);
    }
  }

  async function addManualNote() {
    const res = await fetch(`/api/notebooks/${notebookId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "ملاحظة جديدة", content: "" }),
    });
    const data = await res.json();
    if (data.note) {
      setNotes((prev) => [...prev, data.note]);
      onOpenNote(data.note);
    }
  }

  async function deleteNote(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("حذف هذه الملاحظة؟")) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notebooks/${notebookId}/notes/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 transition-colors duration-200">
      {/* Top Header */}
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <Sparkles size={16} />
          </div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">استوديو التعلم وصناع الأفكار</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Audio Summary / Podcast Feature Banner */}
        {onTriggerAudioPlayer && (
          <button
            onClick={onTriggerAudioPlayer}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-4 text-white shadow-lg transition hover:scale-[1.01]"
          >
            <div className="flex items-center gap-3 text-right">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 text-white backdrop-blur-md">
                <Headphones size={20} className="group-hover:animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">حوار صوتي (Audio Podcast)</p>
                <p className="text-[11px] text-indigo-200">استمع لمناقشة تلخيصية للمستندات بصوت تفاعلي</p>
              </div>
            </div>
          </button>
        )}

        {/* Basic Generation Tools */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">أدوات تلخيص أساسية</p>
          <div className="grid grid-cols-2 gap-2.5">
            {BASIC_ACTIONS.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                onClick={() => generate(kind)}
                disabled={generating !== null}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:text-indigo-400 transition disabled:opacity-50"
              >
                {generating === kind ? (
                  <Loader2 size={18} className="animate-spin text-indigo-600" />
                ) : (
                  <Icon size={18} />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Interactive Tools */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">أدوات تفاعلية متقدمة</p>
          <div className="grid grid-cols-2 gap-2.5">
            {ADVANCED_ACTIONS.map(({ kind, label, icon: Icon, color }) => (
              <button
                key={kind}
                onClick={() => generate(kind)}
                disabled={generating !== null}
                className={`flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-r ${color} p-3.5 text-white shadow-md transition hover:scale-[1.02] hover:shadow-lg disabled:opacity-50`}
              >
                {generating === kind ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Icon size={20} />
                )}
                <p className="text-xs font-bold">{label}</p>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Saved Notes list */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">الملاحظات المحفوظة ({notes.length})</p>
            <button
              onClick={addManualNote}
              className="flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 transition"
            >
              <Plus size={13} /> ملاحظة يدويّة
            </button>
          </div>

          {notes.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 py-10 text-center text-xs text-slate-400">
              استخدم الأدوات أعلاه لإنشاء محتوى تعليمي تفاعلي
            </p>
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => {
                const Icon = KIND_ICON[note.kind];
                const colorClass = KIND_COLORS[note.kind];
                return (
                  <li key={note.id}>
                    <div
                      onClick={() => onOpenNote(note)}
                      className="group flex cursor-pointer items-start gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 hover:border-slate-200 hover:bg-slate-100 dark:border-slate-800/50 dark:bg-slate-900/50 dark:hover:bg-slate-800/80 transition"
                    >
                      <div className={`mt-0.5 shrink-0 ${colorClass}`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">{note.title}</p>
                        <p className="truncate text-[11px] text-slate-400 mt-0.5">
                          {note.kind === "mindmap" && "🗺️ خريطة ذهنية"}
                          {note.kind === "flashcards" && "🎴 بطاقات تعليمية"}
                          {note.kind === "presentation" && "📊 عرض تقديمي"}
                          {!["mindmap", "flashcards", "presentation"].includes(note.kind) &&
                            (note.content.replace(/[#*_>-]/g, "").slice(0, 45) || "بلا محتوى")}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteNote(note.id, e)}
                        className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50 group-hover:opacity-100"
                        title="حذف الملاحظة"
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
      </div>
    </div>
  );
}
