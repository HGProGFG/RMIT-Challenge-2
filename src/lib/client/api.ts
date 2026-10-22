import type { ApiSuccess } from "../contracts";
import { getBrowserTide } from "../tide/browser/adapter";
export class ClientApiError extends Error {
  constructor(public code: string, message: string, public correlationId?: string, public status?: number) { super(message); }
}
let sessionGeneration = 0;
/** Ignore delayed authentication failures belonging to an account we already left. */
export function advanceClientSession() { sessionGeneration++; }
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const generation = sessionGeneration, adapter = getBrowserTide();
  if (!getBrowserTide().connected) throw new ClientApiError("TIDE_NOT_READY", "Tide is not connected. Protected actions remain unavailable.");
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await adapter.secureFetch(path, { ...init, cache: "no-store", headers });
  if (response.status === 401 && generation === sessionGeneration && adapter === getBrowserTide() && typeof window !== "undefined") window.dispatchEvent(new Event("vault:session-invalidated"));
  const payload = await response.json();
  if (!response.ok) throw new ClientApiError(payload.error?.code ?? "REQUEST_FAILED", payload.error?.message ?? "The request could not be verified.", payload.error?.correlationId, response.status);
  return (payload as ApiSuccess<T>).data;
}
export function mutation(body: unknown, key?: string): RequestInit {
  return { method: "POST", body: JSON.stringify(body), headers: key ? { "Idempotency-Key": key } : {} };
}
export function safeError(error: unknown): string {
  return error instanceof ClientApiError ? `${error.message}${error.correlationId ? ` Reference: ${error.correlationId}` : ""}`
    : "The operation could not be verified. No protected authority has changed.";
}
