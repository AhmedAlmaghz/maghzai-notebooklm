import { db } from "@/db";
import { IS_POSTGRES, memberships, organizations, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

/**
 * Dual-dialect timestamp value.
 *
 * Convention in this codebase: Postgres stores `timestamptz` (a `Date`),
 * SQLite stores an ISO-8601 string. Drizzle's better-sqlite3 driver rejects
 * `Date` objects for TEXT columns ("can only bind numbers, strings, bigints,
 * buffers, and null"), so every write must pick the correct shape. The return
 * type is `Date` because the shared schema is typed as the Postgres variant;
 * for SQLite the ISO string is returned at runtime.
 */
function nowValue(): Date {
    return IS_POSTGRES ? new Date() : (new Date().toISOString() as unknown as Date);
}

/**
 * Organization Service
 *
 * Implements the multi-tenant isolation model:
 *  - Every registered user belongs to their own PERSONAL org (created lazily
 *    at registration or on first login for legacy accounts). The personal org
 *    is recorded on `users.organization_id`.
 *  - Notebooks can be shared at the org level via `notebooks.visibility =
 *    'org'`; only members of `notebooks.organization_id` can see them.
 *  - Roles: `owner` (full control), `admin` (full control over notebooks),
 *    `member` (read-only for org-shared notebooks).
 *
 * Membership is defensive: the last `owner` of an org can never be removed or
 * demoted, so an org always retains full control.
 */

export type OrgRole = "owner" | "admin" | "member";

export const ORG_ROLES: OrgRole[] = ["owner", "admin", "member"];

export interface OrgMemberRow {
    userId: string;
    name: string;
    email: string;
    role: OrgRole;
}

/** Converts a display name into a URL-safe slug. */
function slugify(input: string): string {
    const slug = input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    return slug || "org";
}

function randomSuffix(): string {
    return Math.random().toString(36).slice(2, 8);
}

/**
 * Returns the user's personal org, creating it idempotently if missing.
 *
 * Priority:
 *  1. `users.organization_id` (fast path for accounts created after this
 *     feature shipped).
 *  2. Any existing `owner` membership (covers legacy accounts that were
 *     partially migrated, and is what makes this idempotent).
 *  3. Otherwise create an org named after the user with a unique slug, an
 *     `owner` membership, and set `users.organization_id`.
 *
 * @returns the personal org, or `null` if the user does not exist.
 */
export async function ensurePersonalOrg(userId: string, userName: string) {
    const [userRow] = await db.select().from(users).where(eq(users.id, userId));
    if (!userRow) return null;

    // 1. Fast path.
    if (userRow.organizationId) {
        const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, userRow.organizationId));
        if (org) return org;
    }

    // 2. Reuse an existing owner membership.
    const [existing] = await db
        .select({ organizationId: memberships.organizationId })
        .from(memberships)
        .where(and(eq(memberships.userId, userId), eq(memberships.role, "owner")));
    if (existing) {
        const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, existing.organizationId));
        if (org) {
            await db
                .update(users)
                .set({ organizationId: org.id, updatedAt: nowValue() })
                .where(eq(users.id, userId));
            return org;
        }
    }

    // 3. Create a fresh personal org named after the user. A slug collision can
    //    still happen under concurrency, so retry with a random suffix.
    const base = slugify(userName);
    for (let attempt = 0; attempt < 3; attempt++) {
        const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
        try {
            const [org] = await db
                .insert(organizations)
                .values({ name: userName.trim(), slug })
                .returning();
            await db
                .insert(memberships)
                .values({ organizationId: org.id, userId, role: "owner" });
            await db
                .update(users)
                .set({ organizationId: org.id, updatedAt: nowValue() })
                .where(eq(users.id, userId));
            return org;
        } catch (error) {
            // Unique constraint on slug — retry with a fresh suffix.
            if (attempt === 2) throw error;
        }
    }
    return null; // unreachable
}

/** All organizations the user is a member of, with their membership role. */
export async function getUserOrganizations(userId: string) {
    const rows = await db
        .select({
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            createdAt: organizations.createdAt,
            updatedAt: organizations.updatedAt,
            role: memberships.role,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
        .where(eq(memberships.userId, userId))
        .orderBy(desc(organizations.createdAt));
    return rows;
}

export async function getOrgById(orgId: string) {
    const [row] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));
    return row || null;
}

/** The membership row linking a user to an org, or `null`. */
export async function getMembership(orgId: string, userId: string) {
    const [row] = await db
        .select()
        .from(memberships)
        .where(
            and(
                eq(memberships.organizationId, orgId),
                eq(memberships.userId, userId)
            )
        );
    return row || null;
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
    return (await getMembership(orgId, userId)) !== null;
}

/** Adds a user to an org. Idempotent — returns the existing membership if any. */
export async function addMember(orgId: string, userId: string, role: OrgRole = "member") {
    const existing = await getMembership(orgId, userId);
    if (existing) return existing;
    const [row] = await db
        .insert(memberships)
        .values({ organizationId: orgId, userId, role })
        .returning();
    return row;
}

async function countOwners(orgId: string): Promise<number> {
    const rows = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.organizationId, orgId), eq(memberships.role, "owner")));
    return rows.length;
}

/**
 * Changes a member's role. Guards against demoting the last owner.
 * Returns the updated membership, or `null` if there is no membership.
 */
export async function updateMemberRole(orgId: string, userId: string, role: OrgRole) {
    const membership = await getMembership(orgId, userId);
    if (!membership) return null;

    if (membership.role === "owner" && role !== "owner") {
        if ((await countOwners(orgId)) <= 1) {
            throw new Error("Cannot demote the last owner");
        }
    }

    const [row] = await db
        .update(memberships)
        .set({ role })
        .where(
            and(
                eq(memberships.organizationId, orgId),
                eq(memberships.userId, userId)
            )
        )
        .returning();
    return row;
}

/**
 * Removes a user from an org. Guards against removing the last owner.
 * Returns `true` when a membership was removed.
 */
export async function removeMember(orgId: string, userId: string): Promise<boolean> {
    const membership = await getMembership(orgId, userId);
    if (!membership) return false;

    if (membership.role === "owner" && (await countOwners(orgId)) <= 1) {
        throw new Error("Cannot remove the last owner");
    }

    await db
        .delete(memberships)
        .where(
            and(
                eq(memberships.organizationId, orgId),
                eq(memberships.userId, userId)
            )
        );
    return true;
}

/** All members of an org with their roles. */
export async function getOrgMembers(orgId: string): Promise<OrgMemberRow[]> {
    const rows = await db
        .select({
            userId: users.id,
            name: users.name,
            email: users.email,
            role: memberships.role,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.organizationId, orgId))
        .orderBy(memberships.createdAt);

    return rows.map((r) => ({ ...r, role: r.role as OrgRole }));
}
