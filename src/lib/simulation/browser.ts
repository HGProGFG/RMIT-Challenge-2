"use client";
import { MAX_PLAINTEXT_BYTES, type Role, type SignedPolicy } from "../contracts";
import type { BrowserTideAdapter } from "../tide/browser/adapter";
import { fromBase64, toBase64 } from "../tide/browser/encoding";

class SimulationError extends Error { constructor(public status: number, public code: string) { super(code); } }
async function request(path: string, init?: RequestInit) {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/") || url.username || url.password) throw new Error("INVALID_API_TARGET");
  const headers = new Headers(init?.headers);
  if (init?.method && !["GET", "HEAD"].includes(init.method.toUpperCase())) {
    const bootstrap = await fetch(new URL("/api/simulation/bootstrap", window.location.origin), { credentials: "same-origin", cache: "no-store", redirect: "error" });
    if (!bootstrap.ok) throw new Error("SIMULATION_BOOTSTRAP_UNAVAILABLE");
    const value = (await bootstrap.json()).data;
    if (value?.simulation !== true || typeof value.csrfToken !== "string") throw new Error("SIMULATION_BOOTSTRAP_INVALID");
    headers.set("X-Sealed-Demo-CSRF", value.csrfToken);
  }
  return fetch(url, { ...init, headers, credentials: "same-origin", cache: "no-store", redirect: "error" });
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) throw new SimulationError(response.status, value.error?.code ?? "SIMULATION_UNAVAILABLE");
  return value.data as T;
}
function assertPolicy(policy: SignedPolicy, examId: string, purpose: "WRITE" | "READ") {
  if (policy.simulation !== true || policy.examId !== examId || policy.assignmentId !== examId || policy.purpose !== purpose) throw new Error("SIMULATION_POLICY_MISMATCH");
}
async function key(policy: SignedPolicy, examId: string, purpose: "WRITE" | "READ") {
  assertPolicy(policy, examId, purpose);
  const data = await post<{ keyBase64: string; simulation: boolean }>(`/api/exams/${examId}/simulation-key`, { purpose, policyId: policy.id, tags: [examId] });
  if (!data.simulation) throw new Error("SIMULATION_MODE_MISMATCH");
  return crypto.subtle.importKey("raw", Uint8Array.from(fromBase64(data.keyBase64)), "AES-GCM", false, [purpose === "WRITE" ? "encrypt" : "decrypt"]);
}
const aad = (examId: string) => new TextEncoder().encode(`LOCAL_SIMULATION:${examId}`);

/** Browser AES-GCM + server-held demo keys. This is deliberately NOT Tide E2EE or ORK enforcement. */
export function createSimulationAdapter(): BrowserTideAdapter {
  return { connected: true,
    async login(role: Role = "author", participant?: string) {
      await post("/api/simulation/login", { participant: role === "tide-realm-admin" ? participant ?? "governor-1" : role });
    },
    async logout() { await post("/api/simulation/logout", {}); },
    secureFetch: request,
    async encrypt({ examId, plaintext, policy }) {
      const bytes = new TextEncoder().encode(plaintext);
      if (!bytes.length || bytes.length > MAX_PLAINTEXT_BYTES) throw new Error("INVALID_PLAINTEXT_SIZE");
      const cryptoKey = await key(policy, examId, "WRITE"), iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(examId) }, cryptoKey, bytes);
      return toBase64(new TextEncoder().encode(JSON.stringify({ format: "SIMULATION_AES_GCM_V1", examId, iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) })));
    },
    async decrypt({ examId, ciphertextBase64, policy }) {
      const correlationId = crypto.randomUUID();
      try {
        const cryptoKey = await key(policy, examId, "READ");
        const envelope = JSON.parse(new TextDecoder().decode(fromBase64(ciphertextBase64)));
        if (envelope.format !== "SIMULATION_AES_GCM_V1" || envelope.examId !== examId) throw new Error("SIMULATION_POLICY_MISMATCH");
        const opened = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(fromBase64(envelope.iv)), additionalData: aad(examId) }, cryptoKey, Uint8Array.from(fromBase64(envelope.data)));
        if (opened.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("INVALID_PLAINTEXT_SIZE");
        return { status: "opened", plaintext: new TextDecoder("utf-8", { fatal: true }).decode(opened) };
      } catch (error) {
        if (error instanceof SimulationError && error.status === 403) return { status: "denied", code: "SIMULATION_ACCESS_DENIED", correlationId };
        return { status: "error", code: "SIMULATION_CRYPTO_ERROR", correlationId };
      }
    },
    async signPolicy({ examId, purpose }) {
      const response = await request(`/api/exams/${examId}/policy?purpose=${purpose}`);
      if (!response.ok) throw new Error("SIMULATION_POLICY_UNAVAILABLE");
      return (await response.json()).data.policy.signedBytesBase64;
    }
  };
}
