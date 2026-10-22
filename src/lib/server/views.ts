import type { ActivityEntry, Exam, ExamSummary, GovernanceObservation, GovernanceRequestView, ReleaseState } from "../contracts";
import type { GovernanceLink } from "../db/repository";
import { db } from "../db";

export function governanceRequestView(link: GovernanceLink): GovernanceRequestView {
  const observation = JSON.parse(link.observation) as GovernanceObservation;
  const states = observation.requests.map(r => r.status);
  const status = states.length && states.every(s => s === "COMMITTED") ? "COMMITTED"
    : states.includes("UNAVAILABLE") ? "UNAVAILABLE" : states.includes("PENDING") ? "PENDING" : "REJECTED";
  const age = Date.now() - Date.parse(observation.observedAt);
  const single = observation.requests.length === 1 ? observation.requests[0] : null;
  return { appRequestId: link.id, tideChangeRequestIds: observation.changeRequestIds, targetSubject: link.targetSubject,
    requestedRoles: JSON.parse(link.requestedRoles), status, observedAt: observation.observedAt, requests: observation.requests,
    ...(single ? { authorizationCount: single.authorizationCount, threshold: single.threshold } : {}),
    stale: !Number.isFinite(age) || age > 60000 || age < -5000 };
}
export function toExamSummary(exam: Exam): ExamSummary {
  let releaseState: ReleaseState = "UNKNOWN_BLOCKED";
  if (process.env.INVIGILATOR_ISSUER && process.env.INVIGILATOR_SUBJECT) {
    const link = db().prepare("SELECT * FROM GovernanceLink WHERE examId=? AND targetIssuer=? AND targetSubject=? ORDER BY createdAt DESC,id DESC LIMIT 1")
      .get(exam.id, process.env.INVIGILATOR_ISSUER, process.env.INVIGILATOR_SUBJECT) as unknown as GovernanceLink | undefined;
    if (link && (JSON.parse(link.requestedRoles) as string[]).includes("_tide_decryptor")) {
      const view = governanceRequestView(link);
      if (!view.stale && view.status === "COMMITTED") releaseState = "RELEASED";
      if (!view.stale && view.status === "PENDING") releaseState = "REQUEST_PENDING";
    }
  }
  return { id: exam.id, runId: exam.runId, title: exam.title, authorAlias: exam.authorAlias,
    contentType: exam.contentType, sealedAt: exam.sealedAt, advisoryReleaseAt: exam.advisoryReleaseAt,
    byteLength: exam.byteLength, ciphertextSha256: exam.ciphertextSha256,
    state: exam.state === "SEALED" ? "SEALED" : "DRAFT", releaseState };
}
export function toActivityEntry(row: Record<string, unknown>): ActivityEntry {
  return { id: row.id as string, at: row.observedAt as string, actorAlias: row.actorAlias as string,
    kind: row.kind as string, outcome: row.outcome as string, code: row.code as string, correlationId: row.correlationId as string,
    source: row.source === "APP" ? "APP_LOG" : row.source === "TIDE_OBSERVATION" ? "OBSERVED_FROM_TIDECLOAK" : "CLIENT_REPORTED" };
}
