// Local wire/authorization regression tests. These do NOT exercise a live Tide realm or ORK.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Models } from "@tideorg/js";
import { fixture } from "./fixtures";
import { verifyExamPolicy } from "../src/lib/tide/server/policy";
import { parseChangeRequest, governanceConfigured } from "../src/lib/tide/server/governance";
import { publicTideConfig } from "../src/lib/server/config";
import { handleApi } from "../src/lib/server/api";
import { buildExamPolicy } from "../src/lib/tide/browser/policy";

const f = await fixture(); after(f.cleanup);
const keys = generateKeyPairSync("ed25519"), examId = randomUUID(), vendorId = "LOCAL_FIXTURE_VENDOR_ONLY";
const original = JSON.parse(readFileSync(f.adapterPath, "utf8"));
const adapter = { ...original, vendorId, homeOrkUrl: "https://ork.invalid", credentials: { secret: "MUST_NOT_SERIALIZE" },
  "client-origin-auth-http://localhost:3000": "LOCAL_FIXTURE_ORIGIN_SIGNATURE_ONLY" };
adapter.jwk.keys.push(keys.publicKey.export({ format: "jwk" }));
writeFileSync(f.adapterPath, JSON.stringify(adapter));
function signed(purpose: "READ" | "WRITE", change?: (policy: Models.Policy) => void) {
  const p = buildExamPolicy(vendorId, examId, purpose); change?.(p);
  // Local generated signature over SDK serialization; never represented as a Tide signature.
  const serialized = p.toBytes();
  const layoutLength = new DataView(serialized.buffer, serialized.byteOffset).getInt32(4, true);
  p.signature = sign(null, serialized.subarray(8, 8 + layoutLength), keys.privateKey);
  return p.toBytes();
}
test("SDK policy constructor and server reader agree on vendor, operation, record and exact signed bytes", async () => {
  for (const purpose of ["WRITE", "READ"] as const) {
    const policy = await verifyExamPolicy({ examId, purpose, signedBytes: signed(purpose) });
    assert.equal(policy.subjectId, purpose === "WRITE" ? "author" : "invigilator");
    assert.deepEqual(policy.operationRoles, [purpose === "WRITE" ? "_tide_encryptor" : "_tide_decryptor"]);
    assert.equal(policy.assignmentId, examId);
  }
});
test("policy verifier rejects modified signature, wrong vendor/record/role/model, extra params, expiry and truncated bytes", async () => {
  const wrong = signed("READ"); wrong[wrong.length - 1] ^= 1;
  const cases = [wrong, signed("READ", p => { p.keyId = "other-vendor"; }),
    signed("READ", p => { p.params.entries.set("assignmentId", randomUUID()); }),
    signed("READ", p => { p.params.entries.set("roles", '["_tide_encryptor","_tide_decryptor"]'); }),
    signed("READ", p => { p.modelIds = ["PolicyEnabledDecryption:1"]; }),
    signed("READ", p => { p.params.entries.set("clientId", "unrelated-client"); }),
    signed("READ", p => { p.expiry = 1n; }), signed("READ").subarray(0, 40)];
  for (const bytes of cases) await assert.rejects(verifyExamPolicy({ examId, purpose: "READ", signedBytes: bytes }), /does not match/);
});
test("public provider config strips secret and unknown fields and refuses incomplete exports", () => {
  const config = publicTideConfig(); assert.ok(config);
  assert.equal(JSON.stringify(config).includes("MUST_NOT_SERIALIZE"), false);
  assert.equal(config.redirectUri, "http://localhost:3000/auth/redirect");
  assert.equal(Object.entries(config).find(([key]) => key === "client-origin-auth-http://localhost:3000")?.[1], "LOCAL_FIXTURE_ORIGIN_SIGNATURE_ONLY");
  writeFileSync(f.adapterPath, JSON.stringify(original));
  assert.equal(publicTideConfig(), null);
  writeFileSync(f.adapterPath, JSON.stringify(adapter));
});
test("real realm-management governor is recognized; an unrelated client role cannot grant governance", async () => {
  const claims = { realm_access: { roles: [] }, resource_access: { "realm-management": { roles: ["tide-realm-admin"] } } };
  const response = await handleApi(await f.request("/api/session", { claims }));
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(data.identity.realmRoles, []);
  assert.deepEqual(data.identity.clientRoles["realm-management"], ["tide-realm-admin"]);
  const denied = await handleApi(await f.request("/api/policies/ingest", { method: "POST", body: {},
    claims: { realm_access: { roles: ["teacher"] }, resource_access: { attacker: { roles: ["tide-realm-admin"] } } } }));
  assert.equal(denied.status, 403);
});
test("live CR parser preserves unknown counts, uses current status names, rejects duplicate voters and false commit", () => {
  const unknown = parseChangeRequest({ id: "cr", status: "PENDING" }, "cr");
  assert.equal(unknown.authorizationCount, null); assert.equal(unknown.threshold, null);
  const committed = parseChangeRequest({ id: "cr", status: "APPROVED", authorizationCount: 2, threshold: 2,
    authorizers: [{ username: "gov-1" }, { username: "gov-2" }] }, "cr");
  assert.equal(committed.status, "COMMITTED");
  assert.equal(parseChangeRequest({ id: "cr", status: "DENIED" }, "cr").status, "REJECTED");
  for (const raw of [{ id: "other", status: "PENDING" }, { id: "cr", status: "toString" },
    { id: "cr", status: "APPROVED", threshold: 2, authorizationCount: 1 },
    { id: "cr", status: "PENDING", authorizationCount: 2, authorizers: [{ username: "gov-1" }, { username: "gov-1" }] }]) {
    assert.throws(() => parseChangeRequest(raw, "cr"));
  }
});
test("governance stays unavailable without reviewed narrow credentials", () => {
  assert.equal(governanceConfigured(), false);
});
