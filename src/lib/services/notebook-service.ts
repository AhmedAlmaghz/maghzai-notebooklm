import { db } from "@/db";
import { IS_POSTGRES, notebooks, sources, users } from "@/db/schema";
import { and, eq, desc, sql, isNull, inArray, or } from "drizzle-orm";
import type { Notebook } from "@/lib/types";

/**
 * Dual-dialect timestamp value.
 *
 * Postgres stores `timestamptz` (a `Date`); SQLite stores an ISO-8601 string.
 * Drizzle's better-sqlite3 driver rejects `Date` objects for TEXT columns
 * ("can only bind numbers, strings, bigints, buffers, and null"), so writes
 * must pick the correct shape. Return type is `Date` because the shared schema
 * is typed as the Postgres variant; for SQLite an ISO string is returned at
 * runtime.
 */
function nowValue(): Date {
  return IS_POSTGRES ? new Date() : (new Date().toISOString() as unknown as Date);
}

export interface NotebookWithCount extends Notebook {
  userId: string | null;
  sourceCount: number;
}

/**
 * SQL-level tenant isolation for the notebooks list.
 *
 * A user sees exactly:
 *  - notebooks they own (and that are not deleted), OR
 *  - notebooks shared with an org they belong to
 *    (`organization_id IN (:orgIds) AND visibility = 'org'`).
 *
 * The tenant filter is enforced inside the SQL WHERE clause — rows from other
 * tenants are never fetched, so nothing can leak into application memory.
 *
 * Legacy public notebooks (`userId === null`) are visible to every
 * authenticated user (read-only), preserving the original anonymous mode.
 *
 * @param userId The authenticated user's id, or `null` for anonymous visitors.
 * @param orgIds The user's organization ids (from their memberships). Anonymous
 *               visitors pass `[]` — they never see org-shared notebooks.
 */
export async function getNotebooksForUser(
  userId: string | null,
  orgIds: string[] = [],
): Promise<NotebookWithCount[]> {
  const rows = await db
    .select({
      id: notebooks.id,
      userId: notebooks.userId,
      title: notebooks.title,
      emoji: notebooks.emoji,
      description: notebooks.description,
      createdAt: notebooks.createdAt,
      updatedAt: notebooks.updatedAt,
      sourceCount: sql<number>`count(distinct ${sources.id})`.mapWith(Number),
    })
    .from(notebooks)
    .leftJoin(sources, eq(sources.notebookId, notebooks.id))
    .where(
      and(
        isNull(notebooks.deletedAt),
        or(
          userId !== null ? eq(notebooks.userId, userId) : undefined,
          orgIds.length > 0
            ? and(
              inArray(notebooks.organizationId, orgIds),
              eq(notebooks.visibility, "org")
            )
            : undefined,
          isNull(notebooks.userId)
        )
      )
    )
    .groupBy(notebooks.id)
    .orderBy(desc(notebooks.updatedAt));

  return rows.map((r) => ({
    ...r,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : (r.createdAt as Date).toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : (r.updatedAt as Date).toISOString(),
  }));
}

/**
 * Returns notebooks that are currently in the trash (soft-deleted) and are
 * visible to the given user. Used by the trash/restore API.
 *
 * Trash is strictly personal: only notebooks owned by the user appear here.
 * Org-shared notebooks and legacy public notebooks are NOT trashable by
 * non-owners, so they never appear.
 */
export async function getTrashedNotebooksForUser(
  userId: string | null,
  _orgIds: string[] = [],
): Promise<NotebookWithCount[]> {
  const rows = await db
    .select({
      id: notebooks.id,
      userId: notebooks.userId,
      title: notebooks.title,
      emoji: notebooks.emoji,
      description: notebooks.description,
      createdAt: notebooks.createdAt,
      updatedAt: notebooks.updatedAt,
      sourceCount: sql<number>`count(distinct ${sources.id})`.mapWith(Number),
    })
    .from(notebooks)
    .leftJoin(sources, eq(sources.notebookId, notebooks.id))
    .where(
      and(
        sql`${notebooks.deletedAt} IS NOT NULL`,
        userId !== null ? eq(notebooks.userId, userId) : sql`1 = 0`
      )
    )
    .groupBy(notebooks.id)
    .orderBy(desc(notebooks.updatedAt));

  return rows.map((r) => ({
    ...r,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : (r.createdAt as Date).toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : (r.updatedAt as Date).toISOString(),
  }));
}

export async function getNotebookById(id: string) {
  const [notebook] = await db.select().from(notebooks).where(eq(notebooks.id, id));
  return notebook || null;
}

export async function createNotebook(params: {
  title: string;
  emoji: string;
  userId?: string | null;
  organizationId?: string | null;
  visibility?: "private" | "org";
}) {
  // Validate that the userId actually exists in the users table.
  // A stale JWT (e.g. after the database was reset) can carry an id that no
  // longer has a corresponding row, which causes SQLITE_CONSTRAINT_FOREIGNKEY.
  let resolvedUserId: string | null = params.userId ?? null;
  if (resolvedUserId) {
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, resolvedUserId));
    if (!existingUser) {
      resolvedUserId = null;
    }
  }

  const [notebook] = await db
    .insert(notebooks)
    .values({
      title: params.title,
      emoji: params.emoji,
      userId: resolvedUserId,
      organizationId: params.organizationId ?? null,
      visibility: params.visibility ?? "private",
    })
    .returning();
  return notebook;
}

export async function updateNotebook(id: string, data: { title?: string; emoji?: string; description?: string }) {
  const [notebook] = await db
    .update(notebooks)
    .set({ ...data, updatedAt: nowValue() })
    .where(eq(notebooks.id, id))
    .returning();
  return notebook;
}

/**
 * Soft-delete a notebook by setting `deletedAt`. The row (and all its child
 * rows) remain in the database so it can be restored from the trash later.
 */
export async function deleteNotebook(id: string) {
  const now = nowValue();
  const [notebook] = await db
    .update(notebooks)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(notebooks.id, id))
    .returning();
  return notebook;
}

/**
 * Restore a soft-deleted notebook by clearing `deletedAt`.
 * Returns the restored notebook, or `null` if it doesn't exist.
 */
export async function restoreNotebook(id: string) {
  const [notebook] = await db
    .update(notebooks)
    .set({ deletedAt: null, updatedAt: nowValue() })
    .where(eq(notebooks.id, id))
    .returning();
  return notebook || null;
}

/**
 * Permanently delete a notebook and all of its associated rows.
 * Only used when the user explicitly empties the trash.
 */
export async function permanentlyDeleteNotebook(id: string) {
  await db.delete(notebooks).where(eq(notebooks.id, id));
}

export async function touchNotebook(id: string) {
  await db.update(notebooks).set({ updatedAt: nowValue() }).where(eq(notebooks.id, id));
}
