import type { FastApiError } from "@/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as FastApiError;
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join(", ");
  } catch {}
  return response.statusText || `Request failed (${response.status})`;
}

function handleUnauthorized(status: number) {
  if (status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
    location.assign(
      new URL(`/login?next=${encodeURIComponent(location.pathname)}`, location.origin),
    );
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
