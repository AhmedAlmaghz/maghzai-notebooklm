"use client";

import {
  MessageSquareText,
  Headphones,
  Network,
  GraduationCap,
  FolderOpen,
  Languages,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";
import Badge from "@/components/ui/badge";
import ScrollReveal from "@/components/landing/scroll-reveal";

const FEATURES = [
  { key: "chat", icon: MessageSquareText, gradient: "from-indigo-500 to-blue-500" },
  { key: "podcast", icon: Headphones, gradient: "from-fuchsia-500 to-pink-500" },
  { key: "mindmap", icon: Network, gradient: "from-emerald-500 to-teal-500" },
  { key: "quiz", icon: GraduationCap, gradient: "from-amber-500 to-orange-500" },
  { key: "sources", icon: FolderOpen, gradient: "from-purple-500 to-violet-500" },
  { key: "languages", icon: Languages, gradient: "from-rose-500 to-red-500" },
] as const;

export default function LandingFeatures() {
  const { t } = useI18n();

  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <Badge variant="primary" icon={<Sparkles size={12} />} className="mb-4 px-3.5 py-1.5 text-xs">
              {t.landing.features.badge}
            </Badge>
          </ScrollReveal>
          <ScrollReveal delay={80}>
            <h2 className="text-balance text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {t.landing.features.title}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={160}>
            <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {t.landing.features.subtitle}
            </p>
          </ScrollReveal>
        </div>

        {/* Feature cards */}
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const item = t.landing.features.items[feature.key];
            return (
              <ScrollReveal key={feature.key} delay={i * 70}>
                <div className="group relative h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-950/5 dark:border-slate-800 dark:bg-slate-900">
                  {/* Hover glow */}
                  <div
                    aria-hidden="true"
                    className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${feature.gradient} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25`}
                  />
                  <div
                    className={`relative mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                  >
                    <feature.icon size={22} />
                  </div>
                  <h3 className="relative text-lg font-extrabold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
