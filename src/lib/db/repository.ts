import { createHash, randomUUID } from "node:crypto";
import type { Exam, GovernanceObservation, Identity, PolicyPurpose, SignedPolicy, SignedPolicyRef, VerifiedIdentity } from "../contracts";
import { AppError } from "../server/errors";
import { db, transaction } from "./index";
import { requireActiveRun } from "./runs";
import { hasVerifiedRole } from "../roles";

const examColumns = "id,runId,title,authorIssuer,authorSubject,authorAlias,advisoryReleaseAt,createdAt,sealedAt,contentType,state,ciphertextSha256,byteLength,version";
export const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export function examById(id: string): Exam {
  const row = db().prepare(`SELECT ${examColumns} FROM Exam WHERE id=?`).get(id);
  if (!row) throw new AppError(404, "EXAM_NOT_FOUND", "Exam not found.");
  return row as unknown as Exam;
}
export function activeExamById(id: string, issuer?: string): Exam {
  const run = requireActiveRun(issuer), exam = examById(id);
  if (exam.runId !== run.id) throw new AppError(404, "EXAM_NOT_FOUND", "Exam not found in the active run.");
  return exam;
}
export function listExams(limit: number, offset: number) {
  return db().prepare(`SELECT ${examColumns} FROM Exam WHERE runId=? ORDER BY createdAt DESC,id DESC LIMIT ? OFFSET ?`).all(requireActiveRun().id, limit, offset) as unknown as Exam[];
}
type EventInput = { actor: Identity; exam: Exam; kind: string; outcome: string;
  source: "APP" | "CLIENT_REPORTED" | "TIDE_OBSERVATION"; code: string; correlationId: string };
export function addActivity(e: EventInput) {
  const id = randomUUID();
  db().prepare("INSERT INTO ActivityEvent(id,runId,examId,actorIssuer,actorSubject,kind,outcome,source,code,correlationId,observedAt,actorAlias) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(
    id, e.exam.runId, e.exam.id, e.actor.issuer, e.actor.subject,
    e.kind, e.outcome, e.source, e.code, e.correlationId, new Date().toISOString(), e.actor.alias);
  return id;
}
function idempotency(actor: Identity, scope: string, key: string, input: unknown) {
  const hash = digest(JSON.stringify(input));
  const prior = db().prepare("SELECT requestDigest,response FROM Idempotency WHERE issuer=? AND subject=? AND scope=? AND key=?")
    .get(actor.issuer, actor.subject, scope, key) as { requestDigest: string; response: string | null } | undefined;
  if (prior && prior.requestDigest !== hash) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key was used with different input.");
  return { hash, prior };
}
function saveIdempotency(actor: Identity, scope: string, key: string, hash: string, response: unknown) {
  db().prepare("INSERT INTO Idempotency VALUES(?,?,?,?,?,?)").run(actor.issuer, actor.subject, scope, key, hash, JSON.stringify(response));
}
export function prepareExam(actor: Identity, input: { title: string; advisoryReleaseAt: string }, key: string, correlationId: string) {
  return transaction(() => {
    const run = requireActiveRun(actor.issuer), scope = `prepare:${run.id}`;
    const { hash, prior } = idempotency(actor, scope, key, input);
    if (prior) return JSON.parse(prior.response!) as Exam;
    if (db().prepare("SELECT id FROM Exam WHERE runId=?").get(run.id)) throw new AppError(409, "RUN_EXAM_EXISTS", "This run already has its exam. Reset offline for another demo.");
    const id = randomUUID(), now = new Date().toISOString();
    db().prepare("INSERT INTO Exam(id,runId,title,authorIssuer,authorSubject,authorAlias,advisoryReleaseAt,createdAt,contentType,state) VALUES(?,?,?,?,?,?,?,?,'text/plain;charset=utf-8','PREPARED')")
      .run(id, run.id, input.title, actor.issuer, actor.subject, actor.alias, new Date(input.advisoryReleaseAt).toISOString(), now);
    const exam = examById(id);
    addActivity({ actor, exam, kind: "EXAM_PREPARED", outcome: "prepared", source: "APP", code: "POLICY_NOT_READY", correlationId });
    saveIdempotency(actor, scope, key, hash, exam);
    return exam;
  });
}
export function getPolicy(examId: string, purpose: PolicyPurpose): SignedPolicyRef {
  examById(examId);
  const row = db().prepare("SELECT id,signedBytes,digest,metadata FROM ExamPolicy WHERE examId=? AND purpose=? AND version=1")
    .get(examId, purpose) as { id: string; signedBytes: Uint8Array; digest: string; metadata: string } | undefined;
  if (!row) throw new AppError(503, "POLICY_NOT_READY", "A verified signed policy is not available.", true);
  return { ...JSON.parse(row.metadata), id: row.id, policyId: row.id, signedBytesBase64: Buffer.from(row.signedBytes).toString("base64"), digest: row.digest } as SignedPolicyRef;
}
export function insertPolicy(examId: string, purpose: PolicyPurpose, bytes: Uint8Array,
  metadata: Omit<SignedPolicy, "id" | "digest" | "signedBytesBase64">) {
  return transaction(() => {
    const exam = examById(examId);
    if (exam.state !== "PREPARED") throw new AppError(409, "POLICY_FROZEN", "Policies are frozen after sealing.");
    const subject = purpose === "WRITE" ? "author" : "invigilator";
    const operation = purpose === "WRITE" ? "_tide_encryptor" : "_tide_decryptor";
    if (metadata.examId !== examId || metadata.assignmentId !== examId || metadata.purpose !== purpose ||
        metadata.contractId !== "RelationshipAttestation:1" || metadata.subjectType !== "Role" ||
        metadata.subjectId !== subject || metadata.version !== 1 ||
        metadata.operationRoles.length !== 1 || metadata.operationRoles[0] !== operation) {
      throw new AppError(422, "POLICY_MISMATCH", "Verified policy does not match this exam, subject and operation.");
    }
    const hash = digest(bytes);
    const prior = db().prepare("SELECT digest FROM ExamPolicy WHERE examId=? AND purpose=?").get(examId, purpose) as { digest: string } | undefined;
    if (prior) {
      if (prior.digest !== hash) throw new AppError(409, "POLICY_CONFLICT", "This exam already has a different policy.");
      return getPolicy(examId, purpose);
    }
    db().prepare("INSERT INTO ExamPolicy VALUES(?,?,?,?,?,?,1)").run(randomUUID(), examId, purpose, bytes, hash, JSON.stringify(metadata));
    return getPolicy(examId, purpose);
  });
}
export function sealExam(actor: Identity, id: string, bytes: Uint8Array, writePolicyId: string,
  expectedVersion: number, key: string, correlationId: string) {
  return transaction(() => {
    const exam = examById(id);
    if (exam.authorIssuer !== actor.issuer || exam.authorSubject !== actor.subject) throw new AppError(403, "NOT_OWNER", "Only the verified author can seal this exam.");
    const input = { hash: digest(bytes), writePolicyId, expectedVersion };
    const { hash, prior } = idempotency(actor, `seal:${id}`, key, input);
    if (prior) return JSON.parse(prior.response!) as Exam;
    if (exam.state !== "PREPARED" || exam.version !== expectedVersion) throw new AppError(409, "EXAM_FROZEN", "Exam is already sealed or its version changed.");
    if (getPolicy(id, "WRITE").id !== writePolicyId) throw new AppError(422, "POLICY_MISMATCH", "Write policy does not belong to this exam.");
    getPolicy(id, "READ");
    const updated = db().prepare("UPDATE Exam SET state='SEALED',ciphertext=?,ciphertextSha256=?,byteLength=?,sealedAt=?,version=2 WHERE id=? AND state='PREPARED' AND version=?")
      .run(bytes, input.hash, bytes.byteLength, new Date().toISOString(), id, expectedVersion);
    if (updated.changes !== 1) throw new AppError(409, "EXAM_FROZEN", "Exam state or version changed before sealing.");
    const result = examById(id);
    addActivity({ actor, exam: result, kind: "EXAM_SEALED", outcome: "sealed", source: "APP", code: "CIPHERTEXT_STORED", correlationId });
    saveIdempotency(actor, `seal:${id}`, key, hash, result);
    return result;
  });
}
export function readCiphertext(id: string) {
  const exam = examById(id);
  if (exam.state !== "SEALED") throw new AppError(409, "EXAM_NOT_SEALED", "Exam has not been sealed.");
  const row = db().prepare("SELECT ciphertext FROM Exam WHERE id=?").get(id) as { ciphertext: Uint8Array };
  const bytes = Buffer.from(row.ciphertext);
  if (bytes.length !== exam.byteLength || digest(bytes) !== exam.ciphertextSha256) throw new AppError(409, "CIPHERTEXT_CORRUPT", "Stored ciphertext does not match its recorded digest.");
  return { ciphertextBase64: bytes.toString("base64"), encoding: "base64" as const,
    sha256: exam.ciphertextSha256, byteLength: bytes.length, integrityLabel: "Integrity reference; not a signature" };
}
export function overrideDisplayRole(actor: Identity, runId: string, correlationId: string) {
  return transaction(() => {
    const row = db().prepare(`SELECT ${examColumns} FROM Exam WHERE runId=?`).get(runId) as unknown as Exam | undefined;
    if (!row) throw new AppError(404, "RUN_NOT_FOUND", "Demo run not found.");
    const prior = db().prepare("SELECT displayRole FROM DemoRoleOverride WHERE runId=? AND issuer=? AND subject=?")
      .get(runId, actor.issuer, actor.subject) as { displayRole: string } | undefined;
    db().prepare("INSERT INTO DemoRoleOverride VALUES(?,?,?,'invigilator',?) ON CONFLICT(runId,issuer,subject) DO UPDATE SET displayRole='invigilator',updatedAt=excluded.updatedAt")
      .run(runId, actor.issuer, actor.subject, new Date().toISOString());
    addActivity({ actor, exam: row, kind: "DISPLAY_ROLE_CHANGED", outcome: "display_only", source: "APP", code: "NO_AUTHORITY_CHANGED", correlationId });
    return { before: prior?.displayRole ?? null, after: "invigilator", authorityChanged: false, verifiedRoles: actor.roles };
  });
}
export function activity(examId: string | undefined, limit: number, offset: number) {
  const runId = requireActiveRun().id;
  return examId
    ? db().prepare("SELECT * FROM ActivityEvent WHERE runId=? AND examId=? ORDER BY observedAt DESC,id DESC LIMIT ? OFFSET ?").all(runId, examId, limit, offset)
    : db().prepare("SELECT * FROM ActivityEvent WHERE runId=? ORDER BY observedAt DESC,id DESC LIMIT ? OFFSET ?").all(runId, limit, offset);
}
export type GovernanceLink = { id: string; examId: string; requesterIssuer: string; requesterSubject: string;
  targetIssuer: string; targetSubject: string; requestedRoles: string; changeRequestIds: string; observation: string; createdAt: string };
export function governanceLinks(actor: Identity) {
  const runId = requireActiveRun(actor.issuer).id;
  const governor = "realmRoles" in actor ? hasVerifiedRole(actor as VerifiedIdentity, "tide-realm-admin") : actor.roles.includes("tide-realm-admin");
  return (governor
    ? db().prepare("SELECT * FROM GovernanceLink WHERE examId IN(SELECT id FROM Exam WHERE runId=?) ORDER BY createdAt DESC LIMIT 100").all(runId)
    : db().prepare("SELECT * FROM GovernanceLink WHERE examId IN(SELECT id FROM Exam WHERE runId=?) AND requesterIssuer=? AND requesterSubject=? ORDER BY createdAt DESC LIMIT 100").all(runId, actor.issuer, actor.subject)) as unknown as GovernanceLink[];
}
export function getDisplayRole(runId: string, actor: Identity): string | null {
  const row = db().prepare("SELECT displayRole FROM DemoRoleOverride WHERE runId=? AND issuer=? AND subject=?")
    .get(runId, actor.issuer, actor.subject) as { displayRole: string } | undefined;
  return row?.displayRole ?? null;
}
export function getGovernanceLink(id: string) {
  const link = db().prepare("SELECT * FROM GovernanceLink WHERE id=? AND examId IN(SELECT id FROM Exam WHERE runId=?)").get(id, requireActiveRun().id) as unknown as GovernanceLink | undefined;
  if (!link) throw new AppError(404, "REQUEST_NOT_FOUND", "Request not found in the active run.");
  const observation = JSON.parse(link.observation) as GovernanceObservation;
  return { ...link, stale: !Number.isFinite(Date.parse(observation.observedAt)) || Date.now() - Date.parse(observation.observedAt) > 60000 };
}
export function updateObservedStatus(id: string, observation: GovernanceObservation) {
  getGovernanceLink(id);
  db().prepare("UPDATE GovernanceLink SET observation=? WHERE id=?").run(JSON.stringify(observation), id);
}
export function reserveProposal(actor: Identity, examId: string, kind: string, key: string) {
  return transaction(() => {
    const scope = `access:${examId}`, { hash, prior } = idempotency(actor, scope, key, { kind });
    if (prior) {
      if (!prior.response) throw new AppError(503, "PROPOSAL_UNCERTAIN", "Proposal is in progress or needs reconciliation with Tide. Reuse this key.", true);
      return JSON.parse(prior.response) as { id: string; observation: GovernanceObservation };
    }
    db().prepare("INSERT INTO Idempotency VALUES(?,?,?,?,?,NULL)").run(actor.issuer, actor.subject, scope, key, hash);
    return null;
  });
}
export function completeProposal(actor: Identity, exam: Exam, target: Pick<Identity, "issuer" | "subject">,
  roles: string[], key: string, observation: GovernanceObservation, correlationId: string) {
  return transaction(() => {
    const id = randomUUID(), response = { id, observation };
    db().prepare("INSERT INTO GovernanceLink(id,examId,requesterIssuer,requesterSubject,targetIssuer,targetSubject,requestedRoles,changeRequestIds,observation,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id, exam.id, actor.issuer, actor.subject,
      target.issuer, target.subject, JSON.stringify(roles), JSON.stringify(observation.changeRequestIds), JSON.stringify(observation), new Date().toISOString());
    db().prepare("UPDATE Idempotency SET response=? WHERE issuer=? AND subject=? AND scope=? AND key=?")
      .run(JSON.stringify(response), actor.issuer, actor.subject, `access:${exam.id}`, key);
    addActivity({ actor, exam, kind: "ACCESS_REQUEST_OBSERVED", outcome: "observed",
      source: "TIDE_OBSERVATION", code: "TIDE_CR_OBSERVED", correlationId });
    return response;
  });
}
