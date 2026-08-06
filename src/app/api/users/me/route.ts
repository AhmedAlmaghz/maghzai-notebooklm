import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
    getCurrentUser,
    requireCsrf,
    verifyPassword,
    hashPassword,
    revokeUserSessions,
} from "@/lib/auth";
import type { UserPayload } from "@/lib/auth";

/**
 * GET /api/users/me — returns the current user profile, or { user: null }.
 * POST/PATCH /api/users/me — updates the profile:
 *   - `name`: updates the display name (unchanged behavior).
 *   - `currentPassword` + `newPassword`: verifies the current password, hashes
 *     the new one (bcrypt cost 10), and revokes every outstanding session
 *     (bumps refresh_token_version + revokes all refresh token rows), exactly
 *     like POST /api/auth/reset-password. Returns { user, success: true }.
 * Both state-changing verbs require the CSRF double-submit token.
 */

export async function GET() {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
}

export async function PATCH(req: Request) {
    try {
        const current = await getCurrentUser();
        if (!current) {
            return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
        }
        if (!(await requireCsrf(req))) {
            return NextResponse.json({ error: "طلب غير صالح" }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

        // Password change (Security card): fires whenever either password field is
        // present. Mirrors the reset-password flow exactly — verify the current
        // password against the stored bcrypt hash, hash the new one (cost 10),
        // then revoke every outstanding session so other devices must re-login.
        const wantsPasswordChange = currentPassword !== "" || newPassword !== "";
        if (wantsPasswordChange) {
            if (!newPassword) {
                return NextResponse.json({ error: "كلمة المرور الجديدة مطلوبة" }, { status: 400 });
            }
            if (newPassword.length < 8) {
                return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
            }

            const [row] = await db.select().from(users).where(eq(users.id, current.id));
            if (!row) {
                return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
            }

            // OAuth-only users (e.g. signed up via Google) have no stored
            // password, so they can set one directly without a "current"
            // password. Password-based users must still verify the current one.
            if (row.password) {
                if (!currentPassword) {
                    return NextResponse.json({ error: "كلمة المرور الحالية مطلوبة" }, { status: 400 });
                }
                const valid = await verifyPassword(currentPassword, row.password);
                if (!valid) {
                    return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
                }
            }

            const hashedPassword = await hashPassword(newPassword);
            await db.update(users).set({ password: hashedPassword }).where(eq(users.id, current.id));

            // Bump refresh_token_version + revoke every stored refresh token,
            // exactly like reset-password — logs out all other devices.
            await revokeUserSessions(current.id);
        }

        // Name-only changes (no password fields) keep working exactly as before.
        if (name) {
            await db.update(users).set({ name }).where(eq(users.id, current.id));
        }

        const [updated] = await db.select().from(users).where(eq(users.id, current.id));
        if (!updated) {
            return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
        }

        const payload: UserPayload = {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            role: updated.role as UserPayload["role"],
            emailVerifiedAt:
                updated.emailVerifiedAt == null
                    ? null
                    : updated.emailVerifiedAt instanceof Date
                        ? updated.emailVerifiedAt.toISOString()
                        : (updated.emailVerifiedAt as string),
            organizationId: updated.organizationId ?? null,
        };

        // Same success shape as name changes ({ user }), plus { success: true }
        // when a password was changed (matching the reset-password route).
        return NextResponse.json({
            user: payload,
            ...(wantsPasswordChange ? { success: true } : {}),
        });
    } catch (error) {
        console.error("Update profile error:", error);
        return NextResponse.json({ error: "حدث خطأ أثناء تحديث الملف الشخصي" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    return PATCH(req);
}
