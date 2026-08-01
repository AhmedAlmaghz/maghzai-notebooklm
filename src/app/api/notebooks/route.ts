import { db } from "@/db";
import { notebooks, sources } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

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

  const filtered = rows.filter((r) => !user || !r.userId || r.userId === user.id);

  return Response.json({ notebooks: filtered });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "دفتر بحث جديد";
  const emoji = typeof body.emoji === "string" && body.emoji ? body.emoji : "📓";

  const [notebook] = await db
    .insert(notebooks)
    .values({
      title,
      emoji,
      userId: user?.id ?? null,
    })
    .returning();

  return Response.json({ notebook }, { status: 201 });
}
