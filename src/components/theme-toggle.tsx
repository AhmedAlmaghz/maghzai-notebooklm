"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Laptop } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <div className="flex items-center rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 transition-colors">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${theme === "light"
            ? "bg-white text-indigo-600 shadow-sm dark:bg-neutral-700 dark:text-indigo-400"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        title={t.common.light}
        aria-label={t.theme.lightMode}
        aria-pressed={theme === "light"}
      >
        <Sun size={14} />
        <span className="hidden sm:inline">{t.common.light}</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${theme === "dark"
            ? "bg-neutral-900 text-indigo-400 shadow-sm dark:bg-indigo-600 dark:text-white"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        title={t.common.dark}
        aria-label={t.theme.darkMode}
        aria-pressed={theme === "dark"}
      >
        <Moon size={14} />
        <span className="hidden sm:inline">{t.common.dark}</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${theme === "system"
            ? "bg-white text-indigo-600 shadow-sm dark:bg-neutral-700 dark:text-indigo-400"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        title={t.common.system}
        aria-label={t.theme.systemMode}
        aria-pressed={theme === "system"}
      >
        <Laptop size={14} />
      </button>
    </div>
  );
}
