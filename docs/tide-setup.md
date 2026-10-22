# Tide integration handoff — Dinh

> Historical integration notes. The current application runs Plan C only. Its real Tide provider,
> policy-signing screen and OAuth callback have been removed; these steps are not needed to use
> the demo. Start with [the Plan C guide](simulation.md).

## Current state

For the usable network-independent prototype, run `npm run demo` and follow the
[local simulation guide](simulation.md). It simulates sign-in, roles, policy checks and two-of-three
release without changing the live activation state described below.

The application now installs the real SDK and wires a strict DPoP provider, login/logout,
callback, browser encryption/decryption, governor policy signing, and pinned-key policy ingestion.
The server JWT/DPoP verifier and atomic replay store remain in use. The production build and local
regression tests are separate from live Tide acceptance.

Docker's Linux engine is running with WSL 3.0.3. The dedicated `sealed-exam-vault` realm,
`sealed-exam-vault-client` client and seven synthetic account slots have been created. The owner
confirmed that the selected ORK network has `RelationshipAttestation:1`. The owner's licence email,
explicit Terms acceptance and bootstrap credentials stay in ignored local files.

**Tide activation remains incomplete.** Initial activation returned HTTP 500,
`TIDE-IDPEXT-VENDOR-KEYGEN_FAILED`, with wallet status `UNDETERMINED`. A local clock skew of about
61 minutes was found and corrected. A bounded resume then passed the wallet-state check but failed
inside `Midgard.FinalizeWallet`: `Not enough orks returned an ok response`, with upstream HTTP 500.
A separate clean recovery realm, created after the correction, reproduced that finalization
failure. The original realm is preserved and remains the application's configured realm.

Licence details and `isPendingLicenseActive=true` are returned, but actual adapter export still
fails because the Tide public key is missing. These reads do not establish completed vendor-key
setup. See [the sanitized diagnostic](evidence/tide/bootstrap-2026-10-22.md).

No human Tide identities are linked, IGA has not been enabled, and no signed M0 quorum, live
ciphertext or two-person approval has been verified. The live integration deliberately remains
unavailable for sealing until a genuine adapter and measured ciphertext limit are supplied.

The integration uses these npm releases resolved on 22 October 2026:

| Package | Exact version |
|---|---|
| `@tidecloak/nextjs` | 0.14.40 |
| `@tidecloak/react` | 0.14.33 |
| `@tidecloak/js` | 0.14.41 |
| `heimdall-tide` | 0.14.41 |
| `@tideorg/js` | 0.14.29 |

These packages have different publication versions. Check them against the actual image release
and perform the real login/enclave tests before claiming compatibility. The relay bundled with
the installed JS SDK has the same SHA-256 as the copied pack relay:
`9d7844b938f0a2565fa910d3d30e9b8797cbfd6e0b73d59d804169a089aea757`.

## Start local infrastructure on Windows

1. Install Docker Desktop and start its Linux container engine. Run `npm run tide:check`.
   It compares the host and Docker engine clocks with independent HTTPS time sources and stops
   on a measured skew over 30 seconds. It changes no clocks. If network checks are unavailable,
   it warns; verify time before activation. A healthy `/active` response alone does not prove
   Tide wallet finalization is available.
2. Keep `.env.tide-bootstrap` separate from the application's `.env.local`. For another deployment,
   a human must supply `TIDE_LICENSE_EMAIL`, `TIDE_TERMS_ACCEPTED=yes` only after agreeing at
   <https://tide.org/legal>, and `TIDE_HOSTING=docker`. There is no default email or consent.
3. Run `npm run tide:start`. It creates or reuses only its labelled `tidecloak-sealed-vault`
   container and dedicated `sealed-vault-tide-data` volume. It never deletes another container or
   database. The admin password is generated into the ignored bootstrap file and supplied through
   an ignored Docker env file. It is never printed or passed as a literal shell argument.
   The image runs as UID 1000; the script prepares ownership on this dedicated volume before
   first startup, or while its verified project container is stopped. The server runs as its
   normal image user. An orphaned volume name is a stop for inspection, not permission to overwrite it.
4. This command starts infrastructure only. It **does not create or license a realm**. Its local
   image digest observation is in ignored `data/tide-image.json`.

The PowerShell npm commands use a process-only execution-policy bypass for the checked-in script;
they do not change the machine's execution policy.

Before creating the application realm, confirm with the Tide team that its network includes
`RelationshipAttestation:1` (ORK main c69fc4f6, 16 October 2026 or a compatible later build).
Contact: <https://discord.gg/XBMd9ny2q5> or info@tide.org. Do not replace it with a custom contract.
The owner has supplied this confirmation for the current local realm.

## Realm bootstrap and seven identities

Run `npm run tide:plan` to generate an ignored `data/realm-import.json`. This is a plan, not a remote
write. The byte-exact base template came from `@tideorg/mcp@1.9.33`,
`templates/shared/realm.json.template`, SHA-256
`121d98d360f5f72f5b1a3918de440d5b0eaa6cdb0b2370cd0caceaa24acdff61`.
It includes audience, groups, tideuserkey and vuid mappers, DPoP-bound tokens, exact origins and
callbacks. Its default realm/client are `sealed-exam-vault` / `sealed-exam-vault-client`.
Do not reuse the image's imported `myrealm`.

Follow the current pack playbooks `bootstrap-realm-from-template` and
`initialize-admin-and-link-account` with this generated import. Do not run an old bootstrap's
container cleanup step against this setup. In order:

1. Import the dedicated realm while IGA is off, disable the broker profile review page, and finish
   all client redirects/origins/mappers before enabling IGA.
2. License via `vendorResources/setUpTideRealm` using the owner's provided email. A response
   containing `NEED_PAYMENT`, a checkout redirect or a non-2xx is a stop, not a successful licence.
   This free-tier flow requests activation automatically; it has no manually entered challenge
   licence-key field. If it partially creates a vendor and then fails, retain the database and
   inspect the existing state with Tide support before retrying or creating another realm.
3. Set `iga.attestor=tide`. Read `tide-admin/iga-status` first; enable IGA only if off. Current
   `toggle-iga` is a flip: never call it twice. Drain only known bootstrap requests in FirstAdmin
   mode; never blanket-approve `DISABLE_IGA`, `DELETE_REALM` or `OFFBOARD_REALM`.
4. Enroll each synthetic slot in a separate Tide account through the supported account-linking
   flow. Invite links are enrollment secrets: retain privately, never commit or publish them.
   At the first invite step, ask the owner about login branding and which profile fields to collect
   and wait for the answers, as required by the Tide setup workflow.
5. Configure and sign the IdP settings while still FirstAdmin. Grant the real
   `realm-management` client role `tide-realm-admin` last. Subsequent grants and changes require
   enclave approvals. A custom realm role with the same name is not an ORK governor credential.
6. Enroll all three governors, grant their actual governance role through the supported flow,
   protect the signed M0 admin policy and set/read back its threshold to **2**. Inspect both the
   effective IGA threshold and the signed M0; a UI label or realm attribute alone is not evidence.

| Slot | Initial realm roles | Governance privilege |
|---|---|---|
| author | `author`, `_tide_encryptor`, `_tide_enabled` | none |
| invigilator | `invigilator`, `_tide_enabled` | none; `_tide_decryptor` withheld |
| teacher | `teacher`, `_tide_enabled` | none |
| app-admin | `app-admin`, `_tide_enabled` | none |
| governor-1/2/3 | `_tide_enabled` | grant actual `realm-management/tide-realm-admin` after linking |

Never give governors `_tide_decryptor` or `invigilator`. Never include `_tide_encryptor` or
`_tide_decryptor` in default composites. Each of seven accounts must have a distinct Tide key;
separate browser profiles are useful for rehearsal. Never use a shared governor session.

## Export config and start an application run

Export the actual Tide adapter through:
`GET /admin/realms/{realm}/vendorResources/get-installations-provider?clientId={clientUuid}&providerId=keycloak-oidc-keycloak-json`.
Save it privately as `data/tidecloak.json`. Require real `jwk.keys`, `vendorId`, `homeOrkUrl` and
the exported `client-origin-auth-{APP_ORIGIN}` signature for the exact browser origin; never
hand-build a substitute or fetch remote signing keys at authentication time. Public config is
allowlisted before entering the browser; client secrets and unknown adapter fields are stripped.

Set `.env.local` from `.env.example`. Record the exact invigilator issuer/subject. Measure the
largest policy-encrypted envelope for a 16 KiB UTF-8 input and set `MAX_CIPHERTEXT_BYTES` from that
measurement with a documented margin. An empty value deliberately blocks sealing. Record the
actual immutable image digest. Then run `npm run db:migrate`, `npm run run:create`, `npm run dev`.
Use offline reset commands only after stopping the app process.

`APP_ORIGIN` must match the browser, including port. Register `/auth/redirect`,
`/silent-check-sso.html` and the origin in the realm before multi-admin. The app uses webpack,
the published SDK ESM alias, strict ES256 DPoP and the byte-exact relay with its special CSP.
The role selector is only a hint; `/api/session` verifies the actual signed identity.

## Prepare and sign per-exam policies

The author first prepares an exam from New exam. No plaintext is submitted. A governor then signs
in and uses **Governance → Prepare record policies**. Each missing policy is independently signed
in that governor's authenticated enclave and posted to the server. Existing policies are reused
and frozen once sealed. The author signs in again and resumes the prepared exam to encrypt/seal.

Both policies use `Models.Policy.latestVersion` (currently wire v4), `RelationshipAttestation:1`,
models `PolicyEnabledEncryption:1` and `PolicyEnabledDecryption:1`, IMPLICIT/PRIVATE, and the
exported vendorId. They have exactly four string params, no clientId:

| Param | Write | Read |
|---|---|---|
| subjectType | Role | Role |
| subjectId | author | invigilator |
| assignmentId | fresh exam UUID | same exam UUID |
| roles | JSON string `["_tide_encryptor"]` | JSON string `["_tide_decryptor"]` |

The server validates bounded TideMemory v1 / Policy v4 serialization, exact fields and the
64-byte Ed25519 signature over the exact serialized `dataToVerify` against the pinned key.
This wire verifier has local SDK serialization regression tests; its live ORK round-trip is
**still an acceptance gate**, including confirmation of the deployed signature format.
It never signs a policy. Unsupported formats fail closed and require a reviewed update.

Crypto calls `IAMService.doEncrypt` / `doDecrypt` with the signed bytes and exactly one tag
`[examId]`. Raw byte results are stored as canonical base64 without a second envelope. A local
successful decrypt may return plaintext only in the `opened` branch. An ambiguous threshold
failure remains an error; it is not counted as a proven denial. Logout, identity/token changes,
API 401 and navigation clear or invalidate sensitive state and stale operations.

Policy signing and IGA release are separate ceremonies. Signing the read policy never grants the
protected decrypt role. A policy does not enforce the advisory exam clock.

## Governance: supported console and optional narrow bridge

Default to the supported realm Tide console, in each governor's own browser session. Configure
the reviewed console link. Never approve or commit with the bootstrap credential, an app server
proxy or a service account. `/approve` records the HTTP caller; distinct humans routed through
one service account do not create distinct votes. No approval/commit route is exposed by this app.
The existing rejection route stays disabled unless a separately reviewed implementation is wired;
use the console to deny only freshly PENDING requests. Denying APPROVED is not revocation.

`src/lib/tide/server/governance.ts` implements the additive realm role proposal and live reads.
Its optional client-credentials bridge requires an offline deployment review in the ignored path
`TIDE_BRIDGE_REVIEW_PATH`, plus `TIDE_PROPOSAL_CLIENT_ID/SECRET`. Do not populate these until live
positive/negative privilege tests pass. Required review shape:

```json
{
  "issuer": "the actual exported issuer",
  "clientId": "the reviewed proposal-only client",
  "pinnedKeyFingerprint": "the actual SHA-256 fingerprint shown in the version manifest",
  "reviewedAt": "an actual ISO timestamp",
  "canPropose": true, "canRead": true, "approveDenied": true, "commitDenied": true
}
```

The bridge locally verifies each service JWT, checks its issuer/client and restricts its realm
roles to defaults and `_tide_enabled`, and realm-management roles to the explicit proposal/read
allowlist. It rejects bound tokens it cannot prove and broad/approval roles. It never casts votes.
Current Tide builds may require `manage-realm` even for CR reads: **do not add it to make the
bridge work**. If narrow rights cannot satisfy both operations, keep the bridge unavailable and
run the supported console demonstration. Record this limitation in the evidence.

Only a real HTTP 202 Location creates a pending app request. Missing IDs, direct 204 application,
timeouts and inconsistent observations fail closed; inspect the console before retrying an
uncertain write. No automatic retry or destructive mapping replacement occurs. Reads use
`authorizationCount`, `threshold`, distinct `authorizers`, current `PENDING/APPROVED/DENIED`
semantics; missing values stay unknown. SDK-installed readiness is not proof of a live quorum.

## Acceptance and sanitized evidence

Run `npm test`, `npm run typecheck`, `npm run build`, `npm run verify:dpop` and the current pack's
`tide-doctor.sh --app . --check --url http://localhost:3000`. Doctor cannot pass the missing-adapter
check before a real realm has been licensed and exported. Do not create a fixture to hide that.

Execute the A1–A15 acceptance matrix in `FUNCTION_PLAN.md` on the live realm. In particular: author
seals; teacher and app-admin receive verified contract refusals using the saved ciphertext; wrong
or extra tags are refused; a self-grant has one approval and remains ineffective; duplicate voting
does not increase the count; reject the pending self-grant; separately release only the designated
invigilator with two distinct approvals; after real commit and fresh login, the invigilator opens
the exact source; teacher/admin remain refused. Verify governance membership and policy changes
are themselves governed and the actual signed M0 requires two approvals.

Use `docs/evidence/tide/status.json` for the truthful current status. Add only sanitized versions,
public fingerprints, CR IDs/counts/thresholds, outcomes and timestamps. Never include plaintext,
tokens, proofs, private keys, passwords, invitation URLs or licence secrets. Do not describe an
outage as an access refusal, an app log as immutable evidence, or manual release as a time lock.

Primary implementation references: Tide Agent Pack 1.9.33 relationship-attestation scenario,
its relationship helper and IGA API canon; installed package declarations/source;
[Tide JS](https://github.com/tide-foundation/tide-js),
[TideCloak JS](https://github.com/tide-foundation/tidecloak-js),
[IGA extensions](https://github.com/tide-foundation/tidecloak-iga-extensions).
