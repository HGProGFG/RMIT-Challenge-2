import { createHash } from "node:crypto";
import { calculateJwkThumbprint, createLocalJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from "jose";
import { roleSchema, type Identity, type Role, type VerifiedIdentity } from "../contracts";
import { claimProof } from "../db";
import { appOrigin, tideConfig } from "./config";
import { AppError } from "./errors";
import { verifyDpop } from "./vendor/verifyDpop";
import { hasVerifiedRole } from "../roles";

const DPOP_WINDOW = 120;
export async function authenticate(req: Request): Promise<VerifiedIdentity> {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.length > 32768 || !/^DPoP [^\s]+$/i.test(auth)) throw new AppError(401, "INVALID_SESSION", "A DPoP-bound session is required.");
  const token = auth.slice(5);
  const { adapter, issuer } = tideConfig();
  let claims: JWTPayload;
  try {
    ({ payload: claims } = await jwtVerify(token, createLocalJWKSet(adapter.jwk), {
      algorithms: ["EdDSA"], issuer, requiredClaims: ["exp", "iat", "sub", "iss", "azp", "cnf"],
      clockTolerance: 5,
      ...(process.env.TIDECLOAK_EXPECTED_AUDIENCE ? { audience: process.env.TIDECLOAK_EXPECTED_AUDIENCE } : {})
    }));
    if (claims.azp !== adapter.resource || typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 512 ||
        !Number.isInteger(claims.iat) || claims.iat! > Date.now() / 1000 + 5) throw Error();
  } catch { throw new AppError(401, "INVALID_SESSION", "Session verification failed."); }

  const proof = req.headers.get("dpop");
  if (!proof || proof.length > 16384) throw new AppError(401, "INVALID_PROOF", "A valid DPoP proof is required.");
  let thumbprint: string;
  try {
    const header = decodeProtectedHeader(proof), jwk = header.jwk;
    if (header.alg !== "ES256" || !jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" ||
        "d" in jwk || "k" in jwk) throw Error();
    thumbprint = await calculateJwkThumbprint(jwk);
  } catch { throw new AppError(401, "INVALID_PROOF", "DPoP proof must use a public ES256 key."); }

  const canonicalUrl = new URL(new URL(req.url).pathname, appOrigin()).href;
  try {
    await verifyDpop({ url: canonicalUrl, method: req.method, headers: req.headers }, token, claims as { cnf?: { jkt?: string } }, {
      trustForwardedHeaders: false, iatSkewSeconds: DPOP_WINDOW,
      jtiStore: { async claim(jti) {
        if (jti.length > 256) return false;
        try {
          // A proof may be future dated within the window: keep it until BOTH windows end.
          return claimProof(thumbprint, jti, Date.now() + (2 * DPOP_WINDOW + 1) * 1000);
        } catch { throw new AppError(503, "REPLAY_STORE_UNAVAILABLE", "Proof replay storage is unavailable.", true); }
      } }
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, "INVALID_PROOF", "DPoP verification failed or proof was already used.");
  }
  const realmRoles = (claims.realm_access as { roles?: unknown } | undefined)?.roles;
  const client = process.env.TIDECLOAK_ROLE_CLIENT;
  const clientRoles = client ? (claims.resource_access as Record<string, { roles?: unknown }> | undefined)?.[client]?.roles : [];
  const governanceRoles = (claims.resource_access as Record<string, { roles?: unknown }> | undefined)?.["realm-management"]?.roles;
  const roles = [...new Set([...(Array.isArray(realmRoles) ? realmRoles : []), ...(Array.isArray(clientRoles) ? clientRoles : [])])]
    .flatMap(role => { const parsed = roleSchema.safeParse(role); return parsed.success ? [parsed.data] : []; });
  const governance = Array.isArray(governanceRoles) && governanceRoles.includes("tide-realm-admin");
  if (governance && !roles.includes("tide-realm-admin")) roles.push("tide-realm-admin");
  if (!roles.length) throw new AppError(403, "PARTICIPANT_REQUIRED", "This session is not an authorized demo participant.");
  return { issuer, subject: claims.sub!, roles,
    realmRoles: Array.isArray(realmRoles) ? realmRoles.filter((role): role is string => typeof role === "string") : [],
    clientRoles: { ...(client && Array.isArray(clientRoles) ? { [client]: clientRoles.filter((role): role is string => typeof role === "string") } : {}),
      ...(Array.isArray(governanceRoles) ? { "realm-management": governanceRoles.filter((role): role is string => typeof role === "string") } : {}) },
    alias: typeof claims.preferred_username === "string" ? claims.preferred_username.slice(0, 120) : "Authenticated participant" };
}
export async function verifyRequest(req: Request, opts: { requiredRoles?: Role[] } = {}) {
  const identity = await authenticate(req);
  if (opts.requiredRoles && !opts.requiredRoles.some(role => hasVerifiedRole(identity, role))) throw new AppError(403, "FORBIDDEN", "Required verified role is absent.");
  return identity;
}
export function actorBucket(actor: Identity) {
  return createHash("sha256").update(JSON.stringify([actor.issuer, actor.subject])).digest("hex");
}
