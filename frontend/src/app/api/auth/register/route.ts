import { NextResponse } from "next/server";

import { forwardedFor } from "@/lib/client-ip";
import { backendUrl } from "@/lib/server-config";
import { registerRequestSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const parsed = registerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join(", ");
    return NextResponse.json({ detail }, { status: 422 });
  }

  const upstream = await fetch(backendUrl("/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...forwardedFor(request) },
    body: JSON.stringify(parsed.data),
  });

  const response = NextResponse.json(await upstream.json(), { status: upstream.status });
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) response.headers.set("Retry-After", retryAfter);
  return response;
}
