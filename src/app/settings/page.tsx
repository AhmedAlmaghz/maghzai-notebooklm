import { redirect } from "next/navigation";

/**
 * /settings — lightweight alias for /profile.
 *
 * The middleware already protects this route for authenticated users only, so a
 * simple server-side redirect is safe and instant. Profile/settings content is
 * deliberately not duplicated here; there are no org-management API routes to
 * back a richer settings page, and inventing them is out of scope.
 */
export default function SettingsPage() {
    redirect("/profile");
}
