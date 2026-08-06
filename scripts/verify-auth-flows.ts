/**
 * Full auth-lifecycle verification (standalone, throwaway SQLite DB).
 *
 * Run:
 *   node --experimental-strip-types --import ./scripts/node-ts-loader-auth.mjs \
 *        scripts/verify-auth-flows.ts
 *
 * The node-ts-loader-auth.mjs resolver does four things (on top of the plain
 * node-ts-loader behavior):
 *   1. Rewrites `next/headers` → scripts/next-headers-shim.ts — the real module
 *      only works inside a Next.js request (AsyncLocalStorage). The shim
 *      provides a process-global cookie jar with the same interface.
 *   2. Rewrites `next/server` → the real `next/server.js` (resolves under Node)
 *      so `NextResponse.json()` behaves exactly as in production.
 *   3. Rewrites `@/db` → scripts/verify-db.ts (the SQLite shim).
 *   4. Preloads scripts/date-bind-shim.mjs (Date→ISO binding for
 *      better-sqlite3 + a global `require` for the auth lib's CJS call).
 *
 * This lets the REAL route handlers (register / login / me / logout) run
 * unchanged against a throwaway DB, so the script verifies the actual HTTP
 * contract — including the CSRF double-submit cookie and the new password-change
 * flow in POST/PATCH /api/users/me.
 *
 * Checks:
 *   1. register → full session (access + refresh + CSRF cookies) + GET /me.
 *   2. name-only PATCH /api/users/me (CSRF header) still works (no regression).
 *   3. password change with WRONG currentPassword → 400, password unchanged.
 *   4. password change with CORRECT currentPassword → 200 { user, success: true },
 *      new password logs in, old password is rejected.
 *   5. revokeUserSessions effect: refresh_token_version bumped + every stored
 *      refresh token row revoked → the OLD refresh token can no longer rotate
 *      (401 via /api/auth/refresh).
 *
 * Why standalone node: vitest 4.1.10 has a pre-existing environment bug
 * ("Cannot read properties of undefined (reading 'config')") that breaks
 * `vitest run` for every suite in this repo. This script runs with Node's
 * native --experimental-strip-types, keeping the exact same TS sources.
 */

import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rmSync, existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });

// Force SQLite with a throwaway DB. Unique per run (timestamp) so a stale
// better-sqlite3 handle from a prior run can never cause EPERM on Windows
// during cleanup. Mirrors scripts/verify-tenant-isolation.ts.
process.env.DATABASE_DRIVER = "sqlite";
const dbPath = path.join(__dirname, "..", `nblm_verify_authflows_${Date.now()}.db`);
process.env.SQLITE_DB_PATH = dbPath;

// Best-effort cleanup of previously written verification DBs (older runs).
for (const f of ["nblm_verify_authflows.db"]) {
  const p = path.join(__dirname, "..", f);
  if (existsSync(p)) {
    try {
      rmSync(p);
    } catch {
      // ignored — a previous process may still hold the handle
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module loading order is CRITICAL — see scripts/verify-tenant-isolation.ts for
// the full explanation. The date-bind shim + next/headers shim are registered
// by the LOADER (--import) BEFORE this script body runs, and every module that
// touches the DB is imported DYNAMICALLY inside `main()` after the env vars are
// set. The route modules are also imported dynamically here for the same reason
// (their `@/db`/`@/lib/auth` deps open the SQLite DB at import time).
// ─────────────────────────────────────────────────────────────────────────────

let db: Awaited<typeof import("./verify-db")>["db"];
let users: Awaited<typeof import("../src/db/schema-sqlite")>["users"];
let refreshTokens: Awaited<typeof import("../src/db/schema-sqlite")>["refreshTokens"];
let eq: typeof import("drizzle-orm")["eq"];
let hashToken: Awaited<typeof import("../src/lib/auth")>["hashToken"];
let cookieShim: typeof import("./next-headers-shim");

let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) console.log(`  PASS: ${label}`);
  else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
}

function cookieOf(name: string): string | undefined {
  return cookieShim.__dump()[name];
}

/** Reads the CSRF token the way the browser would (document.cookie). */
function csrfToken(): string {
  return cookieOf("nblm_csrf") ?? "";
}

function jsonBody(data: unknown): string {
  return JSON.stringify(data);
}

function csrfHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "Content-Type": "application/json", "x-csrf-token": csrfToken(), ...extra };
}

async function main() {
  // Load the shims + DB + routes ONLY after DATABASE_DRIVER / SQLITE_DB_PATH are set.
  const [dbMod, usersMod, refreshTokensMod, drizzleMod, authMod, cookieShimMod] = await Promise.all([
    import("./verify-db"),
    import("../src/db/schema-sqlite"),
    import("../src/db/schema-sqlite"),
    import("drizzle-orm"),
    import("../src/lib/auth"),
    import("./next-headers-shim"),
  ]);
  db = dbMod.db;
  users = usersMod.users;
  refreshTokens = refreshTokensMod.refreshTokens;
  eq = drizzleMod.eq;
  hashToken = authMod.hashToken;
  cookieShim = cookieShimMod;

  const registerRoute = await import("../src/app/api/auth/register/route");
  const loginRoute = await import("../src/app/api/auth/login/route");
  const meRoute = await import("../src/app/api/users/me/route");
  const refreshRoute = await import("../src/app/api/auth/refresh/route");
  const logoutRoute = await import("../src/app/api/auth/logout/route");

  const EMAIL = "auth.flows@example.com";
  const NAME = "Auth Flows";
  const PASSWORD_OLD = "OldPass123!";
  const PASSWORD_NEW = "NewPass456!";
  const UA = "verify-auth-flows/1.0";

  console.log("=== 1. Register + session establishment ===");
  cookieShim.__reset();
  const regRes = await registerRoute.POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1", "user-agent": UA },
      body: jsonBody({ name: NAME, email: EMAIL, password: PASSWORD_OLD }),
    })
  );
  const regData = await regRes.json();
  check(regRes.status === 200 && regData.user?.email === EMAIL, "register returns 200 + user payload");
  check(
    Boolean(cookieOf("nblm_session")) && Boolean(cookieOf("nblm_refresh")) && Boolean(cookieOf("nblm_csrf")),
    "register sets access + refresh + CSRF cookies"
  );

  const meGet1 = await meRoute.GET();
  const meGet1Data = await meGet1.json();
  check(meGet1.status === 200 && meGet1Data.user?.email === EMAIL, "GET /api/users/me returns the registered user");

  // Capture the refresh token issued at registration (for the revocation check).
  const regRefreshRaw = cookieOf("nblm_refresh")!;
  const regRefreshHash = hashToken(regRefreshRaw);
  const [regRtRow] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, regRefreshHash));
  check(Boolean(regRtRow), "refresh token row persisted (hashed) at registration");

  const [userRowBefore] = await db.select().from(users).where(eq(users.email, EMAIL));
  const rvBefore = userRowBefore.refreshTokenVersion;

  console.log("=== 2. Name-only PATCH (no regression) ===");
  cookieShim.__reset();
  // Simulate a fresh page load: establish a session via login so cookies exist.
  const loginRes = await loginRoute.POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1", "user-agent": UA },
      body: jsonBody({ email: EMAIL, password: PASSWORD_OLD }),
    })
  );
  const loginData = await loginRes.json();
  check(loginRes.status === 200 && loginData.user?.email === EMAIL, "login with correct password succeeds");

  const newName = "Auth Flows Renamed";
  const patchRes = await meRoute.PATCH(
    new Request("http://localhost/api/users/me", {
      method: "PATCH",
      headers: csrfHeaders(),
      body: jsonBody({ name: newName }),
    })
  );
  const patchData = await patchRes.json();
  check(patchRes.status === 200 && patchData.user?.name === newName, "name-only PATCH returns updated name");
  check(patchData.success === undefined, "name-only PATCH does NOT report success flag (unchanged shape)");
  check(patchData.user?.email === EMAIL, "name-only PATCH returns the full user payload");

  console.log("=== 3. Password change — WRONG current password ===");
  const badPwRes = await meRoute.POST(
    new Request("http://localhost/api/users/me", {
      method: "POST",
      headers: csrfHeaders(),
      body: jsonBody({ currentPassword: "WrongPass999!", newPassword: PASSWORD_NEW }),
    })
  );
  const badPwData = await badPwRes.json();
  check(badPwRes.status === 400 && typeof badPwData.error === "string", "wrong currentPassword → 400 + error");
  check(badPwData.user === undefined, "wrong currentPassword → no user in response");

  // Verify the password hash was NOT changed.
  const [userRowWrongPw] = await db.select().from(users).where(eq(users.email, EMAIL));
  const oldHashStillValid = await authMod.verifyPassword(PASSWORD_OLD, userRowWrongPw.password!);
  check(oldHashStillValid, "password hash unchanged after failed attempt (old password still verifies)");

  console.log("=== 4. Password change — CORRECT current password ===");
  // Issue a fresh refresh token (via /api/auth/refresh rotation) so we have a
  // second, distinct row to prove revocation wipes ALL stored tokens.
  const rotRes = await refreshRoute.POST(new Request("http://localhost/api/auth/refresh", { method: "POST" }));
  const rotData = await rotRes.json();
  check(rotRes.status === 200 && rotData.user?.email === EMAIL, "refresh rotation before password change succeeds");

  const goodPwRes = await meRoute.POST(
    new Request("http://localhost/api/users/me", {
      method: "POST",
      headers: csrfHeaders(),
      body: jsonBody({ currentPassword: PASSWORD_OLD, newPassword: PASSWORD_NEW }),
    })
  );
  const goodPwData = await goodPwRes.json();
  check(
    goodPwRes.status === 200 && goodPwData.success === true && goodPwData.user?.email === EMAIL,
    "correct currentPassword → 200 { user, success: true }"
  );

  // Password now verifies against the NEW password.
  const [userRowAfter] = await db.select().from(users).where(eq(users.email, EMAIL));
  const newHashValid = await authMod.verifyPassword(PASSWORD_NEW, userRowAfter.password!);
  check(newHashValid, "new password verifies after change");

  // refresh_token_version must have been bumped.
  check(
    userRowAfter.refreshTokenVersion > rvBefore,
    `refresh_token_version bumped (${rvBefore} → ${userRowAfter.refreshTokenVersion})`
  );

  // All refresh token rows for this user must be revoked.
  const allRows = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, userRowAfter.id));
  const allRevoked = allRows.length > 0 && allRows.every((r) => r.revokedAt != null);
  check(allRevoked, `all ${allRows.length} stored refresh tokens revoked`);

  // Direct lib-level check: the registration-era refresh token (its stored row)
  // can no longer be validated → verifyStoredRefreshToken returns null.
  const staleLib = await authMod.verifyStoredRefreshToken(regRefreshRaw);
  check(staleLib === null, "old refresh token fails verifyStoredRefreshToken (row revoked)");

  // HTTP-level check: put the OLD token in the cookie jar (the refresh route
  // reads the `nblm_refresh` cookie from next/headers), then POST /api/auth/refresh.
  cookieShim.__reset();
  (await cookieShim.cookies()).set("nblm_refresh", regRefreshRaw);
  const staleRefreshRes = await refreshRoute.POST(new Request("http://localhost/api/auth/refresh", { method: "POST" }));
  check(staleRefreshRes.status === 401, "old refresh token rejected by /api/auth/refresh (401)");

  console.log("=== 5. New password login / old password rejection ===");
  cookieShim.__reset();
  const loginNewRes = await loginRoute.POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1", "user-agent": UA },
      body: jsonBody({ email: EMAIL, password: PASSWORD_NEW }),
    })
  );
  check(loginNewRes.status === 200, "login with NEW password succeeds");

  cookieShim.__reset();
  const loginOldRes = await loginRoute.POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1", "user-agent": UA },
      body: jsonBody({ email: EMAIL, password: PASSWORD_OLD }),
    })
  );
  check(loginOldRes.status === 400, "login with OLD password rejected");

  // Cleanup: remove the throwaway DB (best-effort; WAL files too).
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${dbPath}${suffix}`;
    if (existsSync(p)) {
      try {
        rmSync(p);
      } catch {
        // ignored — a previous process may still hold the handle
      }
    }
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
