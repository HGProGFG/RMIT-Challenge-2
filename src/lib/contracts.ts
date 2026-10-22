import { z } from "zod";

export const MAX_PLAINTEXT_BYTES = 16 * 1024;
export const roleSchema = z.enum(["author", "invigilator", "teacher", "app-admin", "tide-realm-admin"]);
export type Role = z.infer<typeof roleSchema>;
export type Identity = { issuer: string; subject: string; alias: string; roles: Role[] };
export type VerifiedIdentity = Identity & { realmRoles: string[]; clientRoles: Record<string, string[]>; tideUserKey?: string };
export type Readiness = "ready" | "not_ready" | "unavailable";
export type IntegrationReadiness = { tide: Readiness; missing: string[] };
export const ExamState = { PREPARING: "PREPARING", DRAFT: "DRAFT", ENCRYPTING: "ENCRYPTING", SEALED: "SEALED" } as const;
export type ExamState = typeof ExamState[keyof typeof ExamState];
export const ReleaseState = { UNRELEASED: "UNRELEASED", REQUEST_PENDING: "REQUEST_PENDING", RELEASED: "RELEASED", UNKNOWN_BLOCKED: "UNKNOWN_BLOCKED" } as const;
export type ReleaseState = typeof ReleaseState[keyof typeof ReleaseState];
export const OpenState = { CLOSED: "CLOSED", OPENING: "OPENING", OPENED: "OPENED", DENIED: "DENIED", UNAVAILABLE: "UNAVAILABLE" } as const;
export type OpenState = typeof OpenState[keyof typeof OpenState];
export const ScheduleState = { BEFORE_ADVISORY_TIME: "BEFORE_ADVISORY_TIME", ADVISORY_TIME_REACHED: "ADVISORY_TIME_REACHED" } as const;
export type ScheduleState = typeof ScheduleState[keyof typeof ScheduleState];
export type ApiError = { error: { code: string; message: string; correlationId: string; retryable: boolean } };
export type ApiSuccess<T> = { data: T; correlationId: string; version: 1 };
export type DecryptResult =
  | { status: "opened"; plaintext: string }
  | { status: "denied" | "not_ready" | "unavailable" | "error"; code: string; correlationId: string };
export type Exam = {
  id: string; runId: string; title: string; authorIssuer: string; authorSubject: string; authorAlias: string;
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
export type DecryptOutcome = DecryptResult;
export type SignedPolicyRef = SignedPolicy & { policyId: string };
export type PolicyReadiness = { status: "ready"; policy: SignedPolicyRef } | { status: "not_ready"; reason: string };
export type ExamSummary = Pick<Exam, "id" | "runId" | "title" | "authorAlias" | "contentType" | "sealedAt" | "advisoryReleaseAt" | "byteLength" | "ciphertextSha256"> & { state: ExamState; releaseState: ReleaseState };
export type GovernanceRequestView = { appRequestId: string; tideChangeRequestIds: string[]; targetSubject: string; requestedRoles: string[];
  status: GovernanceRequestState["status"]; authorizationCount?: number | null; threshold?: number | null; observedAt: string; requests: GovernanceRequestState[]; stale: boolean };
export type ActivityEntry = { id: string; at: string; actorAlias: string; kind: string; outcome: string;
  source: "APP_LOG" | "CLIENT_REPORTED" | "OBSERVED_FROM_TIDECLOAK"; code: string; correlationId: string; changeRequestId?: string };
export const LIMITS = { MAX_PLAINTEXT_BYTES, MAX_TITLE: 120 } as const;
// Ciphertext limit is runtime deployment configuration, never a guessed browser constant.
export type VersionManifest = { applicationVersion: string; nodeVersion: string; sdkVersions: Record<string, string | null>;
  realmImageDigest: string | null; dpopAssetSha256: string | null; dpopAssetMatches: boolean; pinnedKeyFingerprint: string | null };
export type DemoRun = { id: string; active: number; mode: "LIVE_MANUAL_RELEASE"; createdAt: string;
  realmId: string; clientId: string; issuer: string; versionManifest: string; expectedPolicyFingerprints: string; pinnedKeyFingerprint: string | null };
export type SessionResponse = { identity: VerifiedIdentity;
  readiness: IntegrationReadiness & { authentication: Readiness; policy: Readiness; governance: Readiness };
  capabilities: { deny: Readiness }; activeRunId: string | null; versionManifest: VersionManifest;
  mode: "LIVE_MANUAL_RELEASE"; scheduleIsAdvisory: true };
export const denyRequestSchema = z.object({ changeRequestId: z.string().min(1).max(256) }).strict();
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
