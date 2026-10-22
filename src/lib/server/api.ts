import { z } from "zod";
import { accessRequestSchema, clientObservationSchema, denyRequestSchema, displayRoleSchema, policyInputSchema,
  prepareSchema, sealSchema, type GovernanceObservation } from "../contracts";
import { db } from "../db";
import * as repo from "../db/repository";
import { ciphertextLimit, tideConfig, tideConsoleUrl } from "./config";
import { getActiveRun, requireActiveRun } from "../db/runs";
import { AppError, notReady } from "./errors";
import { decodeBase64, idempotencyKey, json, pagination, protectedRoute, readBody, requireRoles } from "./http";
import { tideIntegration } from "./tide-integration";
import { getIntegrationReadiness, getVersionManifest } from "./readiness";
import { governanceRequestView, toActivityEntry, toExamSummary } from "./views";
import { hasVerifiedRole } from "../roles";

const uuid = (id: string) => {
  if (!z.uuid().safeParse(id).success) throw new AppError(422, "INVALID_ID", "A valid UUID is required.");
  return id;
};
const requestStateSchema = z.object({
  changeRequestId: z.string().min(1).max(256),
  status: z.enum(["PENDING", "COMMITTED", "REJECTED", "UNAVAILABLE"]),
  authorizationCount: z.number().int().nonnegative().nullable(), threshold: z.number().int().positive().nullable(),
  authorizers: z.array(z.string().min(1).max(512)).max(100).nullable()
}).strict();
const observationSchema = z.object({
  changeRequestIds: z.array(z.string().min(1).max(256)).min(1).max(8),
  requests: z.array(requestStateSchema).min(1).max(8),
  observedAt: z.iso.datetime({ offset: true }), source: z.literal("TIDE")
}).strict();
function validateObservation(raw: GovernanceObservation, ids?: string[]) {
  const parsed = observationSchema.safeParse(raw);
  if (!parsed.success) throw new AppError(503, "INVALID_TIDE_OBSERVATION", "Live governance response could not be verified.");
  const value = parsed.data;
  if (new Set(value.changeRequestIds).size !== value.changeRequestIds.length ||
      (ids && [...ids].sort().join("\0") !== [...value.changeRequestIds].sort().join("\0")) ||
      [...value.changeRequestIds].sort().join("\0") !== value.requests.map(r => r.changeRequestId).sort().join("\0") ||
      value.requests.some(r => (r.authorizers && new Set(r.authorizers).size !== r.authorizers.length) ||
        (r.authorizers && r.authorizationCount !== null && r.authorizers.length !== r.authorizationCount) ||
        (r.status === "COMMITTED" && (r.threshold === null || r.authorizationCount === null || r.authorizationCount < r.threshold)))) {
    throw new AppError(503, "INVALID_TIDE_OBSERVATION", "Governance identifiers, counts or commit evidence are inconsistent.");
  }
  const age = Date.now() - Date.parse(value.observedAt);
  if (age > 60000 || age < -5000) throw new AppError(503, "STALE_TIDE_OBSERVATION", "A fresh governance observation is required.", true);
  return value;
}
export function handleApi(req: Request) {
  return protectedRoute(req, async ({ actor, correlationId }) => {
    const url = new URL(req.url), path = url.pathname.replace(/\/$/, ""), method = req.method;
    if (method === "GET" && path === "/api/session") return json({ identity: actor,
      readiness: { authentication: "ready", policy: tideIntegration.policyReadiness, governance: tideIntegration.governanceReadiness, ...getIntegrationReadiness() },
      capabilities: { deny: tideIntegration.denyReadiness }, tideConsoleUrl: tideConsoleUrl(),
      versionManifest: getVersionManifest(), activeRunId: getActiveRun()?.id ?? null,
      mode: "LIVE_MANUAL_RELEASE", scheduleIsAdvisory: true }, correlationId);
    const run = requireActiveRun(actor.issuer), config = tideConfig();
    if (run.realmId !== config.adapter.realm || run.clientId !== config.adapter.resource) throw new AppError(503, "RUN_CONFIGURATION_MISMATCH", "The active run does not match this realm/client.");
    if (method === "POST" && path === "/api/exams/prepare") {
      requireRoles(actor, ["author"]);
      const input = await readBody(req, prepareSchema), key = idempotencyKey(req);
      const exam = repo.prepareExam(actor, input, key, correlationId);
      const count = (db().prepare("SELECT count(*) AS count FROM ExamPolicy WHERE examId=?").get(exam.id) as { count: number }).count;
      return json({ exam, examId: exam.id, policyStatus: count === 2 ? "ready" : "not_ready" }, correlationId, 201);
    }
    if (method === "GET" && path === "/api/exams") {
      const { limit, offset } = pagination(url);
      const exams = repo.listExams(limit, offset);
      return json({ exams, summaries: exams.map(toExamSummary), runId: run.id, limit, offset, accessReleaseStatus: "unknown" }, correlationId);
    }
    if (method === "POST" && path === "/api/policies/ingest") {
      requireRoles(actor, ["tide-realm-admin"]);
      if (tideIntegration.policyReadiness !== "ready") notReady("Reviewed signed-policy verification is not connected.");
      const input = await readBody(req, policyInputSchema.extend({ examId: z.uuid() }), 96 * 1024);
      const exam = repo.activeExamById(input.examId, actor.issuer);
      const bytes = decodeBase64(input.signedBytesBase64, 64 * 1024);
      const metadata = await tideIntegration.verifyPolicy({ examId: exam.id, purpose: input.purpose, signedBytes: bytes });
      const policy = repo.insertPolicy(exam.id, input.purpose, bytes, metadata);
      repo.addActivity({ actor, exam, kind: "POLICY_STORED", outcome: "stored", source: "APP", code: "VERIFIED_POLICY_STORED", correlationId });
      return json({ policy }, correlationId, 201);
    }
    const match = /^\/api\/exams\/([^/]+)(?:\/(seal|ciphertext|policy|policies|access-requests))?$/.exec(path);
    if (match) {
      const id = uuid(match[1]), action = match[2], exam = repo.activeExamById(id, actor.issuer);
      if (!action && method === "GET") return json({ exam, summary: toExamSummary(exam), accessReleaseStatus: "unknown", scheduleIsAdvisory: true }, correlationId);
      if (action === "seal" && method === "POST") {
        requireRoles(actor, ["author"]);
        const max = ciphertextLimit(), input = await readBody(req, sealSchema, 4 * Math.ceil(max / 3) + 4096);
        const bytes = decodeBase64(input.ciphertextBase64, max);
        return json({ exam: repo.sealExam(actor, id, bytes, input.writePolicyId, input.expectedVersion, idempotencyKey(req), correlationId) }, correlationId);
      }
      if (action === "ciphertext" && method === "GET") return json(repo.readCiphertext(id), correlationId);
      if (action === "policy" && method === "GET") {
        const purpose = url.searchParams.get("purpose") ?? "READ";
        if (purpose !== "READ" && purpose !== "WRITE") throw new AppError(422, "INVALID_PURPOSE", "Policy purpose must be READ or WRITE.");
        return json({ policy: repo.getPolicy(id, purpose) }, correlationId);
      }
      if (action === "policies" && method === "POST") {
        requireRoles(actor, ["tide-realm-admin"]);
        if (tideIntegration.policyReadiness !== "ready") notReady("Reviewed signed-policy verification is not connected.");
        const input = await readBody(req, policyInputSchema, 96 * 1024);
        const signedBytes = decodeBase64(input.signedBytesBase64, 64 * 1024);
        const metadata = await tideIntegration.verifyPolicy({ examId: id, purpose: input.purpose, signedBytes });
        const policy = repo.insertPolicy(id, input.purpose, signedBytes, metadata);
        repo.addActivity({ actor, exam, kind: "POLICY_STORED", outcome: "stored", source: "APP", code: "VERIFIED_POLICY_STORED", correlationId });
        return json({ policy }, correlationId, 201);
      }
      if (action === "access-requests" && method === "POST") {
        const input = await readBody(req, accessRequestSchema), key = idempotencyKey(req);
        if (exam.state !== "SEALED") throw new AppError(409, "EXAM_NOT_SEALED", "Seal the exam before requesting access.");
        if (input.kind === "SELF_ACCESS") requireRoles(actor, ["app-admin"]);
        else requireRoles(actor, ["invigilator", "tide-realm-admin"]);
        const target = input.kind === "SELF_ACCESS" ? { issuer: actor.issuer, subject: actor.subject }
          : { issuer: process.env.INVIGILATOR_ISSUER ?? "", subject: process.env.INVIGILATOR_SUBJECT ?? "" };
        if (!target.issuer || !target.subject || target.issuer !== actor.issuer) notReady("A fixed same-realm invigilator must be configured.");
        if (input.kind === "INVIGILATOR_RELEASE" && !hasVerifiedRole(actor, "tide-realm-admin") &&
            (actor.subject !== target.subject || actor.issuer !== target.issuer)) throw new AppError(403, "NOT_DESIGNATED_RECIPIENT", "Only the designated invigilator or governance can request release.");
        if (tideIntegration.governanceReadiness !== "ready") notReady("Tide proposal bridge is unavailable. No pending CR was created.");
        const prior = repo.reserveProposal(actor, id, input.kind, key);
        if (prior) return json(prior, correlationId, 202);
        const roles = input.kind === "SELF_ACCESS" ? ["invigilator", "_tide_decryptor"] : ["_tide_decryptor"];
        const observation = validateObservation(await tideIntegration.proposeAccess({ examId: id, actor, target, roles,
          idempotencyKey: repo.digest(JSON.stringify([actor.issuer, actor.subject, id, key])) }));
        return json(repo.completeProposal(actor, exam, target, roles, key, observation, correlationId), correlationId, 202);
      }
    }
    const denyMatch = /^\/api\/governance\/requests\/([^/]+)\/deny$/.exec(path);
    if (method === "POST" && denyMatch) {
      requireRoles(actor, ["tide-realm-admin"]);
      const link = repo.getGovernanceLink(uuid(denyMatch[1]));
      if (tideIntegration.governanceReadiness !== "ready" || tideIntegration.denyReadiness !== "ready") notReady("A reviewed governor denial flow is unavailable. Use the supported Tide console.");
      const input = await readBody(req, denyRequestSchema);
      const ids = JSON.parse(link.changeRequestIds) as string[];
      if (!ids.includes(input.changeRequestId)) throw new AppError(422, "REQUEST_ID_MISMATCH", "The Tide request does not belong to this application request.");
      const current = validateObservation(await tideIntegration.observeRequests(ids), ids);
      repo.updateObservedStatus(link.id, current);
      if (current.requests.find(r => r.changeRequestId === input.changeRequestId)?.status !== "PENDING") throw new AppError(409, "REQUEST_NOT_PENDING", "Only a freshly observed pending request can be rejected; rejection is not revocation.");
      await tideIntegration.denyChangeRequest({ actor, changeRequestId: input.changeRequestId, expectedStatus: "PENDING" });
      const observed = validateObservation(await tideIntegration.observeRequests(ids), ids);
      repo.updateObservedStatus(link.id, observed);
      if (observed.requests.find(r => r.changeRequestId === input.changeRequestId)?.status !== "REJECTED") throw new AppError(503, "DENIAL_UNCONFIRMED", "Tide has not confirmed the rejection. Refresh before taking another action.", true);
      repo.addActivity({ actor, exam: repo.activeExamById(link.examId, actor.issuer), kind: "ACCESS_REQUEST_REJECTION_OBSERVED",
        outcome: "rejected", source: "TIDE_OBSERVATION", code: "TIDE_CR_REJECTION_OBSERVED", correlationId });
      return json({ request: governanceRequestView(repo.getGovernanceLink(link.id)), observation: observed }, correlationId);
    }
    if (method === "GET" && path === "/api/governance/requests") {
      requireRoles(actor, ["app-admin", "tide-realm-admin"]);
      if (tideIntegration.governanceReadiness !== "ready") notReady("Live governance observations are unavailable.");
      const requests = [];
      for (const link of repo.governanceLinks(actor)) {
        const ids = JSON.parse(link.changeRequestIds) as string[];
        const observation = validateObservation(await tideIntegration.observeRequests(ids), ids);
        repo.updateObservedStatus(link.id, observation);
        requests.push({ ...link, requestedRoles: JSON.parse(link.requestedRoles), changeRequestIds: ids, observation,
          view: governanceRequestView({ ...link, observation: JSON.stringify(observation) }) });
      }
      return json({ requests, observedAt: new Date().toISOString(), authority: "Tide observations; app cache does not grant access" }, correlationId);
    }
    if (method === "PUT" && path === "/api/demo/display-role") {
      if (process.env.NODE_ENV === "production" || process.env.DEMO_ATTACKS_ENABLED !== "true") throw new AppError(404, "NOT_FOUND", "Route not found.");
      requireRoles(actor, ["app-admin"]);
      const input = await readBody(req, displayRoleSchema);
      if (input.runId !== run.id) throw new AppError(404, "RUN_NOT_FOUND", "Demo run not found.");
      return json(repo.overrideDisplayRole(actor, input.runId, correlationId), correlationId);
    }
    if (method === "GET" && path === "/api/activity") {
      const { limit, offset } = pagination(url), examId = url.searchParams.get("examId") ?? undefined;
      if (examId) repo.activeExamById(uuid(examId), actor.issuer);
      const events = repo.activity(examId, limit, offset);
      return json({ events, entries: events.map(toActivityEntry), runId: run.id, limit, offset, evidenceLabel: "Mutable application observations; client reports are not independent proof" }, correlationId);
    }
    if (method === "POST" && path === "/api/activity/client-observations") {
      const input = await readBody(req, clientObservationSchema);
      const matchingCodes = { opened: ["SDK_OPENED"], denied: ["SDK_ROLE_DENIED", "SDK_POLICY_DENIED"], not_ready: ["POLICY_NOT_READY"], unavailable: ["NETWORK_UNAVAILABLE"], error: ["SDK_UNKNOWN"] };
      if (!matchingCodes[input.outcome].includes(input.code)) throw new AppError(422, "INVALID_OBSERVATION", "Outcome and code do not match.");
      const exam = repo.activeExamById(input.examId, actor.issuer);
      repo.addActivity({ actor, exam, kind: input.kind, outcome: input.outcome, source: "CLIENT_REPORTED", code: input.code, correlationId: input.correlationId });
      return json({ recorded: true, source: "CLIENT_REPORTED", authority: "This report does not prove decryption or grant access." }, correlationId, 201);
    }
    throw new AppError(404, "NOT_FOUND", "Route not found.");
  });
}
