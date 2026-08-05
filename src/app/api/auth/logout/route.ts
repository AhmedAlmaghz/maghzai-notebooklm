import { NextResponse } from "next/server";
import {
  getRefreshCookie,
  hashToken,
  revokeRefreshTokenByHash,
  clearAuthSession,
} from "@/lib/auth";

/**
 * POST /api/auth/logout
 *
 * Revokes the stored refresh token (by hash) when a refresh cookie is present,
 * then clears every auth cookie. Idempotent: no session → still 200.
 */
export async function POST() {
  try {
    const rawToken = await getRefreshCookie();
    if (rawToken) {
      await revokeRefreshTokenByHash(hashToken(rawToken));
    }
  } catch (error) {
    // Logout must never fail — best-effort revocation.
    console.error("Logout revoke error:", error);
  }
  await clearAuthSession();
  return NextResponse.json({ success: true });
}
