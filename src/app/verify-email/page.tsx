"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, Send, Mail } from "lucide-react";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import AuthLayout from "@/components/auth/auth-layout";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";

type Status = "verifying" | "verified" | "invalid";

function VerifyEmailContent() {
    const { t } = useI18n();
    const { success, error } = useToast();
    const searchParams = useSearchParams();
    const token = (searchParams.get("token") ?? "").trim();

    const [status, setStatus] = useState<Status>(token ? "verifying" : "invalid");

    // Resend form (shown in the invalid/expired state).
    const [resendEmail, setResendEmail] = useState("");
    const [resendError, setResendError] = useState<string | null>(null);
    const [resending, setResending] = useState(false);

    // Hold the current dictionary in a ref so the verify effect below does not
    // re-run (re-consuming the one-time token) when the locale changes.
    const tRef = useRef(t);
    tRef.current = t;

    useEffect(() => {
        if (!token) return;
        let cancelled = false;

        (async () => {
            try {
                const res = await fetch("/api/auth/verify-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                });
                const data = await res.json();
                if (cancelled) return;
                if (res.ok) {
                    setStatus("verified");
                } else {
                    // Surface the API message (invalid/expired token, rate-limit, …).
                    error(data.error || tRef.current.authPages.verifyEmailInvalidBody);
                    setStatus("invalid");
                }
            } catch {
                if (!cancelled) {
                    error(tRef.current.errors.apiError);
                    setStatus("invalid");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [token, error]);

    async function handleResend(e: FormEvent) {
        e.preventDefault();
        if (!resendEmail.trim()) {
            setResendError(t.auth.emailRequired);
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail.trim())) {
            setResendError(t.auth.emailInvalid);
            return;
        }
        setResendError(null);
        setResending(true);
        try {
            const res = await fetch("/api/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resendEmail.trim() }),
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

    // ─── Verifying state ────────────────────────────────────────────────────────
    if (status === "verifying") {
        return (
            <AuthLayout subtitle={t.authPages.verifyEmailSubtitle} title={t.authPages.verifyEmailTitle}>
                <div className="flex flex-col items-center text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                        <Loader2 size={30} className="animate-spin" />
                    </div>
                    <p className="mt-5 text-sm font-bold text-slate-700 dark:text-slate-300">
                        {t.authPages.verifyEmailVerifying}
                    </p>
                </div>
            </AuthLayout>
        );
    }

    // ─── Verified state ─────────────────────────────────────────────────────────
    if (status === "verified") {
        return (
            <AuthLayout subtitle={t.authPages.verifyEmailSubtitle} title={t.authPages.verifyEmailTitle}>
                <div className="animate-fade-in flex flex-col items-center text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                        <CheckCircle2 size={30} />
                    </div>
                    <h2 className="mt-5 text-lg font-black text-slate-900 dark:text-white">
                        {t.authPages.verifyEmailSuccessTitle}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        {t.authPages.verifyEmailSuccessBody}
                    </p>
                    <a
                        href="/"
                        className="mt-6 inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-purple-700"
                    >
                        {t.authPages.verifyEmailGoDashboard}
                    </a>
                </div>
            </AuthLayout>
        );
    }

    // ─── Invalid / expired state + resend form ──────────────────────────────────
    return (
        <AuthLayout subtitle={t.authPages.verifyEmailSubtitle} title={t.authPages.verifyEmailTitle}>
            <div className="animate-fade-in flex flex-col items-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                    <AlertTriangle size={30} />
                </div>
                <h2 className="mt-5 text-lg font-black text-slate-900 dark:text-white">
                    {t.authPages.verifyEmailInvalidTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {t.authPages.verifyEmailInvalidBody}
                </p>
            </div>

            <form onSubmit={handleResend} className="mt-6 space-y-4" noValidate>
                <Input
                    name="email"
                    type="email"
                    label={t.authPages.verifyEmailResendLabel}
                    placeholder="you@example.com"
                    dir="ltr"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    error={resendError || undefined}
                    leftIcon={<Mail size={16} />}
                    autoComplete="email"
                    required
                />
                <Button type="submit" fullWidth size="lg" variant="secondary" isLoading={resending} loadingText={t.common.loading}>
                    <Send size={16} />
                    {t.authPages.verifyEmailResendSubmit}
                </Button>
            </form>
        </AuthLayout>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={null}>
            <VerifyEmailContent />
        </Suspense>
    );
}
