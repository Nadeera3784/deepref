import { type NextRequest, NextResponse } from "next/server";

import { readTokenClaims, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const claims = readTokenClaims(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!claims && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (claims && (isPublic || pathname === "/")) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }
  if (claims && pathname.startsWith("/admin") && claims.role !== "admin") {
    return NextResponse.redirect(new URL("/chat", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
