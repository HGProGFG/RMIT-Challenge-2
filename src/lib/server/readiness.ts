import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IntegrationReadiness, VersionManifest } from "../contracts";
import { getActiveRun } from "../db/runs";
import { ciphertextLimit, tideConfig } from "./config";
import { tideIntegration } from "./tide-integration";

export const EXPECTED_DPOP_SHA256 = "9d7844b938f0a2565fa910d3d30e9b8797cbfd6e0b73d59d804169a089aea757";
export function getVersionManifest(): VersionManifest {
  let applicationVersion = "unknown", packages: Record<string, { version?: unknown }> = {};
  try { applicationVersion = JSON.parse(readFileSync(resolve("package.json"), "utf8")).version; } catch { /* unavailable evidence */ }
  try { packages = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")).packages; } catch { /* unavailable evidence */ }
  const names = ["next", "jose", "@tidecloak/nextjs", "@tidecloak/js", "@tidecloak/react"];
  const sdkVersions = Object.fromEntries(names.map(name => {
    const version = packages?.[`node_modules/${name}`]?.version;
    return [name, typeof version === "string" && /^[0-9][A-Za-z0-9.+-]{0,79}$/.test(version) ? version : null];
  }));
  let dpopAssetSha256: string | null = null, pinnedKeyFingerprint: string | null = null;
  try { dpopAssetSha256 = createHash("sha256").update(readFileSync(resolve("public/tide_dpop_auth.html"))).digest("hex"); } catch { /* missing asset */ }
  try { pinnedKeyFingerprint = createHash("sha256").update(JSON.stringify(tideConfig().adapter.jwk)).digest("hex"); } catch { /* no public adapter */ }
  const image = process.env.TIDECLOAK_REALM_IMAGE_DIGEST;
  return { applicationVersion: typeof applicationVersion === "string" && /^\d+[\w.+-]*$/.test(applicationVersion) ? applicationVersion : "unknown",
    nodeVersion: process.versions.node, sdkVersions, realmImageDigest: image && /^sha256:[a-f0-9]{64}$/.test(image) ? image : null,
    dpopAssetSha256, dpopAssetMatches: dpopAssetSha256 === EXPECTED_DPOP_SHA256, pinnedKeyFingerprint };
}
export function getIntegrationReadiness(): IntegrationReadiness {
  const missing: string[] = []; let unavailable = false;
  let config: ReturnType<typeof tideConfig> | null = null;
  try { config = tideConfig(); } catch { missing.push("pinned_adapter"); }
  const manifest = getVersionManifest();
  if (!manifest.dpopAssetMatches) missing.push("dpop_relay");
  if (!manifest.sdkVersions["@tidecloak/js"] || (!manifest.sdkVersions["@tidecloak/react"] && !manifest.sdkVersions["@tidecloak/nextjs"])) missing.push("tide_sdk");
  if (tideIntegration.browserReadiness !== "ready") missing.push("browser_provider");
  if (tideIntegration.policyReadiness !== "ready") missing.push("signed_policy_verifier");
  if (tideIntegration.governanceReadiness !== "ready") missing.push("governance_bridge");
  unavailable = [tideIntegration.browserReadiness, tideIntegration.policyReadiness, tideIntegration.governanceReadiness].includes("unavailable");
  if (!process.env.INVIGILATOR_SUBJECT || !config || process.env.INVIGILATOR_ISSUER !== config.issuer) missing.push("designated_invigilator");
  try { ciphertextLimit(); } catch { missing.push("ciphertext_envelope_limit"); }
  try {
    const run = getActiveRun();
    if (!run) missing.push("active_run");
    else if (!config || run.issuer !== config.issuer || run.realmId !== config.adapter.realm || run.clientId !== config.adapter.resource) missing.push("active_run_configuration");
  } catch { missing.push("database"); unavailable = true; }
  return { tide: unavailable ? "unavailable" : missing.length ? "not_ready" : "ready", missing };
}
