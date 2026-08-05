import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { createEmailVerificationToken, deleteUnusedVerificationTokens } from "@/lib/auth-tokens";
import { buildTokenLink, buildVerificationEmail, sendEmail } from "@/lib/email";
import { getLocaleFromString } from "@/i18n";

export async function POST(req: Request) {
    const { result, retryAfterSeconds } = checkRateLimit(req, "auth:resend-verification", {
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
        if (!user) {
            // Don't leak whether the account exists.
            return NextResponse.json({ success: true });
        }
        if (user.emailVerifiedAt != null) {
            return NextResponse.json({ success: true });
        }

        await deleteUnusedVerificationTokens(user.id);
        const rawToken = await createEmailVerificationToken(user.id);
        const link = buildTokenLink("/verify-email", rawToken);
        const locale = getLocaleFromString(req.headers.get("accept-language"));
        const { subject, html, text } = buildVerificationEmail(user.name, link, locale);

        await sendEmail({ to: user.email, subject, html, text });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Resend verification error:", error);
        return NextResponse.json({ success: true }); // Never leak internal state.
    }
}
