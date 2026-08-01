"use client";

import { useEffect, useRef, useState } from "react";
import { 
  Send, Sparkles, BookOpen, Loader2, MessageCircle, Globe, 
  Lightbulb, ArrowUpRight, Copy, Check, Bookmark, RefreshCw 
} from "lucide-react";
import type { ChatMessage, SourceItem, FollowUpSuggestion, NoteItem } from "@/lib/types";
import Markdown from "@/components/markdown";

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
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [expandingMessageId, setExpandingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [savedNoteMessageId, setSavedNoteMessageId] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (sources.length > 0 && messages.length === 0) {
      fetch(`/api/notebooks/${notebookId}/suggestions`)
        .then((r) => r.json())
        .then((d) => setSuggestions(d.questions || []))
        .catch(() => {});
    }
  }, [sources.length, messages.length, notebookId]);

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
        body: JSON.stringify({ question, sourceIds: selectedSourceIds }),
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

  const lastAssistantMessage = messages.filter(m => m.role === "assistant").slice(-1)[0];

  return (
    <div className={`flex h-full flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-200 ${isCollapsed ? "hidden" : ""}`}>
      {/* Panel Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <MessageCircle size={16} />
          </div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">المحادثة التعليمية والتحليلية</h2>
        </div>
        {messages.length > 0 && (
          <span className="text-[11px] font-medium text-slate-400">
            {messages.length} رسالة
          </span>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center text-slate-400">
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-indigo-500/20 blur-xl animate-pulse" />
              <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-600/30">
                <Sparkles size={36} />
              </div>
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">مساعدك التعليمي الذكي</h3>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {sources.length === 0
                  ? "أضف مصادرك من اللوحة الجانبية، ثم اسأل أي سؤال وستحصل على إجابات مفصّلة مدعمة بالاستشهادات."
                  : "اطرح أي سؤال حول مصادرك المحددة، ودع الذكاء الاصطناعي يشرح المفاهيم بأمثلة واضحة."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((m) => (
              <div key={m.id} className="animate-fade-in">
                <div className={`flex ${m.role === "user" ? "justify-start" : "justify-start"}`}>
                  <div
                    className={`group relative max-w-[95%] rounded-3xl p-5 shadow-sm transition-all ${
                      m.role === "user"
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-600/20"
                        : "border border-slate-200/80 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {/* Role Header indicator */}
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <span className={`text-[10px] font-bold ${m.role === "user" ? "text-indigo-200" : "text-indigo-600 dark:text-indigo-400"}`}>
                        {m.role === "user" ? "سؤالك" : "إجابة بحّاثة الذكي"}
                      </span>

                      {/* Action buttons for assistant message */}
                      {m.role === "assistant" && (
                        <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100 transition">
                          <button
                            onClick={() => handleCopy(m.id, m.content)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition"
                            title="نسخ النص"
                          >
                            {copiedMessageId === m.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                          {onSaveAsNote && (
                            <button
                              onClick={() => saveAnswerAsNote(m.id, m.content)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition"
                              title="حفظ كملاحظة في الاستوديو"
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
                        <span className="text-[11px] font-bold text-slate-400">المصادر المُستشهد بها:</span>
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
                          {expandingMessageId === m.id ? "جارٍ التوسعة من الإنترنت..." : "🌐 توسيع ودعم الإجابة من الإنترنت"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-bold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <Loader2 size={18} className="animate-spin text-indigo-600" />
                  <span>جارٍ البحث في مستنداتك وتوليد الإجابة الدقيقة...</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Follow-up Suggestions */}
      {followUps.length > 0 && !sending && (
        <div className="border-t border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            <Lightbulb size={14} className="text-amber-500" />
            <span>أسئلة للمتابعة والتوسيع:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {followUps.map((fu, i) => (
              <button
                key={i}
                onClick={() => send(fu.text)}
                className="group flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:text-indigo-400"
              >
                {fu.type === "expand" && "📖"}
                {fu.type === "related" && "🔗"}
                {fu.type === "example" && "💡"}
                {fu.type === "deeper" && "🔬"}
                <span>{fu.text}</span>
                <ArrowUpRight size={12} className="opacity-0 transition group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Initial Suggestions */}
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">💡 أسئلة اقترحتها مستنداتك:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((q, i) => (
              <button
                key={i}
                onClick={() => send(q)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 px-4 py-2 text-xs font-bold text-red-600 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اسأل سؤالاً تفاعلياً حول مصادرك..."
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-950"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
