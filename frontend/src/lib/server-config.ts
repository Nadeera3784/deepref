import "server-only";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export function backendUrl(path: string): string {
  return `${BACKEND_URL}/api/v1${path}`;
}
