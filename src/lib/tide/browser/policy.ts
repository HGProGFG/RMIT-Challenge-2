"use client";
import { IAMService } from "@tidecloak/js";
import { Models } from "@tideorg/js";
import { PolicySignRequest } from "heimdall-tide";
import type { PublicTideConfig } from "../../server/config";
import { fromBase64, toBase64 } from "./encoding";

// Reviewed against pack 1.9.33 relationship.ts and the installed SDK's internal client.
// Isolate the internal API: re-run enclave integration tests on SDK upgrades.
export function enclaveClient() {
  const client = IAMService._tc;
  if (!client || !IAMService.isLoggedIn()) throw new Error("TIDE_SESSION_REQUIRED");
  return client;
}
export function buildExamPolicy(vendorId: string, examId: string, purpose: "WRITE" | "READ") {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(examId) || !vendorId) throw new Error("INVALID_POLICY_INPUT");
  return new Models.Policy({ version: Models.Policy.latestVersion,
    contractId: "RelationshipAttestation:1", modelId: ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"], keyId: vendorId,
    approvalType: Models.ApprovalType.IMPLICIT, executionType: Models.ExecutionType.PRIVATE,
    params: new Map([
      ["subjectType", "Role"], ["subjectId", purpose === "WRITE" ? "author" : "invigilator"],
      ["assignmentId", examId], ["roles", JSON.stringify([purpose === "WRITE" ? "_tide_encryptor" : "_tide_decryptor"])],
    ]) });
}
export async function signExamPolicy(config: PublicTideConfig, input: { examId: string; purpose: "WRITE" | "READ" }) {
  const tc = enclaveClient();
  // This is a human's browser request using that same person's DPoP-bound session.
  const token = await IAMService.getToken();
  const url = `${config["auth-server-url"].replace(/\/+$/, "")}/admin/realms/${encodeURIComponent(config.realm)}/iga/role-policies/name/tide-realm-admin`;
  const response = await IAMService.secureFetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error("ADMIN_POLICY_UNAVAILABLE");
  const data = await response.json();
  if (typeof data.policy !== "string" || data.policy.length > 128 * 1024) throw new Error("ADMIN_POLICY_UNAVAILABLE");
  const adminPolicy = fromBase64(data.policy);
  const policy = buildExamPolicy(config.vendorId!, input.examId, input.purpose);
  const request = PolicySignRequest.New(policy);
  request.setCustomExpiry(604800);
  const initialized = await tc.createTideRequest(request.encode());
  const id = Models.BaseTideRequest.decode(initialized).getUniqueId();
  const [approval] = await tc.requestTideOperatorApproval([{ id, request: initialized }]);
  if (!approval || approval.id !== id || approval.status !== "approved") throw new Error("POLICY_SIGNING_NOT_APPROVED");
  const approved = Models.BaseTideRequest.decode(approval.request);
  approved.addPolicy(adminPolicy);
  const signatures = await tc.executeSignRequest(approved.encode(), true);
  if (signatures.length !== 1 || signatures[0].length !== 64) throw new Error("INVALID_POLICY_SIGNATURE");
  policy.signature = signatures[0];
  return toBase64(policy.toBytes());
}
