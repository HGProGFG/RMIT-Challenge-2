import { after, test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixtures";
import { getIntegrationReadiness, getVersionManifest, EXPECTED_DPOP_SHA256 } from "../src/lib/server/readiness";
import { tideIntegration } from "../src/lib/server/tide-integration";
import { handleApi } from "../src/lib/server/api";
const f = await fixture();
after(f.cleanup);
test("readiness lists concrete missing integrations and never treats installed backend as live Tide", () => {
  const readiness = getIntegrationReadiness();
  assert.equal(readiness.tide, "not_ready");
  for (const name of ["browser_provider", "signed_policy_verifier", "governance_bridge"]) assert.ok(readiness.missing.includes(name));
  assert.equal(readiness.missing.includes("tide_sdk"), false);
});
test("version manifest reports actual relay digest, pinned-key fingerprint and unavailable SDK/image values", () => {
  const manifest = getVersionManifest();
  assert.equal(manifest.dpopAssetSha256, EXPECTED_DPOP_SHA256); assert.equal(manifest.dpopAssetMatches, true);
  assert.match(manifest.pinnedKeyFingerprint!, /^[a-f0-9]{64}$/); assert.equal(manifest.sdkVersions["@tidecloak/js"], "0.14.41");
  const prior = process.env.TIDECLOAK_REALM_IMAGE_DIGEST;
  try {
    process.env.TIDECLOAK_REALM_IMAGE_DIGEST = "DO_NOT_EXPOSE_ARBITRARY_ENV_VALUE";
    assert.equal(getVersionManifest().realmImageDigest, null);
    assert.ok(!JSON.stringify(getVersionManifest()).includes("DO_NOT_EXPOSE"));
  } finally { if (prior === undefined) delete process.env.TIDECLOAK_REALM_IMAGE_DIGEST; else process.env.TIDECLOAK_REALM_IMAGE_DIGEST = prior; }
});
test("missing adapter and an unavailable integration are represented explicitly", () => {
  const path = process.env.TIDECLOAK_ADAPTER_PATH, prior = tideIntegration.governanceReadiness;
  try {
    process.env.TIDECLOAK_ADAPTER_PATH = "missing-public-adapter.json";
    assert.ok(getIntegrationReadiness().missing.includes("pinned_adapter"));
    tideIntegration.governanceReadiness = "unavailable";
    assert.equal(getIntegrationReadiness().tide, "unavailable");
  } finally { process.env.TIDECLOAK_ADAPTER_PATH = path; tideIntegration.governanceReadiness = prior; }
});
test("session exposes compatibility identity fields and sanitized evidence", async () => {
  const response = await handleApi(await f.request("/api/session"));
  assert.equal(response.status, 200); const { data } = await response.json();
  assert.deepEqual(data.identity.realmRoles, ["author"]); assert.deepEqual(data.identity.clientRoles, {});
  assert.ok(data.activeRunId); assert.equal(data.versionManifest.dpopAssetMatches, true);
  assert.ok(!JSON.stringify(data).includes("signedBytesBase64"));
});
test("selected-client roles never substitute for privileged realm roles", async () => {
  process.env.TIDECLOAK_ROLE_CLIENT = "vault";
  try {
    const response = await handleApi(await f.request("/api/exams/prepare", { method: "POST", body: { title: "Blocked", advisoryReleaseAt: "2026-10-23T02:00:00Z" },
      claims: { realm_access: { roles: [] }, resource_access: { vault: { roles: ["author"] } } } }));
    assert.equal(response.status, 403);
  } finally { delete process.env.TIDECLOAK_ROLE_CLIENT; }
});
