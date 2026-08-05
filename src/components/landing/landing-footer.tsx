"use client";

import Link from "next/link";
import { Sparkles, Globe, Send, Rss } from "lucide-react";
import { useI18n } from "@/i18n/provider";

const SOCIALS = [
  { icon: Globe, label: "Website" },
  { icon: Send, label: "Telegram" },
  { icon: Rss, label: "RSS" },
];

export default function LandingFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30">
                <Sparkles size={18} />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                {t.common.appName}
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {t.landing.footer.tagline}
            </p>
            <div className="mt-5 flex gap-2">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-800 dark:hover:text-indigo-400"
                >
                  <social.icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {t.landing.footer.product}
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#features" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.productLinks.features}
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.productLinks.pricing}
                </a>
              </li>
              <li>
                <a href="#faq" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.productLinks.faq}
                </a>
              </li>
              <li>
                <a href="/#changelog" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.productLinks.changelog}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {t.landing.footer.company}
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.companyLinks.about}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.companyLinks.contact}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.companyLinks.privacy}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.companyLinks.terms}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {t.landing.footer.resources}
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.resourcesLinks.blog}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.resourcesLinks.help}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.resourcesLinks.docs}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.resourcesLinks.status}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {t.landing.footer.legal}
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.legalLinks.privacy}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.legalLinks.terms}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  {t.landing.footer.legalLinks.cookies}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-8 sm:flex-row dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} {t.common.appName}. {t.landing.footer.rights}
          </p>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            Built with <span className="text-indigo-500">♥</span> for researchers & learners
          </p>
        </div>
      </div>
    </footer>
  );
}
