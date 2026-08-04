"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Reads the initial theme from localStorage (client-only guard). */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const saved = window.localStorage.getItem("theme") as Theme | null;
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "system";
}

/** Resolves the actual light/dark preference for the current theme setting. */
function resolveDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  // "system" mode follows the OS preference.
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const [mounted, setMounted] = useState(false);

  // Apply the resolved theme to <html> as soon as the component mounts,
  // and keep it in sync whenever the theme changes.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolveDark(theme));
    window.localStorage.setItem("theme", theme);
    setMounted(true);
  }, [theme]);

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

  const isDark = mounted && resolveDark(theme);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
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
