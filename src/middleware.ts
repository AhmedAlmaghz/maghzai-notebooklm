import { NextResponse, type NextRequest } from "next/server";
import { getLocaleFromString, locales } from "@/i18n";

const PUBLIC_FILE_PATTERN = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes, and Next internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE_PATTERN.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check if the pathname starts with a locale
  const isLocalePath = locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
  if (isLocalePath) {
    return NextResponse.next();
  }

  // Determine locale from cookie or default
  const cookieLocale = getLocaleFromString(request.cookies.get("nblm_locale")?.value);

  // Add the locale to the pathname
  const newUrl = new URL(`/${cookieLocale}${pathname === "/" ? "" : pathname}${request.nextUrl.search}`, request.url);

  return NextResponse.rewrite(newUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};