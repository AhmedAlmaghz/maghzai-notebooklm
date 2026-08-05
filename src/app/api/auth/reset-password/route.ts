import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { consumePasswordResetToken, markPasswordResetUsed } from "@/lib/auth-tokens";
import { hashPassword, hashToken, revokeUserSessions } from "@/lib/auth";

/**
 * POST /api/auth/reset-password
 * Body: { token, password }  (password min 8 chars)
 *
 * Validates the one-time token (existence + expiry + unused), updates the
 * password hash, marks the token used, and bumps refresh_token_version while
 * revoking every stored refresh token — forcing all sessions to re-login.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const token = typeof body.token === "string" ? body.token.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!token || !password) {
            return NextResponse.json({ error: "الرمز وكلمة المرور مطلوبان" }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
        }

        const result = await consumePasswordResetToken(token);
        if (!result) {
            return NextResponse.json({ error: "الرمز غير صالح أو منتهي الصلاحية" }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, result.userId));

        // Mark the token as consumed (single-use).
        await markPasswordResetUsed(hashToken(token));

        // Invalidate every outstanding session: bump the version + revoke rows.
        await revokeUserSessions(result.userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Reset password error:", error);
        return NextResponse.json({ error: "حدث خطأ أثناء إعادة تعيين كلمة المرور" }, { status: 500 });
    }
}
