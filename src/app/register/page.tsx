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

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {t.auth.haveAccount}{" "}
        <a href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
          {t.auth.login}
        </a>
      </p>
    </AuthLayout>
  );
}