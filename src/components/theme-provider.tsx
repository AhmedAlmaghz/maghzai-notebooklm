"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Validates a value as a Theme.
 * Returns "system" for anything unexpected.
 */
function toValidTheme(value: string | null): Theme {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

/**
 * Reads the persisted theme from localStorage.
 * Client-only — must never be called during SSR/render.
 */
function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    return toValidTheme(window.localStorage.getItem("theme"));
  } catch {
    return "system";
  }
}

/**
 * Resolves the actual light/dark preference for the current theme setting.
 * Safe on the server (falls back to light).
 */
function resolveDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  // "system" mode follows the OS preference.
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Important for hydration: the initial state is ALWAYS "system" (the same on
  // server and client first render). The persisted value is only applied inside
  // useEffect, after hydration, which prevents a hydration mismatch.
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  // After hydration: restore the persisted theme, then apply the resolved
  // class to <html>. This also writes the (default "system") value to
  // localStorage on first visit.
  useEffect(() => {
    setThemeState(readStoredTheme());
    setMounted(true);
  }, []);

  // Keep <html class="dark"> in sync with the resolved theme. Runs after
  // hydration (mounted) and whenever the theme changes.
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", resolveDark(theme));
  }, [theme, mounted]);

  // Persist the selection so it survives reloads.
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem("theme", theme);
    } catch {
      // localStorage may be unavailable (e.g. privacy mode); ignore.
    }
  }, [theme, mounted]);

  // When the theme is "system", react live to OS preference changes.
  useEffect(() => {
    if (!mounted || theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, mounted]);

  // Expose a stable resolved flag. Always false until mounted so client and
  // server render identically during hydration.
  const isDark = mounted && resolveDark(theme);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const value = useMemo<ThemeContextType>(
    () => ({ theme, setTheme, isDark }),
    [theme, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
