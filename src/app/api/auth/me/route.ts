import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/auth/me
 *
 * Returns { user: UserPayload | null } — existing clients rely on this shape.
 * UserPayload = { id, name, email, role, emailVerifiedAt, organizationId }.
 */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
