import test from "node:test";
import assert from "node:assert/strict";
import { getBrowserTide } from "../src/lib/tide/browser/adapter";
import { api, ClientApiError, mutation, safeError } from "../src/lib/client/api";

test("unconnected browser cannot authenticate, encrypt, decrypt or make authenticated requests", async () => {
  const adapter = getBrowserTide();
  assert.equal(adapter.connected, false);
  await assert.rejects(() => adapter.login("app-admin"), /TIDE_NOT_READY/);
  await assert.rejects(() => adapter.secureFetch("/api/session"), /TIDE_NOT_READY/);
  await assert.rejects(() => adapter.encrypt({ examId: "synthetic", plaintext: "SYNTHETIC ONLY", policy: {} as never }), /TIDE_NOT_READY/);
  await assert.rejects(() => adapter.decrypt({ examId: "synthetic", ciphertextBase64: "AAAA", policy: {} as never }), /TIDE_NOT_READY/);
  await assert.rejects(() => api("/api/exams"), (error: unknown) => error instanceof ClientApiError && error.code === "TIDE_NOT_READY");
});
test("unknown SDK errors cannot leak exception contents into the interface", () => {
  const secret = "sensitive SDK payload that must not reach the UI";
  assert.equal(safeError(new Error(secret)).includes(secret), false);
  assert.match(safeError(new Error(secret)), /could not be verified/);
  assert.match(safeError(new ClientApiError("POLICY_NOT_READY", "Policy not ready.", "synthetic-reference")), /synthetic-reference/);
});
test("mutation retries preserve caller idempotency without adding plaintext or credentials", () => {
  const first = mutation({ kind: "SELF_ACCESS" }, "synthetic-stable-key");
  const retry = mutation({ kind: "SELF_ACCESS" }, "synthetic-stable-key");
  assert.deepEqual(first, retry);
  assert.deepEqual(JSON.parse(first.body as string), { kind: "SELF_ACCESS" });
  assert.deepEqual(first.headers, { "Idempotency-Key": "synthetic-stable-key" });
});
