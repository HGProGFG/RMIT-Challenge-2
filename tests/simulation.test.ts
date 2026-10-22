import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Exam, GovernanceObservation, SignedPolicy } from "../src/lib/contracts";
import { createSimulationAdapter } from "../src/lib/simulation/browser";
import { closeSimulationDb, handleSimulationApi } from "../src/lib/simulation/server";
import { simulationEnabled } from "../src/lib/simulation/mode";

const dir = mkdtempSync(join(tmpdir(), "sealed-simulation-"));
process.env.TIDE_SIMULATION = "true";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.SIMULATION_DATABASE_PATH = join(dir, "simulation.sqlite");
after(() => { closeSimulationDb(); rmSync(dir, { recursive: true, force: true }); });
let cookie = "";
async function call(path: string, method = "GET", body?: unknown, extra: Record<string, string> = {}) {
  const headers = new Headers({ Origin: "http://localhost:3000", Cookie: cookie, ...extra });
  if (method !== "GET" && !headers.has("x-sealed-demo-csrf")) {
    const bootstrap = await handleSimulationApi(new Request("http://localhost:3000/api/simulation/bootstrap"));
    if (bootstrap.ok) headers.set("X-Sealed-Demo-CSRF", (await bootstrap.json()).data.csrfToken);
  }
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await handleSimulationApi(new Request(`http://localhost:3000${path}`, { method, headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
  const setCookie = response.headers.get("set-cookie"); if (setCookie) cookie = setCookie.split(";")[0];
  return response;
}
async function data<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await call(path, method, body, { "Idempotency-Key": randomUUID() });
  assert.ok(response.ok, `${path}: ${response.status} ${await response.clone().text()}`);
  return (await response.json()).data as T;
}
async function login(participant: string) { await data("/api/simulation/login", "POST", { participant }); }

test("Plan C is the default, loopback-only and uses separate authenticated local sessions", async () => {
  assert.equal((await call("/api/session")).status, 401);
  process.env.TIDE_SIMULATION = "false";
  assert.equal(simulationEnabled(), true);
  process.env.TIDE_SIMULATION = "true"; process.env.APP_ORIGIN = "https://public.example";
  assert.equal(simulationEnabled(), false);
  process.env.APP_ORIGIN = "http://localhost:3000";
  const untrusted = await handleSimulationApi(new Request("http://localhost:3000/api/simulation/login", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ participant: "author" }) }));
  assert.equal(untrusted.status, 403);
  assert.equal(untrusted.headers.has("Access-Control-Allow-Origin"), false);
  assert.equal((await call("/api/simulation/login", "POST", { participant: "author" }, { "x-sealed-demo-csrf": "forged" })).status, 403);
  const embedded = await call("/api/simulation/login", "POST", { participant: "author" }, { Origin: "null", "Sec-Fetch-Site": "cross-site" });
  assert.equal(embedded.status, 200, "a bootstrapped embedded preview must be able to select the author");
  assert.equal((await call("/api/simulation/login", "POST", { participant: "super-admin" })).status, 422);
  const response = await call("/api/simulation/login", "POST", { participant: "teacher" });
  assert.match(response.headers.get("set-cookie")!, /HttpOnly; SameSite=Strict/);
  assert.equal(response.headers.get("X-Sealed-Mode"), "LOCAL_SIMULATION");
  assert.equal((await call("/api/exams/prepare", "POST", { title: "not allowed", advisoryReleaseAt: new Date().toISOString() })).status, 403);
  const valid = cookie; cookie = "sealed_simulation=governor-1";
  assert.equal((await call("/api/session", "GET", undefined, { Authorization: "Bearer forged", "X-Role": "tide-realm-admin" })).status, 401);
  cookie = valid;
});

test("local browser crypto + server simulation completes sealing, denials, distinct votes and opening", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "http://localhost:3000" } } });
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const request = new Request(String(url), init), headers = new Headers(request.headers);
    headers.set("Origin", "null"); headers.set("Sec-Fetch-Site", "cross-site"); headers.set("Cookie", cookie);
    const response = await handleSimulationApi(new Request(request, { headers }));
    if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie")!.split(";")[0];
    return response;
  }) as typeof fetch;
  try {
    const adapter = createSimulationAdapter();
    await adapter.login("author");
    const input = { title: "Synthetic release ceremony", advisoryReleaseAt: "2026-10-23T02:00:00Z" }, idem = randomUUID();
    const first = await call("/api/exams/prepare", "POST", input, { "Idempotency-Key": idem });
    const { exam } = (await first.json()).data as { exam: Exam };
    const retry = await call("/api/exams/prepare", "POST", input, { "Idempotency-Key": idem });
    assert.equal((await retry.json()).data.exam.id, exam.id);
    assert.equal((await call("/api/exams/prepare", "POST", { ...input, title: "different" }, { "Idempotency-Key": idem })).status, 409);
    const write = (await data<{ policy: SignedPolicy }>(`/api/exams/${exam.id}/policy?purpose=WRITE`)).policy;
    const read = (await data<{ policy: SignedPolicy }>(`/api/exams/${exam.id}/policy?purpose=READ`)).policy;
    assert.equal(write.simulation, true);
    const plaintext = "SYNTHETIC EXAM — 1. Explain independent approval.\nĐề thi thử nghiệm.";
    const ciphertext = await adapter.encrypt({ examId: exam.id, plaintext, policy: write });
    assert.ok(!Buffer.from(ciphertext, "base64").toString("utf8").includes(plaintext));
    assert.equal((await call(`/api/exams/${exam.id}/simulation-key`, "POST", { purpose: "WRITE", policyId: write.id, tags: [randomUUID()] })).status, 403);
    assert.equal((await call(`/api/exams/${exam.id}/simulation-key`, "POST", { purpose: "WRITE", policyId: write.id, tags: [exam.id, "extra"] })).status, 422);
    const sealed = await data<{ exam: Exam }>(`/api/exams/${exam.id}/seal`, "POST", { ciphertextBase64: ciphertext, writePolicyId: write.id, expectedVersion: 1, contentType: "text/plain;charset=utf-8" });
    assert.equal(sealed.exam.state, "SEALED");
    assert.equal((await call(`/api/exams/${exam.id}/seal`, "POST", { ciphertextBase64: ciphertext, writePolicyId: write.id, expectedVersion: 1, contentType: "text/plain;charset=utf-8" }, { "Idempotency-Key": randomUUID() })).status, 409);
    const open = () => adapter.decrypt({ examId: exam.id, ciphertextBase64: ciphertext, policy: read });
    await adapter.login("teacher"); assert.equal((await open()).status, "denied");
    await adapter.login("app-admin"); assert.equal((await open()).status, "denied");
    const session = await data<{ activeRunId: string; mode: string }>("/api/session"); assert.equal(session.mode, "LOCAL_SIMULATION");
    await data("/api/demo/display-role", "PUT", { runId: session.activeRunId, displayRole: "invigilator" });
    assert.equal((await open()).status, "denied");
    const self = await data<{ observation: GovernanceObservation }>(`/api/exams/${exam.id}/access-requests`, "POST", { kind: "SELF_ACCESS" });
    const selfId = self.observation.changeRequestIds[0]; assert.equal(self.observation.source, "SIMULATION");
    await adapter.login("tide-realm-admin", "governor-1");
    assert.equal((await call(`/api/governance/requests/${selfId}/approve`, "POST", { changeRequestId: selfId })).status, 403);
    await data(`/api/governance/requests/${selfId}/deny`, "POST", { changeRequestId: selfId });
    await adapter.login("invigilator"); assert.equal((await open()).status, "denied");
    const release = await data<{ observation: GovernanceObservation }>(`/api/exams/${exam.id}/access-requests`, "POST", { kind: "INVIGILATOR_RELEASE" });
    const id = release.observation.changeRequestIds[0];
    assert.equal((await call(`/api/governance/requests/${id}/approve`, "POST", { changeRequestId: id })).status, 403);
    await adapter.login("tide-realm-admin", "governor-1");
    const one = await data<{ observation: GovernanceObservation }>(`/api/governance/requests/${id}/approve`, "POST", { changeRequestId: id });
    assert.equal(one.observation.requests[0].authorizationCount, 1); assert.equal(one.observation.requests[0].status, "PENDING");
    assert.equal((await call(`/api/governance/requests/${id}/approve`, "POST", { changeRequestId: id })).status, 409);
    await adapter.login("invigilator"); assert.equal((await open()).status, "denied");
    await adapter.login("tide-realm-admin", "governor-2");
    const two = await data<{ observation: GovernanceObservation }>(`/api/governance/requests/${id}/approve`, "POST", { changeRequestId: id });
    assert.equal(two.observation.requests[0].status, "COMMITTED"); assert.equal(two.observation.requests[0].authorizationCount, 2);
    assert.equal((await call(`/api/governance/requests/${id}/deny`, "POST", { changeRequestId: id })).status, 409);
    await adapter.login("invigilator");
    closeSimulationDb(); // State, votes, sessions and ciphertext survive a local server restart.
    assert.deepEqual(await open(), { status: "opened", plaintext });
    const damaged = JSON.parse(Buffer.from(ciphertext, "base64").toString("utf8")); const bytes = Buffer.from(damaged.data, "base64"); bytes[0] ^= 1; damaged.data = bytes.toString("base64");
    assert.equal((await adapter.decrypt({ examId: exam.id, policy: read, ciphertextBase64: Buffer.from(JSON.stringify(damaged)).toString("base64") })).status, "error");
    for (const role of ["teacher", "app-admin", "author"] as const) { await adapter.login(role); assert.equal((await open()).status, "denied"); }
    const events = await data<{ events: { source: string; kind: string }[] }>("/api/activity");
    assert.ok(events.events.every(e => e.source === "SIMULATION")); assert.ok(events.events.some(e => e.kind === "RELEASE_COMMITTED"));
    assert.ok(!readFileSync(process.env.SIMULATION_DATABASE_PATH!).includes(Buffer.from(plaintext)));
    const revokedCookie = cookie; await adapter.logout(); cookie = revokedCookie;
    assert.equal((await call("/api/session")).status, 401);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
  }
});
