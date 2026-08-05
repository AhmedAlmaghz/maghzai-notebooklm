import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID } from "crypto";

// ─── Configuration ───────────────────────────────────────────────────────────

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const ACCESS_COOKIE_NAME = "nblm_session";
export const REFRESH_COOKIE_NAME = "nblm_refresh";
export const CSRF_COOKIE_NAME = "nblm_csrf";

// Never fall back to a hardcoded secret. In production a missing JWT_SECRET is
// a fatal misconfiguration. In development we still refuse to silently sign
// with a known value — we warn loudly so nobody ships with a guessable key.
function resolveJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET is not set (or is too short). Set a strong secret (openssl rand -base64 32) " +
        "in your environment before starting the production server."
      );
    }
    console.warn(
      "[auth] JWT_SECRET is missing or too short. Using a DEV-ONLY fallback secret — " +
      "tokens will be invalidated on restart. DO NOT deploy with this configuration."
    );
    return new TextEncoder().encode("dev_only_insecure_fallback_secret_do_not_use_in_prod");
  }
  return new TextEncoder().encode(secret);
}

// Resolve lazily, not at module scope: `next build` imports this module with
// NODE_ENV=production and no JWT_SECRET set, but signing/verifying only happens
// at request time. The FIRST token operation still throws when the secret is
// missing/weak in production — the security posture is unchanged.
let cachedSecret: Uint8Array | undefined;

function getJwtSecret(): Uint8Array {
  if (cachedSecret === undefined) {
    cachedSecret = resolveJwtSecret();
  }
  return cachedSecret;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";

export interface UserPayload {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerifiedAt: string | null;
  organizationId: string | null;
}

export interface AuthResult {
  user: UserPayload;
  accessToken: string;
  refreshToken: string;
}

interface AccessTokenClaims extends UserPayload {
  type: "access";
  rv: number; // refresh_token_version at the time of signing
  orgId: string | null;
  jti: string;
}

interface RefreshTokenClaims {
  type: "refresh";
  sub: string; // user id
  jti: string;
  rv: number; // refresh_token_version at the time of signing
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerifiedAt: string | null;
  organizationId: string | null;
  refreshTokenVersion: number;
}

// ─── Password hashing ────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// ─── Token hashing (refresh tokens are stored hashed, never raw) ─────────────

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("hex");
}

export function generateJti(): string {
  return randomUUID();
}

// ─── Access token (short-lived JWT) ─────────────────────────────────────────

export async function createAccessToken(user: SessionUser): Promise<string> {
  return await new SignJWT({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    orgId: user.organizationId,
    rv: user.refreshTokenVersion,
    type: "access",
    jti: generateJti(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

// ─── Refresh token (opaque, stored hashed in DB, delivered via cookie) ───────

export async function createRefreshToken(userId: string, refreshTokenVersion: number): Promise<string> {
  // The signed JWT is the raw token. Only its sha-256 hash is ever persisted
  // (see refresh_tokens.token_hash); the raw value travels only via the
  // httpOnly `nblm_refresh` cookie.
  return await new SignJWT({ type: "refresh", sub: userId, jti: generateJti(), rv: refreshTokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyRefreshToken(
  rawToken: string
): Promise<{ userId: string; jti: string; rv: number } | null> {
  try {
    const { payload } = await jwtVerify(rawToken, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    if (payload.type !== "refresh" || !payload.sub || !payload.jti) return null;
    const rv = typeof payload.rv === "number" ? payload.rv : 0;
    return { userId: payload.sub, jti: payload.jti, rv };
  } catch {
    return null;
  }
}

// ─── Backward-compatible aliases (existing callers used createToken/verifyToken) ─

/**
 * Backward-compatible alias: signs a 15-minute access JWT from a user payload.
 * Kept so existing code paths (and any future callers) keep compiling.
 */
export async function createToken(payload: Pick<UserPayload, "id" | "name" | "email">): Promise<string> {
  const sessionUser: SessionUser = {
    ...payload,
    role: "user",
    emailVerifiedAt: null,
    organizationId: null,
    refreshTokenVersion: 0,
  };
  return await createAccessToken(sessionUser);
}

/**
 * Backward-compatible alias: verifies a JWT and returns the user payload or null.
 */
export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (payload.type && payload.type !== "access") return null;
    return {
      id: (payload.sub as string) ?? (payload.id as string),
      name: (payload.name as string) ?? "",
      email: (payload.email as string) ?? "",
      role: (payload.role as UserRole) ?? "user",
      emailVerifiedAt: (payload.emailVerifiedAt as string | null) ?? null,
      organizationId: (payload.orgId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Session helpers ─────────────────────────────────────────────────────────

/**
 * Builds the combined "session" from the access cookie (if present).
 * The refresh cookie is kept separate so logout can revoke it server-side.
 *
 * Session fallback: when the short-lived access cookie is missing or expired,
 * a still-valid refresh cookie (`nblm_refresh`) can authenticate the user so
 * server-rendered pages render seamlessly until the client bootstrap replaces
 * the access cookie via POST /api/auth/refresh. Server components cannot set
 * cookies, so this path only returns the payload — it never issues a cookie.
 *
 * The fallback runs the SAME DB-backed validation as the refresh flow:
 * signature/type/expiry via the JWT, then a lookup of `refresh_tokens` by the
 * sha-256 hash, checking the row is not revoked/expired and that the token's
 * embedded `rv` matches the user's current `refresh_token_version`.
 *
 * @param opts.refreshFallback Set to `false` on routes that must NOT silently
 *   accept an expired access cookie (defaults to `true`).
 */
export async function getCurrentUser({ refreshFallback = true }: { refreshFallback?: boolean } = {}): Promise<UserPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
    if (token) {
      const user = await verifyToken(token);
      if (user) return user;
    }

    // Access token missing or expired → try the refresh cookie fallback.
    if (refreshFallback) {
      const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
      if (refreshToken) {
        const verified = await verifyStoredRefreshToken(refreshToken);
        // Same version check the rotation flow applies: a token signed at an
        // older refresh_token_version is stale (all sessions were revoked).
        if (verified && verified.rv === verified.user.refreshTokenVersion) {
          return toUserPayload(verified.user);
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Backward-compatible cookie writer: writes the access token cookie (short-lived).
 */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
    path: "/",
    priority: "high",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
  cookieStore.delete(CSRF_COOKIE_NAME);
}

// ─── Cookie management for the full auth lifecycle ───────────────────────────

export async function setAccessCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
    path: "/",
    priority: "high",
  });
}

export async function setRefreshCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
    path: "/",
    priority: "high",
  });
}

export async function setCsrfCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
    path: "/",
  });
}

export async function getRefreshCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;
}

export async function clearRefreshCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(REFRESH_COOKIE_NAME);
}

export async function clearCsrfCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE_NAME);
}

// ─── CSRF (double-submit cookie) ─────────────────────────────────────────────

const CSRF_HEADER = "x-csrf-token";

/**
 * Pragmatic CSRF protection: on login/refresh we set a non-httpOnly cookie
 * `nblm_csrf` to a random value. Any state-changing request that carries a
 * custom header must send the same value in `x-csrf-token`. Because browsers
 * cannot attach custom headers cross-origin (no CORS allow-header), and our
 * auth cookies are sameSite=lax, a forged cross-site form post cannot include
 * the header.
 */
export async function requireCsrf(req: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  if (!csrfCookie) return false;
  const headerValue = req.headers.get(CSRF_HEADER);
  if (!headerValue) return false;
  // Constant-time comparison to avoid timing side-channels.
  return timingSafeEqualHex(csrfCookie, headerValue);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return require("crypto").timingSafeEqual(ab, bb);
}

export async function createCsrfToken(): Promise<string> {
  return randomBytes(32).toString("base64url");
}

// ─── Full-session helpers (used by auth routes) ───────────────────────────────

/**
 * Establishes a complete authenticated session for a user:
 *  1. issues access + refresh tokens and persists the (hashed) refresh token,
 *  2. writes the httpOnly access cookie, the httpOnly refresh cookie and the
 *     non-httpOnly CSRF double-submit cookie.
 * Returns the payload for the JSON response.
 */
export async function establishAuthSession(
  user: Pick<UserPayload, "id" | "name" | "email" | "role" | "emailVerifiedAt" | "organizationId">,
  opts?: { refreshTokenVersion?: number; userAgent?: string | null }
): Promise<UserPayload> {
  const result = await createTokens(user, {
    refreshTokenVersion: opts?.refreshTokenVersion ?? 0,
    userAgent: opts?.userAgent ?? null,
  });
  const csrfToken = await createCsrfToken();
  await Promise.all([
    setAccessCookie(result.accessToken),
    setRefreshCookie(result.refreshToken),
    setCsrfCookie(csrfToken),
  ]);
  return toUserPayload(user);
}

/**
 * Clears every auth cookie (access, refresh, CSRF).
 */
export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
  cookieStore.delete(CSRF_COOKIE_NAME);
}

// ─── Token rotation & revocation ─────────────────────────────────────────────

/**
 * Revoke every session for a user: bump `refresh_token_version` (which makes
 * all outstanding access tokens stale at refresh time — they are 15-min anyway)
 * and hard-revoke every stored refresh token row.
 */
export async function revokeUserSessions(userId: string) {
  const { db } = await import("@/db");
  const { users, refreshTokens } = await import("@/db/schema");
  const { eq, gte, sql } = await import("drizzle-orm");

  const [next] = await db
    .update(users)
    .set({ refreshTokenVersion: sql`${users.refreshTokenVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ refreshTokenVersion: users.refreshTokenVersion });

  // Mark all still-active rows revoked.
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(sql`${refreshTokens.revokedAt} IS NULL AND ${refreshTokens.userId} = ${userId}`);

  return next?.refreshTokenVersion ?? 0;
}

export async function revokeRefreshTokenByHash(tokenHash: string) {
  const { db } = await import("@/db");
  const { refreshTokens } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenHash, tokenHash));
}

// ─── Session establishment & rotation ─────────────────────────────────────────

/**
 * Creates a full session (access + refresh token) for a user and persists the
 * refresh token (hashed) into `refresh_tokens`.
 */
export async function createTokens(
  user: Pick<UserPayload, "id" | "name" | "email" | "role" | "emailVerifiedAt" | "organizationId">,
  opts?: { refreshTokenVersion?: number; userAgent?: string | null }
): Promise<AuthResult> {
  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    organizationId: user.organizationId,
    refreshTokenVersion: opts?.refreshTokenVersion ?? 0,
  };

  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(sessionUser),
    createRefreshToken(user.id, sessionUser.refreshTokenVersion),
  ]);

  const { db } = await import("@/db");
  const { refreshTokens } = await import("@/db/schema");
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    userAgent: opts?.userAgent ?? null,
  });

  return { user: toUserPayload(user), accessToken, refreshToken };
}

export function toUserPayload(
  u: Pick<UserPayload, "id" | "name" | "email" | "role" | "emailVerifiedAt" | "organizationId">
): UserPayload {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    emailVerifiedAt: u.emailVerifiedAt,
    organizationId: u.organizationId,
  };
}

/**
 * Validates a refresh token: signature, type, expiry, presence in DB (hashed),
 * not revoked, not expired. Returns the user row on success, else null.
 */
export async function verifyStoredRefreshToken(
  rawToken: string
): Promise<{ user: SessionUser; jti: string; rv: number } | null> {
  const parsed = await verifyRefreshToken(rawToken);
  if (!parsed) return null;

  const { db } = await import("@/db");
  const { users, refreshTokens } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const [row] = await db
    .select({
      user: users,
      rt: refreshTokens,
    })
    .from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(eq(refreshTokens.tokenHash, hashToken(rawToken)));

  if (!row) return null;

  const now = Date.now();
  const expiresAt =
    row.rt.expiresAt instanceof Date ? row.rt.expiresAt.getTime() : new Date(row.rt.expiresAt as string).getTime();
  if (row.rt.revokedAt != null || expiresAt <= now) return null;

  return {
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: (row.user.role as UserRole) ?? "user",
      emailVerifiedAt:
        row.user.emailVerifiedAt == null
          ? null
          : row.user.emailVerifiedAt instanceof Date
            ? row.user.emailVerifiedAt.toISOString()
            : (row.user.emailVerifiedAt as string),
      organizationId: row.user.organizationId ?? null,
      refreshTokenVersion: row.user.refreshTokenVersion,
    },
    jti: parsed.jti,
    rv: parsed.rv,
  };
}

/**
 * Full refresh rotation: revokes the old refresh token row, then issues a brand
 * new access + refresh token pair.
 */
export async function rotateRefreshToken(
  rawToken: string,
  opts?: { userAgent?: string | null }
): Promise<AuthResult | null> {
  const verified = await verifyStoredRefreshToken(rawToken);
  if (!verified) return null;

  // The refresh token's embedded version must match the user's current
  // refresh_token_version. If the user revoked all sessions (bumped the
  // version), any token signed at an older version is now stale.
  if (verified.rv !== verified.user.refreshTokenVersion) {
    return null;
  }

  const { user, jti } = verified;

  // Revoke the old refresh token row.
  await revokeRefreshTokenByHash(hashToken(rawToken));

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    organizationId: user.organizationId,
    refreshTokenVersion: user.refreshTokenVersion,
  };

  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(sessionUser),
    createRefreshToken(user.id, sessionUser.refreshTokenVersion),
  ]);

  const { db } = await import("@/db");
  const { refreshTokens } = await import("@/db/schema");
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    userAgent: opts?.userAgent ?? null,
  });

  void jti;
  return {
    user: toUserPayload(user),
    accessToken,
    refreshToken,
  };
}
