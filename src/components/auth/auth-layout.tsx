"use client";

import { useI18n } from "@/i18n/provider";
import LanguageToggle from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";
import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  subtitle: string;
}

export default function AuthLayout({ children, subtitle }: AuthLayoutProps) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <a href="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25">
            <BookOpen size={20} />
          </div>
          <span className="text-lg font-extrabold text-slate-900 dark:text-white">{t.common.appName}</span>
        </a>
        <div className="flex items-center gap-2">
          <LanguageToggle compact />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">{t.auth.welcomeBack}</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}