"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { defaultLocale, getLocaleFromString, isRTL, type Dictionary, type Locale } from "./index";
import ar from "./dictionaries/ar";
import en from "./dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { ar, en };

export const LOCALE_STORAGE_KEY = "nblm_locale";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
  dir: "rtl" | "ltr";
  lang: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = getLocaleFromString(localStorage.getItem(LOCALE_STORAGE_KEY));
    setLocaleState(saved);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRTL(locale) ? "rtl" : "ltr";
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale, mounted]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
  }, []);

  const t = dictionaries[locale];
  const dir: "rtl" | "ltr" = isRTL(locale) ? "rtl" : "ltr";

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir, lang: locale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}