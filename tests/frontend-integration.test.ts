/** Browser transport uses local generated-key API fixtures. This is NOT live Tide evidence. */
import { after, afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Exam, SessionResponse, SignedPolicyRef, Role } from "../src/lib/contracts";
import { api, ClientApiError, mutation } from "../src/lib/client/api";
import { resumableExam, scheduleInput } from "../src/lib/client/exams";
import { configureBrowserTide, getBrowserTide, type BrowserTideAdapter } from "../src/lib/tide/browser/adapter";
import { handleApi } from "../src/lib/server/api";
import { fixture, fixturePolicies } from "./fixtures";

const f = await fixture(), disconnected = getBrowserTide();
let role: Role = "author", expired = false;
const unavailable = async (): Promise<never> => { throw Error("UNIT_TEST_HAS_NO_TIDE_CRYPTO"); };
const adapter: BrowserTideAdapter = { connected: true, login: unavailable, logout: async () => {}, encrypt: unavailable, decrypt: unavailable,
  async secureFetch(path, init) {
    const headers = Object.fromEntries(new Headers(init?.headers));
    return handleApi(await f.request(path, { role, method: init?.method ?? "GET", headers,
      ...(init?.body ? { body: JSON.parse(init.body as string) } : {}), ...(expired ? { claims: { exp: 1 } } : {}) }));
  }
};
beforeEach(() => { f.freshRun(); role = "author"; expired = false; configureBrowserTide(adapter); });
afterEach(() => { configureBrowserTide(disconnected); });
after(f.cleanup);
const input = { title: "Frontend integration fixture", advisoryReleaseAt: "2026-10-23T02:00:00Z" };

test("browser transport reads the full latest session contract and missing Tide dependencies", async () => {
  const session = await api<SessionResponse>("/api/session");
  assert.equal(session.identity.subject, "author"); assert.deepEqual(session.identity.realmRoles, ["author"]);
  assert.equal(session.readiness.tide, "not_ready"); assert.ok(session.readiness.missing.includes("tide_sdk"));
  assert.ok(session.activeRunId); assert.equal(session.capabilities.deny, "not_ready");
});
test("upload can resume a prepared paper instead of creating a second exam in the active run", async () => {
  const session = await api<SessionResponse>("/api/session"), key = randomUUID();
  const first = await api<{ exam: Exam }>("/api/exams/prepare", mutation(input, key));
  const list = await api<{ exams: Exam[] }>("/api/exams");
  assert.equal(resumableExam(list.exams, session.identity)?.id, first.exam.id);
  assert.equal(resumableExam([], session.identity), null);
  assert.throws(() => resumableExam(list.exams, { ...session.identity, issuer: "https://other.invalid" }), /RUN_OWNED_BY_ANOTHER_AUTHOR/);
  assert.equal(scheduleInput(first.exam.advisoryReleaseAt), "2026-10-23T09:00");
});
test("Headers-based idempotency survives the client wrapper and prevents duplicate prepare", async () => {
  const key = randomUUID(), request = mutation(input, key);
  const first = await api<{ exam: Exam }>("/api/exams/prepare", { ...request, headers: new Headers(request.headers) });
  const retry = await api<{ exam: Exam }>("/api/exams/prepare", { ...request, headers: new Headers(request.headers) });
  assert.equal(first.exam.id, retry.exam.id);
});
test("frontend seal/policy/ciphertext response shapes match the latest backend", async () => {
  const { exam } = await api<{ exam: Exam }>("/api/exams/prepare", mutation(input, randomUUID()));
  const policies = fixturePolicies(exam.id), bytes = randomBytes(20000);
  const policy = await api<{ policy: SignedPolicyRef }>(`/api/exams/${exam.id}/policy?purpose=WRITE`);
  assert.equal(policy.policy.policyId, policies.write.id);
  const sealed = await api<{ exam: Exam }>(`/api/exams/${exam.id}/seal`, mutation({ ciphertextBase64: bytes.toString("base64"),
    writePolicyId: policy.policy.id, contentType: "text/plain;charset=utf-8", expectedVersion: 1 }, randomUUID()));
  assert.equal(sealed.exam.state, "SEALED");
  role = "teacher";
  const stored = await api<{ ciphertextBase64: string; byteLength: number }>(`/api/exams/${exam.id}/ciphertext`);
  assert.deepEqual(Buffer.from(stored.ciphertextBase64, "base64"), bytes); assert.equal(stored.byteLength, bytes.length);
});
test("401 invalidates the browser session; a role-based 403 does not", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window"), events = new EventTarget();
  let invalidations = 0; events.addEventListener("vault:session-invalidated", () => { invalidations++; });
  Object.defineProperty(globalThis, "window", { configurable: true, value: events });
  try {
    role = "teacher";
    await assert.rejects(api("/api/exams/prepare", mutation(input, randomUUID())), (e: unknown) => e instanceof ClientApiError && e.status === 403);
    assert.equal(invalidations, 0);
    expired = true;
    await assert.rejects(api("/api/session"), (e: unknown) => e instanceof ClientApiError && e.status === 401);
    assert.equal(invalidations, 1);
  } finally { if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window"); }
});
