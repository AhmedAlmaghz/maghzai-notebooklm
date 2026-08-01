"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn } from "lucide-react";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import AuthLayout from "@/components/auth/auth-layout";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const { t } = useI18n();
  const { success, error } = useToast();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        error(data.error || t.auth.invalidCredentials);
        return;
      }
      success(t.auth.loginSuccess);
      router.push("/");
      router.refresh();
    } catch {
      error(t.errors.apiError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle={t.auth.loginSubtitle}>
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