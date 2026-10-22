import { after, test } from "node:test";
import assert from "node:assert/strict";
import { authenticate } from "../src/lib/server/auth";
import { closeDb, db } from "../src/lib/db";
import { fixture } from "./fixtures";

const f = await fixture();
after(f.cleanup);
test("accepts a signed bound session and a fresh proof; query is excluded from htu", async () => {
  const actor = await authenticate(await f.request("/api/exams?limit=1"));
  assert.equal(actor.subject, "author"); assert.deepEqual(actor.roles, ["author"]);
});
test("rejects a stolen token sent as Bearer", async () => {
  const req = await f.request("/api/session");
  req.headers.set("authorization", `Bearer ${await f.token()}`);
  await assert.rejects(authenticate(req), { status: 401 });
});
test("rejects missing proof and unbound access token", async () => {
  const req = await f.request("/api/session"); req.headers.delete("dpop");
  await assert.rejects(authenticate(req), { status: 401 });
  await assert.rejects(authenticate(await f.request("/api/session", { claims: { cnf: {} } })), { status: 401 });
});
test("rejects expired, wrong issuer/client and future issued credentials", async () => {
  for (const claims of [{ exp: 1 }, { iss: "https://wrong.invalid" }, { azp: "other-client" },
    { iat: Math.floor(Date.now() / 1000) + 60 }]) {
    await assert.rejects(authenticate(await f.request("/api/session", { claims })), { status: 401 });
  }
});
test("rejects a forged access-token payload and missing expiry", async () => {
  const parts = (await f.token()).split(".");
  parts[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], "base64url").toString()), sub: "app-admin" })).toString("base64url");
  await assert.rejects(authenticate(await f.request("/api/session", { token: parts.join(".") })), { status: 401 });
  await assert.rejects(authenticate(await f.request("/api/session", { claims: { exp: undefined } })), { status: 401 });
});
test("rejects wrong method, URL, token hash, key binding, stale proof and malformed type", async () => {
  for (const proof of [{ htm: "POST" }, { htu: "https://attacker.invalid/api/session" },
    { ath: "wrong" }, { iat: 1 }, { iat: "123" }, { jti: "" }]) {
    await assert.rejects(authenticate(await f.request("/api/session", { proof })), { status: 401 });
  }
  await assert.rejects(authenticate(await f.request("/api/session", { claims: { cnf: { jkt: "wrong" } } })), { status: 401 });
  await assert.rejects(authenticate(await f.request("/api/session", { proofHeader: { typ: "JWT" } })), { status: 401 });
});
test("rejects proof header containing private key material", async () => {
  await assert.rejects(authenticate(await f.request("/api/session", { proofHeader: { jwk: { kty: "EC", crv: "P-256", d: "private" } } })), { status: 401 });
});
test("rejects duplicate proof across concurrent requests and a database restart", async () => {
  const req = await f.request("/api/session");
  const outcomes = await Promise.allSettled([authenticate(req.clone()), authenticate(req.clone())]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  closeDb();
  await assert.rejects(authenticate(req.clone()), { status: 401 });
});
test("namespaces replay keys by thumbprint and retains future-dated proofs for both windows", async () => {
  const req = await f.request("/api/session", { proof: { iat: Math.floor(Date.now() / 1000) + 115, jti: "future-proof" } });
  await authenticate(req);
  const row = db().prepare("SELECT expiresAt FROM DpopReplay WHERE jti='future-proof'").get() as { expiresAt: number };
  assert.ok(row.expiresAt > Date.now() + 235000);
  await assert.rejects(authenticate(req.clone()), { status: 401 });
});
test("does not trust forwarded host or roles from an unrelated client", async () => {
  await assert.rejects(authenticate(await f.request("/api/session", {
    proof: { htu: "https://evil.invalid/api/session" }, headers: { "x-forwarded-host": "evil.invalid", "x-forwarded-proto": "https" }
  })), { status: 401 });
  await assert.rejects(authenticate(await f.request("/api/session", { claims: {
    realm_access: { roles: [] }, resource_access: { other: { roles: ["app-admin"] } }
  } })), { status: 403 });
});
test("missing pinned keys fails closed without fetching remote JWKS", async () => {
  process.env.TIDECLOAK_ADAPTER_PATH = "missing-adapter.json";
  try { await assert.rejects(authenticate(await f.request("/api/session")), { status: 503, code: "AUTH_NOT_READY" }); }
  finally { process.env.TIDECLOAK_ADAPTER_PATH = f.adapterPath; }
});
test("replay-store failure blocks even a correctly signed session/proof", async () => {
  db().exec("ALTER TABLE DpopReplay RENAME TO ReplayTemporarilyUnavailable");
  try { await assert.rejects(authenticate(await f.request("/api/session")), { status: 503, code: "REPLAY_STORE_UNAVAILABLE" }); }
  finally { db().exec("ALTER TABLE ReplayTemporarilyUnavailable RENAME TO DpopReplay"); }
});
