import { getCurrentUser } from "@/lib/auth";
import { getNotebookById } from "@/lib/services/notebook-service";

export type AccessRole = "read" | "write";

export type NotebookAccessResult =
    | { ok: true; notebook: NonNullable<Awaited<ReturnType<typeof getNotebookById>>> }
    | { ok: false; status: number; error: string };

/**
 * Centralized authorization guard for notebook-scoped resources.
 *
 * Model (resource-level authorization):
 * - Public notebooks (`userId === null`) remain readable AND writable by any
 *   visitor, preserving the anonymous no-account mode.
 * - Owned notebooks (`userId !== null`) are accessible ONLY by their owner,
 *   identified via `getCurrentUser()`.
 * - Any other user (or an unauthenticated visitor) receives **404** (not 403)
 *   so the existence of the resource is not leaked. This is consistent across
 *   all routes and avoids information disclosure about which notebooks exist.
 *
 * Soft-deleted notebooks (deletedAt set) are hidden from every normal access
 * (the trash keeps them invisible until explicitly restored). The restore
 * endpoint opts in via `allowDeleted: true`.
 *
 * Child resources (sources, notes, messages, audio, studio, suggestions...)
 * inherit this check from their parent notebook: there is no need to repeat
 * per-resource ownership checks.
 *
 * @param notebookId The notebook (parent resource) to authorize.
 * @param _role Kept for API symmetry ("read" for reads, "write" for mutations);
 *              the current model grants both roles to public notebooks and to
 *              the owner, so the role only documents intent for future rules.
 * @param opts.allowDeleted Set to `true` to permit access to soft-deleted
 *                          notebooks (used only by the restore endpoint).
 */
export async function requireNotebookAccess(
    notebookId: string,
    _role: AccessRole,
    opts?: { allowDeleted?: boolean },
): Promise<NotebookAccessResult> {
    const notebook = await getNotebookById(notebookId);
    if (!notebook) {
        return { ok: false, status: 404, error: "Notebook not found" };
    }

    // Soft-deleted notebooks are not accessible through the normal routes.
    if (!opts?.allowDeleted && notebook.deletedAt != null) {
        return { ok: false, status: 404, error: "Notebook not found" };
    }

    // Public notebook: readable and writable by anyone (anonymous mode).
    if (notebook.userId === null) {
        return { ok: true, notebook };
    }

    // Owned notebook: only the matching authenticated owner may access it.
    const user = await getCurrentUser();
    if (user && user.id === notebook.userId) {
        return { ok: true, notebook };
    }

    // Deny with 404 (not 403) so resource existence is never leaked.
    return { ok: false, status: 404, error: "Notebook not found" };
}
