"use client";
import { IAMService } from "@tidecloak/js";
import type { PublicTideConfig } from "../../server/config";
import { MAX_PLAINTEXT_BYTES, type DecryptResult, type SignedPolicy } from "../../contracts";
import type { BrowserTideAdapter } from "./adapter";
import { fromBase64, toBase64 } from "./encoding";
import { signExamPolicy } from "./policy";

function assertPolicy(policy: SignedPolicy, examId: string, purpose: "READ" | "WRITE") {
  if (policy.examId !== examId || policy.assignmentId !== examId || policy.purpose !== purpose ||
      policy.contractId !== "RelationshipAttestation:1" || policy.subjectType !== "Role" ||
      policy.subjectId !== (purpose === "WRITE" ? "author" : "invigilator") ||
      policy.operationRoles.length !== 1 || policy.operationRoles[0] !== (purpose === "WRITE" ? "_tide_encryptor" : "_tide_decryptor")) throw new Error("POLICY_NOT_READY");
  return fromBase64(policy.signedBytesBase64);
}
/** Authenticated transport only to our API. Tokens never go to caller-selected origins. */
export async function sdkFetch(url: string, init?: RequestInit) {
  if (!IAMService.isLoggedIn()) throw new Error("TIDE_SESSION_REQUIRED");
  const token = await IAMService.getToken();
  if (!token) throw new Error("TIDE_SESSION_REQUIRED");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  // secureFetch replaces the current Bearer with a bound DPoP proof; no manual proof or refresh.
  return IAMService.secureFetch(url, { ...init, headers, cache: "no-store", redirect: "error" });
}
export function createSdkAdapter(config: PublicTideConfig): BrowserTideAdapter {
  return {
    connected: true,
    async login() { await IAMService.doLogin(); },
    async logout() { await IAMService.doLogout(); },
    async secureFetch(input, init) {
      const url = new URL(input, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/") || url.username || url.password) throw new Error("INVALID_API_TARGET");
      return sdkFetch(url.href, init);
    },
    async encrypt({ examId, plaintext, policy }) {
      const bytes = new TextEncoder().encode(plaintext);
      if (!bytes.length || bytes.length > MAX_PLAINTEXT_BYTES) throw new Error("INVALID_PLAINTEXT_SIZE");
      // A policy is always supplied. Omitting it invokes the incompatible self-encryption path.
      const result = await IAMService.doEncrypt([{ data: bytes, tags: [examId] }], assertPolicy(policy, examId, "WRITE"));
      if (result.length !== 1 || !(result[0] instanceof Uint8Array) || !result[0].length) throw new Error("INVALID_SDK_RESULT");
      return toBase64(result[0]);
    },
    async decrypt({ examId, ciphertextBase64, policy }): Promise<DecryptResult> {
      const correlationId = crypto.randomUUID();
      try {
        const result = await IAMService.doDecrypt([{ encrypted: fromBase64(ciphertextBase64), tags: [examId] }], assertPolicy(policy, examId, "READ"));
        if (result.length !== 1 || !(result[0] instanceof Uint8Array) || result[0].length > MAX_PLAINTEXT_BYTES) throw new Error("INVALID_SDK_RESULT");
        return { status: "opened", plaintext: new TextDecoder("utf-8", { fatal: true }).decode(result[0]) };
      } catch (error) {
        // A threshold failure alone is ambiguous (outage OR refusal). Never present it as proof of denial.
        if (error instanceof Error && error.message === "POLICY_NOT_READY") return { status: "not_ready", code: "POLICY_NOT_READY", correlationId };
        if (error instanceof TypeError && error.message === "Failed to fetch") return { status: "unavailable", code: "NETWORK_UNAVAILABLE", correlationId };
        return { status: "error", code: "SDK_UNKNOWN", correlationId };
      }
    },
    signPolicy: input => signExamPolicy(config, input),
  };
}
