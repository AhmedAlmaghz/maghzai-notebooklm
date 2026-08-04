import { requireNotebookAccess } from "@/lib/access";
import { restoreNotebook } from "@/lib/services/notebook-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/notebooks/[id]/restore
 *
 * Restores a soft-deleted notebook from the trash by clearing `deletedAt`.
 * `allowDeleted: true` lets this endpoint reach the trashed notebook that all
 * the other routes intentionally hide.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;

    const access = await requireNotebookAccess(id, "write", { allowDeleted: true });
    if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

    const notebook = await restoreNotebook(id);
    if (!notebook) return Response.json({ error: "Notebook not found" }, { status: 404 });

    return Response.json({
        ok: true,
        notebook: {
            ...notebook,
            createdAt:
                typeof notebook.createdAt === "string" ? notebook.createdAt : (notebook.createdAt as Date).toISOString(),
            updatedAt:
                typeof notebook.updatedAt === "string" ? notebook.updatedAt : (notebook.updatedAt as Date).toISOString(),
        },
    });
}
