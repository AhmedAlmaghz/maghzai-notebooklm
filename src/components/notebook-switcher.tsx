"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BookOpen, Check, ChevronDown, Loader2, Plus, Trash2, RotateCcw, FileStack } from "lucide-react";
import type { Notebook } from "@/lib/types";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";

interface NotebookSwitcherProps {
  currentNotebookId: string;
  notebooks: Notebook[];
  onNotebooksChange?: (notebooks: Notebook[]) => void;
  /** Called when the user requests creating a new notebook (opens the modal). */
  onNewNotebook?: () => void;
}

/**
 * A compact header control that combines:
 *  - a dropdown listing all available notebooks (quick navigation),
 *  - a "New Notebook" button,
 *  - a trash button that lists soft-deleted notebooks and offers restore.
 *
 * The dropdown is rendered with `position: fixed` inside a single high
 * z-index container so it always appears above every panel (chat replies,
 * studio sidebar, etc.) even when an ancestor uses `overflow-hidden`.
 */
export default function NotebookSwitcher({
  currentNotebookId,
  notebooks,
  onNotebooksChange,
  onNewNotebook,
}: NotebookSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const { success, error, info } = useToast();

  const [open, setOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashedNotebooks, setTrashedNotebooks] = useState<Notebook[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const triggerRef = useRef<HTMLDivElement>(null);
  const trashTriggerRef = useRef<HTMLDivElement>(null);

  const currentNotebook = notebooks.find((nb) => nb.id === currentNotebookId);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setTrashOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openDropdown() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: 280 });
    setTrashOpen(false);
    setOpen(true);
  }

  function openTrashDropdown() {
    const el = trashTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: 300 });
    setOpen(false);
    setTrashOpen(true);
    void loadTrash();
  }

  async function loadTrash() {
    setLoadingTrash(true);
    try {
      const res = await fetch("/api/notebooks/trash");
      const data = await res.json();
      setTrashedNotebooks(data.notebooks || []);
    } catch {
      setTrashedNotebooks([]);
    } finally {
      setLoadingTrash(false);
    }
  }

  async function handleCreateNew() {
    if (creating) return;
    if (onNewNotebook) {
      onNewNotebook();
      setOpen(false);
      return;
    }
    // Fallback: create a notebook directly without opening the template modal.
    setCreating(true);
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t.home.unnamedNotebook, emoji: "📓" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errors.notebookCreateError);
      success(t.toast.success);
      setOpen(false);
      router.push(`/notebook/${data.notebook.id}`);
    } catch (e) {
      error(e instanceof Error ? e.message : t.errors.notebookCreateError);
    } finally {
      setCreating(false);
    }
  }

  async function restoreNotebook(id: string) {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/notebooks/${id}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errors.notebookUpdateError);
      setTrashedNotebooks((prev) => prev.filter((nb) => nb.id !== id));
      success(t.notebook.notebookRestored);
      if (onNotebooksChange) {
        const res2 = await fetch("/api/notebooks");
        const data2 = await res2.json();
        onNotebooksChange(data2.notebooks || []);
      }
    } catch (e) {
      error(e instanceof Error ? e.message : t.errors.notebookUpdateError);
    } finally {
      setRestoringId(null);
    }
  }

  async function permanentlyDelete(id: string) {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/notebooks/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permanent: true }),
      });
      if (!res.ok) throw new Error(t.errors.notebookDeleteError);
      setTrashedNotebooks((prev) => prev.filter((nb) => nb.id !== id));
      success(t.notebook.notebookDeletedPermanently);
    } catch {
      error(t.errors.notebookDeleteError);
    } finally {
      setRestoringId(null);
    }
  }

  function navigateTo(id: string) {
    setOpen(false);
    if (id === currentNotebookId) return;
    if (pathname === `/notebook/${id}`) return;
    router.push(`/notebook/${id}`);
  }

  return (
    <div className="relative z-[9999] flex items-center gap-1.5">
      {/* Notebook list dropdown */}
      <div
        ref={triggerRef}
        className="relative"
        onMouseEnter={openDropdown}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openDropdown())}
          className="flex max-w-[180px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:text-indigo-400"
          title={t.notebook.switchNotebook}
        >
          <BookOpen size={14} className="shrink-0 text-indigo-500" />
          <span className="truncate">{currentNotebook ? currentNotebook.emoji + " " + currentNotebook.title : t.notebook.switchNotebook}</span>
          <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && pos && (
          <div
            className="fixed z-[9999] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-fade-in"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {t.notebook.availableNotebooks} ({notebooks.length})
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {notebooks.length === 0 ? (
                <div className="px-3 py-3 text-center text-[11px] text-slate-400">
                  {t.notebook.noNotebooksYet}
                </div>
              ) : (
                notebooks.map((nb) => (
                  <button
                    key={nb.id}
                    type="button"
                    onClick={() => navigateTo(nb.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-indigo-50 dark:hover:bg-indigo-950/50 ${nb.id === currentNotebookId ? "bg-indigo-50/70 dark:bg-indigo-950/30" : ""}`}
                  >
                    <span className="shrink-0 text-base">{nb.emoji}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-700 dark:text-slate-300">
                      {nb.title}
                    </span>
                    {nb.id === currentNotebookId && (
                      <Check size={13} className="shrink-0 text-indigo-500" />
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 p-1.5 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t.home.newNotebook}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Notebook button */}
      <button
        type="button"
        onClick={handleCreateNew}
        disabled={creating}
        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60"
        title={t.home.newNotebook}
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        <span className="hidden sm:inline">{t.home.newNotebook}</span>
      </button>

      {/* Trash button + dropdown */}
      <div
        ref={trashTriggerRef}
        className="relative"
        onMouseEnter={openTrashDropdown}
        onMouseLeave={() => setTrashOpen(false)}
      >
        <button
          type="button"
          onClick={() => (trashOpen ? setTrashOpen(false) : openTrashDropdown())}
          className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
          title={t.notebook.trash}
          aria-label={t.notebook.trash}
        >
          <Trash2 size={15} />
        </button>

        {trashOpen && pos && (
          <div
            className="fixed z-[9999] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-fade-in"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onMouseEnter={() => setTrashOpen(true)}
            onMouseLeave={() => setTrashOpen(false)}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {t.notebook.trash} ({trashedNotebooks.length})
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {loadingTrash ? (
                <div className="flex items-center justify-center gap-2 px-3 py-4 text-[11px] text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  {t.common.loading}
                </div>
              ) : trashedNotebooks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-3 py-5 text-center">
                  <FileStack size={20} className="text-slate-300" />
                  <p className="text-[11px] text-slate-400">{t.notebook.trashEmpty}</p>
                </div>
              ) : (
                trashedNotebooks.map((nb) => (
                  <div
                    key={nb.id}
                    className="flex items-center gap-2 px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="shrink-0 text-base">{nb.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {nb.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => restoreNotebook(nb.id)}
                      disabled={restoringId === nb.id}
                      className="shrink-0 rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-950/50 disabled:opacity-50"
                      title={t.notebook.restore}
                    >
                      {restoringId === nb.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t.notebook.confirmPermanentDelete)) {
                          void permanentlyDelete(nb.id);
                        }
                      }}
                      disabled={restoringId === nb.id}
                      className="shrink-0 rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-50"
                      title={t.notebook.deleteForever}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
