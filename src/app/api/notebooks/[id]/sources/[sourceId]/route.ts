import { NextRequest } from "next/server";
import { deleteSource, getSourceById } from "@/lib/services/source-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await ctx.params;
  const source = await getSourceById(id, sourceId);
  if (!source) return Response.json({ error: "Source not found" }, { status: 404 });
  return Response.json({ source });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id, sourceId } = await ctx.params;
  const deleted = await deleteSource(id, sourceId);
  if (!deleted) {
    return Response.json({ error: "Source not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}