"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import Badge from "@/components/ui/badge";
import ScrollReveal from "@/components/landing/scroll-reveal";

const FAQ_KEYS = ["one", "two", "three", "four", "five", "six"] as const;

export default function LandingFaq() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <Badge variant="primary" icon={<Sparkles size={12} />} className="mb-4 px-3.5 py-1.5 text-xs">
              {t.landing.faq.badge}
            </Badge>
          </ScrollReveal>
          <ScrollReveal delay={80}>
            <h2 className="text-balance text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {t.landing.faq.title}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={160}>
            <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {t.landing.faq.subtitle}
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={120}>
          <div className="mx-auto mt-12 max-w-3xl space-y-3">
            {FAQ_KEYS.map((key, i) => {
              const item = t.landing.faq.items[key];
              const isOpen = openIndex === i;
              return (
                <div
                  key={key}
                  className={`overflow-hidden rounded-2xl border transition-colors duration-200 ${
                    isOpen
                      ? "border-indigo-300 bg-white shadow-lg shadow-indigo-950/5 dark:border-indigo-800 dark:bg-slate-900"
                      : "border-slate-200/80 bg-white hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-start"
                  >
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">
                      {item.question}
                    </span>
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-300 ${
                        isOpen
                          ? "rotate-45 bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      <Plus size={16} />
                    </span>
                  </button>
                  <div
                    id={`faq-panel-${i}`}
                    role="region"
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
