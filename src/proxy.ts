import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/places", "/map", "/lists", "/me"];
const AUTH_PAGES = ["/join", "/signin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSessionCookie) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const isAuthPage = AUTH_PAGES.some((route) => pathname === route);
  if (isAuthPage && hasSessionCookie) {
    return NextResponse.redirect(new URL("/places", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/places/:path*", "/map/:path*", "/lists/:path*", "/me/:path*", "/join", "/signin"],
};
