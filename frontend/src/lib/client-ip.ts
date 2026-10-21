import "server-only";

/**
 * The caller's IP, forwarded to FastAPI so it can rate-limit per client.
 *
 * Next.js sets X-Forwarded-For to the socket address only when the request has none, and a reverse
 * proxy in front (nginx, Caddy) appends the address it saw. Either way the rightmost entry is the
 * hop closest to this server, so it is the hardest to forge. With no proxy in front, a client can
 * still send its own header; the backend's global limit covers that case.
 */
export function clientIp(request: Request): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const nearest = forwardedFor
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  return nearest || request.headers.get("x-real-ip") || undefined;
}

/** Headers that tell the backend who the real client is. */
export function forwardedFor(request: Request): Record<string, string> {
  const ip = clientIp(request);
  return ip ? { "x-forwarded-for": ip } : {};
}
