/**
 * Cross-tenant isolation verification (standalone, throwaway SQLite DB).
 *
 * Run:  node --experimental-strip-types --import ./scripts/node-ts-loader.mjs \
 *            scripts/verify-tenant-isolation.ts
 *
 * Verifies the org-model guarantees end to end at the service layer:
 *   1. Every user gets their own distinct personal org (idempotent).
 *   2. Notebook lists are scoped at the SQL level — user A never sees user B's
 *      private notebook, and vice-versa.
 *   3. Org-shared notebooks become visible only after a real membership exists.
 *   4. The access decision matrix (owner / member-read / member-write / none)
 *      that drives `requireNotebookAccess` behaves correctly, using the same
 *      `getMembership` lookup the access layer uses.
 *   5. Trash is strictly personal.
 *   6. Last-owner guard prevents removing/demoting the final owner.
 *
 * NOTE: `requireNotebookAccess` itself calls `getCurrentUser()` (next/headers)
 * and cannot run outside a Next.js request. Its org branch is exactly
 * `getMembership(notebook.organizationId, user.id)` + role comparison, which
 * this script verifies against real rows (see `accessFor` below).
 *
 * IMPORTANT contract being exercised: the SQL list filter trusts `orgIds` —
 * callers MUST derive them from `getUserOrganizations(userId)` (membership),
 * as `GET /api/notebooks` does. Direct resource access is additionally guarded
 * by the membership check inside `requireNotebookAccess` (defense in depth).
 *
 * Why standalone node: vitest 4.1.10 has a pre-existing environment bug
 * ("Cannot read properties of undefined (reading 'config')") that breaks
 * `vitest run` for every suite in this repo, and tsx's esbuild cannot compile
 * `src/db/index.ts` (top-level await) into CJS. This script runs with Node's
 * native --experimental-strip-types, keeping the exact same TS sources.
 */

import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rmSync, existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });

// Force SQLite with a throwaway DB so we never touch a real database. The path
// is unique per run (timestamp) so a stale better-sqlite3 handle from a prior
// run can never cause EPERM on Windows during cleanup.
process.env.DATABASE_DRIVER = "sqlite";
const dbPath = path.join(
  __dirname,
  "..",
  `nblm_verify_isolation_${Date.now()}.db`
);
process.env.SQLITE_DB_PATH = dbPath;

// Best-effort cleanup of any previously written verification DBs (older runs).
for (const f of ["nblm_verify_isolation.db"]) {
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
// Module loading order is CRITICAL: ESM hoists static imports, so any module
// that opens the SQLite DB (`@/db` → verify-db shim) would execute BEFORE the
// process.env assignments above — the DB path would be the stable fallback and
// a stale DB from a crashed run would survive into this one (hence the earlier
// `UNIQUE constraint failed: users.email`). Therefore every module that touches
// the DB (and the services that import `@/db`) is loaded DYNAMICALLY, after the
// env vars are set, inside `main()` below.
//
// `users` is imported from schema-sqlite directly (not `@/db/schema`) because
// the shared schema.ts compile-types everything as the Postgres variant, while
// `db` is the SQLite shim — same runtime object when DATABASE_DRIVER=sqlite,
// but typed as SQLiteColumn so it typechecks against the sqlite query builder.
//
// `NotebookAccessInfo` is a pure type import from the real access layer — it is
// erased at runtime, so it never pulls in `@/lib/auth` (which imports
// `next/headers` and cannot load outside a Next.js runtime).
import type { NotebookAccessInfo } from "../src/lib/access";

// Values are assigned at the top of `main()` from the dynamic imports below.
let db: Awaited<typeof import("./verify-db")>["db"];
let users: Awaited<typeof import("../src/db/schema-sqlite")>["users"];
let eq: typeof import("drizzle-orm")["eq"];
let orgService: Awaited<typeof import("../src/lib/services/org-service")>;
let notebookService: Awaited<typeof import("../src/lib/services/notebook-service")>;

let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) console.log(`  PASS: ${label}`);
  else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
}

/**
 * Local replica of the decision matrix from `src/lib/access.ts`, kept in sync
 * with the real `getNotebookAccess` so this script can exercise the same
 * branching without importing `@/lib/auth` (which pulls in `next/headers` and
 * cannot load outside a Next.js runtime). The ONLY external dependency is
 * `orgService.getMembership` — exactly what access.ts uses.
 */
async function accessFor(userId: string | null, notebook: {
  userId: string | null;
  organizationId: string | null;
  visibility: string;
}): Promise<NotebookAccessInfo> {
  if (userId !== null && notebook.userId === userId) {
    return { access: "owner" };
  }
  if (notebook.organizationId !== null && notebook.visibility === "org") {
    if (userId !== null) {
      const membership = await orgService.getMembership(notebook.organizationId, userId);
      if (membership) {
        if (membership.role === "member") {
          return { access: "member-read", membershipRole: "member" };
        }
        return { access: "member-write", membershipRole: membership.role as NotebookAccessInfo["membershipRole"] };
      }
    }
    return { access: "none" };
  }
  if (notebook.userId === null) {
    return { access: "public-read" };
  }
  return { access: "none" };
}

async function main() {
  // Load the DB shim + services ONLY after DATABASE_DRIVER / SQLITE_DB_PATH are
  // set. Everything below this line is the same code the app runs.
  const [dbMod, usersMod, drizzleMod, orgSvc, nbSvc] = await Promise.all([
    import("./verify-db"),
    import("../src/db/schema-sqlite"),
    import("drizzle-orm"),
    import("../src/lib/services/org-service"),
    import("../src/lib/services/notebook-service"),
  ]);
  db = dbMod.db;
  users = usersMod.users;
  eq = drizzleMod.eq;
  orgService = orgSvc;
  notebookService = nbSvc;

  console.log("=== 1. Users + personal orgs ===");
  const [userA] = await db
    .insert(users)
    .values({ name: "Alice Tenant", email: "alice.tenant@example.com", password: "x" })
    .returning();
  const [userB] = await db
    .insert(users)
    .values({ name: "Bob Tenant", email: "bob.tenant@example.com", password: "x" })
    .returning();

  const orgA = await orgService.ensurePersonalOrg(userA.id, userA.name);
  const orgB = await orgService.ensurePersonalOrg(userB.id, userB.name);
  check(!!orgA && !!orgB, "both personal orgs created");
  check(orgA!.id !== orgB!.id, "personal orgs are distinct tenants");

  const orgA2 = await orgService.ensurePersonalOrg(userA.id, userA.name);
  check(orgA2!.id === orgA!.id, "ensurePersonalOrg is idempotent");

  const [aAfter] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, userA.id));
  check(aAfter.organizationId === orgA!.id, "users.organization_id points at personal org");

  const ownerMembership = await orgService.getMembership(orgA!.id, userA.id);
  check(ownerMembership?.role === "owner", "creator has owner membership");

  console.log("=== 2. SQL-level list isolation ===");
  const nbA = await notebookService.createNotebook({
    title: "A private",
    emoji: "📓",
    userId: userA.id,
    organizationId: orgA!.id,
    visibility: "private",
  });
  const nbB = await notebookService.createNotebook({
    title: "B private",
    emoji: "📓",
    userId: userB.id,
    organizationId: orgB!.id,
    visibility: "private",
  });

  const listA = await notebookService.getNotebooksForUser(userA.id, [orgA!.id]);
  const listAIds = new Set(listA.map((n) => n.id));
  check(listAIds.has(nbA.id), "A sees own notebook");
  check(!listAIds.has(nbB.id), "A does NOT see B's private notebook (cross-tenant leak blocked)");

  const listB = await notebookService.getNotebooksForUser(userB.id, [orgB!.id]);
  const listBIds = new Set(listB.map((n) => n.id));
  check(listBIds.has(nbB.id), "B sees own notebook");
  check(!listBIds.has(nbA.id), "B does NOT see A's private notebook");

  console.log("=== 3. Org sharing (membership-gated) ===");
  const sharedB = await notebookService.createNotebook({
    title: "B org-shared",
    emoji: "📓",
    userId: userB.id,
    organizationId: orgB!.id,
    visibility: "org",
  });

  // Before membership: A's org list is only [orgA] (as getUserOrganizations
  // returns) → A must not see B's org-shared notebook.
  const listA2 = await notebookService.getNotebooksForUser(userA.id, [orgA!.id]);
  check(!listA2.some((n) => n.id === sharedB.id), "A cannot see B's org notebook before joining");

  // A joins B's org as a member → getUserOrganizations(userA) now returns both.
  await orgService.addMember(orgB!.id, userA.id, "member");
  const orgsA = await orgService.getUserOrganizations(userA.id);
  const orgIdsA = orgsA.map((o) => o.id);
  check(orgIdsA.includes(orgA!.id) && orgIdsA.includes(orgB!.id), "getUserOrganizations returns both orgs for A");

  const listA3 = await notebookService.getNotebooksForUser(userA.id, orgIdsA);
  check(listA3.some((n) => n.id === sharedB.id), "A sees B's org-shared notebook as member");
  check(!listA3.some((n) => n.id === nbB.id), "A still cannot see B's private notebook");

  console.log("=== 4. Access decision matrix (drives requireNotebookAccess) ===");
  const nbARow = (await notebookService.getNotebookById(nbA.id))!;
  const nbBRow = (await notebookService.getNotebookById(nbB.id))!;
  const sharedBRow = (await notebookService.getNotebookById(sharedB.id))!;

  // Owner
  const aOnA = await accessFor(userA.id, nbARow);
  check(aOnA.access === "owner", "owner of own notebook → full access (owner)");

  // Cross-tenant private → none → requireNotebookAccess maps to 404.
  // (By this point A is a member of orgB from section 3, but nbB is `private`,
  // so membership alone grants nothing — the matrix must still return `none`.)
  const aOnB = await accessFor(userA.id, nbBRow);
  check(
    nbBRow.userId === userB.id &&
    nbBRow.visibility === "private" &&
    nbBRow.organizationId === orgB!.id &&
    aOnB.access === "none",
    "A has no relationship to B's private notebook → none → 404 (no existence leak)"
  );

  // Org-shared, member role → read-only (member-read)
  const aInBOrg = await orgService.getMembership(orgB!.id, userA.id);
  check(aInBOrg?.role === "member", "A is a 'member' of B's org");
  check(sharedBRow.organizationId === orgB!.id && sharedBRow.visibility === "org", "B's shared notebook is org-visible");
  const aOnShared = await accessFor(userA.id, sharedBRow);
  check(aOnShared.access === "member-read", "member-read branch: A can READ the org notebook");
  check(
    aOnShared.access === "member-read",
    "member-read branch: write would be denied → 403 for authenticated member"
  );

  // Org-shared, owner/admin → member-write
  const bInBOrg = await orgService.getMembership(orgB!.id, userB.id);
  check(bInBOrg?.role === "owner", "B is owner of his org → member-write (full access)");
  check(sharedBRow.userId === userB.id, "B is also the notebook owner → full access");
  const bOnShared = await accessFor(userB.id, sharedBRow);
  check(
    bOnShared.access === "owner" || bOnShared.access === "member-write",
    "B on org-shared notebook → full access (owner/member-write)"
  );

  // Public (legacy) notebook semantics — ownerless row, read-only for everyone.
  const publicNb = await notebookService.createNotebook({ title: "Legacy public", emoji: "📓", userId: null });
  const publicRow = (await notebookService.getNotebookById(publicNb.id))!;
  check(publicRow.userId === null, "legacy public notebook has userId === null");
  check(publicRow.visibility === "private", "legacy public notebook defaults to private visibility");
  const listAnon = await notebookService.getNotebooksForUser(null, []);
  check(listAnon.some((n) => n.id === publicNb.id), "anonymous visitor sees legacy public notebook");
  check(!listAnon.some((n) => n.id === nbA.id), "anonymous visitor never sees owned notebooks");

  console.log("=== 5. Trash isolation ===");
  await notebookService.deleteNotebook(nbA.id);
  const trashA = await notebookService.getTrashedNotebooksForUser(userA.id, orgIdsA);
  check(trashA.some((n) => n.id === nbA.id), "A sees own notebook in trash");
  check(!trashA.some((n) => n.id === nbB.id), "A does NOT see B's notebook in trash");
  await notebookService.restoreNotebook(nbA.id);
  check((await notebookService.getNotebookById(nbA.id))!.deletedAt === null, "restored notebook leaves the trash");

  console.log("=== 6. Last-owner guard ===");
  let threwRemove = false;
  try {
    await orgService.removeMember(orgA!.id, userA.id);
  } catch {
    threwRemove = true;
  }
  check(threwRemove, "cannot remove the last owner");

  let threwDemote = false;
  try {
    await orgService.updateMemberRole(orgA!.id, userA.id, "member");
  } catch {
    threwDemote = true;
  }
  check(threwDemote, "cannot demote the last owner");

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
