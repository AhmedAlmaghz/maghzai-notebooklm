"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, LogIn, AlertTriangle, RefreshCw } from "lucide-react";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import AuthLayout from "@/components/auth/auth-layout";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";

/**
 * Safe internal redirect: only allow paths that start with a single "/" and
 * never contain "//" (protocol-relative URLs like //evil.com) or ":" (schemes
 * like javascript:, https:). Everything else falls back to "/".
 */
function sanitizeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.includes(":")) return "/";
  return next;
}

function LoginForm() {
  const { t } = useI18n();
  const { success, error } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyBanner, setVerifyBanner] = useState(false);
  const [resending, setResending] = useState(false);

  function validate(): boolean {
    let valid = true;

    if (!email.trim()) {
      setEmailError(t.auth.emailRequired);
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t.auth.emailInvalid);
      valid = false;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError(t.auth.passwordRequired);
      valid = false;
    } else {
      setPasswordError(null);
    }

    return valid;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setVerifyBanner(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface the API message (rate-limited 429, invalid credentials, …).
        error(data.error || t.auth.invalidCredentials);
        return;
      }

      // Email not verified yet — show the inline banner instead of blocking.
      if (data.requiresVerification) {
        setVerifyBanner(true);
      }

      success(t.auth.loginSuccess);
      // `next` comes from the middleware redirect (e.g. /login?next=/notebook/abc)
      // and is sanitized above to prevent open-redirect attacks.
      router.push(next);
      router.refresh();
    } catch {
      error(t.errors.apiError);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        error(data.error || t.errors.apiError);
        return;
      }
      success(t.authPages.verifyEmailResent);
    } catch {
      error(t.errors.apiError);
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout subtitle={t.auth.loginSubtitle}>
      {verifyBanner && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/40">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-relaxed text-amber-800 dark:text-amber-300">
              {t.auth.loginVerifyBanner}
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 transition hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-900"
            >
              <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
              {t.auth.loginResendVerification}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          name="email"
          type="email"
          label={t.auth.email}
          placeholder="you@example.com"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError || undefined}
          leftIcon={<Mail size={16} />}
          autoComplete="email"
          required
        />
        <div>
          <Input
            name="password"
            type="password"
            label={t.auth.password}
            placeholder="••••••••"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError || undefined}
            leftIcon={<Lock size={16} />}
            autoComplete="current-password"
            required
          />
          <div className="mt-1.5 text-end">
            <a
              href="/forgot-password"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              {t.auth.loginForgotPassword}
            </a>
          </div>
        </div>
        <Button type="submit" fullWidth size="lg" isLoading={loading} loadingText={t.common.loading}>
          <LogIn size={18} />
          {t.auth.login}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {t.auth.noAccount}{" "}
        <a href="/register" className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
          {t.auth.createAccount}
        </a>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
