import { NextRequest } from "next/server";
import { deleteSource, getSourceById } from "@/lib/services/source-service";
import { requireNotebookAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await ctx.params;

  const access = await requireNotebookAccess(id, "read");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const source = await getSourceById(id, sourceId);
  if (!source) return Response.json({ error: "Source not found" }, { status: 404 });
  return Response.json({ source });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await ctx.params;

  const access = await requireNotebookAccess(id, "write");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const deleted = await deleteSource(id, sourceId);
  if (!deleted) {
    return Response.json({ error: "Source not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}