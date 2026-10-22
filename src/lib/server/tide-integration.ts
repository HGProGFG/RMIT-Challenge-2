import type { GovernanceObservation, Identity, PolicyPurpose, Readiness, SignedPolicy } from "../contracts";
import { notReady } from "./errors";

/** Application port, NOT Tide SDK exports. Dinh wires reviewed browser/server integration here.
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
export const tideIntegration: TideIntegration = {
  browserReadiness: "not_ready",
  policyReadiness: "not_ready",
  governanceReadiness: "not_ready",
  denyReadiness: "not_ready",
  async verifyPolicy() { return notReady("Signed-policy verification has not been connected by Dinh."); },
  async proposeAccess() { return notReady("Tide proposal integration is unavailable. No pending request has been created."); },
  async observeRequests() { return notReady("Live Tide governance observations are unavailable."); },
  async denyChangeRequest() { return notReady("A reviewed governor denial flow is not connected. Use the supported Tide console."); }
};
