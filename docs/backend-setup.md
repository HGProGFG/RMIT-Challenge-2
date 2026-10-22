# Backend setup — Hoang

This branch implements the application backend. It is **not yet a working live Tide demo**: Dinh must connect the public adapter, browser provider, signed-policy verification and live proposal/read bridge. Missing dependencies fail closed with HTTP 503; there is no authentication bypass or runtime mock mode.

## Run locally

Tested runtime: Node **24.19.0**, npm **11.17.0**, Next **16.4.2**, jose **6.2.13**, Zod **4.6.7**. Use Node 24; this backend uses built-in `node:sqlite` and the Node runtime, not Edge. The lockfile pins installed dependencies.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:migrate
npm run dev
```

The shell initially shows the integration scaffold at http://localhost:3000. The migration command reads shell environment variables; set `$env:DATABASE_PATH` before running it if using a non-default path. Next loads `.env.local` when serving. All `/api/**` routes require verified sessions; opening an API in an unauthenticated browser returns 401. Use Dinh's browser `secureFetch` after sign-in.

Configuration:

| Name | Meaning |
| --- | --- |
| `APP_ORIGIN` | Exact browser origin; localhost HTTP or HTTPS. DPoP uses this pinned origin plus request pathname, excluding query/fragment. Forwarded host headers are ignored. |
| `DATABASE_PATH` | Persistent local SQLite file, default `data/vault.sqlite`. The parent is created and versioned migrations apply lazily/atomically. |
| `TIDECLOAK_ADAPTER_PATH` | Public exported adapter containing `realm`, `resource`, `auth-server-url`, and embedded public Ed25519 `jwk.keys`. No remote JWKS fallback. Default `data/tidecloak.json`, ignored by Git. |
| `TIDECLOAK_EXPECTED_AUDIENCE` | Optional exact `aud` constraint, after Dinh inspects genuine claims. `iss` and `azp=resource` are always checked. |
| `TIDECLOAK_ROLE_CLIENT` | Optional exact client namespace whose verified roles are accepted in addition to realm roles. Unrelated client roles are ignored. |
| `MAX_CIPHERTEXT_BYTES` | Required before seal. Dinh confirms the SDK envelope overhead; allowed app deployment range 16 KiB–1 MiB. No default assumption. Browser plaintext stays limited to 16 KiB. |
| `INVIGILATOR_ISSUER`, `INVIGILATOR_SUBJECT` | Fixed same-realm recipient for release proposals; never accepted from a browser body. |
| `DEMO_ATTACKS_ENABLED` | `true` enables the display-role mutation only in development/test. Route returns 404 under `next start` production, regardless of this flag. Record this demo with `npm run dev`. |

Never place a bootstrap password, license key, token, private JWK, exam key or governance credential in runtime config or Git. A public adapter is required to verify sessions; this branch does not provision a realm or accept terms on anyone's behalf.

## Storage and authority

Migration: `src/lib/db/migrations/001-initial.sql`. Entities: DemoRun, Exam, ExamPolicy, GovernanceLink, DemoRoleOverride, ActivityEvent, DpopReplay, Idempotency and RateLimit. Each prepared exam gets a fresh UUID and fresh run UUID. Only one exam may belong to a run.

Exam bytes stay opaque. The backend stores decoded ciphertext exactly, computes SHA-256 from those bytes, and verifies byte length/digest when reading. It cannot establish whether a malicious client honestly encrypted an exam. It stores no plaintext checksum, source file name, plaintext, access token, DPoP proof or arbitrary error text.

Prepare and seal require `Idempotency-Key` (16–128 letters/digits/underscore/hyphen). Scope includes verified issuer+subject, operation and exam. Matching retries return their original result; changed input with the same key returns 409. Seal requires verified ownership, version 1 and both verified policies. Sealed ciphertext and prepared policies are write-once through normal APIs; SQL triggers also reject ordinary updates. A hostile DB operator can alter the database or remove triggers, so these controls do not establish tamper-proof storage.

API authentication verifies local EdDSA JWT signatures, expiry, issued-at, issuer, authorized party and participant roles. It then requires RFC 9449 DPoP with public ES256 key, `typ`, `cnf.jkt`, `ath`, method, canonical URL, fresh numeric `iat`, and bounded single-use `jti`. Bearer presentations are rejected. The shipped Tide verifier is wrapped with SQLite replay storage scoped to proof-key thumbprint. Records live through the whole accepted future-proof window and survive process restarts. DB failure blocks the request.

Every response uses `Cache-Control: no-store`. Mutations require an exact same-origin header. Bodies are bounded while streaming, independent of Content-Length, and use strict schemas. Durable rate limits allow 120 requests/minute and 30 mutations/minute per verified identity. Do not deploy separate SQLite copies behind multiple instances: replay/rate/idempotency state must be shared. Use one Node server with one persistent file for this prototype; use an atomic shared database before scaling.

Activity is mutable application logging. A client saying `opened` is stored as `CLIENT_REPORTED` and proves neither network permission nor that decryption occurred. Ciphertext digests are integrity references, not signatures. No automatic time lock, room check, immutable audit, decryption endpoint or production reset endpoint exists.

## Integrating Dinh's work

The application port is `src/lib/server/tide-integration.ts`, with shared data in `src/lib/contracts.ts`. Dinh implements real SDK operations under `src/lib/tide/**`; wire only server-safe exports into this port. Do not import browser encryption/decryption into route handlers.

1. Export the compatible public adapter and confirm genuine `iss`, `azp`, algorithm, realm/client role namespace and any audience restriction. Review `src/lib/server/auth.ts` together; retain the durable replay store on **every** API. No example fixture key is configured in runtime.
2. Add the browser provider and compatible SDK dependencies, enabling `useDPoP: { mode: 'strict', alg: 'ES256' }` **inside provider config**. The byte-exact relay and rewrite/headers are already supplied. Dinh must review any SDK-specific webpack alias/workarounds before adding that package.
3. Implement `verifyPolicy`: verify the signed byte format with the reviewed Tide library and separately pinned trust root; return metadata parsed from those exact authenticated bytes, never caller JSON. Validate vendor/realm, `RelationshipAttestation:1`, model/operation, string parameter encoding, role gates, subject, exact exam tag/assignment, expiry and signature. Backend checks expected exam/purpose/subject/one operation again before storing. Keep `policyReadiness=not_ready` until this is proven. Ingest is otherwise disabled.
4. Prepare both WRITE/READ policies before seal. This port does not generate or sign policies. Each governor signs/approves in their own supported browser/console flow.
5. Implement `proposeAccess` and `observeRequests` with supported live IGA calls. Verify target issuer+subject and exact allowlisted roles at the boundary; never proxy a governor's approval under an application service identity. The proposal port receives a stable derived idempotency key: deduplicate/reconcile upstream before creating a CR. Return actual CR IDs and **one state per CR**, with distinct authorizers and live count/threshold. Missing counts stay `null`. Return `COMMITTED` only for authoritative applied/committed state. A console-only setup may leave the proposal port unavailable; do not invent pending requests.
6. If proposal succeeds remotely but its response is lost, the local reservation stays unresolved. The same key returns `PROPOSAL_UNCERTAIN`; reconcile actual Tide CR IDs using the adapter/operator before retrying. Do not delete the reservation and blindly create another grant. Reservation rows grant no authority.
7. Set readiness to `ready` only after the live version/realm/policy/quorum tests pass. Confirm active signed 2-of-3 gate and under-threshold rejection; the backend does not create that gate. The app checks consistent, fresh observations (up to 60 seconds) but does not confer cryptographic authority from a cached status.

After grant/revoke, use a fresh real invigilator session. The default metadata API deliberately reports release status as `unknown` until UI reads authoritative governance observations. Reaching the advisory schedule never changes protected authority.

## Verify

```powershell
npm test
npm run typecheck
npm run build
```

Tests generate local signing keys and synthetic policy fixtures in isolated temporary work directories. They verify application storage, local JWT/DPoP checks and HTTP guards. **They do not prove Tide login, shared encryption, policy signatures, network denials or 2-of-3 governance.** See `docs/evidence/backend-validation.md` for the boundary between checks and live blockers.

The relay and unchanged reference verifier come from `@tideorg/mcp@1.9.33`. Relay SHA-256: `9d7844b938f0a2565fa910d3d30e9b8797cbfd6e0b73d59d804169a089aea757`. The wrapper strengthens accepted algorithm, public-key checks, canonical origin, durable replay and replay retention; it never uses the reference MemoryJtiStore.
