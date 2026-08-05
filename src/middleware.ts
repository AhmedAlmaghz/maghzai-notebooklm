import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Global route protection for بحّاثة / Bahhatha.
 *
 * Runs on the Edge runtime (Next.js middleware default). This file must stay
 * fully self-contained: it MUST NOT import from `@/lib/*` or `@/db/*` because
 * those pull in Node-only modules (better-sqlite3, pg, bcryptjs, nodemailer).
 * It only uses `jose` (edge-compatible) + `process.env`.
 *
 * Design notes:
 * - The middleware is the *UX gate*, not the sole security boundary. Route
 *   handlers and server components still enforce real authorization
 *   (`requireNotebookAccess`, `getCurrentUser`, DB checks).
 * - The 15-minute access JWT frequently expires while a 30-day refresh cookie
 *   is still valid. When the access token is missing/expired but a refresh
 *   cookie exists we let the request through: `getCurrentUser()` falls back to
 *   the refresh cookie server-side, and the client `<SessionRefresh/>`
 *   bootstrap silently calls POST /api/auth/refresh to rotate the pair.
 * - In production, a missing/weak JWT_SECRET denies every protected route
 *   (never allow). In development we replicate the EXACT dev-only fallback
 *   secret from `resolveJwtSecret()` in src/lib/auth.ts so dev tokens verify
 *   consistently between the middleware and the Node runtime.
 */

const ACCESS_COOKIE = "nblm_session";
const REFRESH_COOKIE = "nblm_refresh";

// ─── Route classification ────────────────────────────────────────────────────

/** Auth pages: a signed-in user is redirected away to the dashboard. */
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

/** Public pages (auth pages are also public for signed-out visitors). */
const PUBLIC_PAGES = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

/** Protected pages (any depth below each prefix). */
const PROTECTED_PAGE_PREFIXES = ["/notebook", "/profile", "/settings"];

type RouteKind = "auth" | "public" | "protectedPage" | "protectedApi";

/** Exact path match, or any depth below it (`/reset-password/<token>` …). */
function isPathMatch(pathname: string, pathOrPrefix: string): boolean {
  return pathname === pathOrPrefix || pathname.startsWith(`${pathOrPrefix}/`);
}

function classifyRoute(pathname: string): RouteKind {
  // Any `/api/*` path that reaches the middleware is protected: the matcher
  // below already excluded /api/auth/* and /api/health. Currently that means
  // /api/notebooks* and /api/users/me (plus anything added later).
  if (pathname.startsWith("/api/")) return "protectedApi";

  // Auth pages must be checked before the generic public list.
  if (AUTH_PAGES.some((p) => isPathMatch(pathname, p))) return "auth";

  // Public pages pass through for signed-out visitors (and signed-in users).
  if (PUBLIC_PAGES.some((p) => isPathMatch(pathname, p))) return "public";

  // Protected pages (notebook workspace, profile, settings).
  if (PROTECTED_PAGE_PREFIXES.some((p) => isPathMatch(pathname, p))) return "protectedPage";

  // Default: anything else stays public (future public pages).
  return "public";
}

// ─── JWT secret resolution (parity with src/lib/auth.ts) ─────────────────────

/**
 * Mirrors `resolveJwtSecret()` from src/lib/auth.ts so the middleware and the
 * Node runtime agree on the signing/verification key — including the dev-only
 * fallback. Returns `null` in production when the secret is missing/weak so
 * protected routes are denied rather than accidentally allowed.
 */
function resolveJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[middleware] JWT_SECRET is not set (or is too short). Protected routes are DENIED."
      );
      return null;
    }
    console.warn(
      "[auth] JWT_SECRET is missing or too short. Using a DEV-ONLY fallback secret — " +
        "tokens will be invalidated on restart. DO NOT deploy with this configuration."
    );
    return new TextEncoder().encode("dev_only_insecure_fallback_secret_do_not_use_in_prod");
  }
  return new TextEncoder().encode(secret);
}

// Resolve lazily, never at module scope: the middleware bundle must build even
// when JWT_SECRET is absent (a missing/weak secret only denies routes at
// runtime). Memoized so the production "DENIED" error log fires at most once.
let cachedSecret: Uint8Array | null | undefined;

function getJwtSecret(): Uint8Array | null {
  if (cachedSecret === undefined) {
    cachedSecret = resolveJwtSecret();
  }
  return cachedSecret;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // 1. Verify the access JWT (HS256). Missing/expired/invalid is simply "not
  //    access-valid"; the refresh cookie may still let the request through.
  let accessValid = false;
  const secret = getJwtSecret();
  if (accessToken && secret) {
    try {
      const { payload } = await jwtVerify(accessToken, secret, {
        algorithms: ["HS256"],
      });
      // Same semantics as verifyToken() in src/lib/auth.ts: a `type` claim of
      // anything other than "access" (e.g. a refresh JWT) is rejected.
      accessValid = Boolean(payload.sub || payload.id) && (!payload.type || payload.type === "access");
    } catch {
      accessValid = false;
    }
  }

  const route = classifyRoute(pathname);

  // 2. Auth pages: a signed-in user is bounced to the dashboard.
  if (route === "auth") {
    if (accessValid) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 3. Public pages always pass through.
  if (route === "public") {
    return NextResponse.next();
  }

  // 4. Protected routes (pages + APIs).
  if (accessValid) {
    return NextResponse.next();
  }

  // Access token missing/expired but a refresh cookie exists → let it through.
  // The server-side `getCurrentUser()` refresh fallback and the client
  // `/api/auth/refresh` bootstrap perform the silent rotation. Middleware is
  // the UX gate, not the sole security boundary.
  if (refreshToken) {
    return NextResponse.next();
  }

  // No valid session at all → deny.
  if (route === "protectedPage") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Preserve the original path + search so the login page can return the
    // user after authenticating (e.g. /login?next=/notebook/abc?tab=sources).
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // protectedApi
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

/**
 * Run on every route EXCEPT:
 *  - `/_next/*` (Next.js internals)
 *  - `/api/auth/*` and `/api/health` (public by design)
 *  - `/robots.txt`, `/sitemap.xml`
 *  - any path containing a dot (static files: favicon.ico, .png, .svg, .css,
 *    .js, .woff2, …)
 *
 * Verified mentally for the key paths:
 *  - `/api/notebooks`, `/api/notebooks/<id>/...`  → runs (protected API)
 *  - `/notebook/<id>`, `/profile`, `/settings`    → runs (protected pages)
 *  - `/login`, `/`, `/reset-password/<token>`     → runs (public/auth pages)
 *  - `/api/auth/login`, `/api/health`, `/favicon.ico`, `/_next/...` → skipped
 */
export const config = {
  matcher: ["/((?!_next|api/auth|api/health|robots\\.txt|sitemap\\.xml|.*\\..*).*)"],
};
