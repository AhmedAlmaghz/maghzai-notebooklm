"use client";

import { NotebookPen, FolderPlus, Rocket, Sparkles, ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import Badge from "@/components/ui/badge";
import ScrollReveal from "@/components/landing/scroll-reveal";

const STEPS = [
    { key: "one", icon: NotebookPen, gradient: "from-indigo-500 to-blue-500", step: "01" },
    { key: "two", icon: FolderPlus, gradient: "from-purple-500 to-fuchsia-500", step: "02" },
    { key: "three", icon: Rocket, gradient: "from-emerald-500 to-teal-500", step: "03" },
] as const;

export default function LandingHowItWorks() {
    const { t } = useI18n();

    return (
        <section id="how-it-works" className="relative py-20 sm:py-28">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-white via-indigo-50/40 to-white dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-950" />
            </div>

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <ScrollReveal>
                        <Badge variant="primary" icon={<Sparkles size={12} />} className="mb-4 px-3.5 py-1.5 text-xs">
                            {t.landing.howItWorks.badge}
                        </Badge>
                    </ScrollReveal>
                    <ScrollReveal delay={80}>
                        <h2 className="text-balance text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                            {t.landing.howItWorks.title}
                        </h2>
                    </ScrollReveal>
                    <ScrollReveal delay={160}>
                        <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 dark:text-slate-300">
                            {t.landing.howItWorks.subtitle}
                        </p>
                    </ScrollReveal>
                </div>

                <div className="relative mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
                    {/* Connector line (desktop) */}
                    <div
                        aria-hidden="true"
                        className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-indigo-300 via-purple-300 to-emerald-300 md:block dark:from-indigo-800 dark:via-purple-800 dark:to-emerald-800"
                    />

                    {STEPS.map((step, i) => {
                        const item = t.landing.howItWorks.steps[step.key];
                        return (
                            <ScrollReveal key={step.key} delay={i * 120}>
                                <div className="relative flex flex-col items-center text-center">
                                    <div className="relative">
                                        <div
                                            className={`relative z-10 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br ${step.gradient} text-white shadow-xl shadow-indigo-950/10`}
                                        >
                                            <step.icon size={30} />
                                        </div>
                                        <span className="absolute -right-2 -top-2 z-20 grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-xs font-black text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                            {step.step}
                                        </span>
                                    </div>
                                    <h3 className="mt-6 text-xl font-extrabold text-slate-900 dark:text-white">
                                        {item.title}
                                    </h3>
                                    <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                        {item.description}
                                    </p>
                                </div>
                            </ScrollReveal>
                        );
                    })}
                </div>

                <ScrollReveal delay={200}>
                    <div className="mt-14 text-center">
                        <span className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            <ArrowLeft size={16} className="rtl:rotate-180" />
                            {t.landing.nav.getStarted}
                        </span>
                    </div>
                </ScrollReveal>
            </div>
        </section>
    );
}
