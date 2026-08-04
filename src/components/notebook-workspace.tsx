"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, FileStack, MessageCircle, Sparkles, Trash2,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Headphones, Check, BookOpen
} from "lucide-react";
import type { ChatMessage, Notebook, NoteItem, SourceItem } from "@/lib/types";
import SourcesPanel from "@/components/sources-panel";
import ChatPanel from "@/components/chat-panel";
import StudioPanel from "@/components/studio-panel";
import SourceViewer from "@/components/source-viewer";
import NoteViewer from "@/components/note-viewer";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import AudioOverviewPlayer from "@/components/audio-overview-player";
import NotebookSwitcher from "@/components/notebook-switcher";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { useNotebookShortcuts } from "@/hooks/use-keyboard-shortcuts";

const NEW_NOTEBOOK_EMOJIS = ["📓", "📚", "🧪", "💡", "🧠", "📊", "🔬", "🗂️", "📝", "🌐", "⚡", "🎓", "🤖", "🚀"];

type MobileTab = "sources" | "chat" | "studio";

export default function NotebookWorkspace({
  notebook,
  initialSources,
  initialMessages,
  initialNotes,
}: {
  notebook: Notebook;
  initialSources: SourceItem[];
  initialMessages: ChatMessage[];
  initialNotes: NoteItem[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { success, info } = useToast();
  const [title, setTitle] = useState(notebook.title);
  const [emoji, setEmoji] = useState(notebook.emoji || "📓");
  const [sources, setSources] = useState<SourceItem[]>(initialSources);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  // All notebooks the current user can see (for the header switcher).
  const [allNotebooks, setAllNotebooks] = useState<Notebook[]>([notebook]);
  // New-notebook modal state.
  const [showNewNotebookModal, setShowNewNotebookModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEmoji, setNewEmoji] = useState(NEW_NOTEBOOK_EMOJIS[0]);
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  // Soft-delete confirmation state.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingNotebook, setDeletingNotebook] = useState(false);
  // By default ALL sources are selected/used in chat & studio.
  // The user can toggle specific sources off; only selected ones are used.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSources.map((s) => s.id)),
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [savedTitleState, setSavedTitleState] = useState(false);

  // Audio Overview player state
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);

  // Add source dialog state
  const [showDialog, setShowDialog] = useState(false);

  // Panel collapse states
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);

  const [viewingSource, setViewingSource] = useState<SourceItem | null>(null);
  const [viewingSourceContent, setViewingSourceContent] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<NoteItem | null>(null);

  const selectedSourceIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  // Keep selection in sync: any newly added source is automatically selected.
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const s of sources) {
        if (!next.has(s.id)) {
          next.add(s.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sources]);

  // Load the full notebook list for the header switcher (excluding trashed ones).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notebooks")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setAllNotebooks(d.notebooks || []);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [notebook.id]);

  // Keyboard shortcuts
  useNotebookShortcuts({
    onSendMessage: () => {
      const input = document.querySelector('input[placeholder*="اسأل"]') as HTMLInputElement;
      if (input) input.focus();
    },
    onNewSource: () => setShowDialog(true),
    onToggleSources: () => setSourcesCollapsed(!sourcesCollapsed),
    onToggleStudio: () => setStudioCollapsed(!studioCollapsed),
    onCloseModal: () => {
      if (viewingSource) setViewingSource(null);
      if (viewingNote) setViewingNote(null);
    },
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(sources.map((s) => s.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function openSource(source: SourceItem) {
    setViewingSource(source);
    setViewingSourceContent(null);
    const res = await fetch(`/api/notebooks/${notebook.id}/sources/${source.id}`);
    const data = await res.json();
    setViewingSourceContent(data.source?.content ?? "تعذر تحميل المحتوى");
  }

  function openCitation(sourceId: string) {
    const source = sources.find((s) => s.id === sourceId);
    if (source) openSource(source);
  }

  async function saveTitle() {
    if (title.trim() === notebook.title) return;
    setSavedTitleState(true);
    await fetch(`/api/notebooks/${notebook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || "دفتر بحث بلا عنوان" }),
    });
    setTimeout(() => setSavedTitleState(false), 2000);
  }

  async function deleteNotebook() {
    if (deletingNotebook) return;
    setDeletingNotebook(true);
    try {
      const res = await fetch(`/api/notebooks/${notebook.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // no `permanent` flag → soft delete
      });
      if (!res.ok) throw new Error(t.errors.notebookDeleteError);
      // Notify the user that the notebook moved to the trash and can be restored.
      info(t.notebook.movedToTrash);
      setShowDeleteConfirm(false);
      router.push("/");
    } catch {
      setShowDeleteConfirm(false);
      router.push("/");
    } finally {
      setDeletingNotebook(false);
    }
  }

  async function createNewNotebook() {
    if (creatingNotebook) return;
    setCreatingNotebook(true);
    try {
      const title = newTitle.trim() || t.home.unnamedNotebook;
      const emoji = newEmoji || NEW_NOTEBOOK_EMOJIS[Math.floor(Math.random() * NEW_NOTEBOOK_EMOJIS.length)];
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, emoji }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errors.notebookCreateError);
      if (data.notebook) {
        success(t.toast.success);
        setShowNewNotebookModal(false);
        setNewTitle("");
        setNewEmoji(NEW_NOTEBOOK_EMOJIS[0]);
        router.push(`/notebook/${data.notebook.id}`);
      }
    } catch (e) {
      setShowNewNotebookModal(false);
    } finally {
      setCreatingNotebook(false);
    }
  }

  // Calculate grid columns based on collapsed states
  const getGridCols = () => {
    if (sourcesCollapsed && studioCollapsed) return "grid-cols-[52px_1fr_52px]";
    if (sourcesCollapsed) return "grid-cols-[52px_1fr_320px] lg:grid-cols-[52px_1fr_360px]";
    if (studioCollapsed) return "grid-cols-[300px_1fr_52px] lg:grid-cols-[340px_1fr_52px]";
    return "grid-cols-[300px_1fr_320px] lg:grid-cols-[340px_1fr_360px]";
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* Top Navbar Header */}
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <a
            href="/"
            className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
            title="العودة للصفحة الرئيسية"
          >
            <ArrowRight size={18} />
          </a>

          <span className="shrink-0 text-2xl">{emoji}</span>

          <div className="relative min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              className="w-full truncate bg-transparent text-base font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500/30 rounded-lg px-1 transition"
            />
            {savedTitleState && (
              <span className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-fade-in">
                <Check size={12} /> تم الحفظ
              </span>
            )}
          </div>
        </div>

        {/* Action Header Items */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Notebook switcher: list of available notebooks + new notebook + trash */}
          <NotebookSwitcher
            currentNotebookId={notebook.id}
            notebooks={allNotebooks}
            onNotebooksChange={setAllNotebooks}
            onNewNotebook={() => setShowNewNotebookModal(true)}
          />

          {/* Audio Overview Podcast Button */}
          <button
            onClick={() => setShowAudioPlayer(!showAudioPlayer)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm ${showAudioPlayer
              ? "bg-indigo-600 text-white shadow-indigo-600/30"
              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:text-indigo-300 dark:hover:bg-indigo-900"
              }`}
          >
            <Headphones size={15} />
            <span className="hidden sm:inline">{t.notebook.audioOverview}</span>
          </button>

          <ThemeToggle />
          <LanguageToggle compact />

          {/* Soft delete: moves the notebook to the trash */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 transition"
            title={t.notebook.deleteNotebook}
          >
            <Trash2 size={15} />
            <span className="hidden lg:inline">{t.notebook.deleteNotebook}</span>
          </button>
        </div>
      </header>

      {/* Audio Overview Banner (If active) */}
      {showAudioPlayer && (
        <div className="px-4 py-3 border-b border-indigo-100 dark:border-indigo-950 bg-indigo-50/50 dark:bg-indigo-950/20">
          <div className="mx-auto max-w-4xl">
            <AudioOverviewPlayer
              title={`حوار صوتي تلخيصي: ${title}`}
              notebookId={notebook.id}
              selectedSourceIds={selectedSourceIds}
              onClose={() => setShowAudioPlayer(false)}
            />
          </div>
        </div>
      )}

      {/* Mobile Tabs navigation */}
      <div className="flex border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden">
        {[
          { key: "sources" as MobileTab, label: `المصادر (${sources.length})`, icon: FileStack },
          { key: "chat" as MobileTab, label: "المحادثة", icon: MessageCircle },
          { key: "studio" as MobileTab, label: `الاستوديو (${notes.length})`, icon: Sparkles },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMobileTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-xs font-bold transition ${mobileTab === key
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-400 dark:text-slate-500"
              }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Desktop 3-Column Grid Workspace */}
      <div className={`hidden flex-1 overflow-hidden md:grid ${getGridCols()} transition-all duration-300`}>
        {/* Left Column: Sources Panel */}
        <div className="relative overflow-hidden border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-all duration-300">
          {sourcesCollapsed ? (
            <div className="flex h-full flex-col items-center py-4">
              <button
                onClick={() => setSourcesCollapsed(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
                title="فتح لوحة المصادر"
              >
                <PanelLeftOpen size={20} />
              </button>
              <div className="mt-6 flex flex-1 items-center">
                <span className="rotate-90 whitespace-nowrap text-xs font-bold text-slate-400">
                  المصادر ({sources.length})
                </span>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setSourcesCollapsed(true)}
                className="absolute left-2 top-3 z-10 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
                title="طي لوحة المصادر"
              >
                <PanelLeftClose size={16} />
              </button>
              <SourcesPanel
                notebookId={notebook.id}
                sources={sources}
                setSources={setSources}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                onViewSource={openSource}
              />
            </>
          )}
        </div>

        {/* Center Column: Chat Panel */}
        <div className="overflow-hidden bg-slate-50 dark:bg-slate-950">
          <ChatPanel
            notebookId={notebook.id}
            messages={messages}
            setMessages={setMessages}
            sources={sources}
            selectedSourceIds={selectedSourceIds}
            onOpenCitation={openCitation}
            onSaveAsNote={(newNote) => setNotes((prev) => [...prev, newNote])}
          />
        </div>

        {/* Right Column: Studio Panel */}
        <div className="relative overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-all duration-300">
          {studioCollapsed ? (
            <div className="flex h-full flex-col items-center py-4">
              <button
                onClick={() => setStudioCollapsed(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
                title="فتح لوحة الاستوديو"
              >
                <PanelRightOpen size={20} />
              </button>
              <div className="mt-6 flex flex-1 items-center">
                <span className="-rotate-90 whitespace-nowrap text-xs font-bold text-slate-400">
                  الاستوديو ({notes.length})
                </span>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setStudioCollapsed(true)}
                className="absolute right-2 top-3 z-10 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
                title="طي لوحة الاستوديو"
              >
                <PanelRightClose size={16} />
              </button>
              <StudioPanel
                notebookId={notebook.id}
                notes={notes}
                setNotes={setNotes}
                sources={sources}
                selectedSourceIds={selectedSourceIds}
                onOpenNote={setViewingNote}
                onTriggerAudioPlayer={() => setShowAudioPlayer(true)}
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile view content */}
      <div className="flex-1 overflow-hidden md:hidden">
        <div className={`h-full ${mobileTab === "sources" ? "block" : "hidden"}`}>
          <SourcesPanel
            notebookId={notebook.id}
            sources={sources}
            setSources={setSources}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onViewSource={openSource}
          />
        </div>
        <div className={`h-full ${mobileTab === "chat" ? "block" : "hidden"}`}>
          <ChatPanel
            notebookId={notebook.id}
            messages={messages}
            setMessages={setMessages}
            sources={sources}
            selectedSourceIds={selectedSourceIds}
            onOpenCitation={openCitation}
            onSaveAsNote={(newNote) => setNotes((prev) => [...prev, newNote])}
          />
        </div>
        <div className={`h-full ${mobileTab === "studio" ? "block" : "hidden"}`}>
          <StudioPanel
            notebookId={notebook.id}
            notes={notes}
            setNotes={setNotes}
            sources={sources}
            selectedSourceIds={selectedSourceIds}
            onOpenNote={setViewingNote}
            onTriggerAudioPlayer={() => setShowAudioPlayer(true)}
          />
        </div>
      </div>

      {/* Modal Viewers */}
      {viewingSource && (
        <SourceViewer
          source={viewingSource}
          content={viewingSourceContent}
          onClose={() => setViewingSource(null)}
        />
      )}

      {viewingNote && (
        <NoteViewer
          notebookId={notebook.id}
          note={viewingNote}
          onClose={() => setViewingNote(null)}
          onUpdated={(updated) => {
            setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
            setViewingNote(updated);
          }}
        />
      )}

      {/* Soft-delete confirmation dialog */}
      {showDeleteConfirm && (
        <Modal
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          size="sm"
          title={t.notebook.deleteNotebook}
          description={t.notebook.confirmDelete}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deletingNotebook}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={deleteNotebook}
                isLoading={deletingNotebook}
                loadingText={t.common.loading}
              >
                <Trash2 size={15} />
                {t.notebook.deleteNotebook}
              </Button>
            </>
          }
        >
          <div className="py-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {t.notebook.movedToTrash}
          </div>
        </Modal>
      )}

      {/* New Notebook modal */}
      <Modal
        open={showNewNotebookModal}
        onClose={() => setShowNewNotebookModal(false)}
        title={t.home.deleteNotebookTitle}
        description={t.home.deleteNotebookSubtitle}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowNewNotebookModal(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={createNewNotebook} isLoading={creatingNotebook} loadingText={t.common.loading}>
              <BookOpen size={16} />
              {t.home.createNotebookBtn}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.home.notebookName}</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-950">
                {NEW_NOTEBOOK_EMOJIS.slice(0, 6).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewEmoji(e)}
                    className={`rounded-xl p-1.5 text-xl transition ${
                      newEmoji === e ? "bg-white shadow-sm dark:bg-slate-800" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <Input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t.home.notebookPlaceholder}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
