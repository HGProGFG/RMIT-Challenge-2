/** Adapter test doubles test validation only. No real Tide CR or approval is created. */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { fixture, fixturePolicies } from "./fixtures";
import { handleApi } from "../src/lib/server/api";
import { tideIntegration } from "../src/lib/server/tide-integration";
import { AppError } from "../src/lib/server/errors";
import * as repo from "../src/lib/db/repository";
import type { GovernanceObservation } from "../src/lib/contracts";

const f = await fixture(), original = { ...tideIntegration };
after(f.cleanup);
function sealedExam() {
  f.freshRun();
  const actor = f.actor("author"), exam = repo.prepareExam(actor, { title: "Unit governance fixture", advisoryReleaseAt: "2026-10-23T02:00:00Z" }, randomUUID(), randomUUID());
  const policies = fixturePolicies(exam.id);
  return repo.sealExam(actor, exam.id, randomBytes(40), policies.write.id, 1, randomUUID(), randomUUID());
}
const observed = (): GovernanceObservation => ({ changeRequestIds: ["UNIT-CR-1", "UNIT-CR-2"], requests: ["UNIT-CR-1", "UNIT-CR-2"].map(changeRequestId => ({
  changeRequestId, status: "PENDING", authorizationCount: 1, threshold: 2, authorizers: ["UNIT-GOVERNOR-1"]
})), source: "TIDE", observedAt: new Date().toISOString() });
async function withBridge(fn: () => Promise<void>) {
  tideIntegration.governanceReadiness = "ready";
  try { await fn(); } finally { Object.assign(tideIntegration, original); }
}
test("proposals keep real adapter IDs and separate counts, with stable idempotency", async () => withBridge(async () => {
  let calls = 0;
  tideIntegration.proposeAccess = async input => {
    calls++; assert.equal(input.target.subject, "app-admin"); assert.deepEqual(input.roles, ["invigilator", "_tide_decryptor"]);
    return observed();
  };
  const exam = sealedExam(), key = randomUUID();
  for (let i = 0; i < 2; i++) {
    const response = await handleApi(await f.request(`/api/exams/${exam.id}/access-requests`, { role: "app-admin", method: "POST",
      headers: { "idempotency-key": key }, body: { kind: "SELF_ACCESS" } }));
    assert.equal(response.status, 202); const { data } = await response.json();
    assert.equal(data.observation.requests.length, 2); assert.equal(data.observation.requests[0].authorizationCount, 1);
    assert.equal(data.observation.requests[0].status, "PENDING");
  }
  assert.equal(calls, 1);
  assert.equal(repo.governanceLinks(f.actor("app-admin")).length, 1);
  assert.equal(repo.governanceLinks(f.actor("app-admin", "other-admin")).length, 0);
}));
test("an uncertain upstream proposal cannot be repeated blindly", async () => withBridge(async () => {
  let calls = 0;
  tideIntegration.proposeAccess = async () => { calls++; throw new AppError(503, "UPSTREAM_UNAVAILABLE", "Unit failure"); };
  const exam = sealedExam(), key = randomUUID();
  for (let i = 0; i < 2; i++) {
    const response = await handleApi(await f.request(`/api/exams/${exam.id}/access-requests`, { role: "app-admin", method: "POST",
      headers: { "idempotency-key": key }, body: { kind: "SELF_ACCESS" } }));
    assert.equal(response.status, 503);
    if (i) assert.equal((await response.json()).error.code, "PROPOSAL_UNCERTAIN");
  }
  assert.equal(calls, 1);
}));
test("inconsistent committed counts, duplicate voters and stale observations are rejected", async () => withBridge(async () => {
  for (const change of ["under-threshold", "duplicate-voter", "stale"] as const) {
    tideIntegration.proposeAccess = async () => {
      const data = observed();
      if (change === "under-threshold") data.requests[0].status = "COMMITTED";
      if (change === "duplicate-voter") data.requests[0].authorizers = ["same", "same"];
      if (change === "stale") data.observedAt = "2020-01-01T00:00:00Z";
      return data;
    };
    const exam = sealedExam(), response = await handleApi(await f.request(`/api/exams/${exam.id}/access-requests`, {
      role: "app-admin", method: "POST", body: { kind: "SELF_ACCESS" }
    })); assert.equal(response.status, 503);
  }
}));
test("release targets fixed recipient and requires the designated invigilator", async () => withBridge(async () => {
  process.env.INVIGILATOR_ISSUER = f.issuer; process.env.INVIGILATOR_SUBJECT = "designated";
  const exam = sealedExam();
  const denied = await handleApi(await f.request(`/api/exams/${exam.id}/access-requests`, { role: "invigilator", method: "POST", body: { kind: "INVIGILATOR_RELEASE" } }));
  assert.equal(denied.status, 403);
  tideIntegration.proposeAccess = async input => { assert.equal(input.target.subject, "designated"); assert.deepEqual(input.roles, ["_tide_decryptor"]); return observed(); };
  const allowed = await handleApi(await f.request(`/api/exams/${exam.id}/access-requests`, { role: "tide-realm-admin", method: "POST", body: { kind: "INVIGILATOR_RELEASE" } }));
  assert.equal(allowed.status, 202);
}));
async function seedRequest() {
  const exam = sealedExam(); tideIntegration.proposeAccess = async () => observed();
  const response = await handleApi(await f.request(`/api/exams/${exam.id}/access-requests`, { role: "app-admin", method: "POST", body: { kind: "SELF_ACCESS" } }));
  assert.equal(response.status, 202); return (await response.json()).data.id as string;
}
const deny = async (id: string, changeRequestId = "UNIT-CR-1", role: "tide-realm-admin" | "app-admin" = "tide-realm-admin") =>
  handleApi(await f.request(`/api/governance/requests/${id}/deny`, { role, method: "POST", body: { changeRequestId } }));
test("deny checks live pending state, acts as the governor and refetches authoritative rejection", async () => withBridge(async () => {
  const id = await seedRequest(), steps: string[] = []; let rejected = false;
  tideIntegration.denyReadiness = "ready";
  tideIntegration.observeRequests = async () => { steps.push("observe"); const data = observed(); if (rejected) data.requests[0].status = "REJECTED"; return data; };
  tideIntegration.denyChangeRequest = async input => { steps.push("deny"); assert.equal(input.actor.subject, "tide-realm-admin"); assert.equal(input.expectedStatus, "PENDING"); rejected = true; };
  const response = await deny(id); assert.equal(response.status, 200);
  assert.deepEqual(steps, ["observe", "deny", "observe"]);
  assert.equal((await response.json()).data.observation.requests[0].status, "REJECTED");
  assert.equal(repo.getGovernanceLink(id).stale, false);
}));
test("deny never turns a committed grant into revocation", async () => withBridge(async () => {
  const id = await seedRequest(); let calls = 0; tideIntegration.denyReadiness = "ready";
  tideIntegration.observeRequests = async () => { const data = observed(); data.requests[0] = { ...data.requests[0], status: "COMMITTED", authorizationCount: 2, authorizers: ["g1", "g2"] }; return data; };
  tideIntegration.denyChangeRequest = async () => { calls++; };
  const response = await deny(id); assert.equal(response.status, 409); assert.equal(calls, 0);
}));
test("deny fails closed for missing adapter, wrong role, unrelated CR and stale observations", async () => withBridge(async () => {
  const id = await seedRequest(); let calls = 0;
  tideIntegration.denyChangeRequest = async () => { calls++; };
  assert.equal((await deny(id)).status, 503);
  tideIntegration.denyReadiness = "ready";
  assert.equal((await deny(id, "UNIT-CR-1", "app-admin")).status, 403);
  assert.equal((await deny(id, "UNRELATED-CR")).status, 422);
  tideIntegration.observeRequests = async () => ({ ...observed(), observedAt: "2020-01-01T00:00:00Z" });
  assert.equal((await deny(id)).status, 503); assert.equal(calls, 0);
}));
test("a deny race surfaces conflict and unconfirmed upstream result cannot become success", async () => withBridge(async () => {
  const id = await seedRequest(); tideIntegration.denyReadiness = "ready";
  tideIntegration.observeRequests = async () => observed();
  tideIntegration.denyChangeRequest = async () => { throw new AppError(409, "REQUEST_NOT_PENDING", "Unit race"); };
  assert.equal((await deny(id)).status, 409);
  tideIntegration.denyChangeRequest = async () => {};
  const response = await deny(id); assert.equal(response.status, 503); assert.equal((await response.json()).error.code, "DENIAL_UNCONFIRMED");
  assert.ok(!repo.activity(undefined, 100, 0).some(e => e.kind === "ACCESS_REQUEST_REJECTION_OBSERVED"));
}));
test("inactive run's governance links are invisible and cannot be rejected", async () => withBridge(async () => {
  const id = await seedRequest(); f.freshRun(); tideIntegration.denyReadiness = "ready";
  assert.equal(repo.governanceLinks(f.actor("tide-realm-admin")).length, 0);
  assert.equal((await deny(id)).status, 404);
}));
