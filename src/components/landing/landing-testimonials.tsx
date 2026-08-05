"use client";

import { Quote, Star, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import Badge from "@/components/ui/badge";
import ScrollReveal from "@/components/landing/scroll-reveal";

const TESTIMONIALS = ["one", "two", "three"] as const;

const AVATAR_GRADIENTS = [
    "from-indigo-500 to-purple-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
];

export default function LandingTestimonials() {
    const { t } = useI18n();

    return (
        <section className="relative py-20 sm:py-28">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <ScrollReveal>
                        <Badge variant="primary" icon={<Sparkles size={12} />} className="mb-4 px-3.5 py-1.5 text-xs">
                            {t.landing.testimonials.badge}
                        </Badge>
                    </ScrollReveal>
                    <ScrollReveal delay={80}>
                        <h2 className="text-balance text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                            {t.landing.testimonials.title}
                        </h2>
                    </ScrollReveal>
                    <ScrollReveal delay={160}>
                        <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 dark:text-slate-300">
                            {t.landing.testimonials.subtitle}
                        </p>
                    </ScrollReveal>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
                    {TESTIMONIALS.map((key, i) => {
                        const item = t.landing.testimonials.items[key];
                        return (
                            <ScrollReveal key={key} delay={i * 100}>
                                <figure className="flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
                                    <div className="mb-4 flex items-center justify-between">
                                        <Quote size={28} className="text-indigo-200 dark:text-indigo-900" />
                                        <div className="flex gap-0.5">
                                            {Array.from({ length: 5 }).map((_, s) => (
                                                <Star key={s} size={15} className="fill-amber-400 text-amber-400" />
                                            ))}
                                        </div>
                                    </div>
                                    <blockquote className="flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                        “{item.quote}”
                                    </blockquote>
                                    <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                                        <span
                                            className={`grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} text-sm font-black text-white shadow-md`}
                                        >
                                            {item.name.charAt(0)}
                                        </span>
                                        <div>
                                            <div className="text-sm font-extrabold text-slate-900 dark:text-white">{item.name}</div>
                                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.role}</div>
                                        </div>
                                    </figcaption>
                                </figure>
                            </ScrollReveal>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
