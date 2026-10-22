import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import * as repo from "../src/lib/db/repository";
import { claimProof, closeDb, db } from "../src/lib/db";
import { fixture, fixturePolicies } from "./fixtures";

const f = await fixture(), author = f.actor("author"), input = { title: "Synthetic exam", advisoryReleaseAt: "2026-10-23T02:00:00Z" };
after(f.cleanup);
const prepare = (key = randomUUID()) => repo.prepareExam(author, input, key, randomUUID());
test("prepare idempotency is durable and rejects different input with same key", () => {
  const key = randomUUID(), exam = prepare(key);
  closeDb();
  assert.equal(prepare(key).id, exam.id);
  assert.throws(() => repo.prepareExam(author, { ...input, title: "Changed" }, key, randomUUID()), { status: 409 });
});
test("stores and reads exact opaque ciphertext larger than plaintext limit, with ciphertext digest", () => {
  const exam = prepare(), policies = fixturePolicies(exam.id), bytes = randomBytes(40000), key = randomUUID();
  const result = repo.sealExam(author, exam.id, bytes, policies.write.id, 1, key, randomUUID());
  const persisted = repo.readCiphertext(exam.id);
  assert.equal(result.state, "SEALED"); assert.equal(result.version, 2);
  assert.deepEqual(Buffer.from(persisted.ciphertextBase64, "base64"), bytes);
  assert.equal(persisted.sha256, repo.digest(bytes));
  assert.equal(repo.sealExam(author, exam.id, bytes, policies.write.id, 1, key, randomUUID()).id, exam.id);
  assert.throws(() => repo.sealExam(author, exam.id, randomBytes(40), policies.write.id, 1, key, randomUUID()), { status: 409 });
  assert.throws(() => repo.sealExam(author, exam.id, bytes, policies.write.id, 1, randomUUID(), randomUUID()), { status: 409 });
  assert.throws(() => db().prepare("UPDATE Exam SET ciphertext=? WHERE id=?").run(randomBytes(40), exam.id), /SEALED_WRITE_ONCE/);
});
test("enforces ownership and matching frozen signed policy pair", () => {
  const exam = prepare(), other = prepare(), policies = fixturePolicies(exam.id), otherPolicies = fixturePolicies(other.id);
  assert.throws(() => repo.sealExam(f.actor("author", "other-author"), exam.id, randomBytes(30), policies.write.id, 1, randomUUID(), randomUUID()), { status: 403 });
  assert.throws(() => repo.sealExam(author, exam.id, randomBytes(30), otherPolicies.write.id, 1, randomUUID(), randomUUID()), { status: 422 });
  const bare = prepare();
  assert.throws(() => repo.sealExam(author, bare.id, randomBytes(30), policies.write.id, 1, randomUUID(), randomUUID()), { status: 503 });
});
test("policy record binding prevents using a different exam assignment", () => {
  const exam = prepare(), other = prepare(), policy = fixturePolicies(other.id).write;
  assert.throws(() => repo.insertPolicy(exam.id, "WRITE", randomBytes(20), policy), { status: 422 });
});
test("display role mutation never changes verified identity roles", () => {
  const exam = prepare(), admin = f.actor("app-admin");
  const result = repo.overrideDisplayRole(admin, exam.runId, randomUUID());
  assert.equal(result.after, "invigilator"); assert.equal(result.authorityChanged, false);
  assert.deepEqual(admin.roles, ["app-admin"]);
});
test("atomic replay insert is durable and scoped to proof key", () => {
  assert.equal(claimProof("key-a", "same-id", Date.now() + 10000), true);
  assert.equal(claimProof("key-a", "same-id", Date.now() + 10000), false);
  assert.equal(claimProof("key-b", "same-id", Date.now() + 10000), true);
  closeDb(); assert.equal(claimProof("key-a", "same-id", Date.now() + 10000), false);
});
test("metadata responses exclude ciphertext, policies, plaintext and credentials", () => {
  const rows = repo.listExams(100, 0);
  for (const row of rows) {
    assert.ok(!("ciphertext" in row)); assert.ok(!("plaintext" in row)); assert.ok(!("accessToken" in row));
  }
});
