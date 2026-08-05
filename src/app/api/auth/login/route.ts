import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, establishAuthSession } from "@/lib/auth";
import { ensurePersonalOrg } from "@/lib/services/org-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Rate-limited to 10/15-minutes per IP. Establishes a full session (access +
 * refresh + CSRF cookies). Adds an additive `requiresVerification` flag on the
 * response when the email is not yet verified — existing clients ignore it.
 */
export async function POST(req: Request) {
  const { result, retryAfterSeconds } = checkRateLimit(req, "auth:login", {
    limit: 10,
    windowMs: 15 * 60 * 1000, // 10 / 15 minutes
  });
  if (!result.success) {
    return NextResponse.json(
      { error: "محاولات كثيرة جداً. حاول مرة أخرى لاحقاً." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "يرجى إدخال البريد الإلكتروني وكلمة المرور" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail));
    if (!user) {
      return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, { status: 400 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, { status: 400 });
    }

    // Lazy migration for legacy accounts that predate the org model: create the
    // personal org (idempotent) so their notebooks can be tenanted and their
    // access token carries the tenant key.
    const personalOrg = await ensurePersonalOrg(user.id, user.name);
    const organizationId = personalOrg?.id ?? user.organizationId ?? null;

    const payload = await establishAuthSession(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as "user" | "admin",
        emailVerifiedAt:
          user.emailVerifiedAt == null
            ? null
            : user.emailVerifiedAt instanceof Date
              ? user.emailVerifiedAt.toISOString()
              : (user.emailVerifiedAt as string),
        organizationId,
      },
      { refreshTokenVersion: user.refreshTokenVersion, userAgent: req.headers.get("user-agent") }
    );

    const requiresVerification = user.emailVerifiedAt == null;

    return NextResponse.json({ user: payload, requiresVerification });
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تسجيل الدخول" }, { status: 500 });
  }
}
