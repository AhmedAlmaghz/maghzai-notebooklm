import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, establishAuthSession } from "@/lib/auth";
import { ensurePersonalOrg } from "@/lib/services/org-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { createEmailVerificationToken } from "@/lib/auth-tokens";
import { buildTokenLink, buildVerificationEmail, sendEmail } from "@/lib/email";
import { getLocaleFromString } from "@/i18n";

/**
 * POST /api/auth/register
 * Body: { name, email, password }  (password min 8)
 *
 * Rate-limited to 5/hour per IP. Creates the account (email verified = null),
 * establishes a full session (access + refresh + CSRF cookies), and emails a
 * verification link. Returns { user } for the existing client pages.
 */
export async function POST(req: Request) {
  const { result, retryAfterSeconds } = checkRateLimit(req, "auth:register", {
    limit: 5,
    windowMs: 60 * 60 * 1000, // 5/hour
  });
  if (!result.success) {
    return NextResponse.json(
      { error: "محاولات كثيرة جداً. حاول مرة أخرى لاحقاً." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const [existing] = await db.select().from(users).where(eq(users.email, cleanEmail));
    if (existing) {
      return NextResponse.json({ error: "هذا البريد الإلكتروني مُسجل بالفعل" }, { status: 400 });
    }

    // Hash password & insert
    const hashedPassword = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
      })
      .returning();

    // Every new account gets its own personal org (owner membership). The org
    // id is written back to users.organization_id so the access token carries
    // the tenant key for org-level sharing.
    const personalOrg = await ensurePersonalOrg(newUser.id, newUser.name);
    const organizationId = personalOrg?.id ?? newUser.organizationId ?? null;

    // Full session: access + refresh + CSRF cookies (auto-login after register).
    const payload = await establishAuthSession(
      {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role as "user" | "admin",
        emailVerifiedAt: null,
        organizationId,
      },
      { refreshTokenVersion: newUser.refreshTokenVersion, userAgent: req.headers.get("user-agent") }
    );

    // Fire-and-forget the verification email (never fail registration on it).
    try {
      const rawToken = await createEmailVerificationToken(newUser.id);
      const link = buildTokenLink("/verify-email", rawToken);
      const locale = getLocaleFromString(req.headers.get("accept-language"));
      const { subject, html, text } = buildVerificationEmail(newUser.name, link, locale);
      await sendEmail({ to: newUser.email, subject, html, text });
    } catch (emailError) {
      console.error("Verification email failed (registration continues):", emailError);
    }

    return NextResponse.json({ user: payload });
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء إنشاء الحساب" }, { status: 500 });
  }
}
