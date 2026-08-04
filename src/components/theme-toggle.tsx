"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Laptop } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  // Hydration-safe: until the component has mounted, we render a fixed
  // "neutral" state (no theme-derived classes, all buttons unpressed) that is
  // identical on server and client. The active styles are only applied after
  // useEffect runs, which prevents the server/client HTML mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use a stable neutral className (no theme dependency) during SSR/hydration.
  const neutralClassName =
    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200";

  const activeClassName: Record<string, string> = {
    light:
      "bg-white text-indigo-600 shadow-sm dark:bg-neutral-700 dark:text-indigo-400",
    dark: "bg-neutral-900 text-indigo-400 shadow-sm dark:bg-indigo-600 dark:text-white",
    system:
      "bg-white text-indigo-600 shadow-sm dark:bg-neutral-700 dark:text-indigo-400",
  };

  const getClassName = (mode: "light" | "dark" | "system") =>
    mounted && theme === mode ? activeClassName[mode] : neutralClassName;

  const getPressed = (mode: "light" | "dark" | "system") =>
    mounted && theme === mode;

  return (
    <div className="flex items-center rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 transition-colors">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`${neutralClassName} ${getClassName("light")}`}
        title={t.common.light}
        aria-label={t.theme.lightMode}
        aria-pressed={getPressed("light")}
      >
        <Sun size={14} />
        <span className="hidden sm:inline">{t.common.light}</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`${neutralClassName} ${getClassName("dark")}`}
        title={t.common.dark}
        aria-label={t.theme.darkMode}
        aria-pressed={getPressed("dark")}
      >
        <Moon size={14} />
        <span className="hidden sm:inline">{t.common.dark}</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        className={`${neutralClassName} ${getClassName("system")}`}
        title={t.common.system}
        aria-label={t.theme.systemMode}
        aria-pressed={getPressed("system")}
      >
        <Laptop size={14} />
      </button>
    </div>
  );
}
