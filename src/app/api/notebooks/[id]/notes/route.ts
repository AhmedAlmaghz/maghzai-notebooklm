import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await db.select().from(notes).where(eq(notes.notebookId, id)).orderBy(notes.createdAt);
  return Response.json({ notes: rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "ملاحظة جديدة";
  const content = typeof body.content === "string" ? body.content : "";

  const [note] = await db
    .insert(notes)
    .values({ notebookId, title, content, kind: "note" })
    .returning();

  return Response.json({ note }, { status: 201 });
}
