import { getCurrentUser } from "@/lib/auth";
import { getNotebookById } from "@/lib/services/notebook-service";
import { getMembership } from "@/lib/services/org-service";
import type { OrgRole } from "@/lib/services/org-service";

export type AccessRole = "read" | "write";

export type NotebookAccessKind =
    | "owner"
    | "member-read"
    | "member-write"
    | "public-read"
    | "none";

export type NotebookAccessResult =
    | { ok: true; notebook: NonNullable<Awaited<ReturnType<typeof getNotebookById>>> }
    | { ok: false; status: number; error: string };

export interface NotebookAccessInfo {
    /** The access the current user has to the notebook. */
    access: NotebookAccessKind;
    /** Set when the user is a member of the notebook's org (owner is also a member). */
    membershipRole?: OrgRole;
}

export type NotebookRow = NonNullable<Awaited<ReturnType<typeof getNotebookById>>>;

/**
 * Determine what access a user has to a notebook.
 *
 * Decision matrix (all checks are against the DB, never client-supplied data):
 *
 *  1. Soft-deleted notebooks are invisible unless `allowDeleted` (restore flow).
 *  2. Owner (`notebook.userId === user.id`)        → full access.
 *  3. Org-shared (`visibility === 'org'`) and the user is an org member:
 *     - owner/admin membership → write access
 *     - member membership      → read-only access
 *  4. Legacy public notebooks (`userId === null`) → read-only access for
 *     everyone, preserving the anonymous read model. NEVER writable by
 *     anonymous visitors.
 *  5. Anything else → `none`.
 *
 * @param userId  The authenticated user's id, or `null` for anonymous visitors.
 * @param notebook The notebook row to evaluate.
 */
export async function getNotebookAccess(
    userId: string | null,
    notebook: NotebookRow,
): Promise<NotebookAccessInfo> {
    // Owner: full access to the notebook they created (or that was attached to
    // them during backfill). This is also what grants owners of org-shared
    // notebooks their rights, even if the membership row is missing.
    if (userId !== null && notebook.userId === userId) {
        return { access: "owner" };
    }

    // Org-shared notebook: access depends on the user's membership role.
    if (notebook.organizationId !== null && notebook.visibility === "org") {
        if (userId !== null) {
            const membership = await getMembership(notebook.organizationId, userId);
            if (membership) {
                if (membership.role === "member") {
                    return { access: "member-read", membershipRole: "member" };
                }
                // owner | admin
                return { access: "member-write", membershipRole: membership.role as OrgRole };
            }
        }
        return { access: "none" };
    }

    // Legacy public notebook (anonymous mode). Read-only for everyone.
    if (notebook.userId === null) {
        return { access: "public-read" };
    }

    return { access: "none" };
}

/**
 * Centralized authorization guard for notebook-scoped resources.
 *
 * Security posture:
 *  - Cross-tenant requests (no relationship to the notebook) return **404**
 *    (not 403) so resource existence is never leaked.
 *  - **403** is returned only when the user is authenticated AND has a real
 *    relationship to the notebook but insufficient role — e.g. a `member`
 *    attempting a write. This signals "you found the notebook, but you lack
 *    permission" without hiding it from a legitimate member.
 *  - Unauthenticated visitors requesting a private notebook get **401**,
 *    telling them to log in. This is safe (they don't know the notebook
 *    exists) and required so the client can prompt for login.
 *
 * Child resources (sources, notes, messages, audio, studio, suggestions...)
 * inherit this check from their parent notebook: there is no need to repeat
 * per-resource ownership checks.
 *
 * @param notebookId The notebook (parent resource) to authorize.
 * @param role "read" for reads, "write" for mutations.
 * @param opts.allowDeleted Set to `true` to permit access to soft-deleted
 *                          notebooks (used only by the restore endpoint).
 */
export async function requireNotebookAccess(
    notebookId: string,
    role: AccessRole,
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

    const user = await getCurrentUser();
    const info = await getNotebookAccess(user?.id ?? null, notebook);

    switch (info.access) {
        case "owner":
        case "member-write":
            return { ok: true, notebook };
        case "member-read":
            // Read-only members can read, but never write.
            if (role === "read") return { ok: true, notebook };
            return { ok: false, status: 403, error: "You don't have permission to modify this notebook" };
        case "public-read":
            // Legacy public notebooks: readable by anyone. Writes require a real
            // authenticated user with an access relationship — anonymous writes are
            // intentionally removed.
            if (role === "read") return { ok: true, notebook };
            if (user) return { ok: false, status: 403, error: "You don't have permission to modify this notebook" };
            return { ok: false, status: 401, error: "Authentication required" };
        case "none":
            // Private notebook with no relationship: hide existence entirely.
            if (user) return { ok: false, status: 404, error: "Notebook not found" };
            // Anonymous visitor: they are not even authenticated — tell them to log in.
            return { ok: false, status: 401, error: "Authentication required" };
    }
}
