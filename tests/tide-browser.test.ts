// SDK boundary tests use explicit stubs. They are not live encryption/authorization evidence.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { IAMService } from "@tidecloak/js";
import { createSdkAdapter } from "../src/lib/tide/browser/sdk-adapter";
import { fromBase64, toBase64 } from "../src/lib/tide/browser/encoding";
import type { PublicTideConfig } from "../src/lib/server/config";
import type { SignedPolicy } from "../src/lib/contracts";
const originalEncrypt = IAMService.doEncrypt, originalDecrypt = IAMService.doDecrypt;
after(() => { IAMService.doEncrypt = originalEncrypt; IAMService.doDecrypt = originalDecrypt; });
const adapter = createSdkAdapter({} as PublicTideConfig);
const examId = "00000000-0000-4000-8000-000000000001";
const makePolicy = (purpose: "WRITE" | "READ"): SignedPolicy => ({ examId, assignmentId: examId, purpose,
  id: examId, version: 1, digest: "LOCAL_STUB", signedBytesBase64: "AQID", contractId: "RelationshipAttestation:1",
  subjectType: "Role", subjectId: purpose === "WRITE" ? "author" : "invigilator",
  operationRoles: [purpose === "WRITE" ? "_tide_encryptor" : "_tide_decryptor"] });
test("policy encryption sends raw UTF-8 bytes with one exact record tag and full policy bytes", async () => {
  IAMService.doEncrypt = async (items, policy) => {
    assert.deepEqual(items, [{ data: new TextEncoder().encode("Đề giả"), tags: [examId] }]);
    assert.deepEqual(policy, new Uint8Array([1, 2, 3]));
    return [new Uint8Array([9, 8, 7])];
  };
  assert.equal(await adapter.encrypt({ examId, plaintext: "Đề giả", policy: makePolicy("WRITE") }), "CQgH");
  await assert.rejects(adapter.encrypt({ examId, plaintext: "x", policy: makePolicy("READ") }), /POLICY_NOT_READY/);
  await assert.rejects(adapter.encrypt({ examId, plaintext: "x".repeat(16385), policy: makePolicy("WRITE") }), /INVALID_PLAINTEXT_SIZE/);
});
test("decrypt only opens the actual byte result; ambiguous threshold failures contain no plaintext and are not called denials", async () => {
  IAMService.doDecrypt = async (items, policy) => {
    assert.deepEqual(items, [{ encrypted: new Uint8Array([9, 8, 7]), tags: [examId] }]);
    assert.deepEqual(policy, new Uint8Array([1, 2, 3]));
    return [new TextEncoder().encode("SYNTHETIC_STUB_ONLY")];
  };
  assert.deepEqual(await adapter.decrypt({ examId, ciphertextBase64: "CQgH", policy: makePolicy("READ") }), { status: "opened", plaintext: "SYNTHETIC_STUB_ONLY" });
  IAMService.doDecrypt = async () => { throw new Error("TIDE-TIDEJS-NET-THRESHOLD_FAILURE SENSITIVE_PAYLOAD"); };
  const result = await adapter.decrypt({ examId, ciphertextBase64: "CQgH", policy: makePolicy("READ") });
  assert.equal(result.status, "error"); assert.equal("plaintext" in result, false);
  assert.equal(JSON.stringify(result).includes("SENSITIVE_PAYLOAD"), false);
  const wrong = await adapter.decrypt({ examId: "different", ciphertextBase64: "CQgH", policy: makePolicy("READ") });
  assert.equal(wrong.status, "not_ready");
});
test("byte encoding is canonical and handles the maximum configured envelope without spreading a huge array", () => {
  const bytes = new Uint8Array(1024 * 1024).fill(254);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  for (const value of ["", "AQI", "AQJ=", "AQID\n"]) assert.throws(() => fromBase64(value));
});
