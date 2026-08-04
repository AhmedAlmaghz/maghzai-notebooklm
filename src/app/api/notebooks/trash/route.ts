import { getCurrentUser } from "@/lib/auth";
import { getTrashedNotebooksForUser } from "@/lib/services/notebook-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/notebooks/trash
 *
 * Returns the notebooks currently in the trash (soft-deleted), so the UI can
 * offer restore / permanent-delete actions.
 */
export async function GET() {
    const user = await getCurrentUser();
    const notebooks = await getTrashedNotebooksForUser(user?.id ?? null);
    return Response.json({ notebooks });
}
