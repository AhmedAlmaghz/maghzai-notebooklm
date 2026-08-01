"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Laptop } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 transition-colors">
      <button
        onClick={() => setTheme("light")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
          theme === "light"
            ? "bg-white text-indigo-600 shadow-sm dark:bg-neutral-700 dark:text-indigo-400"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        }`}
        title="الوضع الفاتح"
      >
        <Sun size={14} />
        <span className="hidden sm:inline">فاتح</span>
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
          theme === "dark"
            ? "bg-neutral-900 text-indigo-400 shadow-sm dark:bg-indigo-600 dark:text-white"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        }`}
        title="الوضع الداكن"
      >
        <Moon size={14} />
        <span className="hidden sm:inline">داكن</span>
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
          theme === "system"
            ? "bg-white text-indigo-600 shadow-sm dark:bg-neutral-700 dark:text-indigo-400"
            : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        }`}
        title="تلقائي حسب الجهاز"
      >
        <Laptop size={14} />
      </button>
    </div>
  );
}
