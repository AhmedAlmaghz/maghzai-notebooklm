"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Plus, BookOpen, Trash2, FileText, Loader2, Search, Sparkles } from "lucide-react";
import type { Notebook } from "@/lib/types";
import type { UserPayload } from "@/lib/auth";
import ThemeToggle from "@/components/theme-toggle";
import UserProfileButton from "@/components/user-profile-button";

const EMOJIS = ["📓", "📚", "🧪", "💡", "🧠", "📊", "🔬", "🗂️", "📝", "🌐", "⚡", "🎓", "🤖", "🚀"];

const TEMPLATES = [
  { title: "دفتر بحث علمي", emoji: "🧪", description: "لتنظيم المستندات والأوراق الأكاديمية والدردشة معها" },
  { title: "ملخصات المواد والدراسة", emoji: "📚", description: "إعداد دليل دراسي، بطاقات تعليمية وخرائط ذهنية" },
  { title: "قراءة وتحليل كتاب", emoji: "📖", description: "استخراج الأفكار الرئيسية والأسئلة الشائعة والملخصات" },
  { title: "إدارة المشاريع والأفكار", emoji: "💡", description: "تجميع روابط الويب والملاحظات وربط المفاهيم" },
];

export default function NotebooksGrid({
  initialNotebooks,
  currentUser = null,
}: {
  initialNotebooks: Notebook[];
  currentUser?: UserPayload | null;
}) {
  const [notebooks, setNotebooks] = useState<Notebook[]>(initialNotebooks);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const router = useRouter();

  const totalSources = useMemo(() => {
    return notebooks.reduce((acc, nb) => acc + (nb.sourceCount || 0), 0);
  }, [notebooks]);

  const filteredNotebooks = useMemo(() => {
    if (!searchQuery.trim()) return notebooks;
    const q = searchQuery.toLowerCase();
    return notebooks.filter(
      (nb) => nb.title.toLowerCase().includes(q) || nb.description?.toLowerCase().includes(q)
    );
  }, [notebooks, searchQuery]);

  async function createNotebook(titleOverride?: string, emojiOverride?: string) {
    setCreating(true);
    try {
      const emoji = emojiOverride || selectedEmoji || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const title = titleOverride || customTitle.trim() || "دفتر بحث جديد";
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, emoji }),
      });
      const data = await res.json();
      if (data.notebook) {
        setShowTemplateModal(false);
        router.push(`/notebook/${data.notebook.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteNotebook(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("هل أنت متأكد من حذف هذا الدفتر؟ سيتم حذف جميع المصادر والمحادثات المرتبطة به.")) return;
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* Navbar Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25">
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">بحّاثة</h1>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  NotebookLM AI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">مساعدك البحثي الذكي لتحليل ومحادثة مستنداتك الخاصة</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserProfileButton currentUser={currentUser} />

            <button
              onClick={() => setShowTemplateModal(true)}
              disabled={creating}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              <span>دفتر جديد</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Banner Hero Section */}
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-8 text-white shadow-xl dark:border-indigo-900/50">
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-purple-500/30 blur-3xl" />

          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md border border-white/20">
                <Sparkles size={14} className="text-amber-300" />
                {currentUser ? `أهلاً بك، ${currentUser.name} 👋` : "منصة البحث والتعلم الذكية"}
              </span>
              <h2 className="text-2xl font-black md:text-3xl text-white">حوّل مصادرك ومعلوماتك إلى معرفة تفاعلية</h2>
              <p className="text-sm leading-relaxed text-indigo-100/90">
                أضف الكتب والملفات والمقالات وروابط الويب والفيديوهات، ودع الذكاء الاصطناعي يستخرج منها الملخصات، الخرائط الذهنية، البطاقات التعليمية والعروض التقديمية.
              </p>
            </div>

            {/* Quick Stat Badges */}
            <div className="flex shrink-0 items-center gap-4">
              <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur-md border border-white/10 min-w-[100px]">
                <p className="text-2xl font-black text-white">{notebooks.length}</p>
                <p className="text-[11px] text-indigo-200">دفاتر بحثية</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur-md border border-white/10 min-w-[100px]">
                <p className="text-2xl font-black text-white">{totalSources}</p>
                <p className="text-[11px] text-indigo-200">مصدر مُحلّل</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar & Section Title */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">دفاتر البحث الخاصة بك</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              اختر دفتراً لمتابعة المحادثة والدراسة أو أنشئ دفتراً جديداً.
            </p>
          </div>

          <div className="relative min-w-[280px]">
            <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في دفاتر البحث..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-10 pl-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-950"
            />
          </div>
        </div>

        {/* Notebooks Grid */}
        {filteredNotebooks.length === 0 ? (
          searchQuery ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <Search size={32} className="mx-auto mb-3 text-slate-400" />
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">لم يتم العثور على نتائج</p>
              <p className="mt-1 text-xs text-slate-400">جرب البحث بكلمات أخرى</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <button
                onClick={() => setShowTemplateModal(true)}
                disabled={creating}
                className="group flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-100/50 p-6 text-slate-500 transition hover:border-indigo-500 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-md transition group-hover:scale-110 dark:bg-slate-800">
                  <Plus size={28} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-base font-bold">أنشئ أول دفتر بحث لك</p>
                <p className="max-w-xs text-center text-xs text-slate-400">
                  ابدأ بإضافة مصادرك واستخرج الملاحظات والإجابات فورياً
                </p>
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Create New Card */}
            <button
              onClick={() => setShowTemplateModal(true)}
              disabled={creating}
              className="group flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white/50 p-6 text-slate-400 transition hover:border-indigo-500 hover:bg-indigo-50/40 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30"
            >
              {creating ? (
                <Loader2 size={24} className="animate-spin text-indigo-600" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950 dark:text-indigo-400">
                  <Plus size={24} />
                </div>
              )}
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">دفتر بحث جديد</span>
            </button>

            {/* Existing Notebook Cards */}
            {filteredNotebooks.map((nb) => (
              <a
                key={nb.id}
                href={`/notebook/${nb.id}`}
                className="group relative flex min-h-[190px] flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800"
              >
                <button
                  onClick={(e) => deleteNotebook(nb.id, e)}
                  className="absolute left-4 top-4 rounded-xl p-2 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/50"
                  aria-label="حذف الدفتر"
                  title="حذف الدفتر"
                >
                  <Trash2 size={16} />
                </button>

                <div>
                  <div className="mb-4 inline-block text-4xl transition-transform group-hover:scale-110">
                    {nb.emoji}
                  </div>
                  <h4 className="line-clamp-1 text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {nb.title}
                  </h4>
                  {nb.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {nb.description}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 font-medium">
                    <FileText size={14} className="text-indigo-500" />
                    <span>{nb.sourceCount ?? 0} مصادر</span>
                  </div>
                  <span>{new Date(nb.updatedAt).toLocaleDateString("ar-EG")}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* New Notebook Modal / Template Selector */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">أنشئ دفتر بحث جديد</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">اختر إيموجي وعنوان أو ابدأ بقالب جاهز</p>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Custom Title Input */}
            <div className="mb-5 space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم الدفتر:</label>
              <div className="flex gap-2">
                <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-950">
                  {EMOJIS.slice(0, 6).map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`rounded-xl p-1.5 text-xl transition ${
                        selectedEmoji === emoji ? "bg-white shadow-sm dark:bg-slate-800" : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="مثال: بحث الذكاء الاصطناعي"
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Preset Templates */}
            <div className="mb-6">
              <p className="mb-3 text-xs font-bold text-slate-700 dark:text-slate-300">أو اختر من القوالب المجهزة:</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.title}
                    onClick={() => createNotebook(tpl.title, tpl.emoji)}
                    disabled={creating}
                    className="flex text-right items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 transition hover:border-indigo-500 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-indigo-800"
                  >
                    <span className="text-2xl">{tpl.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{tpl.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {tpl.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                onClick={() => createNotebook()}
                disabled={creating}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                أنشئ الدفتر
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
