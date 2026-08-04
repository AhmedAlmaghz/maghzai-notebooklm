"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Plus, BookOpen, Trash2, FileText, Loader2, Search, Sparkles, RotateCcw, X } from "lucide-react";
import type { Notebook } from "@/lib/types";
import type { UserPayload } from "@/lib/auth";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import UserProfileButton from "@/components/user-profile-button";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";

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
  const router = useRouter();
  const { t } = useI18n();
  const { success, error, info } = useToast();
  const [notebooks, setNotebooks] = useState<Notebook[]>(initialNotebooks);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const [deleteTarget, setDeleteTarget] = useState<Notebook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashNotebooks, setTrashNotebooks] = useState<Notebook[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [permanentTarget, setPermanentTarget] = useState<Notebook | null>(null);

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

  async function createNotebook() {
    setCreating(true);
    try {
      const emoji = selectedEmoji || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const title = customTitle.trim() || t.home.unnamedNotebook;
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, emoji }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errors.notebookCreateError);
      if (data.notebook) {
        setShowTemplateModal(false);
        success(t.toast.success);
        router.push(`/notebook/${data.notebook.id}`);
      }
    } catch (e) {
      error(e instanceof Error ? e.message : t.errors.notebookCreateError);
    } finally {
      setCreating(false);
    }
  }

  async function deleteNotebook() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Soft delete: the notebook is moved to the trash and can be restored.
      const res = await fetch(`/api/notebooks/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(t.errors.notebookDeleteError);
      setNotebooks((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      info(t.notebook.movedToTrash);
    } catch {
      error(t.errors.notebookDeleteError);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const handleTemplateClick = (tpl: { title: string; emoji: string }) => {
    setCustomTitle(tpl.title);
    setSelectedEmoji(tpl.emoji);
    createNotebook();
  };

  async function loadTrash() {
    setLoadingTrash(true);
    try {
      const res = await fetch("/api/notebooks/trash");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errors.apiError);
      setTrashNotebooks(data.notebooks ?? []);
    } catch {
      error(t.errors.apiError);
    } finally {
      setLoadingTrash(false);
    }
  }

  function toggleTrash() {
    if (!showTrash) loadTrash();
    setShowTrash((prev) => !prev);
  }

  async function restoreNotebookFromTrash(nb: Notebook) {
    try {
      const res = await fetch(`/api/notebooks/${nb.id}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errors.apiError);
      setTrashNotebooks((prev) => prev.filter((n) => n.id !== nb.id));
      // Refresh the active list so the restored notebook reappears.
      setNotebooks((prev) => [data.notebook, ...prev.filter((n) => n.id !== nb.id)]);
      success(t.notebook.notebookRestored);
    } catch {
      error(t.errors.apiError);
    }
  }

  async function permanentlyDeleteNotebook() {
    if (!permanentTarget) return;
    try {
      const res = await fetch(`/api/notebooks/${permanentTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permanent: true }),
      });
      if (!res.ok) throw new Error(t.errors.notebookDeleteError);
      setTrashNotebooks((prev) => prev.filter((n) => n.id !== permanentTarget.id));
      setNotebooks((prev) => prev.filter((n) => n.id !== permanentTarget.id));
      setPermanentTarget(null);
      info(t.notebook.notebookDeletedPermanently);
    } catch {
      error(t.errors.notebookDeleteError);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* Navbar Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25 sm:h-11 sm:w-11">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl">بحّاثة</h1>
                <span className="hidden rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 sm:inline">
                  NotebookLM AI
                </span>
              </div>
              <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">{t.common.appTagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <ThemeToggle />
            <LanguageToggle compact />
            <UserProfileButton currentUser={currentUser} />

            <Button
              onClick={() => setShowTemplateModal(true)}
              disabled={creating}
              size="sm"
              className="hidden sm:flex"
            >
              {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              {t.home.newNotebook}
            </Button>

            {/* Trash Button + Dropdown */}
            <div className="relative z-[9999]">
              <button
                onClick={toggleTrash}
                type="button"
                aria-label={t.notebook.trash}
                title={t.notebook.trash}
                className={`flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400 ${showTrash ? "border-red-300 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400" : ""
                  }`}
              >
                <Trash2 size={17} />
              </button>

              {showTrash && (
                <>
                  {/* Click-away backdrop */}
                  <div className="fixed inset-0 z-[9998]" onClick={() => setShowTrash(false)} />
                  <div className="fixed right-4 top-[68px] z-[9999] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.notebook.trash}</p>
                      <button
                        onClick={() => setShowTrash(false)}
                        type="button"
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                        aria-label={t.common.close}
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto p-2">
                      {loadingTrash ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                          <Loader2 size={16} className="animate-spin" />
                          {t.common.loading}
                        </div>
                      ) : trashNotebooks.length === 0 ? (
                        <div className="py-8 text-center">
                          <Trash2 size={22} className="mx-auto mb-2 text-slate-300" />
                          <p className="text-sm text-slate-400">{t.notebook.trashEmpty}</p>
                        </div>
                      ) : (
                        <ul className="space-y-1">
                          {trashNotebooks.map((nb) => (
                            <li
                              key={nb.id}
                              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              <span className="text-xl">{nb.emoji}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{nb.title}</p>
                                <p className="text-[11px] text-slate-400">
                                  {new Date(nb.updatedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <button
                                onClick={() => restoreNotebookFromTrash(nb)}
                                type="button"
                                className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1.5 text-[11px] font-bold text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
                                title={t.notebook.restore}
                              >
                                <RotateCcw size={13} />
                                {t.notebook.restore}
                              </button>
                              <button
                                onClick={() => setPermanentTarget(nb)}
                                type="button"
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50"
                                title={t.notebook.deleteForever}
                                aria-label={t.notebook.deleteForever}
                              >
                                <X size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Banner Hero Section */}
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-6 text-white shadow-xl dark:border-indigo-900/50 sm:p-8">
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-purple-500/30 blur-3xl" />

          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md border border-white/20">
                <Sparkles size={14} className="text-amber-300" />
                {currentUser ? `${t.auth.welcomeBack}, ${currentUser.name} 👋` : t.home.heroWelcome}
              </span>
              <h2 className="text-xl font-black md:text-3xl text-white">{t.home.heroTitle}</h2>
              <p className="text-sm leading-relaxed text-indigo-100/90">
                {t.home.heroSubtitle}
              </p>
            </div>

            {/* Quick Stat Badges */}
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <div className="rounded-2xl bg-white/10 p-3 text-center backdrop-blur-md border border-white/10 min-w-[90px] sm:min-w-[100px]">
                <p className="text-2xl font-black text-white">{notebooks.length}</p>
                <p className="text-[11px] text-indigo-200">{t.home.notebooksCount}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center backdrop-blur-md border border-white/10 min-w-[90px] sm:min-w-[100px]">
                <p className="text-2xl font-black text-white">{totalSources}</p>
                <p className="text-[11px] text-indigo-200">{t.home.sourcesCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar & Section Title */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{t.home.yourNotebooks}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.home.notebooksSubtitle}
            </p>
          </div>

          <div className="relative min-w-[280px]">
            <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.home.searchPlaceholder}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-10 pl-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-950"
            />
          </div>
        </div>

        {/* Notebooks Grid */}
        {filteredNotebooks.length === 0 ? (
          searchQuery ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <Search size={32} className="mx-auto mb-3 text-slate-400" />
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">{t.home.noResults}</p>
              <p className="mt-1 text-xs text-slate-400">{t.home.noResultsSubtitle}</p>
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
                <p className="text-base font-bold">{t.home.createFirstNotebook}</p>
                <p className="max-w-xs text-center text-xs text-slate-400">
                  {t.home.createFirstSubtitle}
                </p>
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.home.newNotebook}</span>
            </button>

            {/* Existing Notebook Cards */}
            {filteredNotebooks.map((nb) => (
              <a
                key={nb.id}
                href={`/notebook/${nb.id}`}
                className="group relative flex min-h-[190px] flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800"
              >
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(nb); }}
                  className="absolute left-4 top-4 rounded-xl p-2 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/50"
                  aria-label={t.common.delete}
                  title={t.common.delete}
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
                    <span>{nb.sourceCount ?? 0} {t.home.sources}</span>
                  </div>
                  <span>{new Date(nb.updatedAt).toLocaleDateString('ar-SA')}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* New Notebook Modal */}
      <Modal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title={t.home.deleteNotebookTitle}
        description={t.home.deleteNotebookSubtitle}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={createNotebook} isLoading={creating} loadingText={t.common.loading}>
              <Plus size={16} />
              {t.home.createNotebookBtn}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Custom Title Input */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.home.notebookName}</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-950">
                {EMOJIS.slice(0, 6).map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`rounded-xl p-1.5 text-xl transition ${selectedEmoji === emoji ? "bg-white shadow-sm dark:bg-slate-800" : "opacity-60 hover:opacity-100"
                      }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <Input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={t.home.notebookPlaceholder}
                className="flex-1"
              />
            </div>
          </div>

          {/* Preset Templates */}
          <div>
            <p className="mb-3 text-xs font-bold text-slate-700 dark:text-slate-300">{t.home.orTemplates}</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.title}
                  onClick={() => handleTemplateClick(tpl)}
                  disabled={creating}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 transition hover:border-indigo-500 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-indigo-800"
                >
                  <span className="text-2xl">{tpl.emoji}</span>
                  <div className="min-w-0 text-right">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{tpl.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {tpl.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation — moves the notebook to the trash */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t.common.delete}
        message={t.notebook.movedToTrash}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        onConfirm={deleteNotebook}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Permanent Delete Confirmation (from trash) */}
      <ConfirmDialog
        open={permanentTarget !== null}
        title={t.notebook.deleteForever}
        message={t.notebook.confirmPermanentDelete}
        confirmText={t.notebook.deleteForever}
        cancelText={t.common.cancel}
        onConfirm={permanentlyDeleteNotebook}
        onCancel={() => setPermanentTarget(null)}
      />
    </main>
  );
}