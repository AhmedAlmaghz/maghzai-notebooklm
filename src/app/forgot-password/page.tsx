"use client";

import { useState, type FormEvent } from "react";
import { Mail, MailCheck, ArrowRight } from "lucide-react";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import AuthLayout from "@/components/auth/auth-layout";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const { error } = useToast();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function validate(): boolean {
    if (!email.trim()) {
      setEmailError(t.auth.emailRequired);
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t.auth.emailInvalid);
      return false;
    }
    setEmailError(null);
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Rate-limited (429) or validation errors: surface the API message so
        // the user sees e.g. "too many attempts, try again later".
        error(data.error || t.errors.apiError);
        return;
      }
      // The backend ALWAYS returns success for security (no user enumeration).
      setSent(true);
    } catch {
      error(t.errors.apiError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle={t.authPages.forgotPasswordSubtitle} title={t.authPages.forgotPasswordTitle}>
      {sent ? (
        <div className="animate-fade-in flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <MailCheck size={30} />
          </div>
          <h2 className="mt-5 text-lg font-black text-slate-900 dark:text-white">
            {t.authPages.forgotPasswordSuccessTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t.authPages.forgotPasswordSuccessBody}
          </p>
          <a
            href="/login"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <ArrowRight size={16} className="rtl:rotate-180" />
            {t.authPages.forgotPasswordBackToLogin}
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            name="email"
            type="email"
            label={t.authPages.forgotPasswordEmailLabel}
            placeholder="you@example.com"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError || undefined}
            leftIcon={<Mail size={16} />}
            autoComplete="email"
            required
          />
          <Button type="submit" fullWidth size="lg" isLoading={loading} loadingText={t.common.loading}>
            {t.authPages.forgotPasswordSubmit}
          </Button>
        </form>
      )}

      {!sent && (
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <a
            href="/login"
            className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {t.authPages.forgotPasswordBackToLogin}
          </a>
        </p>
      )}
    </AuthLayout>
  );
}
