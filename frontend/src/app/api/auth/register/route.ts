import { NextResponse } from "next/server";

import { backendUrl } from "@/lib/server-config";
import { registerRequestSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  // Same schema as the client form: never trust that the browser ran it.
  const parsed = registerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join(", ");
    return NextResponse.json({ detail }, { status: 422 });
  }

  const upstream = await fetch(backendUrl("/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  return NextResponse.json(await upstream.json(), { status: upstream.status });
}
