import type { GovernanceObservation, Identity, PolicyPurpose, Readiness, SignedPolicy } from "../contracts";
import { notReady } from "./errors";
import { publicTideConfig } from "./config";
import { verifyExamPolicy } from "../tide/server/policy";
import { governanceConfigured, observeRequests, proposeAccess } from "../tide/server/governance";

/** Application port, NOT Tide SDK exports. Deployment readiness is separate from live acceptance.
 * No runtime signing, decrypt-capable credential, human approval proxy or invented vote counts.
 */
export interface TideIntegration {
  browserReadiness: Readiness;
  policyReadiness: Readiness;
  governanceReadiness: Readiness;
  denyReadiness: Readiness;
  verifyPolicy(input: { examId: string; purpose: PolicyPurpose; signedBytes: Uint8Array }): Promise<Omit<SignedPolicy, "id" | "digest" | "signedBytesBase64">>;
  proposeAccess(input: { examId: string; actor: Identity; target: Pick<Identity, "issuer" | "subject">; roles: string[]; idempotencyKey: string }): Promise<GovernanceObservation>;
  observeRequests(ids: string[]): Promise<GovernanceObservation>;
  denyChangeRequest(input: { actor: Identity; changeRequestId: string; expectedStatus: "PENDING" }): Promise<void>;
}
const overrides: Partial<Record<"browserReadiness" | "policyReadiness" | "governanceReadiness", Readiness>> = {};
export const tideIntegration: TideIntegration = {
  get browserReadiness() { return overrides.browserReadiness ?? (publicTideConfig() ? "ready" : "not_ready"); },
  set browserReadiness(value) { overrides.browserReadiness = value; },
  get policyReadiness() { return overrides.policyReadiness ?? (publicTideConfig() ? "ready" : "not_ready"); },
  set policyReadiness(value) { overrides.policyReadiness = value; },
  get governanceReadiness() { return overrides.governanceReadiness ?? (governanceConfigured() ? "ready" : "not_ready"); },
  set governanceReadiness(value) { overrides.governanceReadiness = value; },
  denyReadiness: "not_ready",
  verifyPolicy: verifyExamPolicy,
  proposeAccess,
  observeRequests,
  async denyChangeRequest() { return notReady("A reviewed governor denial flow is not connected. Use the supported Tide console."); }
};
