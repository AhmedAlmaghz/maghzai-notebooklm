"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
    User,
    Mail,
    Shield,
    LogOut,
    Building2,
    RefreshCw,
    AlertTriangle,
    Save,
    CheckCircle2,
} from "lucide-react";
import type { UserPayload } from "@/lib/auth";
import { csrfHeaders } from "@/lib/client-csrf";
import AuthLayout from "@/components/auth/auth-layout";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Skeleton from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";

export default function ProfilePage() {
    const { t } = useI18n();
    const { success, error } = useToast();
    const router = useRouter();

    // ─── User data ──────────────────────────────────────────────────────────────
    const [user, setUser] = useState<UserPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);

    // ─── Name edit ──────────────────────────────────────────────────────────────
    const [name, setName] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [savingName, setSavingName] = useState(false);

    // ─── Password change ────────────────────────────────────────────────────────
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
    const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
    const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
    const [savingPassword, setSavingPassword] = useState(false);

    // ─── Session / verification actions ─────────────────────────────────────────
    const [resending, setResending] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/users/me");
                const data = await res.json();
                if (cancelled) return;
                if (res.ok && data.user) {
                    setUser(data.user);
                    setName(data.user.name);
                } else {
                    setLoadFailed(true);
                }
            } catch {
                if (!cancelled) setLoadFailed(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    async function handleNameSubmit(e: FormEvent) {
        e.preventDefault();
        if (!user) return;
        if (!name.trim()) {
            setNameError(t.auth.nameRequired);
            return;
        }
        setNameError(null);
        setSavingName(true);
        try {
            const res = await fetch("/api/users/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...csrfHeaders() },
                body: JSON.stringify({ name: name.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                error(data.error || t.errors.apiError);
                return;
            }
            if (data.user) {
                setUser(data.user);
                setName(data.user.name);
            }
            success(t.authPages.profileUpdated);
            router.refresh();
        } catch {
            error(t.errors.apiError);
        } finally {
            setSavingName(false);
        }
    }

    function validatePassword(): boolean {
        let valid = true;

        if (!currentPassword) {
            setCurrentPasswordError(t.auth.passwordRequired);
            valid = false;
        } else {
            setCurrentPasswordError(null);
        }

        if (!newPassword) {
            setNewPasswordError(t.auth.passwordRequired);
            valid = false;
        } else if (newPassword.length < 8) {
            setNewPasswordError(t.authPages.profilePasswordMin);
            valid = false;
        } else {
            setNewPasswordError(null);
        }

        if (!confirmNewPassword) {
            setConfirmPasswordError(t.auth.passwordRequired);
            valid = false;
        } else if (confirmNewPassword !== newPassword) {
            setConfirmPasswordError(t.authPages.profilePasswordMismatch);
            valid = false;
        } else {
            setConfirmPasswordError(null);
        }

        return valid;
    }

    async function handlePasswordSubmit(e: FormEvent) {
        e.preventDefault();
        if (!user || !validatePassword()) return;

        setSavingPassword(true);
        try {
            const res = await fetch("/api/users/me", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...csrfHeaders() },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                error(data.error || t.errors.apiError);
                return;
            }
            success(t.authPages.profileUpdated);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
            router.refresh();
        } catch {
            error(t.errors.apiError);
        } finally {
            setSavingPassword(false);
        }
    }

    async function handleResendVerification() {
        if (!user) return;
        setResending(true);
        try {
            const res = await fetch("/api/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email }),
            });
            const data = await res.json();
            if (!res.ok) {
                error(data.error || t.errors.apiError);
                return;
            }
            success(t.authPages.profileResendSent);
        } catch {
            error(t.errors.apiError);
        } finally {
            setResending(false);
        }
    }

    async function handleLogout() {
        setLoggingOut(true);
        try {
            const res = await fetch("/api/auth/logout", { method: "POST" });
            if (res.ok) {
                success(t.auth.logoutSuccess);
                router.push("/");
                router.refresh();
            }
        } finally {
            setLoggingOut(false);
        }
    }

    const initials = user?.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "";

    // ─── Loading state ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <AuthLayout subtitle={t.authPages.profileTitle} title={t.authPages.profileTitle}>
                <div className="space-y-4">
                    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-14 w-14 rounded-2xl" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        </div>
                        <Skeleton className="mt-4 h-9 w-full" />
                    </div>
                    <Skeleton className="h-56 w-full" />
                </div>
            </AuthLayout>
        );
    }

    // ─── Error state (session invalid / fetch failed) ───────────────────────────
    if (loadFailed || !user) {
        return (
            <AuthLayout subtitle={t.authPages.profileTitle} title={t.authPages.profileTitle}>
                <div className="animate-fade-in flex flex-col items-center text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                        <AlertTriangle size={30} />
                    </div>
                    <p className="mt-5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{t.errors.apiError}</p>
                    <a
                        href="/login"
                        className="mt-6 inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-700 hover:to-purple-700"
                    >
                        {t.auth.login}
                    </a>
                </div>
            </AuthLayout>
        );
    }

    const verified = user.emailVerifiedAt != null;

    return (
        <AuthLayout subtitle={user.email} title={t.authPages.profileTitle}>
            <div className="space-y-5">
                {/* ─── Account card ─────────────────────────────────────────────────── */}
                <Card>
                    <div className="flex items-center gap-4 px-5 pt-5">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-lg font-black text-white shadow-lg shadow-indigo-600/25">
                            {initials || <User size={22} />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-black text-slate-900 dark:text-white">{user.name}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                                {user.email}
                            </p>
                        </div>
                        {verified ? (
                            <Badge variant="success" icon={<CheckCircle2 size={12} />}>
                                {t.authPages.profileEmailVerified}
                            </Badge>
                        ) : (
                            <Badge variant="warning">{t.authPages.profileEmailUnverified}</Badge>
                        )}
                    </div>

                    {/* Name edit */}
                    <form onSubmit={handleNameSubmit} className="space-y-3 px-5 py-4" noValidate>
                        <Input
                            name="name"
                            type="text"
                            label={t.authPages.profileNameLabel}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            error={nameError || undefined}
                            leftIcon={<User size={16} />}
                            autoComplete="name"
                            required
                        />
                        <Button type="submit" size="sm" isLoading={savingName} loadingText={t.common.saving}>
                            <Save size={15} />
                            {t.common.save}
                        </Button>
                    </form>

                    {/* Metadata row */}
                    <div className="grid gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-2 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <Shield size={14} className="shrink-0 text-indigo-500" />
                            <span>{t.authPages.profileRoleLabel}:</span>
                            <Badge variant="primary">{user.role}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <Building2 size={14} className="shrink-0 text-indigo-500" />
                            <span>{t.authPages.profileOrgLabel}:</span>
                            {user.organizationId ? (
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate font-bold text-slate-700 dark:text-slate-300">
                                        {t.org.personalOrgName}
                                    </span>
                                    <Badge variant="primary">{t.org.roleLabels.owner}</Badge>
                                </span>
                            ) : (
                                <span className="text-slate-400">—</span>
                            )}
                        </div>
                    </div>

                    {/* Unverified email actions */}
                    {!verified && (
                        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                isLoading={resending}
                                loadingText={t.common.loading}
                                onClick={handleResendVerification}
                            >
                                <RefreshCw size={15} />
                                {t.authPages.profileResendVerification}
                            </Button>
                        </div>
                    )}
                </Card>

                {/* ─── Security card ────────────────────────────────────────────────── */}
                <Card>
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <Shield size={16} className="text-indigo-500" />
                            {t.authPages.profileSecurityCard}
                        </h3>
                    </div>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4 px-5 py-4" noValidate>
                        <Input
                            name="currentPassword"
                            type="password"
                            label={t.authPages.profileCurrentPassword}
                            placeholder="••••••••"
                            dir="ltr"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            error={currentPasswordError || undefined}
                            autoComplete="current-password"
                            required
                        />
                        <Input
                            name="newPassword"
                            type="password"
                            label={t.authPages.profileNewPassword}
                            placeholder="••••••••"
                            dir="ltr"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            error={newPasswordError || undefined}
                            autoComplete="new-password"
                            required
                        />
                        <Input
                            name="confirmNewPassword"
                            type="password"
                            label={t.authPages.profileConfirmPassword}
                            placeholder="••••••••"
                            dir="ltr"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            error={confirmPasswordError || undefined}
                            autoComplete="new-password"
                            required
                        />
                        <Button type="submit" size="sm" isLoading={savingPassword} loadingText={t.common.saving}>
                            <Save size={15} />
                            {t.authPages.profileSaveChanges}
                        </Button>
                    </form>
                </Card>

                {/* ─── Session card ─────────────────────────────────────────────────── */}
                <Card>
                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <Mail size={14} className="shrink-0 text-indigo-500" />
                            <span dir="ltr">{user.email}</span>
                        </div>
                        <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            isLoading={loggingOut}
                            loadingText={t.common.loading}
                            onClick={handleLogout}
                        >
                            <LogOut size={15} />
                            {t.auth.logout}
                        </Button>
                    </div>
                </Card>
            </div>
        </AuthLayout>
    );
}
