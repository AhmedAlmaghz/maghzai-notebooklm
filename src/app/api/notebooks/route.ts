import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createNotebook, getNotebooksForUser } from "@/lib/services/notebook-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const notebooks = await getNotebooksForUser(user?.id ?? null);
  return Response.json({ notebooks });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "دفتر بحث جديد";
  const emoji = typeof body.emoji === "string" && body.emoji ? body.emoji : "📓";

  const notebook = await createNotebook({ title, emoji, userId: user?.id ?? null });

  return Response.json({ notebook }, { status: 201 });
}