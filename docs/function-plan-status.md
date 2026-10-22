# FUNCTION_PLAN implementation map — Hoang

The plan describes application responsibilities. Existing implementation names are retained where behavior already matches; additive types/views avoid breaking Bao/Dinh's existing imports or HTTP responses. This is an implementation handoff, not evidence that the three people have agreed on interfaces or that live Tide tests passed.

| Plan responsibility | Implementation/status |
| --- | --- |
| Shared types | `contracts.ts`: VerifiedIdentity, IntegrationReadiness, UI state constants/types, ExamSummary, SignedPolicyRef, PolicyReadiness, DecryptOutcome, GovernanceRequestView, ActivityEntry and existing API envelopes. Core PREPARED state remains compatible; summaries map it to DRAFT. |
| Limits | Shared LIMITS has plaintext/title limits. Ciphertext is deployment configuration in server `ciphertextLimit()`, not a browser constant with an invented overhead. |
| openDb / migrate | `db/index.ts`, `db/migrate.ts`: WAL/FK, process ownership lock, ordered offline migrations; API refuses an outdated schema. |
| createDemoRun / getActiveRun | `db/runs.ts`: explicit creation, one active run, pinned issuer/realm/client metadata and manifest. No creation from a read or prepare. |
| insert/get/list/seal/read exam | `db/repository.ts`: prepareExam, examById/activeExamById, listExams, sealExam, readCiphertext. One exam per active run, scoped idempotency, ownership, write-once, exact byte/digest persistence. |
| Policy insert/read | insertPolicy/getPolicy, verified-ingest routes and policyId alias. Version 1 remains the immutable per-run pair. Real signature validation is Dinh's port and stays unavailable until connected. |
| Governance links/status | reserveProposal/completeProposal/governanceLinks/getGovernanceLink/updateObservedStatus; active-run cache, stale flag, fresh observations and separate CR states. Empty/unconfirmed IDs never become a pending security claim. |
| Display-role functions | overrideDisplayRole/getDisplayRole. Labels never enter auth/crypto guards. |
| Activity append/query | addActivity/activity with explicit columns, strict client observations, pagination and active-run scope. Additive source/alias views in `server/views.ts`. |
| Replay claim/purge | claimProof/purgeExpiredJti, SQLite unique thumbprint+JTI, failure blocks API, future-proof window retained. |
| Request verification/guards | authenticate/verifyRequest, local pinned JWT + reference DPoP verification, exact canonical APP_ORIGIN, replay store and realm-only privileged guards. Ownership uses issuer+subject; no display-role lookup. |
| Request/response helpers | http.ts: bounded streaming readBody, idempotencyKey, strict schemas, role guards, same-origin-before-auth handling, rate limits and sanitized correlation/error envelopes. Replay is performed once inside authenticate, not twice by wrapper functions. |
| Readiness and evidence | `server/readiness.ts`: getIntegrationReadiness/getVersionManifest. Session carries missing dependencies and sanitized evidence; package versions come from lockfile and absent SDK/image evidence is null. |
| Deny route | POST /api/governance/requests/:appRequestId/deny, fixed member CR selector, governor realm role, fresh PENDING check, reviewed denial port and refetch before success. No server approval/commit. Real denial adapter is Dinh's dependency. |
| Ingest path from plan | POST /api/policies/ingest is an alias with the same guards as the existing per-exam policies route. |
| Offline reset | db/reset.ts + scripts/reset-run.ts: preview/default dry-run, explicit UUID/apply, same configuration, new UUID, scoped local deletion, retain other runs/replay/rate state. No HTTP route and no policy signing/revocation. |
| DPoP evidence script | npm run verify:dpop verifies the exact pinned relay digest. |

Live Tide enrollment, license/hosting, SDK/provider, policy signature verification, shared author-to-invigilator cryptography, actual CR proposal/denial and signed 2-of-3 enforcement remain Dinh's integration responsibilities. Bao still owns seven screens, README and video. Those dependencies return not_ready/unavailable; local generated keys/test doubles do not satisfy live acceptance criteria.
