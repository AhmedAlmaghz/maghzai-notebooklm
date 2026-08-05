"use client";

import Link from "next/link";
import { Check, Sparkles, Crown, Building2, Zap } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import ScrollReveal from "@/components/landing/scroll-reveal";

const PLANS = [
    {
        key: "free",
        icon: Zap,
        iconGradient: "from-slate-500 to-slate-700",
        border: "",
        highlight: false,
    },
    {
        key: "pro",
        icon: Crown,
        iconGradient: "from-indigo-500 to-purple-600",
        border: "border-indigo-300 dark:border-indigo-700",
        highlight: true,
    },
    {
        key: "org",
        icon: Building2,
        iconGradient: "from-emerald-500 to-teal-600",
        border: "",
        highlight: false,
    },
] as const;

export default function LandingPricing() {
    const { t } = useI18n();

    return (
        <section id="pricing" className="relative py-20 sm:py-28">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/50 to-white dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-950" />
            </div>

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <ScrollReveal>
                        <Badge variant="primary" icon={<Sparkles size={12} />} className="mb-4 px-3.5 py-1.5 text-xs">
                            {t.landing.pricing.badge}
                        </Badge>
                    </ScrollReveal>
                    <ScrollReveal delay={80}>
                        <h2 className="text-balance text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                            {t.landing.pricing.title}
                        </h2>
                    </ScrollReveal>
                    <ScrollReveal delay={160}>
                        <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 dark:text-slate-300">
                            {t.landing.pricing.subtitle}
                        </p>
                    </ScrollReveal>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
                    {PLANS.map((plan, i) => {
                        const data = t.landing.pricing.plans[plan.key];
                        const features = Object.values(data.features);
                        return (
                            <ScrollReveal key={plan.key} delay={i * 100} className="h-full">
                                <div
                                    className={`relative flex h-full flex-col rounded-3xl border bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl dark:bg-slate-900 ${plan.highlight
                                            ? `${plan.border} shadow-xl shadow-indigo-950/10 lg:scale-[1.04]`
                                            : "border-slate-200/80 dark:border-slate-800"
                                        }`}
                                >
                                    {plan.highlight && (
                                        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                            <Badge variant="primary" className="px-4 py-1.5 text-xs shadow-lg shadow-indigo-600/25">
                                                {t.landing.pricing.popular}
                                            </Badge>
                                        </span>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${plan.iconGradient} text-white shadow-md`}
                                        >
                                            <plan.icon size={20} />
                                        </span>
                                        <div>
                                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{data.name}</h3>
                                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{data.description}</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-end gap-1.5">
                                        <span className="text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                                            {data.price}
                                        </span>
                                        <span className="mb-1.5 text-sm font-bold text-slate-400">$</span>
                                        <span className="mb-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                            / {t.landing.pricing.monthly}
                                        </span>
                                    </div>

                                    <ul className="mt-6 flex-1 space-y-3">
                                        {features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                                                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                                                    <Check size={12} strokeWidth={3} />
                                                </span>
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        variant={plan.highlight ? "primary" : "outline"}
                                        size="lg"
                                        fullWidth
                                        className="mt-8"
                                    >
                                        <Link href="/register">{data.cta}</Link>
                                    </Button>
                                </div>
                            </ScrollReveal>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
