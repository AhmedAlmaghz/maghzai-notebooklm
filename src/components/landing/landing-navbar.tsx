"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Sparkles, ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import ThemeToggle from "@/components/theme-toggle";
import LanguageToggle from "@/components/language-toggle";
import Button from "@/components/ui/button";

const NAV_ANCHORS = [
  { key: "features", href: "#features" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "pricing", href: "#pricing" },
  { key: "faq", href: "#faq" },
] as const;

export default function LandingNavbar() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Prevent body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass-panel border-b border-slate-200/70 shadow-sm dark:border-slate-800/80"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 transition-transform group-hover:scale-105">
            <Sparkles size={18} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t.common.appName}
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_ANCHORS.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {t.landing.nav[item.key]}
            </a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <LanguageToggle />
          <Button variant="ghost" size="sm">
            <Link href="/login">{t.landing.nav.login}</Link>
          </Button>
          <Button size="sm">
            <Link href="/register">{t.landing.nav.getStarted}</Link>
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <LanguageToggle compact />
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? t.landing.nav.closeMenu : t.landing.nav.menu}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white/70 text-slate-700 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="glass-panel border-t border-slate-200/70 lg:hidden dark:border-slate-800/80">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {NAV_ANCHORS.map((item) => (
              <a
                key={item.key}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t.landing.nav[item.key]}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-800">
              <Button variant="outline" fullWidth>
                <Link href="/login">{t.landing.nav.login}</Link>
              </Button>
              <Button fullWidth>
                <Link href="/register" className="flex items-center gap-1.5">
                  {t.landing.nav.getStarted}
                  <ArrowRight size={15} className="rtl:rotate-180" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
