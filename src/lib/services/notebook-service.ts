import { db } from "@/db";
import { notebooks, sources, users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { Notebook } from "@/lib/types";

export interface NotebookWithCount extends Notebook {
  userId: string | null;
  sourceCount: number;
}

export async function getNotebooksForUser(userId: string | null): Promise<NotebookWithCount[]> {
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
    .groupBy(notebooks.id)
    .orderBy(desc(notebooks.updatedAt));

  return rows
    // Public notebooks are visible to everyone; owned notebooks are visible
    // only to their owner. Unauthenticated visitors (userId === null) only see
    // public notebooks — never owned ones.
    .filter((r) => r.userId === null || (userId !== null && r.userId === userId))
    .map((r) => ({
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
    })
    .returning();
  return notebook;
}

export async function updateNotebook(id: string, data: { title?: string; emoji?: string; description?: string }) {
  const [notebook] = await db
    .update(notebooks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(notebooks.id, id))
    .returning();
  return notebook;
}

export async function deleteNotebook(id: string) {
  await db.delete(notebooks).where(eq(notebooks.id, id));
}

export async function touchNotebook(id: string) {
  await db.update(notebooks).set({ updatedAt: new Date() }).where(eq(notebooks.id, id));
}