import type { NextResponse } from "next/server";

import type { Role } from "@/lib/types";

/** Shared by Proxy and Route Handlers, so it must not import "server-only". */
export const SESSION_COOKIE = "deepref_session";

export type TokenClaims = { sub: string; role: Role; exp: number };

/**
 * Reads the JWT payload WITHOUT verifying its signature. Only for optimistic routing
 * decisions in Proxy; the backend verifies the token on every API call.
 */
export function readTokenClaims(token: string | undefined): TokenClaims | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as TokenClaims;
    return claims.exp * 1000 > Date.now() ? claims : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number,
): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE);
}
