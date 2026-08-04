import { db } from "@/db";
import { notebooks, sources } from "@/db/schema";
import { desc, eq, isNull, sql } from "drizzle-orm";
import NotebooksGrid from "@/components/notebooks-grid";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  // Select notebooks (excluding soft-deleted ones that are in the trash)
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
    .where(isNull(notebooks.deletedAt))
    .groupBy(notebooks.id)
    .orderBy(desc(notebooks.updatedAt));

  const initialNotebooks = rows
    .filter((r) => !user || !r.userId || r.userId === user.id)
    .map((r) => ({
      ...r,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : (r.createdAt as Date).toISOString(),
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : (r.updatedAt as Date).toISOString(),
    }));

  return <NotebooksGrid initialNotebooks={initialNotebooks} currentUser={user} />;
}
