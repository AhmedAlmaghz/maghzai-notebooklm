"use client";

import { useI18n } from "@/i18n/provider";
import { locales, type Locale } from "@/i18n";
import { Languages } from "lucide-react";

const LOCALE_LABEL: Record<Locale, string> = {
  ar: "ع",
  en: "EN",
};

const LOCALE_FULL: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 transition-colors">
      {locales.map((lang) => (
        <button
          key={lang}
          onClick={() => setLocale(lang)}
          className={`flex items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            locale === lang
              ? "bg-white text-indigo-600 shadow-sm dark:bg-neutral-700 dark:text-indigo-400"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
          title={LOCALE_FULL[lang]}
          aria-label={LOCALE_FULL[lang]}
        >
          {!compact && <Languages size={13} className="hidden sm:block" />}
          <span>{LOCALE_LABEL[lang]}</span>
        </button>
      ))}
    </div>
  );
}