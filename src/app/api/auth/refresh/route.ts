import { NextResponse } from "next/server";
import {
    getRefreshCookie,
    rotateRefreshToken,
    createCsrfToken,
    setAccessCookie,
    setRefreshCookie,
    setCsrfCookie,
    clearAuthSession,
} from "@/lib/auth";

/**
 * POST /api/auth/refresh
 *
 * Reads the httpOnly `nblm_refresh` cookie, verifies the refresh token
 * (signature, type, stored hash, not revoked, not expired, version match),
 * rotates it (revokes the old row, issues a brand-new access + refresh pair
 * plus a fresh CSRF token) and sets the cookies.
 *
 * On any failure the session is wiped and a 401 is returned.
 */
export async function POST(req: Request) {
    try {
        const rawToken = await getRefreshCookie();
        if (!rawToken) {
            await clearAuthSession();
            return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
        }

        const userAgent = req.headers.get("user-agent");
        const result = await rotateRefreshToken(rawToken, { userAgent });

        if (!result) {
            // Token invalid, expired, revoked, or version mismatch → full logout.
            await clearAuthSession();
            return NextResponse.json({ error: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً" }, { status: 401 });
        }

        const csrfToken = await createCsrfToken();
        await Promise.all([
            setAccessCookie(result.accessToken),
            setRefreshCookie(result.refreshToken),
            setCsrfCookie(csrfToken),
        ]);

        return NextResponse.json({ user: result.user });
    } catch (error) {
        console.error("Refresh error:", error);
        await clearAuthSession();
        return NextResponse.json({ error: "حدث خطأ أثناء تجديد الجلسة" }, { status: 500 });
    }
}
