import { z } from "zod";

export const MAX_PLAINTEXT_BYTES = 16 * 1024;
export const roleSchema = z.enum(["author", "invigilator", "teacher", "app-admin", "tide-realm-admin"]);
export type Role = z.infer<typeof roleSchema>;
export type Identity = { issuer: string; subject: string; alias: string; roles: Role[] };
export type Readiness = "ready" | "not_ready" | "unavailable";
export type ApiError = { error: { code: string; message: string; correlationId: string; retryable: boolean } };
export type ApiSuccess<T> = { data: T; correlationId: string; version: 1 };
export type DecryptResult =
  | { status: "opened"; plaintext: string }
  | { status: "denied" | "not_ready" | "unavailable" | "error"; code: string; correlationId: string };
export type Exam = {
  id: string; runId: string; title: string; authorIssuer: string; authorSubject: string;
  advisoryReleaseAt: string; createdAt: string; sealedAt: string | null;
  contentType: "text/plain;charset=utf-8"; state: "PREPARED" | "SEALED";
  ciphertextSha256: string | null; byteLength: number | null; version: number;
};
export type PolicyPurpose = "WRITE" | "READ";
export type SignedPolicy = {
  id: string; examId: string; purpose: PolicyPurpose; signedBytesBase64: string;
  digest: string; contractId: "RelationshipAttestation:1";
  assignmentId: string; subjectType: "Role"; subjectId: "author" | "invigilator";
  operationRoles: ("_tide_encryptor" | "_tide_decryptor")[]; version: 1;
};
export type GovernanceRequestState = {
  changeRequestId: string; status: "PENDING" | "COMMITTED" | "REJECTED" | "UNAVAILABLE";
  authorizationCount: number | null; threshold: number | null; authorizers: string[] | null;
};
export type GovernanceObservation = {
  changeRequestIds: string[]; requests: GovernanceRequestState[]; observedAt: string; source: "TIDE";
};
export const prepareSchema = z.object({ title: z.string().trim().min(1).max(120),
  advisoryReleaseAt: z.iso.datetime({ offset: true }) }).strict();
export const sealSchema = z.object({ ciphertextBase64: z.string().min(4), writePolicyId: z.uuid(),
  contentType: z.literal("text/plain;charset=utf-8"), expectedVersion: z.literal(1) }).strict();
export const accessRequestSchema = z.object({ kind: z.enum(["SELF_ACCESS", "INVIGILATOR_RELEASE"]) }).strict();
export const displayRoleSchema = z.object({ runId: z.uuid(), displayRole: z.literal("invigilator") }).strict();
export const policyInputSchema = z.object({ purpose: z.enum(["WRITE", "READ"]), signedBytesBase64: z.string().min(4) }).strict();
export const clientObservationSchema = z.object({ examId: z.uuid(), kind: z.literal("DECRYPT_ATTEMPT"),
  outcome: z.enum(["opened", "denied", "not_ready", "unavailable", "error"]),
  code: z.enum(["SDK_OPENED", "SDK_ROLE_DENIED", "SDK_POLICY_DENIED", "POLICY_NOT_READY", "NETWORK_UNAVAILABLE", "SDK_UNKNOWN"]),
  correlationId: z.uuid() }).strict();
