/**
 * Shared helpers for one-time email tokens (verification + password reset).
 * Tokens are always stored hashed (sha-256) in the DB; the raw value is only
 * ever sent to the user's email inbox via a link.
 */
import { db } from "@/db";
import { emailVerifications, passwordResets, users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { hashToken, generateToken } from "@/lib/auth";
import type { EmailLocale } from "@/lib/email";

const VERIFY_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Creates an email-verification token for a user, persists its hash, and
 * returns the raw token (to embed in the email link). Any previous unused
 * verification tokens for the same user are invalidated.
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
    const raw = generateToken(32);
    await db.insert(emailVerifications).values({
        userId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    });
    return raw;
}

/**
 * Validates a verification token: exists, not expired, belongs to a real user.
 * On success returns { userId, user } (user includes email/name for re-send).
 * The row is deleted on success (single-use).
 */
export async function consumeEmailVerificationToken(token: string) {
    const tokenHash = hashToken(token);
    const [row] = await db
        .select({ ev: emailVerifications, user: users })
        .from(emailVerifications)
        .innerJoin(users, eq(emailVerifications.userId, users.id))
        .where(eq(emailVerifications.tokenHash, tokenHash));

    if (!row) return null;
    const expiresAt =
        row.ev.expiresAt instanceof Date ? row.ev.expiresAt.getTime() : new Date(row.ev.expiresAt as string).getTime();
    if (expiresAt <= Date.now()) {
        await db.delete(emailVerifications).where(eq(emailVerifications.tokenHash, tokenHash));
        return null;
    }
    return { userId: row.user.id, email: row.user.email, name: row.user.name };
}

/**
 * Marks the user's email as verified and deletes the used token.
 */
export async function markEmailVerified(userId: string, tokenHash: string) {
    await db
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, userId));
    await db.delete(emailVerifications).where(eq(emailVerifications.tokenHash, tokenHash));
}

/**
 * Invalidates all unused verification tokens for a user (used on resend).
 */
export async function deleteUnusedVerificationTokens(userId: string) {
    await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId));
}

/**
 * Creates a password-reset token for a user, persists its hash, and returns
 * the raw token (to embed in the email link).
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
    const raw = generateToken(32);
    await db.insert(passwordResets).values({
        userId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    return raw;
}

/**
 * Validates a password-reset token: exists, not expired, not used, belongs to
 * a real user. Returns { userId } on success, else null. Does NOT consume the
 * token — consumption happens in the reset handler (marks used_at).
 */
export async function consumePasswordResetToken(token: string) {
    const tokenHash = hashToken(token);
    const [row] = await db
        .select({ pr: passwordResets, user: users })
        .from(passwordResets)
        .innerJoin(users, eq(passwordResets.userId, users.id))
        .where(and(eq(passwordResets.tokenHash, tokenHash), isNull(passwordResets.usedAt)));

    if (!row) return null;
    const expiresAt =
        row.pr.expiresAt instanceof Date ? row.pr.expiresAt.getTime() : new Date(row.pr.expiresAt as string).getTime();
    if (expiresAt <= Date.now()) return null;
    return { userId: row.user.id };
}

/**
 * Marks a password-reset token as used.
 */
export async function markPasswordResetUsed(tokenHash: string) {
    await db
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(eq(passwordResets.tokenHash, tokenHash));
}

export type { EmailLocale };
