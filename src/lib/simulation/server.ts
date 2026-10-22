import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { accessRequestSchema, clientObservationSchema, denyRequestSchema, displayRoleSchema, policyInputSchema,
  prepareSchema, sealSchema, type Exam, type GovernanceObservation, type SignedPolicy, type VerifiedIdentity } from "../contracts";
import { AppError } from "../server/errors";
import { appOrigin } from "../server/config";
import { decodeBase64, idempotencyKey, json, pagination, readBody } from "../server/http";
import { simulationEnabled } from "./mode";

export const SIMULATION_ISSUER = "http://simulation.local/realms/sealed-demo";
const COOKIE = "sealed_simulation", sessionMs = 8 * 60 * 60 * 1000;
// Only same-origin readers can obtain this nonce: the API never enables CORS.
const csrfToken = randomBytes(32).toString("base64url");
const participants = ["author", "invigilator", "teacher", "app-admin", "governor-1", "governor-2", "governor-3"] as const;
type Participant = typeof participants[number];
type RecordData = { exam: Exam; policies: { WRITE: SignedPolicy; READ: SignedPolicy }; key: string; ciphertext?: string };
type RequestData = { id: string; examId: string; kind: "SELF_ACCESS" | "INVIGILATOR_RELEASE"; targetSubject: string;
  requestedRoles: string[]; status: "PENDING" | "COMMITTED" | "REJECTED"; authorizers: string[]; createdAt: string };
type EventData = { id: string; observedAt: string; actorAlias: string; kind: string; outcome: string; source: "SIMULATION";
  code: string; correlationId: string; examId?: string };
type State = { runId: string; records: RecordData[]; requests: RequestData[]; events: EventData[];
  idempotency: Record<string, { digest: string; data: unknown }>; displayRoles: Record<string, string> };
let database: DatabaseSync | undefined;
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const fresh = (): State => ({ runId: randomUUID(), records: [], requests: [], events: [], idempotency: {}, displayRoles: {} });
function store() {
  if (!database) {
    const path = resolve(process.env.SIMULATION_DATABASE_PATH ?? "data/simulation.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    database = new DatabaseSync(path);
    database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS SimulationState(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS SimulationSession(tokenHash TEXT PRIMARY KEY,participant TEXT NOT NULL,expiresAt INTEGER NOT NULL);");
    database.prepare("INSERT OR IGNORE INTO SimulationState VALUES(1,?)").run(JSON.stringify(fresh()));
  }
  return database;
}
export function closeSimulationDb() { database?.close(); database = undefined; }
function identity(id: Participant): VerifiedIdentity {
  const governor = id.startsWith("governor-");
  const role = governor ? "tide-realm-admin" : id as "author" | "invigilator" | "teacher" | "app-admin";
  return { issuer: SIMULATION_ISSUER, subject: id, alias: governor ? `Simulated Governor ${id.slice(-1)}` : `Simulated ${id}`,
    roles: [role], realmRoles: governor ? ["_tide_enabled"] : [role, "_tide_enabled", ...(id === "author" ? ["_tide_encryptor"] : [])],
    clientRoles: governor ? { "realm-management": ["tide-realm-admin"] } : {} };
}
function requireRole(actor: VerifiedIdentity, ...roles: string[]) {
  if (!roles.some(role => actor.roles.includes(role as never))) throw new AppError(403, "FORBIDDEN", "This simulated identity cannot perform this operation.");
}
function token(req: Request) { return req.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? ""; }
function authenticate(req: Request): VerifiedIdentity {
  const db = store();
  db.prepare("DELETE FROM SimulationSession WHERE expiresAt<=?").run(Date.now());
  const row = db.prepare("SELECT participant FROM SimulationSession WHERE tokenHash=?").get(hash(token(req))) as { participant: Participant } | undefined;
  if (!row || !participants.includes(row.participant)) throw new AppError(401, "SIMULATION_SIGN_IN_REQUIRED", "Choose a synthetic identity to sign in to the local simulation.");
  return identity(row.participant);
}
function event(state: State, actor: VerifiedIdentity, kind: string, outcome: string, correlationId: string, examId?: string) {
  state.events.unshift({ id: randomUUID(), observedAt: new Date().toISOString(), actorAlias: actor.alias,
    kind, outcome, source: "SIMULATION", code: `SIMULATED_${kind}`, correlationId, ...(examId ? { examId } : {}) });
  state.events = state.events.slice(0, 500);
}
function policy(examId: string, purpose: "READ" | "WRITE"): SignedPolicy {
  const id = randomUUID(), signedBytesBase64 = Buffer.from(JSON.stringify({ simulation: true, examId, purpose, id })).toString("base64");
  return { id, examId, purpose, signedBytesBase64, digest: hash(signedBytesBase64), contractId: "RelationshipAttestation:1",
    assignmentId: examId, subjectType: "Role", subjectId: purpose === "WRITE" ? "author" : "invigilator",
    operationRoles: [purpose === "WRITE" ? "_tide_encryptor" : "_tide_decryptor"], version: 1, simulation: true };
}
function observation(request: RequestData): GovernanceObservation {
  return { changeRequestIds: [request.id], observedAt: new Date().toISOString(), source: "SIMULATION",
    requests: [{ changeRequestId: request.id, status: request.status, authorizationCount: request.authorizers.length,
      authorizers: [...request.authorizers], threshold: 2 }] };
}
function link(request: RequestData) { return { ...request, changeRequestIds: [request.id], observation: observation(request) }; }
function released(state: State, examId: string) {
  return state.requests.some(r => r.examId === examId && r.kind === "INVIGILATOR_RELEASE" && r.targetSubject === "invigilator" &&
    r.status === "COMMITTED" && new Set(r.authorizers).size >= 2);
}
function summary(state: State, exam: Exam) { return { ...exam, state: exam.state === "SEALED" ? "SEALED" : "DRAFT",
  releaseState: released(state, exam.id) ? "RELEASED" : state.requests.some(r => r.examId === exam.id && r.kind === "INVIGILATOR_RELEASE" && r.status === "PENDING") ? "REQUEST_PENDING" : "UNRELEASED" }; }
function record(state: State, id: string) {
  if (!z.uuid().safeParse(id).success) throw new AppError(422, "INVALID_ID", "A valid exam identifier is required.");
  const value = state.records.find(r => r.exam.id === id);
  if (!value) throw new AppError(404, "EXAM_NOT_FOUND", "This simulation has no such exam.");
  return value;
}
function once<T>(state: State, actor: VerifiedIdentity, req: Request, input: unknown, fn: () => T): T {
  const key = `${actor.subject}:${new URL(req.url).pathname}:${idempotencyKey(req)}`, digest = hash(JSON.stringify(input));
  const prior = state.idempotency[key];
  if (prior) { if (prior.digest !== digest) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This request key was already used with different content."); return prior.data as T; }
  const data = fn(); state.idempotency[key] = { digest, data }; return data;
}

/** Separate local simulator. Never calls real auth/policy ports, accepts Tide JWTs, or exports a Tide adapter. */
export async function handleSimulationApi(req: Request): Promise<Response> {
  const correlationId = randomUUID(), path = new URL(req.url).pathname.replace(/\/$/, "");
  let response: Response;
  try {
    if (!simulationEnabled() || new URL(req.url).origin !== appOrigin()) throw new AppError(404, "NOT_FOUND", "Route not found.");
    if (req.method !== "GET" && req.headers.get("x-sealed-demo-csrf") !== csrfToken)
      throw new AppError(403, "DEMO_REQUEST_REJECTED", "Reload the Plan C demo and try again.");
    const input = req.method === "GET" ? undefined : await readBody(req, z.unknown(), 120 * 1024);
    const db = store();
    if (path === "/api/simulation/bootstrap" && req.method === "GET") {
      response = json({ csrfToken, simulation: true }, correlationId);
    } else if (path === "/api/simulation/login" && req.method === "POST") {
      const { participant } = z.object({ participant: z.enum(participants) }).strict().parse(input);
      const value = randomBytes(32).toString("base64url");
      db.prepare("DELETE FROM SimulationSession WHERE tokenHash=? OR expiresAt<=?").run(hash(token(req)), Date.now());
      db.prepare("INSERT INTO SimulationSession VALUES(?,?,?)").run(hash(value), participant, Date.now() + sessionMs);
      response = json({ simulation: true, identity: identity(participant) }, correlationId);
      response.headers.set("Set-Cookie", `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionMs / 1000}`);
    } else if (path === "/api/simulation/logout" && req.method === "POST") {
      db.prepare("DELETE FROM SimulationSession WHERE tokenHash=?").run(hash(token(req)));
      response = json({ signedOut: true, simulation: true }, correlationId);
      response.headers.set("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    } else {
      const actor = authenticate(req);
      db.exec("BEGIN IMMEDIATE");
      try {
        const state = JSON.parse((db.prepare("SELECT value FROM SimulationState WHERE id=1").get() as { value: string }).value) as State;
        response = route(state, actor, req, path, input, correlationId);
        db.prepare("UPDATE SimulationState SET value=? WHERE id=1").run(JSON.stringify(state));
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    }
  } catch (error) {
    const known = error instanceof AppError ? error : error instanceof z.ZodError ? new AppError(422, "INVALID_INPUT", "Invalid simulation request.") : new AppError(503, "SIMULATION_UNAVAILABLE", "Local simulation storage is unavailable.");
    response = Response.json({ error: { code: known.code, message: known.message, correlationId, retryable: known.retryable } }, { status: known.status });
  }
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Vary", "Cookie, Origin");
  response.headers.set("X-Sealed-Mode", "LOCAL_SIMULATION"); response.headers.set("X-Correlation-ID", correlationId);
  return response;
}

function route(state: State, actor: VerifiedIdentity, req: Request, path: string, input: unknown, cid: string): Response {
  const method = req.method, ok = (data: unknown, status = 200) => json(data, cid, status);
  if (method === "GET" && path === "/api/session") return ok({ identity: actor, mode: "LOCAL_SIMULATION", simulation: true,
    readiness: { authentication: "ready", policy: "ready", governance: "ready", tide: "ready", missing: [] },
    capabilities: { deny: "ready" }, tideConsoleUrl: null, activeRunId: state.runId, scheduleIsAdvisory: true,
    versionManifest: { applicationVersion: "simulation", nodeVersion: process.versions.node, sdkVersions: {}, realmImageDigest: null,
      dpopAssetSha256: null, dpopAssetMatches: false, pinnedKeyFingerprint: null } });
  if (path === "/api/simulation/reset" && method === "POST") {
    requireRole(actor, "app-admin"); Object.assign(state, fresh()); event(state, actor, "RESET", "reset", cid);
    return ok({ reset: true, simulation: true });
  }
  if (path === "/api/exams" && method === "GET") return ok({ exams: state.records.map(r => r.exam), summaries: state.records.map(r => summary(state, r.exam)), runId: state.runId });
  if (path === "/api/exams/prepare" && method === "POST") {
    requireRole(actor, "author"); const data = prepareSchema.parse(input);
    return ok(once(state, actor, req, data, () => {
      if (state.records.length) throw new AppError(409, "EXAM_EXISTS", "This demo run already has an exam. Reset it from the simulation panel to start again.");
      const id = randomUUID(), exam: Exam = { id, runId: state.runId, title: data.title, authorIssuer: actor.issuer,
        authorSubject: actor.subject, authorAlias: actor.alias, advisoryReleaseAt: data.advisoryReleaseAt, createdAt: new Date().toISOString(),
        sealedAt: null, contentType: "text/plain;charset=utf-8", state: "PREPARED", ciphertextSha256: null, byteLength: null, version: 1 };
      state.records.push({ exam, policies: { WRITE: policy(id, "WRITE"), READ: policy(id, "READ") }, key: randomBytes(32).toString("base64") });
      event(state, actor, "EXAM_PREPARED", "prepared", cid, id);
      return { exam, examId: id, policyStatus: "ready", simulation: true };
    }), 201);
  }
  const match = /^\/api\/exams\/([^/]+)(?:\/(seal|ciphertext|policy|policies|access-requests|simulation-key))?$/.exec(path);
  if (match) {
    const data = record(state, match[1]), exam = data.exam, action = match[2];
    if (!action && method === "GET") return ok({ exam, summary: summary(state, exam), scheduleIsAdvisory: true, accessReleaseStatus: summary(state, exam).releaseState });
    if (action === "policy" && method === "GET") {
      const purpose = z.enum(["WRITE", "READ"]).parse(new URL(req.url).searchParams.get("purpose") ?? "READ");
      return ok({ policy: { ...data.policies[purpose], policyId: data.policies[purpose].id } });
    }
    if (action === "simulation-key" && method === "POST") {
      const keyInput = z.object({ purpose: z.enum(["WRITE", "READ"]), policyId: z.uuid(), tags: z.array(z.string()).length(1) }).strict().parse(input);
      if (keyInput.tags[0] !== exam.id || keyInput.policyId !== data.policies[keyInput.purpose].id) throw new AppError(403, "SIMULATION_POLICY_DENIED", "Simulated policy refuses this record, operation or tag.");
      if (keyInput.purpose === "WRITE") {
        requireRole(actor, "author");
        if (actor.subject !== exam.authorSubject || exam.state !== "PREPARED") throw new AppError(403, "SIMULATION_ACCESS_DENIED", "Only the author can encrypt a prepared record.");
      } else if (actor.subject !== "invigilator" || !released(state, exam.id) || exam.state !== "SEALED") {
        event(state, actor, "OPEN_DENIED", "denied", cid, exam.id);
        // Return the refusal as a response so the diagnostic event commits with the transaction.
        return Response.json({ error: { code: "SIMULATION_ACCESS_DENIED", message: "Simulated read policy requires the designated invigilator and two distinct governor approvals.", correlationId: cid, retryable: false } }, { status: 403 });
      }
      event(state, actor, keyInput.purpose === "READ" ? "OPEN_ALLOWED" : "ENCRYPT_ALLOWED", "allowed", cid, exam.id);
      return ok({ keyBase64: data.key, simulation: true });
    }
    if (action === "seal" && method === "POST") {
      requireRole(actor, "author"); const seal = sealSchema.parse(input);
      return ok(once(state, actor, req, seal, () => {
        if (actor.subject !== exam.authorSubject || exam.state !== "PREPARED") throw new AppError(409, "EXAM_FROZEN", "This paper cannot be sealed again.");
        if (seal.writePolicyId !== data.policies.WRITE.id) throw new AppError(422, "POLICY_MISMATCH", "Write policy mismatch.");
        const bytes = decodeBase64(seal.ciphertextBase64, 32 * 1024);
        let envelope: { format?: string; examId?: string; iv?: string; data?: string };
        try { envelope = JSON.parse(bytes.toString("utf8")); } catch { throw new AppError(422, "INVALID_ENVELOPE", "A simulation AES-GCM envelope is required."); }
        if (envelope.format !== "SIMULATION_AES_GCM_V1" || envelope.examId !== exam.id || !envelope.iv || !envelope.data ||
          decodeBase64(envelope.iv, 12).length !== 12 || decodeBase64(envelope.data, 16400).length < 17) throw new AppError(422, "INVALID_ENVELOPE", "Simulation envelope fields are invalid.");
        data.ciphertext = seal.ciphertextBase64; Object.assign(exam, { state: "SEALED", version: 2, sealedAt: new Date().toISOString(), byteLength: bytes.length, ciphertextSha256: hash(bytes) });
        event(state, actor, "EXAM_SEALED", "sealed", cid, exam.id); return { exam };
      }));
    }
    if (action === "ciphertext" && method === "GET") {
      if (!data.ciphertext) throw new AppError(409, "EXAM_NOT_SEALED", "Seal this exam first.");
      return ok({ ciphertextBase64: data.ciphertext, sha256: exam.ciphertextSha256, byteLength: exam.byteLength, simulation: true });
    }
    if (action === "access-requests" && method === "POST") {
      const access = accessRequestSchema.parse(input);
      requireRole(actor, ...(access.kind === "SELF_ACCESS" ? ["app-admin"] : ["invigilator", "tide-realm-admin"]));
      if (exam.state !== "SEALED") throw new AppError(409, "EXAM_NOT_SEALED", "Seal this exam first.");
      return ok(once(state, actor, req, access, () => {
        const existing = state.requests.find(r => r.examId === exam.id && r.kind === access.kind && r.status !== "REJECTED");
        if (existing) return { request: link(existing), observation: observation(existing) };
        const request: RequestData = { id: randomUUID(), examId: exam.id, kind: access.kind,
          targetSubject: access.kind === "SELF_ACCESS" ? actor.subject : "invigilator", requestedRoles: access.kind === "SELF_ACCESS" ? ["invigilator", "_tide_decryptor"] : ["_tide_decryptor"],
          status: "PENDING", authorizers: [], createdAt: new Date().toISOString() };
        state.requests.unshift(request); event(state, actor, "ACCESS_REQUESTED", "pending", cid, exam.id);
        return { request: link(request), observation: observation(request) };
      }), 202);
    }
    if (action === "policies" && method === "POST") {
      requireRole(actor, "tide-realm-admin"); const p = policyInputSchema.parse(input);
      if (p.signedBytesBase64 !== data.policies[p.purpose].signedBytesBase64) throw new AppError(422, "POLICY_MISMATCH", "Unknown simulated policy.");
      return ok({ policy: data.policies[p.purpose] });
    }
  }
  if (path === "/api/governance/requests" && method === "GET") {
    requireRole(actor, "app-admin", "tide-realm-admin", "invigilator");
    return ok({ requests: state.requests.map(link), authority: "SIMULATION: local server state; no ORK votes" });
  }
  const decision = /^\/api\/governance\/requests\/([^/]+)\/(approve|deny)$/.exec(path);
  if (decision && method === "POST") {
    requireRole(actor, "tide-realm-admin"); const body = denyRequestSchema.parse(input);
    const request = state.requests.find(r => r.id === decision[1]);
    if (!request || request.id !== body.changeRequestId) throw new AppError(404, "REQUEST_NOT_FOUND", "Unknown simulated request.");
    if (request.status !== "PENDING") throw new AppError(409, "REQUEST_NOT_PENDING", "Only pending requests can receive a decision.");
    if (decision[2] === "deny") request.status = "REJECTED";
    else {
      if (request.kind === "SELF_ACCESS") throw new AppError(403, "SIMULATION_FIXED_RECIPIENT", "This demo policy allows release only to the designated invigilator. Reject the administrator's self-access request.");
      if (request.authorizers.includes(actor.subject)) throw new AppError(409, "DUPLICATE_APPROVAL", "This governor has already approved. Sign in as a different simulated governor.");
      request.authorizers.push(actor.subject);
      if (new Set(request.authorizers).size === 2) request.status = "COMMITTED";
    }
    event(state, actor, decision[2] === "deny" ? "REQUEST_REJECTED" : request.status === "COMMITTED" ? "RELEASE_COMMITTED" : "REQUEST_APPROVED", request.status.toLowerCase(), cid, request.examId);
    return ok({ request: link(request), observation: observation(request) });
  }
  if (path === "/api/demo/display-role" && method === "PUT") {
    requireRole(actor, "app-admin"); const change = displayRoleSchema.parse(input);
    if (change.runId !== state.runId) throw new AppError(404, "RUN_NOT_FOUND", "Unknown simulation run.");
    const before = state.displayRoles[actor.subject] ?? null; state.displayRoles[actor.subject] = change.displayRole;
    event(state, actor, "DISPLAY_ROLE_CHANGED", "display_only", cid);
    return ok({ before, after: change.displayRole, authorityChanged: false, verifiedRoles: actor.roles });
  }
  if (path === "/api/activity" && method === "GET") {
    const url = new URL(req.url), { limit, offset } = pagination(url), examId = url.searchParams.get("examId");
    const events = state.events.filter(e => !examId || e.examId === examId).slice(offset, offset + limit);
    return ok({ events, entries: events.map(e => ({ ...e, at: e.observedAt })), runId: state.runId, limit, offset, evidenceLabel: "SIMULATION: mutable local observations" });
  }
  if (path === "/api/activity/client-observations" && method === "POST") {
    const e = clientObservationSchema.parse(input); record(state, e.examId);
    event(state, actor, "CLIENT_OPEN_REPORT", e.outcome, cid, e.examId); return ok({ recorded: true, source: "SIMULATION" }, 201);
  }
  throw new AppError(404, "NOT_FOUND", "Route not found.");
}
