import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPasswordResetToken } from "@/lib/auth-tokens";
import { buildTokenLink, buildPasswordResetEmail, sendEmail } from "@/lib/email";
import { getLocaleFromString } from "@/i18n";

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Rate-limited to 3/hour per IP. Always returns { success: true } whether or
 * not the account exists (prevents user enumeration). When the account exists
 * a one-time reset token is created and emailed as a /reset-password link.
 */
export async function POST(req: Request) {
    const { result, retryAfterSeconds } = checkRateLimit(req, "auth:forgot-password", {
        limit: 3,
        windowMs: 60 * 60 * 1000, // 3/hour
    });
    if (!result.success) {
        return NextResponse.json(
            { error: "محاولات كثيرة جداً. حاول مرة أخرى لاحقاً." },
            { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
        );
    }

    try {
        const body = await req.json().catch(() => ({}));
        const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
        if (!email) {
            return NextResponse.json({ error: "البريد الإلكتروني مطلوب" }, { status: 400 });
        }

        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (user) {
            const rawToken = await createPasswordResetToken(user.id);
            const link = buildTokenLink("/reset-password", rawToken);
            const locale = getLocaleFromString(req.headers.get("accept-language"));
            const { subject, html, text } = buildPasswordResetEmail(user.name, link, locale);
            await sendEmail({ to: user.email, subject, html, text });
        }

        // Always report success — never leak whether an account exists.
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json({ success: true }); // Never leak internal state.
    }
}
