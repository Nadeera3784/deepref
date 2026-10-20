import { NextResponse } from "next/server";

import { backendUrl } from "@/lib/server-config";
import { readTokenClaims, setSessionCookie } from "@/lib/session";
import { loginSchema } from "@/lib/validation/auth";

type TokenResponse = { access_token: string; expires_in: number };

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: "Enter a valid email and password" }, { status: 422 });
  }

  const upstream = await fetch(backendUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: parsed.data.email, password: parsed.data.password }),
  });
  if (!upstream.ok) {
    return NextResponse.json(await upstream.json(), { status: upstream.status });
  }

  const token = (await upstream.json()) as TokenResponse;
  const response = NextResponse.json({ role: readTokenClaims(token.access_token)?.role });
  setSessionCookie(response, token.access_token, token.expires_in);
  return response;
}
