import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createNotebook, getNotebooksForUser } from "@/lib/services/notebook-service";
import { ensurePersonalOrg, getUserOrganizations } from "@/lib/services/org-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

  // The user's org ids drive the SQL-level tenant filter: their own notebooks
  // plus org-shared notebooks from every org they belong to.
  let orgIds: string[] = [];
  if (user) {
    const orgs = await getUserOrganizations(user.id);
    orgIds = orgs.map((o) => o.id);
  }

  const notebooks = await getNotebooksForUser(user?.id ?? null, orgIds);
  return Response.json({ notebooks });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "دفتر بحث جديد";
  const emoji = typeof body.emoji === "string" && body.emoji ? body.emoji : "📓";

  // New notebooks are private by default and scoped to the user's personal org
  // (lazily created) so they can later be shared at the org level. Anonymous
  // creation is no longer supported — creation requires a session.
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const personalOrg = await ensurePersonalOrg(user.id, user.name);

  const notebook = await createNotebook({
    title,
    emoji,
    userId: user.id,
    organizationId: personalOrg?.id ?? null,
    visibility: "private",
  });

  return Response.json({ notebook }, { status: 201 });
}
