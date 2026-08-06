"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, UserPlus } from "lucide-react";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import AuthLayout from "@/components/auth/auth-layout";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";

export default function RegisterPage() {
  const { t } = useI18n();
  const { success, error } = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    let valid = true;

    if (!name.trim()) {
      setNameError(t.auth.nameRequired);
      valid = false;
    } else {
      setNameError(null);
    }

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
    } else if (password.length < 8) {
      setPasswordError(t.auth.passwordMin);
      valid = false;
    } else {
      setPasswordError(null);
    }

    if (!confirmPassword) {
      setConfirmError(t.auth.passwordRequired);
      valid = false;
    } else if (confirmPassword !== password) {
      setConfirmError(t.auth.passwordMismatch);
      valid = false;
    } else {
      setConfirmError(null);
    }

    return valid;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface the API message (rate-limited 429, existing email, …).
        error(data.error || t.auth.emailExists);
        return;
      }
      success(t.auth.registerSuccess);

      router.push("/");
      router.refresh();
    } catch {
      error(t.errors.apiError);
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    // The server route generates the CSRF state nonce and redirects to Google.
    window.location.href = "/api/auth/google";
  }

  return (
    <AuthLayout subtitle={t.auth.registerSubtitle}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          name="name"
          type="text"
          label={t.auth.name}
          placeholder={t.auth.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError || undefined}
          leftIcon={<User size={16} />}
          autoComplete="name"
          required
        />
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
          autoComplete="new-password"
          required
        />
        <Input
          name="confirmPassword"
          type="password"
          label={t.auth.confirmPassword}
          placeholder="••••••••"
          dir="ltr"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={confirmError || undefined}
          leftIcon={<Lock size={16} />}
          autoComplete="new-password"
          required
        />
        <Button type="submit" fullWidth size="lg" isLoading={loading} loadingText={t.common.loading}>
          <UserPlus size={18} />
          {t.auth.register}
        </Button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
          {t.auth.orContinueWith}
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Google sign-in */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <GoogleIcon />
        {t.auth.continueWithGoogle}
      </button>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {t.auth.haveAccount}{" "}
        <a href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
          {t.auth.login}
        </a>
      </p>
    </AuthLayout>
  );
}

/** Inline Google "G" logo (multi-color) — avoids an extra asset. */
function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 48 48"
      className="shrink-0"
    >
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
