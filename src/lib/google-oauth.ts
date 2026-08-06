import { createHash, randomBytes } from "crypto";

/**
 * Google OAuth 2.0 helpers (Authorization Code flow).
 *
 * We implement the standard OAuth flow manually (no NextAuth) so the existing
 * JWT/cookie session model stays the single source of truth for auth state.
 *
 * Required env vars:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET
 *   - GOOGLE_REDIRECT_URI  (e.g. http://localhost:3000/api/auth/google/callback)
 *
 * Optional:
 *   - NEXT_PUBLIC_APP_URL  (used to build the redirect URI when GOOGLE_REDIRECT_URI is missing)
 */

export const GOOGLE_PROVIDER = "google" as const;
export const GOOGLE_SCOPES = ["openid", "email", "profile"];

export interface GoogleProfile {
    /** Stable, unique user id from Google (the `sub` claim). */
    providerAccountId: string;
    email: string;
    emailVerified: boolean;
    name: string;
    picture?: string;
}

export function isGoogleOAuthConfigured(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function resolveRedirectUri(): string {
    if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

/**
 * Builds the Google authorization URL the browser should be redirected to.
 * `state` is a CSRF nonce the callback route must verify.
 */
export function buildGoogleAuthUrl(state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: resolveRedirectUri(),
        response_type: "code",
        scope: GOOGLE_SCOPES.join(" "),
        access_type: "online",
        include_granted_scopes: "true",
        prompt: "select_account",
        state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges the authorization `code` for an access token.
 */
export async function exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    id_token?: string;
    expires_in: number;
    token_type: string;
}> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth is not configured (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: resolveRedirectUri(),
            grant_type: "authorization_code",
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Google token exchange failed (${res.status}): ${text}`);
    }
    return (await res.json()) as {
        access_token: string;
        id_token?: string;
        expires_in: number;
        token_type: string;
    };
}

/**
 * Fetches the user's Google profile using the access token.
 * We use the userinfo endpoint (works for any granted scopes) instead of
 * decoding the id_token, so we don't need to verify JWT signatures here.
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Google userinfo fetch failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as {
        id: string;
        email: string;
        verified_email?: boolean;
        name: string;
        picture?: string;
    };
    if (!data.id || !data.email || !data.name) {
        throw new Error("Google profile is missing required fields (id/email/name)");
    }
    return {
        providerAccountId: data.id,
        email: data.email.toLowerCase().trim(),
        emailVerified: Boolean(data.verified_email),
        name: data.name,
        picture: data.picture,
    };
}

// ─── State nonce (CSRF protection for the OAuth round-trip) ─────────────────

/**
 * Generates a random state nonce. We store its sha-256 hash in a short-lived
 * httpOnly cookie and compare on callback to prevent CSRF.
 */
export function generateOAuthState(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString("base64url");
    return { raw, hash: createHash("sha256").update(raw).digest("hex") };
}

export function hashOAuthState(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
}
