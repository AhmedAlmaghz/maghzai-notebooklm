"use client";

import Link from "next/link";
import {
  Sparkles,
  FileText,
  MessageSquareText,
  Headphones,
  Network,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import ScrollReveal from "@/components/landing/scroll-reveal";

const STATS = [
  { key: "statsNotebooks", value: "50K+", icon: FileText },
  { key: "statsSources", value: "2M+", icon: Network },
  { key: "statsUsers", value: "12K+", icon: Sparkles },
  { key: "statsLanguages", value: "2", icon: MessageSquareText },
] as const;

/** Stylized product preview built purely with divs/CSS — no images needed. */
function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      {/* Glow behind the mockup */}
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-indigo-500/25 via-purple-500/20 to-fuchsia-500/25 blur-2xl"
      />

      <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/80 shadow-2xl shadow-indigo-950/10 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
          <span className="ml-3 hidden rounded-lg bg-slate-200/70 px-3 py-1 text-[11px] font-semibold text-slate-500 sm:block dark:bg-slate-800 dark:text-slate-400">
            bahhatha.app
          </span>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-5">
          {/* Sources rail */}
          <div className="hidden space-y-2.5 sm:block">
            {[
              { emoji: "📄", label: "ملف بحث PDF", w: "w-10/12" },
              { emoji: "🔗", label: "رابط مقال", w: "w-11/12" },
              { emoji: "▶️", label: "فيديو يوتيوب", w: "w-9/12" },
            ].map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${s.w}`}
              >
                <span>{s.emoji}</span>
                <span className="truncate">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Chat + answer */}
          <div className="space-y-3 sm:col-span-3">
            <div className="rounded-2xl rounded-br-md bg-indigo-600 px-4 py-3 text-right text-[13px] font-semibold text-white shadow-lg shadow-indigo-600/30">
              لخّص لي أهم الأفكار في الفصل الثالث 👋
            </div>
            <div className="rounded-2xl rounded-bl-md border border-slate-200/80 bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              <p>
                يركّز الفصل على ثلاثة محاور رئيسية: <b>التقنيات الناشئة</b>،
                وتطبيقاتها في <b>التعليم</b>، وتحديات <b>الخصوصية</b>...
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["ص١٢-١٥", "ص٢٠", "ص٢٤"].map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              يستند الجواب إلى ٣ مصادر محدّدة
            </div>
          </div>

          {/* Studio tools */}
          <div className="hidden flex-col gap-2.5 sm:flex">
            {[
              { icon: Headphones, label: "حوار صوتي", active: true },
              { icon: Network, label: "خريطة ذهنية" },
              { icon: Sparkles, label: "بطاقات" },
            ].map((tool) => (
              <div
                key={tool.label}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold ${
                  tool.active
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                    : "border-slate-200/70 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                <tool.icon size={13} />
                <span className="truncate">{tool.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating badges */}
        <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 animate-float lg:block" style={{ animationDelay: "0.4s" }}>
          <div className="glass-card flex items-center gap-2 rounded-2xl border border-slate-200/70 px-3.5 py-2.5 shadow-xl dark:border-slate-700">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Headphones size={15} />
            </span>
            <div>
              <p className="text-[11px] font-extrabold text-slate-800 dark:text-white">ملخص صوتي</p>
              <p className="text-[10px] font-semibold text-slate-400">جاهز للاستماع</p>
            </div>
          </div>
        </div>
        <div className="absolute left-4 top-1/3 hidden -translate-y-1/2 animate-float lg:block" style={{ animationDelay: "1.1s" }}>
          <div className="glass-card flex items-center gap-2 rounded-2xl border border-slate-200/70 px-3.5 py-2.5 shadow-xl dark:border-slate-700">
            <CheckCircle2 size={16} className="text-indigo-500" />
            <p className="text-[11px] font-extrabold text-slate-800 dark:text-white">تم تحليل المصدر</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingHero() {
  const { t } = useI18n();
  const title = t.landing.hero.title;
  const highlight = t.landing.hero.titleHighlight;
  const titleBefore = title.replace(highlight, "");
  const titleAfter = title.slice(titleBefore.length + highlight.length);

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Gradient + grid background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 via-white to-white dark:from-indigo-950/40 dark:via-slate-950 dark:to-slate-950" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.08)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] dark:opacity-[0.25]" />
        <div className="absolute -top-32 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-fuchsia-500/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <ScrollReveal>
            <Badge variant="primary" icon={<Sparkles size={12} />} className="mb-6 px-3.5 py-1.5 text-xs">
              {t.landing.hero.badge}
            </Badge>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <h1 className="text-balance text-4xl font-black leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
              {titleBefore}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                {highlight}
              </span>
              {titleAfter}
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              {t.landing.hero.subtitle}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="w-full sm:w-auto">
                <Link href="/register" className="flex items-center gap-2">
                  {t.landing.hero.primaryCta}
                  <ArrowRight size={18} className="rtl:rotate-180" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/login">{t.landing.hero.secondaryCta}</Link>
              </Button>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={340} className="mt-16 sm:mt-20">
          <ProductMockup />
        </ScrollReveal>

        {/* Social proof / stats strip */}
        <ScrollReveal delay={120}>
          <div className="mt-16 flex flex-col items-center gap-8">
            <p className="text-center text-sm font-semibold text-slate-400 dark:text-slate-500">
              {t.landing.hero.trustedBy}
            </p>
            <dl className="grid w-full max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
              {STATS.map((stat) => (
                <div
                  key={stat.key}
                  className="glass-card flex items-center gap-3 rounded-2xl border border-slate-200/70 px-5 py-4 dark:border-slate-800"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    <stat.icon size={18} />
                  </span>
                  <div>
                    <dt className="text-lg font-extrabold text-slate-900 dark:text-white">{stat.value}</dt>
                    <dd className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t.landing.hero[stat.key]}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
