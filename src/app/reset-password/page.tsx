"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, CheckCircle2, AlertTriangle, MailQuestion, ArrowRight } from "lucide-react";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import AuthLayout from "@/components/auth/auth-layout";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";

type Status = "form" | "success" | "invalid" | "no-token";

function ResetPasswordForm() {
    const { t } = useI18n();
    const { success, error } = useToast();
    const searchParams = useSearchParams();
    const token = (searchParams.get("token") ?? "").trim();

    const [status, setStatus] = useState<Status>(token ? "form" : "no-token");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function validate(): boolean {
        let valid = true;

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
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 429) {
                    // Rate-limited — keep the form, surface the API message.
                    error(data.error || t.errors.apiError);
                } else {
                    // Invalid / expired / one-time token already consumed.
                    setStatus("invalid");
                }
                return;
            }
            success(t.authPages.resetPasswordSuccessTitle);
            setStatus("success");
        } catch {
            error(t.errors.apiError);
        } finally {
            setLoading(false);
        }
    }

    // ─── Success state ──────────────────────────────────────────────────────────
    if (status === "success") {
        return (
            <AuthLayout subtitle={t.authPages.resetPasswordSubtitle} title={t.authPages.resetPasswordTitle}>
                <div className="animate-fade-in flex flex-col items-center text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                        <CheckCircle2 size={30} />
                    </div>
                    <h2 className="mt-5 text-lg font-black text-slate-900 dark:text-white">
                        {t.authPages.resetPasswordSuccessTitle}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        {t.authPages.resetPasswordSuccessBody}
                    </p>
                    <a
                        href="/login"
                        className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                        <ArrowRight size={16} className="rtl:rotate-180" />
                        {t.auth.login}
                    </a>
                </div>
            </AuthLayout>
        );
    }

    // ─── Invalid / expired token state ──────────────────────────────────────────
    if (status === "invalid") {
        return (
            <AuthLayout subtitle={t.authPages.resetPasswordSubtitle} title={t.authPages.resetPasswordTitle}>
                <div className="animate-fade-in flex flex-col items-center text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                        <AlertTriangle size={30} />
                    </div>
                    <h2 className="mt-5 text-lg font-black text-slate-900 dark:text-white">
                        {t.authPages.resetPasswordInvalidTitle}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        {t.authPages.resetPasswordInvalidBody}
                    </p>
                    <a
                        href="/forgot-password"
                        className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                        <ArrowRight size={16} className="rtl:rotate-180" />
                        {t.authPages.resetPasswordGoForgot}
                    </a>
                </div>
            </AuthLayout>
        );
    }

    // ─── No token state (page opened directly) ──────────────────────────────────
    if (status === "no-token") {
        return (
            <AuthLayout subtitle={t.authPages.resetPasswordSubtitle} title={t.authPages.resetPasswordTitle}>
                <div className="animate-fade-in flex flex-col items-center text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                        <MailQuestion size={30} />
                    </div>
                    <h2 className="mt-5 text-lg font-black text-slate-900 dark:text-white">
                        {t.authPages.resetPasswordNoTokenTitle}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        {t.authPages.resetPasswordNoTokenBody}
                    </p>
                    <a
                        href="/forgot-password"
                        className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                        <ArrowRight size={16} className="rtl:rotate-180" />
                        {t.authPages.resetPasswordGoForgot}
                    </a>
                </div>
            </AuthLayout>
        );
    }

    // ─── Token present → password form ──────────────────────────────────────────
    return (
        <AuthLayout subtitle={t.authPages.resetPasswordSubtitle} title={t.authPages.resetPasswordTitle}>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Input
                    name="newPassword"
                    type="password"
                    label={t.authPages.resetPasswordNewLabel}
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
                    label={t.authPages.resetPasswordConfirmLabel}
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
                    {t.authPages.resetPasswordSubmit}
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                <a
                    href="/forgot-password"
                    className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                    {t.authPages.resetPasswordGoForgot}
                </a>
            </p>
        </AuthLayout>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ResetPasswordForm />
        </Suspense>
    );
}
