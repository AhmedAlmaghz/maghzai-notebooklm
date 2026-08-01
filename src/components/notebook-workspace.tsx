"use client";

import { useMemo, useState } from "react";
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
import AudioOverviewPlayer from "@/components/audio-overview-player";

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
  const [title, setTitle] = useState(notebook.title);
  const [emoji, setEmoji] = useState(notebook.emoji || "📓");
  const [sources, setSources] = useState<SourceItem[]>(initialSources);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [savedTitleState, setSavedTitleState] = useState(false);

  // Audio Overview player state
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);

  // Panel collapse states
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);

  const [viewingSource, setViewingSource] = useState<SourceItem | null>(null);
  const [viewingSourceContent, setViewingSourceContent] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<NoteItem | null>(null);

  const selectedSourceIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    if (!confirm("حذف هذا الدفتر بالكامل؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    await fetch(`/api/notebooks/${notebook.id}`, { method: "DELETE" });
    router.push("/");
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
          {/* Audio Overview Podcast Button */}
          <button
            onClick={() => setShowAudioPlayer(!showAudioPlayer)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm ${
              showAudioPlayer
                ? "bg-indigo-600 text-white shadow-indigo-600/30"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:text-indigo-300 dark:hover:bg-indigo-900"
            }`}
          >
            <Headphones size={15} />
            <span className="hidden sm:inline">حوار صوتي</span>
          </button>

          <ThemeToggle />

          <button
            onClick={deleteNotebook}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 transition"
            title="حذف الدفتر"
          >
            <Trash2 size={15} />
            <span className="hidden lg:inline">حذف</span>
          </button>
        </div>
      </header>

      {/* Audio Overview Banner (If active) */}
      {showAudioPlayer && (
        <div className="px-4 py-3 border-b border-indigo-100 dark:border-indigo-950 bg-indigo-50/50 dark:bg-indigo-950/20">
          <div className="mx-auto max-w-4xl">
            <AudioOverviewPlayer
              title={`حوار صوتي تلخيصي: ${title}`}
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
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-xs font-bold transition ${
              mobileTab === key
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
                hasSources={sources.length > 0}
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
            hasSources={sources.length > 0}
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
    </div>
  );
}
