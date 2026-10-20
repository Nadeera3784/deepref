/**
 * Browser-side API client. All calls go to this app's /api/* Route Handlers, which attach the
 * session token from the httpOnly cookie and forward to FastAPI.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FastApiError = { detail?: string | { msg: string }[] };

export async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as FastApiError;
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join(", ");
  } catch {
    // Non-JSON error body
  }
  return response.statusText || `Request failed (${response.status})`;
}

function handleUnauthorized(status: number) {
  if (status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
    // Runs outside React (inside fetch helpers), so the router isn't available here.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) {
    handleUnauthorized(response.status);
    throw new ApiError(response.status, await errorMessage(response));
  }
  return response;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const json = (body: unknown) => JSON.stringify(body);
