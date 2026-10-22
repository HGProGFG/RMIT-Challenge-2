import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { handleApi } from "../src/lib/server/api";
import { fixture, fixturePolicies } from "./fixtures";
import { prepareExam } from "../src/lib/db/repository";

const f = await fixture();
after(f.cleanup);
const input = { title: "Synthetic paper", advisoryReleaseAt: "2026-10-23T02:00:00Z" };
test("every implemented API fails closed without a session and uses no-store error envelope", async () => {
  for (const path of ["/session", "/exams", "/exams/prepare", "/activity", "/governance/requests", "/demo/display-role"]) {
    const response = await handleApi(new Request(`${f.origin}/api${path}`));
    assert.equal(response.status, 401); assert.match(response.headers.get("cache-control")!, /no-store/);
    const body = await response.json(); assert.equal(typeof body.error.correlationId, "string");
  }
});
test("session reports real local verification and explicit missing integrations", async () => {
  const response = await handleApi(await f.request("/api/session", { role: "teacher" }));
  assert.equal(response.status, 200);
  const { data } = await response.json(); assert.equal(data.identity.subject, "teacher");
  assert.equal(data.readiness.policy, "not_ready"); assert.equal(data.readiness.governance, "not_ready");
});
test("strict prepare input excludes plaintext, caller roles and unknown fields", async () => {
  for (const extra of [{ plaintext: "DO_NOT_STORE_ME" }, { actor: "app-admin" }, { roles: ["author"] }]) {
    const response = await handleApi(await f.request("/api/exams/prepare", { method: "POST", body: { ...input, ...extra } }));
    assert.equal(response.status, 422);
  }
});
test("rejects unauthorized author actions, cross-origin mutation and missing idempotency", async () => {
  const cases: Array<{ role?: "teacher"; headers?: Record<string, string> }> = [
    { role: "teacher" }, { headers: { origin: "https://evil.invalid" } }, { headers: { "idempotency-key": "" } }
  ];
  for (const opts of cases) {
    const response = await handleApi(await f.request("/api/exams/prepare", { method: "POST", body: input, ...opts }));
    assert.equal(response.status, "role" in opts || opts.headers?.origin ? 403 : 422);
  }
});
test("prepare → seal → read returns exact persisted bytes to teacher/admin", async () => {
  const prepared = await handleApi(await f.request("/api/exams/prepare", { method: "POST", body: input }));
  assert.equal(prepared.status, 201); const { data } = await prepared.json(), examId = data.exam.id;
  const policies = fixturePolicies(examId), bytes = randomBytes(20000);
  const sealed = await handleApi(await f.request(`/api/exams/${examId}/seal`, { method: "POST", body: {
    ciphertextBase64: bytes.toString("base64"), writePolicyId: policies.write.id, contentType: "text/plain;charset=utf-8", expectedVersion: 1
  } }));
  assert.equal(sealed.status, 200);
  for (const role of ["teacher", "app-admin"] as const) {
    const read = await handleApi(await f.request(`/api/exams/${examId}/ciphertext`, { role }));
    assert.equal(read.status, 200); assert.deepEqual(Buffer.from((await read.json()).data.ciphertextBase64, "base64"), bytes);
  }
  const proposal = await handleApi(await f.request(`/api/exams/${examId}/access-requests`, { role: "app-admin", method: "POST", body: { kind: "SELF_ACCESS" } }));
  assert.equal(proposal.status, 503); assert.equal((await proposal.json()).error.code, "NOT_READY");
});
test("unsigned policy ingest is unavailable; no pending governance requests are fabricated", async () => {
  const exam = prepareExam(f.actor("author"), input, randomUUID(), randomUUID());
  const response = await handleApi(await f.request(`/api/exams/${exam.id}/policies`, { role: "tide-realm-admin", method: "POST",
    body: { purpose: "READ", signedBytesBase64: Buffer.from("unsigned-policy").toString("base64") } }));
  assert.equal(response.status, 503);
  const governance = await handleApi(await f.request("/api/governance/requests", { role: "app-admin" }));
  assert.equal(governance.status, 503); assert.ok(!("data" in await governance.json()));
});
test("rejects invalid base64, excessive ciphertext and unknown pagination", async () => {
  const exam = prepareExam(f.actor("author"), input, randomUUID(), randomUUID()), policies = fixturePolicies(exam.id);
  for (const [ciphertextBase64, status] of [["!!!!", 422], [randomBytes(131073).toString("base64"), 413]] as const) {
    const response = await handleApi(await f.request(`/api/exams/${exam.id}/seal`, { method: "POST", body: {
      ciphertextBase64, writePolicyId: policies.write.id, contentType: "text/plain;charset=utf-8", expectedVersion: 1
    } })); assert.equal(response.status, status);
  }
  assert.equal((await handleApi(await f.request("/api/activity?limit=NaN"))).status, 422);
});
test("streaming body bound does not rely on Content-Length", async () => {
  const response = await handleApi(await f.request("/api/exams/prepare", { method: "POST", body: { ...input, title: "x".repeat(25000) } }));
  assert.equal(response.status, 413);
});
test("client observations have fixed source and never accept arbitrary text", async () => {
  const exam = prepareExam(f.actor("author"), input, randomUUID(), randomUUID());
  const body = { examId: exam.id, kind: "DECRYPT_ATTEMPT", outcome: "opened", code: "SDK_OPENED", correlationId: randomUUID() };
  const response = await handleApi(await f.request("/api/activity/client-observations", { method: "POST", body }));
  assert.equal(response.status, 201); assert.equal((await response.json()).data.source, "CLIENT_REPORTED");
  const bad = await handleApi(await f.request("/api/activity/client-observations", { method: "POST", body: { ...body, plaintext: "forbidden" } }));
  assert.equal(bad.status, 422);
});
test("display override is restricted to demo admin and absent in production", async () => {
  const exam = prepareExam(f.actor("author"), input, randomUUID(), randomUUID());
  const req = () => f.request("/api/demo/display-role", { role: "app-admin", method: "PUT", body: { runId: exam.runId, displayRole: "invigilator" } });
  const result = await handleApi(await req());
  assert.equal(result.status, 200); assert.equal((await result.json()).data.authorityChanged, false);
  process.env.DEMO_ATTACKS_ENABLED = "false";
  try { assert.equal((await handleApi(await req())).status, 404); }
  finally { process.env.DEMO_ATTACKS_ENABLED = "true"; }
});
