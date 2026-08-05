import { getCurrentUser } from "@/lib/auth";
import { getTrashedNotebooksForUser } from "@/lib/services/notebook-service";
import { getUserOrganizations } from "@/lib/services/org-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/notebooks/trash
 *
 * Returns the notebooks currently in the trash (soft-deleted), so the UI can
 * offer restore / permanent-delete actions. Trash is strictly personal — only
 * notebooks owned by the requesting user appear here.
 */
export async function GET() {
    const user = await getCurrentUser();

    let orgIds: string[] = [];
    if (user) {
        const orgs = await getUserOrganizations(user.id);
        orgIds = orgs.map((o) => o.id);
    }

    const notebooks = await getTrashedNotebooksForUser(user?.id ?? null, orgIds);
    return Response.json({ notebooks });
}
