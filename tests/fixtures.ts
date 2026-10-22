/** Local generated keys and synthetic policies test application behavior only, never Tide acceptance. */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT } from "jose";
import { closeDb } from "../src/lib/db/index";
import { insertPolicy } from "../src/lib/db/repository";
import type { Identity, Role } from "../src/lib/contracts";

export async function fixture() {
  const parent = resolve(".."), directory = mkdtempSync(resolve(parent, "test-run-"));
  const realm = await generateKeyPair("EdDSA"), client = await generateKeyPair("ES256");
  const realmJwk = { ...await exportJWK(realm.publicKey), kid: "unit-realm", alg: "EdDSA" };
  const clientJwk = await exportJWK(client.publicKey), thumbprint = await calculateJwkThumbprint(clientJwk);
  const issuer = "https://tide-unit.invalid/realms/exam", origin = "http://localhost:3000";
  const adapterPath = resolve(directory, "adapter.json");
  writeFileSync(adapterPath, JSON.stringify({ realm: "exam", resource: "vault", "auth-server-url": "https://tide-unit.invalid", jwk: { keys: [realmJwk] } }));
  process.env.DATABASE_PATH = resolve(directory, "vault.sqlite");
  process.env.TIDECLOAK_ADAPTER_PATH = adapterPath;
  process.env.APP_ORIGIN = origin;
  process.env.MAX_CIPHERTEXT_BYTES = "131072";
  process.env.DEMO_ATTACKS_ENABLED = "true";
  const actor = (role: Role, subject: string = role): Identity => ({ issuer, subject, alias: subject, roles: [role] });
  async function token(role: Role = "author", overrides: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ iss: issuer, sub: role, azp: "vault", exp: now + 600, iat: now,
      cnf: { jkt: thumbprint }, realm_access: { roles: [role] }, ...overrides })
      .setProtectedHeader({ alg: "EdDSA", kid: "unit-realm" }).sign(realm.privateKey);
  }
  async function request(path: string, options: { role?: Role; method?: string; body?: unknown;
    proof?: Record<string, unknown>; claims?: Record<string, unknown>; headers?: Record<string, string>;
    token?: string; proofHeader?: Record<string, unknown> } = {}) {
    const accessToken = options.token ?? await token(options.role, options.claims);
    const method = options.method ?? "GET";
    const signedProof = await new SignJWT({ jti: randomUUID(), htm: method,
      htu: new URL(path, origin).origin + new URL(path, origin).pathname,
      iat: Math.floor(Date.now() / 1000),
      ath: createHash("sha256").update(accessToken).digest("base64url"), ...options.proof })
      .setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk: clientJwk, ...options.proofHeader }).sign(client.privateKey);
    return new Request(new URL(path, origin), { method,
      headers: { authorization: `DPoP ${accessToken}`, dpop: signedProof, origin,
        "content-type": "application/json", "idempotency-key": randomUUID(), ...options.headers },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
  }
  function cleanup() {
    closeDb();
    if (!directory.startsWith(parent + "\\") && !directory.startsWith(parent + "/")) throw Error("Unsafe test cleanup path");
    rmSync(directory, { recursive: true, force: true });
  }
  return { directory, adapterPath, actor, token, request, cleanup, issuer, origin };
}
export function fixturePolicies(examId: string) {
  const make = (purpose: "WRITE" | "READ") => insertPolicy(examId, purpose,
    Buffer.from(`UNIT_TEST_ONLY_NOT_A_TIDE_SIGNATURE:${examId}:${purpose}`), {
      examId, purpose, contractId: "RelationshipAttestation:1", assignmentId: examId,
      subjectType: "Role", subjectId: purpose === "WRITE" ? "author" : "invigilator",
      operationRoles: [purpose === "WRITE" ? "_tide_encryptor" : "_tide_decryptor"], version: 1
    });
  return { write: make("WRITE"), read: make("READ") };
}
