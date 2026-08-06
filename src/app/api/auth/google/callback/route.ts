import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, oauthAccounts } from "@/db/schema";
import { establishAuthSession } from "@/lib/auth";
import { ensurePersonalOrg } from "@/lib/services/org-service";
import {
    exchangeCodeForToken,
    fetchGoogleProfile,
    GOOGLE_PROVIDER,
    hashOAuthState,
} from "@/lib/google-oauth";

/**
 * GET /api/auth/google/callback
 *
 * Google redirects the browser here after the user grants (or denies) access.
 * We:
 *   1. Verify the `state` nonce against the cookie (CSRF protection).
 *   2. Exchange the `code` for an access token.
 *   3. Fetch the user's Google profile.
 *   4. Find or create the local user, linking the OAuth account.
 *   5. Establish a full session (access + refresh + CSRF cookies).
 *   6. Redirect to the original `next` destination (or "/").
 *
 * Email verification is currently DISABLED — Google users are treated as
 * verified (Google already verified the email), and the existing
 * `requiresVerification` flag is no longer surfaced to the client.
 */

function sanitizeNext(next: string | null | undefined): string {
    if (!next) return "/";
    if (!next.startsWith("/")) return "/";
    if (next.startsWith("//")) return "/";
    if (next.includes(":")) return "/";
    return next;
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    const cookieStore = await cookies();
    const stateHashCookie = cookieStore.get("nblm_oauth_state")?.value;
    const nextCookie = cookieStore.get("nblm_oauth_next")?.value;

    // Always clear the one-shot cookies, even on failure.
    cookieStore.delete("nblm_oauth_state");
    cookieStore.delete("nblm_oauth_next");

    const safeNext = sanitizeNext(nextCookie);

    if (oauthError) {
        return NextResponse.redirect(new URL(`/login?error=oauth_${encodeURIComponent(oauthError)}`, req.url));
    }

    if (!code || !state || !stateHashCookie) {
        return NextResponse.redirect(new URL("/login?error=oauth_missing_params", req.url));
    }

    // CSRF: the state we sent must hash to the value we stored in the cookie.
    if (hashOAuthState(state) !== stateHashCookie) {
        return NextResponse.redirect(new URL("/login?error=oauth_state_mismatch", req.url));
    }

    try {
        const tokens = await exchangeCodeForToken(code);
        const profile = await fetchGoogleProfile(tokens.access_token);

        // 1. Look for an existing OAuth link first.
        const [existingLink] = await db
            .select({ user: users })
            .from(oauthAccounts)
            .innerJoin(users, eq(oauthAccounts.userId, users.id))
            .where(
                and(
                    eq(oauthAccounts.provider, GOOGLE_PROVIDER),
                    eq(oauthAccounts.providerAccountId, profile.providerAccountId)
                )
            );

        let userRow = existingLink?.user;

        // 2. No link — try to match by email (account linking).
        if (!userRow) {
            const [byEmail] = await db.select().from(users).where(eq(users.email, profile.email));
            if (byEmail) {
                // Link the OAuth account to the existing user.
                await db.insert(oauthAccounts).values({
                    userId: byEmail.id,
                    provider: GOOGLE_PROVIDER,
                    providerAccountId: profile.providerAccountId,
                    providerEmail: profile.email,
                    providerName: profile.name,
                });
                // Backfill the profile picture if the user doesn't have one.
                if (!byEmail.image && profile.picture) {
                    await db.update(users).set({ image: profile.picture, updatedAt: new Date() }).where(eq(users.id, byEmail.id));
                }
                userRow = { ...byEmail, image: byEmail.image ?? profile.picture ?? null };
            }
        }

        // 3. No existing user — create one.
        if (!userRow) {
            const [created] = await db
                .insert(users)
                .values({
                    name: profile.name,
                    email: profile.email,
                    // No password for OAuth-only users.
                    password: null,
                    image: profile.picture ?? null,
                    // Email is verified by Google — mark as verified.
                    emailVerifiedAt: new Date(),
                })
                .returning();
            userRow = created;

            await db.insert(oauthAccounts).values({
                userId: created.id,
                provider: GOOGLE_PROVIDER,
                providerAccountId: profile.providerAccountId,
                providerEmail: profile.email,
                providerName: profile.name,
            });

            // Personal org for the new user (same as the email/password flow).
            await ensurePersonalOrg(created.id, created.name);
        }

        // 4. Ensure the user has a personal org (idempotent for legacy accounts).
        const personalOrg = await ensurePersonalOrg(userRow.id, userRow.name);
        const organizationId = personalOrg?.id ?? userRow.organizationId ?? null;

        // 5. Establish the full session.
        await establishAuthSession(
            {
                id: userRow.id,
                name: userRow.name,
                email: userRow.email,
                role: (userRow.role as "user" | "admin") ?? "user",
                emailVerifiedAt:
                    userRow.emailVerifiedAt == null
                        ? null
                        : userRow.emailVerifiedAt instanceof Date
                            ? userRow.emailVerifiedAt.toISOString()
                            : (userRow.emailVerifiedAt as string),
                organizationId,
            },
            { refreshTokenVersion: userRow.refreshTokenVersion, userAgent: req.headers.get("user-agent") }
        );

        return NextResponse.redirect(new URL(safeNext, req.url));
    } catch (error) {
        console.error("Google OAuth callback error:", error);
        return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
    }
}
