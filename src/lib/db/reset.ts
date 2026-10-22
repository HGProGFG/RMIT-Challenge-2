import { z } from "zod";
import { db, transaction } from "./index";
import { getActiveRun, insertDemoRun, type CreateRunInput } from "./runs";
import { AppError } from "../server/errors";

function assertActiveTarget(runId: string) {
  z.uuid().parse(runId);
  const run = getActiveRun();
  if (!run || run.id !== runId) throw new AppError(409, "RESET_TARGET_MISMATCH", "Reset must name the current active run exactly.");
  return run;
}
export function previewRunReset(runId: string) {
  assertActiveTarget(runId);
  const count = (sql: string) => (db().prepare(sql).get(runId) as { count: number }).count;
  return { runId, exams: count("SELECT count(*) AS count FROM Exam WHERE runId=?"),
    policies: count("SELECT count(*) AS count FROM ExamPolicy WHERE examId IN(SELECT id FROM Exam WHERE runId=?)"),
    governanceLinks: count("SELECT count(*) AS count FROM GovernanceLink WHERE examId IN(SELECT id FROM Exam WHERE runId=?)"),
    activity: count("SELECT count(*) AS count FROM ActivityEvent WHERE runId=?"),
    displayOverrides: count("SELECT count(*) AS count FROM DemoRoleOverride WHERE runId=?"),
    preserves: ["DpopReplay", "RateLimit", "other runs"], remoteAuthorityChanged: false };
}
/** Offline local synthetic data only. Remote grants/policies and retained copies are unaffected. */
function deleteRunDataRows(runId: string) {
  // Caller holds the DB transaction/lock. Recheck the exact target before any deletion.
  assertActiveTarget(runId);
  db().prepare("DELETE FROM Idempotency WHERE scope=? OR scope IN(SELECT 'seal:'||id FROM Exam WHERE runId=? UNION SELECT 'access:'||id FROM Exam WHERE runId=?) OR (scope='prepare' AND json_extract(response,'$.runId')=?)")
    .run(`prepare:${runId}`, runId, runId, runId);
  db().prepare("DELETE FROM ActivityEvent WHERE runId=?").run(runId);
  db().prepare("DELETE FROM DemoRoleOverride WHERE runId=?").run(runId);
  db().prepare("DELETE FROM GovernanceLink WHERE examId IN(SELECT id FROM Exam WHERE runId=?)").run(runId);
  db().prepare("DELETE FROM ExamPolicy WHERE examId IN(SELECT id FROM Exam WHERE runId=?)").run(runId);
  db().prepare("DELETE FROM Exam WHERE runId=?").run(runId);
}
export function deleteRunData(runId: string) {
  return transaction(() => { deleteRunDataRows(runId); });
}
export function resetDemoRun(runId: string, next: CreateRunInput) {
  return transaction(() => {
    const prior = assertActiveTarget(runId);
    if (prior.issuer !== next.issuer || prior.realmId !== next.realmId || prior.clientId !== next.clientId) throw new AppError(409, "RESET_CONFIGURATION_MISMATCH", "Reset cannot silently change realm/client/issuer.");
    const removed = previewRunReset(runId);
    deleteRunDataRows(runId);
    db().prepare("UPDATE DemoRun SET active=0 WHERE id=?").run(runId);
    return { removed, run: insertDemoRun(next), policyStatus: "not_ready" as const, remoteAuthorityChanged: false };
  });
}
