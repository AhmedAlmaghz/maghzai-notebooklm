"use client";

import Link from "next/link";
import { ArrowRight, Rocket, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import Button from "@/components/ui/button";
import ScrollReveal from "@/components/landing/scroll-reveal";

export default function LandingCta() {
  const { t } = useI18n();

  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 px-6 py-16 text-center shadow-2xl shadow-indigo-950/30 sm:px-12 sm:py-20">
            {/* Decorative blobs */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
              <div className="absolute right-1/4 top-0 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:22px_22px]"
            />

            <div className="relative mx-auto max-w-2xl">
              <span className="mb-6 inline-grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
                <Rocket size={26} />
              </span>
              <h2 className="text-balance text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                {t.landing.cta.title}
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-indigo-100 sm:text-lg">
                {t.landing.cta.subtitle}
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="bg-white text-indigo-700 shadow-xl shadow-indigo-950/20 hover:bg-indigo-50 hover:from-white hover:to-white"
                >
                  <Link href="/register" className="flex items-center gap-2">
                    <Sparkles size={18} />
                    {t.landing.cta.primaryCta}
                    <ArrowRight size={18} className="rtl:rotate-180" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white dark:border-white/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                >
                  <Link href="/login">{t.landing.cta.secondaryCta}</Link>
                </Button>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
