import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createLocalJWKSet, jwtVerify } from "jose";
import type { GovernanceObservation, GovernanceRequestState, Identity } from "../../contracts";
import { tideConfig } from "../../server/config";
import { AppError, notReady } from "../../server/errors";

const safeId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
function settings() {
  const { adapter, issuer } = tideConfig();
  const clientId = process.env.TIDE_PROPOSAL_CLIENT_ID, secret = process.env.TIDE_PROPOSAL_CLIENT_SECRET;
  const path = process.env.TIDE_BRIDGE_REVIEW_PATH;
  if (!clientId || !secret || !path) return notReady("Use the Tide console until a proposal/read-only client is reviewed.");
  // An offline review records both positive capabilities and negative approval tests on THIS deployment.
  try {
    const review = JSON.parse(readFileSync(path, "utf8"));
    const keyHash = createHash("sha256").update(JSON.stringify(adapter.jwk)).digest("hex");
    if (review.issuer !== issuer || review.clientId !== clientId || review.pinnedKeyFingerprint !== keyHash ||
        review.canPropose !== true || review.canRead !== true || review.approveDenied !== true || review.commitDenied !== true ||
        typeof review.reviewedAt !== "string" || !Number.isFinite(Date.parse(review.reviewedAt))) throw Error();
  } catch { return notReady("A deployment-specific review of the narrow Tide bridge is required."); }
  return { adapter, issuer, clientId, secret, base: `${adapter["auth-server-url"].replace(/\/+$/, "")}/admin/realms/${encodeURIComponent(adapter.realm)}` };
}
export function governanceConfigured() { try { settings(); return true; } catch { return false; } }
async function boundedJson(response: Response): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader(); if (!reader) throw Error();
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 128 * 1024) { await reader.cancel(); throw Error(); }
      chunks.push(value);
    }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    return value as Record<string, unknown>;
  } finally { reader.releaseLock(); }
}
async function connection() {
  const config = settings();
  const response = await fetch(`${config.issuer}/protocol/openid-connect/token`, {
    method: "POST", body: new URLSearchParams({ grant_type: "client_credentials", client_id: config.clientId, client_secret: config.secret }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return notReady("The narrow Tide bridge could not authenticate. Use the Tide console.");
  const data = await boundedJson(response);
  if (typeof data.access_token !== "string") throw Error();
  const { payload } = await jwtVerify(data.access_token, createLocalJWKSet(config.adapter.jwk), { issuer: config.issuer, algorithms: ["EdDSA"], requiredClaims: ["exp", "iat", "sub"] });
  if (payload.azp !== config.clientId) throw Error();
  const realm = payload.realm_access as { roles?: unknown } | undefined;
  const clients = payload.resource_access as Record<string, { roles?: unknown }> | undefined;
  const realmRoles = realm?.roles, clientRoles = clients?.["realm-management"]?.roles;
  // A service principal never holds a governor vote or broad realm-management privilege.
  const allowed = new Set(["manage-users", "view-users", "query-users", "view-realm", "query-groups"]);
  const allowedRealm = new Set(["_tide_enabled", "appUser", "offline_access", "uma_authorization", `default-roles-${config.adapter.realm}`]);
  if (!Array.isArray(realmRoles) || realmRoles.some(r => typeof r !== "string" || !allowedRealm.has(r)) ||
      !Array.isArray(clientRoles) || clientRoles.some(r => typeof r !== "string" || !allowed.has(r)) || payload.cnf) {
    return notReady("The bridge credential has unreviewed privileges or token binding. No operation was sent.");
  }
  return { ...config, request: (path: string, init?: RequestInit) => fetch(`${config.base}${path}`, {
    ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.access_token}` },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
  }) };
}
export function parseChangeRequest(raw: Record<string, unknown>, expectedId: string): GovernanceRequestState {
  if (raw.id !== expectedId || !safeId(raw.id)) throw Error();
  const statuses: Record<string, GovernanceRequestState["status"]> = { PENDING: "PENDING", APPROVED: "COMMITTED", DENIED: "REJECTED", CANCELLED: "UNAVAILABLE" };
  const status = Object.hasOwn(statuses, String(raw.status)) ? statuses[String(raw.status)] : undefined;
  if (!status) throw Error();
  const count = raw.authorizationCount, threshold = raw.threshold;
  if (count !== undefined && (!Number.isSafeInteger(count) || Number(count) < 0)) throw Error();
  if (threshold !== undefined && (!Number.isSafeInteger(threshold) || Number(threshold) < 1)) throw Error();
  let authorizers: string[] | null = null;
  if (raw.authorizers !== undefined) {
    if (!Array.isArray(raw.authorizers) || raw.authorizers.length > 100) throw Error();
    authorizers = raw.authorizers.map(a => {
      if (!a || typeof a !== "object" || typeof a.username !== "string" || !a.username || a.username.length > 512) throw Error();
      return a.username as string;
    });
    if (new Set(authorizers).size !== authorizers.length || (count !== undefined && authorizers.length !== count)) throw Error();
  }
  // Missing counts stay unknown. A committed state needs consistent quorum evidence.
  if (status === "COMMITTED" && (count === undefined || threshold === undefined || Number(count) < Number(threshold))) throw Error();
  return { changeRequestId: expectedId, status, authorizationCount: count === undefined ? null : Number(count),
    threshold: threshold === undefined ? null : Number(threshold), authorizers };
}
async function observe(conn: Awaited<ReturnType<typeof connection>>, ids: string[]): Promise<GovernanceObservation> {
  if (!ids.length || ids.length > 8 || new Set(ids).size !== ids.length || ids.some(id => !safeId(id))) throw Error();
  const requests: GovernanceRequestState[] = [];
  for (const id of ids) {
    const response = await conn.request(`/iga/change-requests/${encodeURIComponent(id)}`);
    if (!response.ok) return notReady("Live Tide governance reads are unavailable. Use the supported console.");
    requests.push(parseChangeRequest(await boundedJson(response), id));
  }
  return { changeRequestIds: ids, requests, source: "TIDE", observedAt: new Date().toISOString() };
}
export async function observeRequests(ids: string[]) { return observe(await connection(), ids); }
export async function proposeAccess(input: { actor: Identity; target: Pick<Identity, "issuer" | "subject">; roles: string[] }) {
  const conn = await connection();
  if (input.actor.issuer !== conn.issuer || input.target.issuer !== conn.issuer || !safeId(input.target.subject) ||
      !input.roles.length || input.roles.some(r => !["invigilator", "_tide_decryptor"].includes(r)) || new Set(input.roles).size !== input.roles.length) throw Error();
  const roles = [];
  for (const name of input.roles) {
    const response = await conn.request(`/roles/${encodeURIComponent(name)}`);
    if (!response.ok) return notReady("Protected realm roles are unavailable.");
    const role = await boundedJson(response);
    if (!safeId(role.id) || role.name !== name || role.clientRole !== false) throw Error();
    roles.push({ id: role.id, name });
  }
  // One additive mapping write. No DELETE, role replacement, approval, commit or retry.
  const response = await conn.request(`/users/${encodeURIComponent(input.target.subject)}/role-mappings/realm`, { method: "POST", body: JSON.stringify(roles) });
  if (response.status !== 202) throw new AppError(503, "TIDE_PROPOSAL_UNCONFIRMED", "Tide did not return a governed proposal. Do not retry blindly; inspect the console.");
  const location = response.headers.get("location");
  if (!location) throw new AppError(503, "TIDE_PROPOSAL_UNCONFIRMED", "Tide accepted the write without a request identifier. Inspect the console before retrying.");
  const url = new URL(location, `${conn.base}/`), prefix = `${conn.base}/iga/change-requests/`;
  if (!url.href.startsWith(prefix) || url.search || url.hash) throw Error();
  const id = url.href.slice(prefix.length);
  if (!safeId(id)) throw Error();
  return observe(conn, [id]);
}
