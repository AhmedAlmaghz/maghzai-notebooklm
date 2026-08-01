"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, LogIn, UserPlus, ChevronDown } from "lucide-react";
import type { UserPayload } from "@/lib/auth";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";
import LanguageToggle from "@/components/language-toggle";

export default function UserProfileButton({ currentUser }: { currentUser: UserPayload | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const { success } = useToast();
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        success(t.auth.logoutSuccess);
        router.push("/");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (!currentUser) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <LanguageToggle compact />
        <a
          href="/login"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 transition"
        >
          <LogIn size={15} />
          <span className="hidden sm:inline">{t.auth.login}</span>
        </a>
        <a
          href="/register"
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
        >
          <UserPlus size={15} />
          <span className="hidden sm:inline">{t.auth.register}</span>
        </a>
      </div>
    );
  }

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <LanguageToggle compact />
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800 transition"
        >
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 font-bold text-white text-xs shadow-inner">
            {initials || <User size={16} />}
          </div>
          <span className="max-w-[120px] truncate text-xs font-bold text-slate-800 dark:text-slate-200 hidden sm:inline">
            {currentUser.name}
          </span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 mt-2 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-2 px-1">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                <p className="truncate text-[11px] text-slate-400 font-mono mt-0.5">{currentUser.email}</p>
              </div>

              <button
                onClick={handleLogout}
                disabled={loading}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition disabled:opacity-50"
              >
                <LogOut size={15} />
                <span>{t.auth.logout}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}