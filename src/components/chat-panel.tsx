"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send, Sparkles, BookOpen, Loader2, MessageCircle, Globe,
  Lightbulb, ArrowUpRight, Copy, Check, Bookmark, Info,
  ChevronDown, Maximize2, Minimize2, FileDown, Printer
} from "lucide-react";
import type { ChatMessage, SourceItem, FollowUpSuggestion, NoteItem, AnswerMode } from "@/lib/types";
import Markdown from "@/components/markdown";
import { AnimatedContainer } from "@/components/ui/animated-container";
import { useI18n } from "@/i18n/provider";

/** Escape a string for safe insertion into HTML. */
function escapeHtml(value: string): string {
  const amp = String.fromCharCode(38) + "amp;";
  const lt = String.fromCharCode(60) + "lt;";
  const gt = String.fromCharCode(62) + "gt;";
  const quot = String.fromCharCode(34) + "quot;";
  const apos = String.fromCharCode(39) + "#039;";
  return value
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot)
    .replace(/'/g, apos);
}

export default function ChatPanel({
  notebookId,
  messages,
  setMessages,
  sources,
  selectedSourceIds,
  onOpenCitation,
  onSaveAsNote,
  isCollapsed,
}: {
  notebookId: string;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sources: SourceItem[];
  selectedSourceIds: string[];
  onOpenCitation: (sourceId: string) => void;
  onSaveAsNote?: (note: NoteItem) => void;
  isCollapsed?: boolean;
}) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [expandingMessageId, setExpandingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [savedNoteMessageId, setSavedNoteMessageId] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string>("");
  // Answer mode: "sources" (default) or "expanded".
  const [answerMode, setAnswerMode] = useState<AnswerMode>("sources");
  const [showModeHelper, setShowModeHelper] = useState(false);
  // Fullscreen (reading mode) for the chat panel only.
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Dropdown state: opened on hover, positioned with `position: fixed` so it
  // always renders above every other component (escaping any overflow clipping).
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Refs to each user message so we can scroll to them from the dropdown.
  const userMessageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dropdownTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (sources.length > 0 && messages.length === 0) {
      const params = new URLSearchParams();
      if (selectedSourceIds.length > 0) {
        params.set("sourceIds", selectedSourceIds.join(","));
      }
      const qs = params.toString();
      fetch(`/api/notebooks/${notebookId}/suggestions${qs ? `?${qs}` : ""}`)
        .then((r) => r.json())
        .then((d) => setSuggestions(d.questions || []))
        .catch(() => { });
    }
  }, [sources.length, messages.length, notebookId, selectedSourceIds]);

  // Close the dropdown when the user presses Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function send(question: string) {
    if (!question.trim() || sending) return;
    if (sources.length === 0) {
      setError("أضف مصدراً واحداً على الأقل قبل بدء المحادثة");
      return;
    }
    setError(null);
    setSending(true);
    setInput("");
    setSuggestions([]);
    setFollowUps([]);
    setLastQuestion(question);

    const optimisticUser: ChatMessage = {
      id: `tmp-${Date.now()}`,
      notebookId,
      role: "user",
      content: question,
      citations: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sourceIds: selectedSourceIds, mode: answerMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "حدث خطأ أثناء المحادثة");
      setMessages((prev) => [...prev, data.message]);
      if (data.followUps) {
        setFollowUps(data.followUps);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء الإرسال");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  }

  async function expandWithWebSearch(messageId: string, previousAnswer: string) {
    setExpandingMessageId(messageId);
    setFollowUps([]);

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/chat/expand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: lastQuestion,
          previousAnswer,
          messageId,
          sourceIds: selectedSourceIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل البحث في الويب");

      if (data.expandedContent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: m.content + "\n\n" + data.expandedContent }
              : m
          )
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل البحث في الويب");
    } finally {
      setExpandingMessageId(null);
    }
  }

  function handleCopy(messageId: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }

  async function saveAnswerAsNote(messageId: string, content: string) {
    try {
      const title = content.slice(0, 40).replace(/[*#]/g, "").trim() + "...";
      const res = await fetch(`/api/notebooks/${notebookId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `إجابة: ${title}`, content, kind: "note" }),
      });
      const data = await res.json();
      if (data.note) {
        setSavedNoteMessageId(messageId);
        if (onSaveAsNote) onSaveAsNote(data.note);
        setTimeout(() => setSavedNoteMessageId(null), 2000);
      }
    } catch (err) {
      console.error("فشل حفظ الملاحظة:", err);
    }
  }

  function scrollToQuestion(messageId: string) {
    userMessageRefs.current.get(messageId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Open the dropdown and compute its fixed position relative to the viewport.
  // `left` is anchored to the trigger's left edge so the menu opens *inward*
  // (into the chat frame) rather than outward toward the side panels.
  function openDropdown() {
    const el = dropdownTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    setDropdownOpen(true);
  }

  function closeDropdown() {
    setDropdownOpen(false);
  }

  // Toggle fullscreen (reading mode) for the chat panel only, using a CSS
  // overlay (fixed inset-0 + very high z-index) so the rest of the UI is hidden.
  function toggleFullscreen() {
    setIsFullscreen((v) => !v);
  }

  // Build a clean, printable HTML document from the chat messages.
  function buildChatPrintHtml(): string {
    const rows = messages
      .map((m) => {
        const isUser = m.role === "user";
        const label = isUser ? t.chat.yourQuestion : t.chat.assistantAnswer;
        const body = escapeHtml(m.content).replace(/\n/g, "<br>");
        return `
          <div class="msg ${isUser ? "user" : "assistant"}">
            <div class="role">${escapeHtml(label)}</div>
            <div class="body">${body}</div>
          </div>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(t.chat.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      direction: rtl;
      padding: 40px;
      line-height: 1.8;
      color: #1e293b;
      background: #fff;
    }
    h1 { color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; font-size: 22px; }
    .msg { margin-bottom: 20px; padding: 14px 16px; border-radius: 12px; }
    .msg.user { background: #eef2ff; border: 1px solid #e0e7ff; }
    .msg.assistant { background: #f8fafc; border: 1px solid #e2e8f0; }
    .role { font-size: 12px; font-weight: 700; color: #6366f1; margin-bottom: 6px; }
    .body { font-size: 14px; white-space: normal; word-break: break-word; }
    @media print {
      body { padding: 20px; }
      .msg { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(t.chat.title)}</h1>
  ${rows}
</body>
</html>`;
  }

  // Export the chat as a PDF by opening a dedicated print window (the user can
  // then "Save as PDF" from the print dialog).
  function exportChatAsPdf() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError(t.chat.exportPdfFailed);
      return;
    }
    printWindow.document.write(buildChatPrintHtml());
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  }

  // Print the chat using the current page with print CSS that shows only the
  // chat panel (see the `.chat-print-area` rules in globals.css).
  function printChat() {
    window.print();
  }

  const lastAssistantMessage = messages.filter(m => m.role === "assistant").slice(-1)[0];
  const userQuestions = messages.filter((m) => m.role === "user");

  // Suggestions to render inline after the last reply: prefer follow-ups from the
  // last answer, otherwise fall back to the initial /suggestions questions.
  const inlineSuggestions: string[] =
    followUps.length > 0 ? followUps.map((f) => f.text) : suggestions;

  return (
    <div
      className={`flex h-full flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-200 ${isCollapsed ? "hidden" : ""} ${isFullscreen ? "fixed inset-0 z-[999] h-screen" : ""
        }`}
    >
      {/* Panel Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <MessageCircle size={14} />
          </div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.chat.title}</h2>
        </div>

        {/* Header action buttons */}
        <div className="flex items-center gap-1">
          {/* Fullscreen (reading mode) toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            title={isFullscreen ? t.chat.fullscreenExit : t.chat.fullscreenEnter}
            aria-label={isFullscreen ? t.chat.fullscreenExit : t.chat.fullscreenEnter}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Export chat as PDF */}
          <button
            type="button"
            onClick={exportChatAsPdf}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            title={t.chat.exportPdf}
            aria-label={t.chat.exportPdf}
          >
            <FileDown size={15} />
          </button>

          {/* Print chat */}
          <button
            type="button"
            onClick={printChat}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            title={t.chat.printChat}
            aria-label={t.chat.printChat}
          >
            <Printer size={15} />
          </button>

          {/* Conversations count with hover dropdown of user questions.
              The button and its dropdown live inside ONE `relative` container
              with a very high z-index (z-[9999]) so the menu always renders
              above the message replies, the studio sidebar, and any parent
              with `overflow-hidden`. The menu itself uses `position: fixed`
              (with viewport coordinates computed from the trigger) to escape
              any ancestor clipping. */}
          {messages.length > 0 && (
            <div
              ref={dropdownTriggerRef}
              className="relative z-[9999]"
              onMouseEnter={openDropdown}
              onMouseLeave={closeDropdown}
            >
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                title={t.chat.messagesDropdownHint}
              >
                {messages.length} {t.chat.messagesCountLabel}
                <ChevronDown size={12} className="transition group-hover:rotate-180" />
              </button>

              {/* Fixed-position dropdown: rendered above every component and
                  aligned inward (into the chat frame) via `left`. */}
              {dropdownOpen && dropdownPos && (
                <div
                  className="fixed z-[9999] mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                  style={{ top: dropdownPos.top, left: dropdownPos.left }}
                >
                  <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {t.chat.messagesDropdownHint}
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {userQuestions.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-slate-400">{t.chat.noQuestionsYet}</div>
                    ) : (
                      userQuestions.map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => scrollToQuestion(q.id)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-indigo-950/50"
                        >
                          <MessageCircle size={12} className="mt-0.5 shrink-0 text-indigo-400" />
                          <span className="line-clamp-2">{q.content}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-print-area flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center text-slate-400">
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-indigo-500/20 blur-xl animate-pulse" />
              <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-600/30">
                <Sparkles size={36} />
              </div>
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t.chat.emptyTitle}</h3>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {sources.length === 0
                  ? t.chat.emptyNoSources
                  : t.chat.emptyWithSources}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 max-w-4xl mx-auto">
            {messages.map((m) => (
              <AnimatedContainer key={m.id} animation="slide" direction="up" duration={0.3}>
                <div
                  ref={(el) => {
                    if (m.role === "user" && el) userMessageRefs.current.set(m.id, el);
                  }}
                  className="flex justify-start"
                >
                  <div
                    className={`group relative max-w-[95%] rounded-3xl p-4 shadow-sm transition-all ${m.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-600/20"
                      : "border border-slate-200/80 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                      }`}
                  >
                    {/* Role Header indicator */}
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <span className={`text-[10px] font-bold ${m.role === "user" ? "text-indigo-200" : "text-indigo-600 dark:text-indigo-400"}`}>
                        {m.role === "user" ? t.chat.yourQuestion : t.chat.assistantAnswer}
                      </span>

                      {/* Action buttons for assistant message */}
                      {m.role === "assistant" && (
                        <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100 transition">
                          <button
                            onClick={() => handleCopy(m.id, m.content)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition"
                            title={t.chat.copyText}
                          >
                            {copiedMessageId === m.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                          {onSaveAsNote && (
                            <button
                              onClick={() => saveAnswerAsNote(m.id, m.content)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition"
                              title={t.chat.saveAsNote}
                            >
                              {savedNoteMessageId === m.id ? <Check size={14} className="text-emerald-500" /> : <Bookmark size={14} />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    {m.role === "assistant" ? (
                      <Markdown content={m.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">{m.content}</p>
                    )}

                    {/* Citations section */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <span className="text-[11px] font-bold text-slate-400">{t.chat.citedSources}</span>
                        {m.citations.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => onOpenCitation(c.sourceId)}
                            className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:text-indigo-300 dark:hover:bg-indigo-900 transition"
                          >
                            <BookOpen size={11} />
                            {c.sourceTitle.length > 28 ? c.sourceTitle.slice(0, 28) + "…" : c.sourceTitle}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Web Search Extension - only for the latest assistant message */}
                    {m.role === "assistant" && m.id === lastAssistantMessage?.id && (
                      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <button
                          onClick={() => expandWithWebSearch(m.id, m.content)}
                          disabled={expandingMessageId === m.id}
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:from-blue-950/60 dark:to-indigo-950/60 dark:text-indigo-300 hover:opacity-90 transition disabled:opacity-50"
                        >
                          {expandingMessageId === m.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Globe size={14} />
                          )}
                          {expandingMessageId === m.id ? t.chat.expanding : t.chat.expandWeb}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </AnimatedContainer>
            ))}

            {sending && (
              <AnimatedContainer animation="fade" duration={0.2}>
                <div className="flex justify-start">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-bold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <Loader2 size={18} className="animate-spin text-indigo-600" />
                    <span>{t.chat.sending}</span>
                  </div>
                </div>
              </AnimatedContainer>
            )}

            {/* Inline suggestions after the last reply */}
            {inlineSuggestions.length > 0 && !sending && (
              <AnimatedContainer animation="fade" duration={0.2}>
                <div className="flex justify-start">
                  <div className="max-w-[95%]">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <Lightbulb size={14} className="text-amber-500" />
                      <span>{t.chat.suggestionsLabel}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {inlineSuggestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => send(q)}
                          className="group flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:text-indigo-400"
                        >
                          <span>{q}</span>
                          <ArrowUpRight size={12} className="opacity-0 transition group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </AnimatedContainer>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="bg-red-50 px-4 py-2 text-xs font-bold text-red-600 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Helper tooltip when expanded mode is active */}
        {answerMode === "expanded" && showModeHelper && (
          <div className="mb-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200">
            {t.chat.expandedModeHelper}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5 transition focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:focus-within:ring-indigo-950">
          {/* Single mode toggle button inside the input */}
          <button
            type="button"
            onClick={() => setAnswerMode((m) => (m === "expanded" ? "sources" : "expanded"))}
            title={t.chat.modeToggleHint}
            aria-label={answerMode === "expanded" ? t.chat.expandedMode : t.chat.sourcesOnlyMode}
            aria-pressed={answerMode === "expanded"}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${answerMode === "expanded"
              ? "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300"
              : "text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              }`}
          >
            {answerMode === "expanded" ? <Globe size={15} /> : <BookOpen size={15} />}
          </button>
          {/* 
          <button
            type="button"
            onClick={() => setShowModeHelper((v) => !v)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200/70 hover:text-indigo-600 dark:hover:bg-slate-800"
            title={t.chat.expandedModeHelper}
            aria-label={t.chat.expandedModeHelper}
          >
            <Info size={14} />
          </button> */}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chat.inputPlaceholder}
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none dark:text-slate-100"
          />

          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:shadow-none"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
