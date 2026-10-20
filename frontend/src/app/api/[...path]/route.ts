import { type NextRequest, NextResponse } from "next/server";

import { backendUrl } from "@/lib/server-config";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/session";

/**
 * Backend-for-frontend proxy: forwards /api/* to FastAPI with the bearer token taken from the
 * httpOnly session cookie, so the token is never exposed to browser JavaScript.
 * Bodies are streamed in both directions (PDF uploads, SSE chat responses).
 */

const FORWARDED_REQUEST_HEADERS = ["accept", "content-type", "range"];
// fetch() already decoded the body, and hop-by-hop headers must not be forwarded.
const DROPPED_RESPONSE_HEADERS = ["content-encoding", "content-length", "transfer-encoding", "connection"];

async function proxy(request: NextRequest, { params }: RouteContext<"/api/[...path]">) {
  const { path } = await params;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl(`/${path.map(encodeURIComponent).join("/")}`)}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Required by Node's fetch to stream a request body.
      ...(hasBody ? { duplex: "half" } : {}),
      signal: request.signal,
      redirect: "manual",
      cache: "no-store",
    } as RequestInit);
  } catch {
    return NextResponse.json({ detail: "The API server is unreachable" }, { status: 502 });
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) responseHeaders.delete(name);

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  if (upstream.status === 401 && token) clearSessionCookie(response);
  return response;
}

export { proxy as DELETE, proxy as GET, proxy as PATCH, proxy as POST, proxy as PUT };
