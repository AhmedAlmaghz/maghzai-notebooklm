import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildGoogleAuthUrl, generateOAuthState, isGoogleOAuthConfigured } from "@/lib/google-oauth";

/**
 * GET /api/auth/google
 *
 * Starts the Google OAuth flow. Generates a CSRF state nonce, stores its
 * sha-256 hash in a short-lived httpOnly cookie, and redirects the browser to
 * Google's authorization endpoint.
 *
 * Query params:
 *   - next: optional internal path to redirect to after a successful sign-in
 *           (sanitized by the callback route).
 */
export async function GET(req: Request) {
    if (!isGoogleOAuthConfigured()) {
        return NextResponse.json(
            { error: "Google sign-in is not configured on this server." },
            { status: 503 }
        );
    }

    const url = new URL(req.url);
    const next = url.searchParams.get("next") || "/";

    const { raw, hash } = generateOAuthState();

    const cookieStore = await cookies();
    cookieStore.set("nblm_oauth_state", hash, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60, // 10 minutes — plenty for the round-trip
        path: "/",
    });
    // Carry the post-login destination through the round-trip.
    cookieStore.set("nblm_oauth_next", next, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/",
    });

    const authUrl = buildGoogleAuthUrl(raw);
    return NextResponse.redirect(authUrl);
}
