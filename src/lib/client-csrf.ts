/**
 * Client-side CSRF helper for the double-submit cookie pattern.
 *
 * The backend sets a non-httpOnly `nblm_csrf` cookie when a session is
 * established (login / register / refresh). Any state-changing request to a
 * protected API (e.g. PATCH/POST /api/users/me) must echo that cookie value in
 * the `x-csrf-token` header — `requireCsrf()` in src/lib/auth.ts compares the
 * two in constant time. Browsers cannot attach custom headers cross-origin, so
 * this closes the CSRF gap for the sameSite=lax auth cookies.
 *
 * Cookie name and header name are kept in sync with src/lib/auth.ts
 * (`CSRF_COOKIE_NAME = "nblm_csrf"`, `CSRF_HEADER = "x-csrf-token"`).
 */
export const CSRF_COOKIE_NAME = "nblm_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Reads the CSRF token from the browser cookie store. Returns null if absent. */
export function getCsrfToken(): string | null {
    if (typeof document === "undefined") return null;
    const prefix = `${CSRF_COOKIE_NAME}=`;
    const cookie = document.cookie
        .split("; ")
        .find((c) => c.startsWith(prefix));
    if (!cookie) return null;
    const value = cookie.slice(prefix.length);
    return value ? decodeURIComponent(value) : null;
}

/**
 * Builds fetch headers with the CSRF token attached. Callers should spread this
 * into their `headers` object, e.g.:
 *
 *   fetch("/api/users/me", {
 *     method: "PATCH",
 *     headers: { "Content-Type": "application/json", ...csrfHeaders() },
 *     body: JSON.stringify({ name }),
 *   });
 */
export function csrfHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const token = getCsrfToken();
    return {
        ...(token ? { [CSRF_HEADER_NAME]: token } : {}),
        ...extra,
    };
}
