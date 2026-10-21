import "server-only";

export function clientIp(request: Request): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const nearest = forwardedFor
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  return nearest || request.headers.get("x-real-ip") || undefined;
}

export function forwardedFor(request: Request): Record<string, string> {
  const ip = clientIp(request);
  return ip ? { "x-forwarded-for": ip } : {};
}
