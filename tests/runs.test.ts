import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fixture, fixturePolicies } from "./fixtures";
import { closeDb, db, openDb, claimProof } from "../src/lib/db";
import { migrate } from "../src/lib/db/migrate";
import { createDemoRun, getActiveRun } from "../src/lib/db/runs";
import { previewRunReset, resetDemoRun } from "../src/lib/db/reset";
import * as repo from "../src/lib/db/repository";
import { handleApi } from "../src/lib/server/api";
import { getVersionManifest } from "../src/lib/server/readiness";

const f = await fixture(), input = { title: "Unit run paper", advisoryReleaseAt: "2026-10-23T02:00:00Z" };
const nextRun = () => ({ realmId: "exam", clientId: "vault", issuer: f.issuer, manifest: getVersionManifest() });
const prepare = (key = randomUUID()) => repo.prepareExam(f.actor("author"), input, key, randomUUID());
after(f.cleanup);
beforeEach(() => { f.freshRun(); });

test("no active run means no implicit run creation; session can still explain readiness", async () => {
  db().prepare("UPDATE DemoRun SET active=0 WHERE active=1").run();
  const before = (db().prepare("SELECT count(*) AS n FROM DemoRun").get() as { n: number }).n;
  assert.equal(getActiveRun(), null);
  assert.throws(() => prepare(), { code: "RUN_NOT_READY" });
  const list = await handleApi(await f.request("/api/exams"));
  assert.equal(list.status, 503); assert.equal((await list.json()).error.code, "RUN_NOT_READY");
  const session = await handleApi(await f.request("/api/session"));
  assert.equal(session.status, 200); assert.ok((await session.json()).data.readiness.missing.includes("active_run"));
  assert.equal((db().prepare("SELECT count(*) AS n FROM DemoRun").get() as { n: number }).n, before);
});
test("one exam per explicitly created run; idempotent retry works and a second exam conflicts", () => {
  const key = randomUUID(), exam = prepare(key);
  assert.equal(prepare(key).id, exam.id);
  assert.throws(() => prepare(), { code: "RUN_EXAM_EXISTS", status: 409 });
  assert.throws(() => createDemoRun(nextRun()), { code: "ACTIVE_RUN_EXISTS" });
});
test("active run scopes metadata, ciphertext, policy, activity and display role", async () => {
  const oldExam = prepare(), policy = fixturePolicies(oldExam.id);
  repo.sealExam(f.actor("author"), oldExam.id, randomBytes(64), policy.write.id, 1, randomUUID(), randomUUID());
  f.freshRun(); const current = prepare();
  assert.deepEqual(repo.listExams(100, 0).map(e => e.id), [current.id]);
  assert.ok(repo.activity(undefined, 100, 0).every(e => e.runId === current.runId));
  for (const path of [`/api/exams/${oldExam.id}`, `/api/exams/${oldExam.id}/ciphertext`, `/api/exams/${oldExam.id}/policy`, `/api/activity?examId=${oldExam.id}`]) {
    assert.equal((await handleApi(await f.request(path))).status, 404);
  }
  const display = await handleApi(await f.request("/api/demo/display-role", { role: "app-admin", method: "PUT", body: { runId: oldExam.runId, displayRole: "invigilator" } }));
  assert.equal(display.status, 404);
});
test("reset deletes only target local data, rotates UUID and preserves replay cache and other runs", () => {
  const archived = prepare();
  f.freshRun(); const key = randomUUID(), exam = prepare(key), policies = fixturePolicies(exam.id);
  repo.sealExam(f.actor("author"), exam.id, randomBytes(40), policies.write.id, 1, randomUUID(), randomUUID());
  repo.overrideDisplayRole(f.actor("app-admin"), exam.runId, randomUUID());
  assert.equal(claimProof("reset-key", "keep-proof", Date.now() + 240000), true);
  const preview = previewRunReset(exam.runId);
  assert.equal(preview.exams, 1); assert.equal(preview.policies, 2); assert.equal(preview.displayOverrides, 1);
  assert.equal(repo.examById(exam.id).state, "SEALED");
  assert.throws(() => resetDemoRun(randomUUID(), nextRun()), { code: "RESET_TARGET_MISMATCH" });
  const result = resetDemoRun(exam.runId, nextRun());
  assert.notEqual(result.run.id, exam.runId); assert.equal(result.policyStatus, "not_ready");
  assert.throws(() => repo.examById(exam.id), { status: 404 });
  assert.equal(repo.examById(archived.id).id, archived.id);
  assert.equal(claimProof("reset-key", "keep-proof", Date.now() + 240000), false);
  assert.equal(repo.listExams(100, 0).length, 0);
  const freshExam = prepare(key); assert.notEqual(freshExam.id, exam.id);
  assert.throws(() => repo.getPolicy(freshExam.id, "WRITE"), { code: "POLICY_NOT_READY" });
});
test("reset rejects realm/client changes without deleting the active paper", () => {
  const exam = prepare();
  assert.throws(() => resetDemoRun(exam.runId, { ...nextRun(), clientId: "different" }), { code: "RESET_CONFIGURATION_MISMATCH" });
  assert.equal(repo.examById(exam.id).id, exam.id);
});
test("database owner blocks a second process from applying migrations or reset", () => {
  const exam = prepare();
  for (const scriptArgs of [["scripts/migrate.ts"], ["scripts/reset-run.ts", "--run-id", exam.runId, "--apply"]]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", ...scriptArgs], { encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 1);
  }
  assert.equal(repo.examById(exam.id).id, exam.id);
});
test("CLI dry-run leaves data unchanged; apply resets offline and preserves proof claims", () => {
  const exam = prepare(); claimProof("cli-key", "still-used", Date.now() + 240000); closeDb();
  const invoke = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "scripts/reset-run.ts", "--run-id", exam.runId, ...args], { encoding: "utf8", timeout: 15000 });
  let result = invoke(); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout.trim()).dryRun, true);
  assert.equal(repo.examById(exam.id).id, exam.id); closeDb();
  result = invoke("--apply"); assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout.split(/\r?\n/)[0]);
  assert.notEqual(output.run.id, exam.runId); assert.equal(output.remoteAuthorityChanged, false);
  assert.equal(claimProof("cli-key", "still-used", Date.now() + 240000), false);
  assert.throws(() => repo.examById(exam.id), { status: 404 });
});
test("version-1 upgrade preserves legacy data and never silently picks an active run", () => {
  const path = process.env.DATABASE_PATH!; closeDb();
  process.env.DATABASE_PATH = resolve(f.directory, "legacy.sqlite");
  try {
    const raw = openDb(), id = randomUUID(), examId = randomUUID(), bytes = randomBytes(32);
    raw.exec(readFileSync(resolve("src/lib/db/migrations/001-initial.sql"), "utf8"));
    raw.prepare("INSERT INTO SchemaMigration VALUES(1,?)").run(new Date().toISOString());
    raw.prepare("INSERT INTO DemoRun(id,mode,createdAt) VALUES(?,'LIVE_MANUAL_RELEASE',?)").run(id, new Date().toISOString());
    raw.prepare("INSERT INTO Exam(id,runId,title,authorIssuer,authorSubject,advisoryReleaseAt,createdAt,sealedAt,contentType,state,ciphertext,ciphertextSha256,byteLength,version) VALUES(?,?,?,?,?,?,?,?,'text/plain;charset=utf-8','SEALED',?,?,?,2)")
      .run(examId, id, "Legacy synthetic exam", f.issuer, "author", input.advisoryReleaseAt, new Date().toISOString(), new Date().toISOString(), bytes, repo.digest(bytes), bytes.length);
    assert.equal(migrate(), 2); assert.equal(migrate(), 2); assert.equal(getActiveRun(), null);
    assert.ok(db().prepare("SELECT id FROM DemoRun WHERE id=?").get(id));
    assert.deepEqual(Buffer.from(repo.readCiphertext(examId).ciphertextBase64, "base64"), bytes);
    assert.equal(repo.examById(examId).authorAlias, "Authenticated author");
    assert.equal((db().prepare("SELECT count(*) AS n FROM SchemaMigration").get() as { n: number }).n, 2);
  } finally { closeDb(); process.env.DATABASE_PATH = path; }
});
