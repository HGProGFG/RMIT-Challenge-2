# Sealed Exam Vault / Đề thi niêm phong — Web Build Specification

**Prepared:** 22 October 2026, Vietnam time (Asia/Ho_Chi_Minh).  
**Deliverable:** specification only; no application, realm, accounts, deployment, publication, or submission created.  
**Recommended MVP:** one encrypted synthetic text exam; browser-only plaintext; separate authenticated identities; Tide-enforced decryption; a live 2-of-3 governed permission release; an administrator bypass demonstration. **Automatic cryptographic time release is not established and is excluded from the default build.**

## Evidence conventions and source register

- **V — Verified documentation/source:** supported by current official documentation or connected Raziel material. This is verification of the integration contract, not a successful test of this application.
- **P — Proposed:** a build decision or application contract specified here.
- **S — Simulated:** a clearly labeled demonstration with no security authority. Default MVP has no simulated cryptography, identity, or approval votes.
- **U — Unresolved:** needs vendor confirmation or a live compatibility/security check before the associated claim can be made.

No runtime Tide integration was exercised while preparing this document. Do not change a V label to “tested” until the milestone evidence exists.

Sources reviewed on 22 October 2026:

| ID | Source | What it establishes / limits |
|---|---|---|
| C1 | [Official UNLOCKED challenge](https://tide.org/unlocked/#challenge), [submission section](https://tide.org/unlocked/#submit), [page configuration](https://tide.org/unlocked/config.js) | Challenge mission, submission artifacts, five judging prompts, weights, branding URLs, and regional deadlines. Web reader could not retrieve this page; its official HTML and config.js were read directly over HTTPS. The static HTML includes a closed-countdown fallback; use the configured regional deadline and confirm actual form availability separately. |
| D1 | [TideCloak introduction](https://docs.tide.org/) | Official product and setup entry point. |
| D2 | [E2EE setup](https://docs.tide.org/Admin/e2ee) | Licensed Tide realm, QEA, browser SDK operations; published examples are self-encryption, not sufficient for author-to-invigilator sharing. |
| D3 | [QEA setup](https://docs.tide.org/Admin/SetupIGA) | Governed role changes, multi-admin approvals and automatic commit at quorum. |
| D4 | [Next.js reference](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-reference), [JWT verifier](https://docs.tide.org/Languages/NextJS/VerifyJWT) | Provider/hooks, protected routes and JWT helper; JWT verification alone does not establish DPoP proof validation. |
| D5 | [Forseti engine](https://docs.tide.org/Core-Concepts/forseti-engine) | Network policy validation and general time-window examples; does not establish a supported absolute exam-release clock or its provenance. |
| D6 | [Threat model](https://docs.tide.org/threat-model), [Secure Web Enclave](https://docs.tide.org/secure-web-enclave) | Vendor architecture/security descriptions; not evidence that this app exports signed audit receipts or survives malicious application-delivered JavaScript. |
| R1 | Connected Raziel `tide_choose_scenario`, `tide_scenario("relationship-attestation")`, `tide_scenario("iga-admin-governance")` | Agent Pack v1.9.33; built-in `RelationshipAttestation:1`, separate encryption and governance paths. Source references ORK `main` c69fc4f6, 16 Oct 2026; caller-denial tests reported by Tide, not reproduced here. |
| R2 | Raziel `tide_canon("iga-change-requests-api")` | Current per-request API, live signed M0 threshold, two-phase `/approve`, distinct HTTP callers, and bootstrap limitations. Source audit f093800 / 7 Oct 2026. |
| R3 | Raziel `configure-e2ee-roles-and-policies`, `setup-forseti-e2ee`, `concepts` encryption section | Shared encryption requires `IAMService` plus signed policy bytes; hook convenience encryption is identity-bound self-encryption. Prefer R1's updated fixed roles over older generic examples. |
| R4 | Raziel `verify-jwt-server-side`, `tide_dpop_asset` | Local embedded JWK verification plus separate RFC 9449 proof verification; relay asset, rewrite and header requirements. |
| R5 | Raziel `custom-contracts` sections: built-ins, runtime, time example, Decision Builder, sandbox; `verifiable-claims`; `tide_gaps` entries 003, 040, 041, 071, 078 | Time and geo examples have limits; custom deployment is Tide-team operated; governance and Fabric thresholds differ; signed evidence requires a trusted verification key. |
| P0 | Local proposal `/Users/vbhh/Downloads/y-tuong-de-thi-niem-phong.md` | Product inspiration only. Its exact-time, exam-room, immutable-audit and complete-server-compromise claims are not accepted as established capabilities. |

**Conflict policy:** prefer the current, specific R1/R2 contract over older generic playbooks. R2 explicitly corrects older claims that filing a request auto-approves it and that a bare `/authorize` supports MultiAdmin. Record version differences; never silently fall back to ordinary Keycloak, Tideless, self-encryption, or a mock.

## 1. Product summary, users, and new possibility

An institution can keep an exam encrypted in infrastructure operated by an application administrator without giving that administrator unilateral decryption or permission-granting authority. The prototype makes this visible by letting the administrator inspect storage, alter an application display-role row, and request protected access; none produces plaintext.

Primary users are an exam author, a designated invigilator, teachers who need scheduling metadata, the application operator, and a small independent governance group. This reduces the need to trust the database operator with exam confidentiality. It does not eliminate trust in authors, approved recipients, the governing quorum, delivered frontend software, or Tide's deployed network.

Default product copy: **“Encrypted exam papers. Access released by independent approval.”** Subtitle: **“Đề thi niêm phong.”** Do not advertise “only at exam time” or “only in the exam room.”

## 2. Challenge alignment and evidence for judges

The differentiator is authority outside the application database. A backend `if (role)` demonstration alone is insufficient. Show a real network decryption attempt with the attacker's genuine session and actual stored ciphertext, even after application-side checks are bypassed.

| Judging criterion (C1) | Weight | Evidence to show |
|---|---:|---|
| Vision & originality | 25% | The exam stays encrypted while the operator can still run the service. |
| Trust constraint insight | 20% | Administrator reads the database and edits a local role, but cannot open the paper. |
| Value & impact | 20% | A clear synthetic examination-office example; fewer people need blanket paper access. Do not invent incident statistics. |
| Why TideCloak matters | 20% | Real SDK decryption refusal, actual governed grant pending at 1/2, then committed after the second distinct approver. |
| Prototype & storytelling | 15% | One legible attack-and-release sequence with visible limitations and successful recipient opening. |

Evidence drawer: runtime version manifest, ciphertext byte count and digest, sanitized attempt outcome, real change-request ID, authoritative threshold/count, committed status, and active subject. Never show tokens, credentials, browser keys, or the full enrollment link in the recording.

## 3. MVP scope, exclusions, and assumptions

**P — Scope:** one exam per demo run, UTF-8 plain text up to 16 KiB; one author, one invigilator, one teacher, one application administrator, and three distinct governance identities. All content, names and metadata are synthetic. Text editor plus `.txt` import; render escaped text only. No PDF parser is needed.

Include seven views in section 5, one sealed record, governance-mediated release, and a timeline. Exclude grading, students, personal records, email, payments, institutional tenancy, bulk exams, recovery services, location checks, document DRM, and a decorative landing page.

Workspace inspection found an empty Git checkout and no existing application or AGENTS.md in the checked workspace/ancestor locations. Use a new suitable Tide template during implementation; this task does not scaffold it.

**Release decision:** governance manually grants the invigilator `_tide_decryptor` after two approvals. The displayed scheduled release is advisory. Two approvers can release early; nobody should infer an independent clock prevents them. No production scheduler or backend clock check substitutes for that missing control.

**Demo threat assumption:** attacker controls the application database and ordinary app configuration, but not an approved recipient session, independently pinned verification configuration, two governance identities, or enough Tide network participants. Full application-server control and malicious frontend delivery are discussed separately in section 10.

## 4. Journeys, identities, and role/action matrix

All demo identities must actually authenticate. A selector chooses a sign-in destination/profile; it never rewrites identity claims. Record issuer + subject and, where required by the SDK, the Tide user key. Friendly aliases do not establish identity.

| Identity | Metadata | Encrypt/seal | Decrypt | Request grant | Approve governed changes | Infrastructure |
|---|---|---|---|---|---|---|
| Author | Yes | Own run, once | No SDK read grant; already knows source | No default UI | No | None |
| Invigilator | Yes | No | After governed release and valid signed policy | May request release | No | None |
| Teacher | Yes | No | Denied | No default UI | No | None |
| Application administrator | Yes | No | Denied | Yes, proposal only | No | App/storage operation |
| Governance G1, G2, G3 | Yes | No | Denied by default | Yes | Each counts once; 2-of-3 required in active signed M0 policy | Realm governance |
| TideCloak master/bootstrap operator | Setup only | No app grant | No default app grant | Setup/maintenance may affect trust | Must not become a runtime bypass | Operates IAM instance; separate from app admin |
| Tide network participants (ORKs) | Protocol metadata as applicable | Participate in protocol | Participate in authorized protocol | No app UI role | Not the human governance voters | Fabric operators; threshold is distinct |

**P — Realm role allocation:** `author` + `_tide_encryptor` for author; `invigilator` for invigilator, with `_tide_decryptor` absent until release; `teacher` for teacher; `app-admin` for app administrator. Governance accounts hold `tide-realm-admin` and only the administration privileges needed by the verified console; none holds either encryption-operation role. Do not put `_tide_encryptor` or `_tide_decryptor` into default/composite roles available to everyone. No runtime application credential may approve, sign policies, or impersonate users.

**Journeys**

1. Author authenticates, reviews synthetic text locally, encrypts with the approved write-only exam policy, and persists only the ciphertext. Sealing is an application write-once state, not a claim that a hostile database cannot replace bytes.
2. Teacher authenticates, views metadata, attempts to open, and sees an SDK/network denial.
3. App administrator reads the stored ciphertext, writes `invigilator` into an application-owned display-role row, and repeats decryption: still denied. Requesting real access creates a governed request; it does not grant it.
4. G1 and G2 inspect the administrator's real request. G1 signs once; access remains denied. G2 rejects it. G1/G2 then approve a separate legitimate invigilator release request.
5. Invigilator authenticates afresh after the grant commits, fetches the signed read-only policy and ciphertext, and decrypts in the browser. No plaintext passes through the application API.

A single person controlling all seven browser profiles is demonstrating separation of identities, not proving seven independent people. Use separate humans/devices for governance where practical, and state the recording arrangement.

## 5. Screens, layout, key copy, and states

### Shared shell and visual system

Desktop: 224 px left navigation, 64 px top identity bar, content max-width 1200 px with 24 px spacing. Navigation: Vault, Activity, Administration, Governance; show relevant navigation but enforce authorization at APIs and Tide independently. At 375 px, use a compact menu, single-column cards and stacked action buttons. No essential information hidden by horizontal overflow.

Use system sans-serif, 16 px body, 14 px labels, 28 px page heading. Neutral white/slate surfaces and one indigo accent; semantically colored badges may supplement explicit words/icons. AA contrast (4.5:1 ordinary text), visible focus, semantic buttons/headings, labels, 44 px touch targets, logical focus order, `aria-live` for results, and `prefers-reduced-motion`. No celebratory or security-themed animation. Accessible modal focus trap and restoration. Display UTC timestamps plus Vietnam local time and zone.

Persistent banner: **“Live Tide integration · Manual governance release · Synthetic content.”** If integration readiness is unknown: **“Protected operations unavailable — configuration not verified.”** Any separate optional simulation must use **“SIMULATION — no protected authority changed”** throughout that mode, and be excluded from security evidence.

### 5.1 Sign-in and identity selection (`/sign-in`)

Project title/subtitle, short purpose, identity cards with role descriptions, “Sign in with Tide,” and current verified subject after authentication. Card text: “Choosing this card does not grant its role. Authenticate the matching account.” Use separate browser profiles/windows for recording; switching identity logs out, clears exam plaintext/state and forces a new confirmed session. Do not use query parameters as identity, share a service account, or assume SSO selected the requested person.

States: initializing, redirecting, canceled login, popup/storage blocked, session expired, wrong profile. On mismatch: “This session belongs to [alias]. Sign out to use another identity.” Never silently disable DPoP to make login work.

### 5.2 Exam vault (`/vault`)

Page title, one exam card/table row with synthetic title, author alias, content type, sealed timestamp, scheduled release, access release state, and “View exam.” Above the row: “Schedule is advisory. This prototype releases access by two independent approvals.” Author gets “Upload synthetic exam.” Show empty state, metadata loading skeleton, retryable load error and service-unavailable banner.

Separate labels: **Sealed**, **Awaiting release approval**, **Access released**, **Opened in this session**. A countdown reaching zero changes only advisory text to “Scheduled time reached — approval still required.”

### 5.3 Author upload/seal (`/vault/new`)

Title, advisory schedule with timezone confirmation, optional `.txt` picker, labeled text preview, byte counter, “Synthetic exam only” checkbox, approved policy fingerprint, and “Encrypt and seal.” File decoding and preview occur locally. Signed write policy is prepared for a fresh run ID before enabling seal. Copy: “Encryption runs in this browser. The server receives encrypted bytes.”

Progress: reading → validating → encrypting with Tide → saving ciphertext → sealed. File/size errors stay inline. Missing policy: “A governance administrator must prepare this exam's encryption policy.” Network/signature failure leaves no sealed exam; retry saving the same encrypted result using an idempotency key. Prevent duplicate submissions. On success clear file/text state; explain that JavaScript cannot guarantee forensic memory erasure.

### 5.4 Exam detail and decrypt (`/vault/:id`)

Left: metadata and immutable-per-run identifiers/digests as recorded by the app. Right: status, “Attempt to open,” current identity, policy readiness, result panel, and timeline preview. Render decrypted content as escaped monospaced text with “Hide paper”; no automatic downloads. Opening is an explicit user action.

Success: **“Opened in this browser for Invigilator. Authorized readers can copy this content.”** Denial: **“Access denied by Tide. This identity has no protected read authority.”** Before release: **“Access has not been released by governance.”** Do not say “too early” unless a trusted time predicate is actually verified. Keep a confirmed network denial separate from an application precheck.

Errors: session expired → sign in; invalid signed policy/corrupt ciphertext → blocked; network unavailable → “Could not verify protected operation; paper remains closed”; unknown SDK failure → “Opening could not be verified.” A generic threshold/network error alone is not evidence of permission denial. Show sanitized diagnostic code and correlation ID; only map known nested contract messages to a denial reason.

### 5.5 Administrator attack panel (`/administration/attacks`)

Three numbered cards, each with actual result evidence:

1. **Inspect stored ciphertext:** read back the persisted blob, show exact byte count, encoding, SHA-256, escaped excerpt, and download ciphertext. Label the digest “Integrity reference; not a signature.” Include developer verification against a direct read-only DB query. Do not display a generated random stand-in.
2. **Request invigilator access:** fixed target is current verified app-admin subject and allowlisted roles. Submit request, display real Tide CR IDs, affected roles, threshold and pending state. If two grant requests are needed, show both rather than a fabricated combined vote. No “approve as admin” control.
3. **Change application display role:** update only `DemoRoleOverride.displayRole`, show before/after, then call a real SDK decryption with the unchanged authenticated session and persisted ciphertext. Copy: “This row changes the app's label. Tide's signed credential and permissions have not changed.” Label this a real mutation of a non-authoritative app row, not a Tide role mutation.

An optional manual forged-token test belongs in integration tests; don't build a token editor into the UI. Denials and unavailability must not share a fabricated “attack blocked” success state.

### 5.6 Governance (`/governance`)

List live requests with target, security impact, requestedBy, creation time, action type, authoritative threshold, distinct authorizers and status. Detail pane shows exact role additions/removals and dependencies. “Approve in Tide” opens the supported enclave flow in that approver's own authenticated browser; “Reject request” is offered only for a freshly fetched PENDING request. Warn before approving the attacker request: “This would give this identity protected exam access.”

Show **“1 of 2 required approvals · 3 eligible governance identities”**, not 1/3. Never count client clicks. No request record → no pending approval badge. Missing threshold/count → “Approval state unavailable”; never default to 0 or assume 2. Wait for authoritative committed/applied state before “Access granted.” Refetch after conflict; prevent stale edits. Minimal fallback: embed the custom read view and link into the real Tide console for approval rather than build an unverified approval implementation.

### 5.7 Activity timeline (`/activity`)

Timestamp, identity, action, outcome, source, correlation/CR ID, and evidence category. Filter by exam/action; cap/paginate. Include seal, client-reported SDK attempt, API-denied request, local role edit, governed grant request, each observed approval, committed release, and client-reported opening.

Every ordinary entry says **“Application log — editable by infrastructure operator.”** Client callbacks say **“Client reported.”** A mirrored governance status says **“Observed from TideCloak”**, not “cryptographically verified.” Only an independently verified artifact may carry **“Signature verified”**, naming exactly which bytes and pinned key were checked. Empty, loading, partial-sync, disconnected, and invalid-evidence states must be visible.

## 6. Lifecycle and state machines

Keep content, release, and session-opening states independent.

| Dimension | P — States and transitions | Authority |
|---|---|---|
| Exam content | `PREPARING` → `DRAFT` → `ENCRYPTING` → `SEALED`; failed encryption returns to draft; failed persistence retries same encrypted upload; sealed content has no normal edit route | App workflow; DB owner can tamper/delete |
| Release | `UNRELEASED` → `REQUEST_PENDING` → `RELEASED`; reject returns to unreleased; missing/inconsistent evidence → `UNKNOWN_BLOCKED` | Effective protected realm grant, validated policy and fresh session; app cache is display-only |
| Opening | `CLOSED` → `OPENING` → `OPENED` / `DENIED` / `UNAVAILABLE`; hide/logout returns to closed | Actual SDK result in current browser |
| Schedule | `BEFORE_ADVISORY_TIME` / `ADVISORY_TIME_REACHED` | Display clock only; no permission transition |
| IGA request | `PENDING` → `APPROVED` / `DENIED` / `CANCELLED` | TideCloak R2; `APPROVED` means committed/applied |

“Ready to commit” is a property of a pending request, not a fictional committed state. R2's unified `/approve` normally auto-commits at threshold. An application-only request-draft state may exist before contacting Tide but must not be displayed as an actual IGA request. Editing pending CR rows invalidates existing authorizations; omit this feature in MVP. Denying an already-approved CR does not revoke access; never use it as undo. Revocation is a new governed role removal and may not invalidate already-issued credentials immediately.

## 7. Recommended stack and architecture

**P — Stack:** Next.js App Router, TypeScript strict mode, Tailwind, minimal accessible component primitives; official compatible `@tidecloak/nextjs` plus `@tidecloak/js`, `heimdall-tide` and matching policy dependencies from the versioned Raziel reference. Pin tested versions in a lockfile and record realm image digest/ORK compatibility. Use Tide's existing auth/DPoP template and `templates/relationship-attestation/relationship.ts` for policy plumbing. Do not regenerate security serialization from this spec.

**P — Storage:** local SQLite via a compatible lightweight driver for a single Node process and one synthetic text blob. Tide's reviewed material prescribes storing ciphertext/signed policy bytes but does not mandate a database vendor. SQLite is our low-setup choice, not a Tide-certified backend. TideCloak's own database remains separate. For a later multi-instance deployment use PostgreSQL plus shared atomic DPoP replay storage; that is out of MVP scope.

```text
Author browser --local plaintext--> Tide SDK / SWE <--> Tide ORK network
       |                                   authorization + crypto protocol
       +--ciphertext + public metadata--> Next.js API --> SQLite

Invigilator browser <--ciphertext + signed policy-- Next.js API
       +--current authenticated SDK / SWE request--> ORKs
       <--authorized decryption result--             |
       +--plaintext rendered locally only------------+

G1/G2/G3 browser --own session + enclave approval--> TideCloak IGA
Next.js --minimal proposal/read credential, if necessary--> TideCloak IGA
```

The diagram is a logical flow; SDK may perform hybrid encryption locally and use the network for protected key operations. Do not assert every content byte traverses an ORK or invent an AES/key-wrapping format. Preserve the opaque SDK ciphertext.

**Plaintext:** author's selected file, browser preview, transient SDK processing, invigilator's returned browser buffer/DOM. Never send source/decrypted text to APIs, SSR, telemetry, error reporters, local/session storage, browser caches, logs, thumbnails or backups. Clear state on hide/navigation/logout; `Cache-Control: no-store` on protected responses; no plaintext service worker caching. Browsers/OS and recipients can retain copies. SDK-managed DPoP key storage may exist; do not claim all browser key material is memory-only or copy it into app storage.

**Configuration:** public client/realm IDs, pinned public adapter JWK and endpoint metadata are allowed. No reusable exam key, decrypt-capable service identity, governance session, recipient refresh token, or bootstrap master password belongs in runtime configuration. Bootstrap credentials stay outside runtime and Git. Treat the verification key as a separately pinned trust root; a hostile server able to replace code and that key can spoof the UI/verifier.

## 8. Verified integration plan, dependencies, and gaps

### 8.1 Authentication and DPoP

**V — D2–D4, R4:** QEA-enabled Tide identities issue the credential needed by E2EE. `verifyTideCloakToken(config, token, allowedRoles?)` is the real helper; it returns claims or null. It verifies JWTs, **not DPoP proofs**. Assert the exported adapter has embedded `jwk.keys`; otherwise the helper can fetch remote keys, weakening the intended pinning model. Restrict accepted token algorithms to the verified realm configuration (Tide QEA EdDSA), validate issuer, authorized party `azp`, required expiry/time claims, and exact relevant realm/client role namespace. Do not assume `aud` equals client ID; inspect real claims and configure intended audience handling explicitly.

**P — Every protected application API:** verify token + required claims, then proof signature with the proof's public JWK, `typ`, allowed algorithm, `cnf.jkt` thumbprint, `ath`, method `htm`, canonical external URL `htu`, fresh `iat`, and atomic single-use `jti`. Require proof even if a bound token is presented as Bearer. Reject unbound tokens. Use the pack's tested `templates/dpop-verify/verifyDpop.ts`, not the illustrative snippets alone. Store replay identifiers with expiry and a unique constraint in SQLite for the single-process demo; a separate in-memory map per instance is insufficient. Nonces, if required by the selected server, follow that server's verified exchange.

**V/P — Provider wiring:** `useDPoP: { mode: 'strict', alg: 'ES256' }` goes inside provider config, not JSX props. Copy `public/tide_dpop_auth.html` from the compatible SDK (pack says shipped at `@tidecloak/js >= 0.14.34`) or exact pack asset. Known-good reviewed asset: 9120 bytes; SHA-256 `9d7844b938f0a2565fa910d3d30e9b8797cbfd6e0b73d59d804169a089aea757`. Revalidate on version changes. Preserve `/tide_dpop/:path*` rewrite, relay-specific CSP and `Allow-CSP-From: *` after catch-all headers, and verify served headers. Do not apply relay exceptions to the whole site. Test popup/iframe/browser storage behavior and use `secureFetch` for protected requests. Only trust forwarded origin headers behind a configured trusted proxy.

Route middleware improves navigation but does not replace route-handler or network authorization. At implementation time run Raziel's `tide_doctor`, inspect failures, and test real login before claiming success.

### 8.2 Shared exam encryption and policy definition

**V — R1/R3:** ordinary `useTideCloak().doEncrypt/doDecrypt` examples without policy perform self-encryption; another identity cannot open that ciphertext merely by acquiring a matching role. Shared encryption uses `IAMService.doEncrypt(items, signedPolicyBytes)` and `IAMService.doDecrypt(items, signedPolicyBytes)` with `Uint8Array` signed policy bytes. Call through the exact reference's initialized IAMService export rather than assuming hooks expose the same overload.

Use built-in `RelationshipAttestation:1`, which R1 reports available on updated ORKs since 16 October 2026. Runtime availability on the chosen network remains **U**. Never upload a custom replacement if absent.

**P — Two signed policies per fresh exam UUID:**

| Policy field | Author policy | Invigilator policy |
|---|---|---|
| `contractId` | `RelationshipAttestation:1` | Same |
| constructor `modelId` | `["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"]` | Same |
| approval / execution | `IMPLICIT` / `PRIVATE` | Same |
| key | Realm `vendorId` | Same |
| `subjectType` | `Role` | `Role` |
| `subjectId` | `author` | `invigilator` |
| `assignmentId` | Fresh exam UUID | Same UUID |
| `roles` parameter | JSON string `["_tide_encryptor"]` | JSON string `["_tide_decryptor"]` |
| `clientId` | Omit for realm role | Omit |

All parameters are strings. Every item has exactly one tag, `[examId]`, in both operations. Read policy version from `Models.Policy.latestVersion`; constructor uses `modelId` singular even if the instance exposes `modelIds`. Copy current serialization/signing reference. Policy signatures are obtained through an authenticated `tide-realm-admin` browser enclave ceremony, not by posting JSON to a backend. Persist only signed, parsed, expected-subject/record policies after successful verification/round trip. Policy prepare failure blocks upload.

**Important boundary:** R1 says relationship policies are approved at signing in the enclave, **not** ordinary IGA change requests. Do not show a policy-signing popup as a 2-of-3 IGA approval. Whether the chosen network's policy-signing authority itself requires the same two humans is **U**. The MVP therefore gives every governance identity **no `_tide_decryptor`**, and protected access requires a governed grant of that gate role in addition to a valid policy. A lone governance signer issuing another relationship policy must not thereby acquire plaintext. Test this explicitly. The stronger claim “every possible policy replacement requires 2-of-3” is blocked until independently verified.

### 8.3 Governance and protection of the rules

**V — D3/R2:** use Tide mode (`iga.attestor=tide`), QEA enabled, linked MultiAdmin accounts and signed M0 `tide-realm-admin` policy. Tideless username approvals are not a substitute. Bootstrap/FirstAdmin has weaker single-admin mechanics; finish it before presenting a protected demo.

**P — Concrete threshold:** three active governance admins, live signed M0 threshold **2**, i.e. **2-of-3**. R2 reports `max(1, floor(0.7 × active admins))` as a fallback/projected value; the threshold in the active signed policy is the live gate and changes through `REGEN_ADMIN_POLICY`. Do not set a JavaScript constant or realm attribute and assume it changed M0. Require diagnostics plus an under-threshold commit rejection. With two admins the floor formula may still produce 1: three is intentional.

| Sensitive change | Required protection / evidence |
|---|---|
| Grant/revoke `invigilator` or `_tide_decryptor` | Actual IGA CR under live threshold; no effective credential before commit; refresh/re-login afterward. |
| Group membership, composites, default roles, token mappers that could convey access | Treat as privilege grants. Verify they are governed on the selected version and do not inherit unintended read authority. Not all mutating endpoints are covered simply because IGA is on. |
| Release exam | Grant `_tide_decryptor` to designated invigilator through 2 approvals. This is permission release, not clock release. |
| Change displayed release time | App metadata only; changing it never releases authority. Log it as editable metadata. |
| Replace signed read policy | Admin enclave signing exists; same 2-of-3 coverage unresolved. Keep governing identities outside all decrypt gates and freeze the prepared policy set for the demo. App “freeze” does not bind a hostile realm admin. |
| Change governance membership, threshold/M0, disable IGA, offboard/delete realm | Governed control-plane paths, dependencies and M0 regeneration must be tested. R2 reports a quorum floor for admin removal and default offboarding minimum of 3. Deny runtime service access to these operations. Uncovered alternate path blocks stronger governance claims. |

The ordinary application administrator is not one of G1–G3. Optional stronger test: one actual Tide admin attempts self-grant and direct commit and cannot pass threshold. R2 does **not** establish a general “requester cannot approve their own request” rule; one eligible requester can count once. Duplicate `/approve` may return recorded rather than error, but must not add another vote.

### 8.4 Time, location, audit: explicit unresolved boundaries

**U — Automatic release:** D5 and R5 contain weekday/hour helper examples and references to time-lock tags, but no verified end-to-end integration here establishes an absolute not-before instant, trusted time input, skew behavior, rollback resistance, and decryption-side enforcement for this built-in relationship policy. R5 blocks nondeterministic direct clock calls in custom sandbox code. Policy expiry is not evidence of a not-before lock. `RelationshipAttestation:1` lists subject/role/tag/expiry checks; no scheduled release parameter was established. Never append a `DecryptTimeLock` tag to this contract: its exact-tag rule would reject it, and a tag name alone proves no trusted clock.

**Default:** manual governed release, advisory schedule, no time slider. Optional UI-only simulation goes on an isolated explanatory screen, clearly S, and never changes a real grant. If Tide later confirms automatic release, document its exact deployed contract/model, signed UTC release value, trusted time source/clock owner, node enforcement, skew and boundary semantics, policy-change governance, and direct early-decrypt refusal. Then record a short real window (about 60–90 seconds) without advancing app/browser time. No automatic-time claim before those tests.

**U — Location:** no independently verified exam-room/device-presence control. A “country” parameter or browser geolocation is not proof of room presence. No location claim in MVP.

**U — Audit integrity:** D6 describes signed audit architecture, but a supported export/verifier for every application decrypt/deny event was not established. Default timeline is mutable app logging. Signed policy bytes can prove integrity of those policy bytes when verified with a separately pinned key; they do not prove when/whether a human read plaintext, completeness of attempts, or immutable event history. Governance diagnostics/`finalSignature` are not automatically independently verifiable receipts without a documented signed-message format. Optional receipt verification must work offline, fail on a byte mutation, and report skipped checks; otherwise omit the badge.

### 8.5 Setup dependencies for later implementation

Before provisioning, obtain the human's license-management email and explicit acceptance of [Tide terms](https://tide.org/legal); do not infer either from this specification request. Ask local Docker versus hosted Skycloak before creating a realm (Raziel reports realm placement cannot later be moved). Recommended default for planning is local Docker with real network access, pending that choice. At post-bootstrap onboarding, follow Raziel's branding/profile questions; no user email or profile is invented.

Prepare compatible template/SDK assets, exact callback origins, pinned adapter, three independently enrolled governance accounts, and all intended realm roles/mappers. Complete governance activation and M0 regeneration, verify no unresolved bootstrap/adoption dependencies, and remove bootstrap credentials from app runtime. No contract deployment, account creation or external messaging is authorized by this document. Custom Forseti deployment is experimental and Tide-team operated; the reduced MVP avoids it.

## 9. Data model and API contracts

Everything in this section is **P — application design**, except explicitly named Tide endpoints. No proposed function name is presented as a Tide SDK export.

### Storage schema

| Entity | Fields and constraints | Sensitive handling / authority |
|---|---|---|
| `DemoRun` | `id` UUID PK, realm/client IDs, createdAt, mode=`LIVE_MANUAL_RELEASE`, expected policy fingerprints, pinned-key fingerprint, version manifest | No secrets. Fingerprints in editable DB are display references unless independently pinned. |
| `Exam` | UUID PK, runId FK, title ≤120 chars, authorIssuer/subject, advisoryReleaseAt UTC, sealedAt, contentType=`text/plain;charset=utf-8`, ciphertext BLOB, ciphertextSha256, byteLength, version=1, state | No source filename if it contains personal data; no plaintext/hash-of-plaintext persisted. Unique sealed run; ordinary update cannot replace ciphertext. |
| `ExamPolicy` | UUID, examId, purpose=`WRITE`/`READ`, contractId, subjectType/Id, signedBytes BLOB, digest, version, signing evidence reference | Opaque signed bytes plus parsed metadata; signature must match parsed content. No signing key. Unique exam/purpose/version. |
| `GovernanceLink` | app request UUID, examId, requesterIssuer/subject, targetIssuer/subject, requested allowlisted roles, Tide CR IDs, lastObservedStatus/count/threshold, observedAt | Read cache only, never source of effective authority. Mark stale. |
| `DemoRoleOverride` | runId + issuer/subject unique, displayRole enum, updatedAt | Only local attack/display row; never used for crypto or real API roles. |
| `ActivityEvent` | UUID, runId/examId, actorIssuer/subject, kind, outcome, source, code, correlationId, Tide CR ID, observedAt, optional artifact/digest | App/client observations; mutable. Allowlisted fields; no plaintext/tokens/raw headers. |
| `DpopReplay` | proof-key thumbprint + jti unique, expiresAt | Atomic insert; preserve until proof freshness window ends. Fail closed on DB errors. |

Do not persist plaintext checksums: exam text has low entropy and a checksum can aid guessing. Ciphertext digests help compare storage reads, not authenticate author origin. UUIDs are fresh on each reset to prevent mixing old policies and new exams.

### Application HTTP surface

All routes except the sign-in shell/public assets require JWT + DPoP, exact role checks where indicated, strict same-origin mutation handling, bounded bodies, schema validation, rate limits, and `no-store`. Use canonical issuer/subject from verified claims; ignore caller-supplied actor roles. Error envelope: `{error:{code,message,correlationId,retryable}}`. Successes carry correlationId and resource version. Unknown auth/config dependencies fail closed. `401` session/proof invalid; `403` valid identity lacks API privilege; `409` state/version conflict; `413` limit; `422` malformed payload; `503` verification dependency unavailable. Browser SDK denials are a separate result, not a fabricated app HTTP 403.

| Contract | Input → result | Enforcement point |
|---|---|---|
| `GET /api/session` | → verified alias/subject, exact role list, integration readiness | API verifier; labels never grant rights |
| `POST /api/exams/prepare` | author: `{title,advisoryReleaseAt}` + idempotency key → fresh examId, pending-policy status | API author check; no plaintext; governance prepares policies before seal |
| `POST /api/exams/:id/seal` | author: `{ciphertextBase64,writePolicyId,contentType}` + expected version/idempotency key → sealed metadata and server-computed digest | API ownership/state/size checks; SDK encrypted before POST. Accept only bounded opaque envelope matching reference format; API cannot prove it is an exam or guarantee client encrypted honestly |
| `GET /api/exams`, `GET /api/exams/:id` | → synthetic metadata and observed release state | Authenticated demo participants |
| `GET /api/exams/:id/ciphertext` | → actual persisted ciphertext/encoding/digest | All authorized demo participants including teacher/admin, intentionally: confidentiality must survive possession of ciphertext |
| `GET /api/exams/:id/policy?purpose=READ` | → prepared signed read policy or explicit not-ready | Authenticated exam participants for this fixed synthetic demo; intentional policy disclosure permits direct negative tests. Policies reveal subject/record metadata. In broader use limit disclosure to intended subjects |
| `POST /api/exams/:id/access-requests` | `{kind:"SELF_ACCESS"|"INVIGILATOR_RELEASE"}` → `202` with real CR IDs or explicit setup/unavailable error | app-admin may request self; designated release requester may request fixed invigilator; target/roles allowlisted server-side |
| `GET /api/governance/requests` | → sanitized observed Tide CRs + source timestamp | app-admin sees own; governance sees relevant demo requests. No cached “approved” authority |
| `PUT /api/demo/display-role` | app-admin: `{displayRole:"invigilator",runId}` → local row before/after | Live synthetic demo only; no real grant; production route absent |
| `POST /api/activity/client-observations` | `{examId,kind,outcome,code,correlationId}` → recorded client-reported event | Verified caller + bounded enums; cannot attest successful decryption |
| `GET /api/activity` | → paginated permitted observations/evidence labels | API roles + fixed run scope |

**No `/api/decrypt`, `/api/plaintext`, server impersonation, master-key route, or production reset route.** Decrypt attempt is local: fetch persisted ciphertext and prepared signed read policy; call the real shared SDK with current identity; classify actual result; clear/retain local plaintext only as the user directs.

**Policy storage:** implement a separate governance-only signed-policy ingest route if the reference needs it: bounded base64 bytes; validate expected contract, subject, operation, assignment and signature with the reviewed library before accepting. No server-generated “approved=true.” If signature validation format cannot be established, keep policy ingest disabled until the real reference round trip is proven.

**Proposal bridge:** prefer supported Tide console actions. If the app needs a proposal/read service credential, narrowly authorize it to the required role-mapping writes/reads, never approvals/policy signing/impersonation. It holds no decryption authority. Verify that all its writes become governed requests. Exact fine-grained privilege support is a setup dependency; if unavailable, have a governance operator propose the app-admin's request in the real console and label the app request “Awaiting operator proposal” until a genuine CR exists. Do not fabricate a pending CR to hide this dependency.

### Verified Tide governance exchange (R2)

Base: `{tidecloak}/admin/realms/{realm}`. Role mapping proposal uses the supported admin API, e.g. `POST /users/{targetId}/role-mappings/realm` with actual realm role representations `{id,name}`; live-test capture as `202` plus `Location`/CR ID. Existing assignments are not blindly rewritten.

- `GET /iga/change-requests?status=PENDING` and `GET /iga/change-requests/{id}` return authoritative records. List uses `authorizationCount`, `authorizers[]`, `threshold`, `readyToCommit`, dependencies, and status.
- Approver browser, authenticating as that human, calls `POST /iga/change-requests/{id}/approve` with `{}`. If `mode="needs-approval"`, pass returned `requestModel` through the exact enclave reference; post `{requestModel:"<base64 signed request>"}` to the same endpoint. Read returned `mode`, `authCount`, `threshold`, `committed`, status. List and approval-response count names differ.
- Never proxy those human approvals using a service-account identity: R2 credits the HTTP caller, not the signature's human label. Distinct humans behind one service token count as one caller and break accountability.
- Do not use legacy `/tide-admin/change-set/*`. `/authorize` is a bootstrap/back-compat lane and rejects ordinary MultiAdmin requests. `/commit` must reject below quorum (`412`) and cannot create missing approvals. Confirm `/approve` auto-commit behavior for the pinned build.
- On PENDING only, `POST /iga/change-requests/{id}/deny` may reject. Never treat denying APPROVED as revocation. `GET .../{id}/diagnostic-bundle` may expose threshold/evidence for inspection; it is not a complete immutable audit verifier.

## 10. Threat model and claim boundaries

| Threat | Expected prototype result | Boundary / residual risk |
|---|---|---|
| Teacher/admin obtains DB dump, ciphertext, policy bytes | Genuine caller cannot decrypt without the protected role and matching policy | This must be a live SDK denial, not just disabled UI. DB compromise still exposes metadata and permits deletion/replacement. |
| App DB role changed to invigilator | No change to signed credential or network authority | App role row has no crypto authority. Bad API code can still expose metadata or forge a screen. |
| App-admin proposes real self-grant | Pending; one independent approval insufficient; commit blocked | Requires active signed 2-of-3 policy and no inherited gate role. |
| Single Tide governor signs an alternative relationship policy | Still cannot read because they/teacher/app-admin lack `_tide_decryptor` | Same-quorum policy-signing enforcement is unverified. Stronger “all policies need two signers” statement prohibited. |
| Stolen or forged token / replayed proof | API rejects invalid signature/binding/replay; network checks authenticated request | DPoP is sender constraint, not universal proof of physical device integrity or protection against code running in the legitimate browser. |
| Server changes scheduled time / browser advances clock | No protected access change | No automatic trusted time enforcement claimed; two governors may choose early release. |
| Server substitutes unsigned policy, wrong record/tag or corrupted blob | SDK fails; no plaintext shown | Changing stored digest too can fool an app-only integrity display. Not proof of authored content. |
| Malicious server delivers modified frontend | Can steal author input, capture recipient plaintext, or deceive approval UI | Outside narrow storage/permission claim. SWE custody does not make application plaintext or delivered UI trustworthy. Separately controlled static builds, reviewed signed/pinned assets, CSP/SRI and independent approval review reduce risk but this demo does not establish complete frontend supply-chain immunity. |
| Authorized author/recipient leaks content | Not prevented | Author already knows source; invigilator can copy, photograph or transmit plaintext. No DRM claim. |
| Fake room/location data | Not a control | Additional independently verified device/location attestation needed. |
| Governance collusion/account takeover | Two valid approvers can grant access | Three accounts on one compromised laptop do not establish human independence. |
| Master/IAM operator, disable/offboard/failover paths | Must be checked for scope and effective cryptographic consequences | Do not extrapolate app-admin demo to all master/recovery/Ragnarok paths. Unverified paths remain outside stronger claims; no keys/password resets should silently downgrade runtime. |
| Network outage/insufficient participation | Protected operation unavailable | No emergency decrypt key or mock success. Fabric threshold/assumptions are deployment-specific and separate from 2-of-3 human governance. |
| App operator edits/deletes logs | Possible | No immutable/comprehensive audit claim; signed artifacts, if any, cover only their specified bytes. |

The application API's guards protect its own resources; Tide enforces the shared cryptographic operation. “Encrypted database” by itself proves neither integrity, correct authorization, safe frontend delivery nor system security.

## 11. Ordered implementation milestones

### M0 — First real vertical slice (highest priority)

Before dashboard polish, complete license/hosting authorization and compatible realm bootstrap, obtain genuine author/teacher/admin/invigilator identities, activate the three-governor threshold and prepare one write/read policy pair. Minimal developer page: real login → author shared encryption → save/read ciphertext → teacher/admin direct SDK denial → legitimate governed recipient grant → fresh invigilator session → permitted shared decryption. Compare original and decrypted synthetic bytes in the test harness only. Record versions, digest, sanitized network outcomes and CR IDs. No local-only self-encryption substitute.

Exit: cross-identity sharing actually works, both negative tests are policy/role denials rather than outages, and ciphertext comes from persistence. If the network lacks the built-in contract, stop protected feature claims and seek Tide compatibility confirmation; a labeled simulation is not completion of M0.

### M1 — Prove governance and all bypass assertions

Verify effective 2-of-3 M0, pending self-grant, one-vote rejection, duplicate identity not counted twice, actual second approval/commit on legitimate release, plus local-role tampering. Verify no decrypt gates for governors; attempt alternative signed read policy under one governor and confirm they still cannot read. Probe protected role/composite/default/membership routes and policy/threshold modification coverage; document unresolved paths. Never run destructive offboard/reset tests on a real deployment; use an isolated synthetic realm if authorized later.

Exit: central administrator attack has verifiable real outcomes. If sensitive grants bypass quorum, this blocks the advertised demo; don't hide it behind application controls.

### M2 — Application persistence and typed API boundaries

Implement schema, bounded ciphertext upload, owner/write-once/idempotency rules, no plaintext server paths, token/proof verifier and atomic replay cache. Finish prepare/sign-policy ceremony and actual CR proposal bridge or explicit console fallback. Remove bootstrap automation from runtime. Integration failures block protected actions.

### M3 — Seven polished views

Implement shell, accessible statuses, exact evidence labels, manual release banner, and separate authenticated profiles. Use real API/SDK state only. Timeline remains explicitly mutable/client-reported where appropriate.

### M4 — Evidence, reset, rehearsal

Complete acceptance checks below; test reset and fresh run IDs/policies; capture readable evidence; rehearse 120-second flow. Add reproducible setup, integration manifest and known limits. Optional trusted time or signed audit features come only after M0–M4 and their own verified boundary tests.

### M5 — Submission preparation (no publication in this task)

Prepare ≤300-word overview, separate setup, under-100-MB video, secrets scan, branding and checklist. Later publishing/submitting requires user authorization; this specification does not execute it.

## 12. Acceptance criteria and focused security checks

All LIVE acceptance checks run against the pinned integrated environment; keep sanitized results in the eventual repository under `docs/evidence/`. Unit mocks may test presentation but cannot satisfy security acceptance. Record PASS, FAIL or NOT VERIFIED; never present skipped checks as passes.

| ID | Procedure | Observable pass condition |
|---|---|---|
| A1 | Upload known synthetic text with a unique marker; read raw persisted exam row/backup; inspect upload payload and server logs | Stored blob matches UI ciphertext/digest; marker/decoded source is absent from record and captured API body/logs. Plaintext fixture may exist separately as a public synthetic test input, never in stored exam data. |
| A2 | Teacher calls real shared decrypt with actual stored ciphertext + valid read policy | Explicit role/subject denial; no plaintext. App route/UI bypass does not change result. |
| A3 | App administrator repeats A2 | Same denial; absence of server reusable decrypt credential independently checked. |
| A4 | Submit real admin self-grant; G1 approves; attempt direct commit; repeat G1 approval | Real CR IDs; effective threshold 2; count remains one; commit rejected/does not apply; fresh app-admin session still fails decrypt. Reject pending attack request afterward. |
| A5 | Edit app-owned display role directly in DB and through panel; bypass frontend prechecks | Authenticated subject/token roles remain unchanged; SDK still refuses real decrypt. |
| A6 | Inspect schedule limitations; advance browser time/change advisoryReleaseAt; call SDK directly | Access remains unchanged before governed grant. Screen/README/video explicitly say no trusted automatic time lock. This is the valid reduced-scope outcome, not evidence of a clock-enforced gate. |
| A7 | G1/G2 approve designated invigilator `_tide_decryptor` grant; reauthenticate invigilator | Authoritative committed grant, actual current subject, byte-identical text from SDK; server still never receives plaintext. Teacher/admin remain denied after release. |
| A8 | Substitute extra/wrong/missing tag, unsigned/modified/wrong-subject policy and corrupted ciphertext | Each fails closed. No silent fallback/self-encryption switch; unknown error is not labeled proven authorization denial. |
| A9 | Use expired JWT, wrong issuer/azp/signature/algorithm, absent key config, unbound token, no/wrong/replayed DPoP, wrong method/URL/ath | API rejects each; valid request succeeds. Replay check is atomic across concurrent requests/restarts within the proof window. Verify externally observed URL behind intended proxy. |
| A10 | Inspect active M0; test one governor's self-grant, membership/role/composite/default changes, governance member/threshold changes and IGA disable proposal | Relevant sensitive writes remain pending under current quorum and no derived access appears. Untested alternate control-plane paths are named. Protected grant bypass is release-blocking; unsupported stronger claims removed. |
| A11 | One governor signs a policy for themselves/app-admin but lacks gate role | Direct decrypt denied. Confirm no governance/default/automation identity inherits `_tide_decryptor`. Record policy-signing quorum as NOT VERIFIED unless actually demonstrated. |
| A12 | Inspect timeline; edit/delete an app log; if optional signed artifact exists, export, verify offline with independently pinned key, mutate one signed byte | UI admits ordinary log mutability. Optional signature fails after mutation and names signed fields; no global immutable-audit badge. If no receipt verifier, audit integrity is NOT VERIFIED. |
| A13 | Disconnect Tide / return malformed policy / expire session during operation | Paper remains closed, no mock response, save is not marked sealed before success, clear retry/sign-in guidance. |
| A14 | Run reset procedure, then revisit previous URLs/ciphertext/policies/role overrides | Fresh run/tag/policies; invigilator gate removed via governance and fresh sessions; no web reset route/bootstrap bypass or unconditional auto-approve script. Old recipients' retained plaintext cannot be revoked. |
| A15 | Keyboard/mobile/contrast review and full 120-second rehearsal | Every sensitive action operable with keyboard, visible focus/status words; no token/secret in screen recording; all seven views usable at 375 px. |

Also inspect source/config/network traces for plaintext analytics, unsafe HTML rendering, permissive arbitrary role targets, cross-user object access, logged Authorization headers, service approval privileges and stale cached “released” flags. Run focused tests plus typecheck/build and the shipped DPoP tests. Do not add a large unrelated test suite.

**Go/no-go:** A1–A7, A9, A11 and failure-closed behavior are required for the advertised core flow. A6/A12 pass through truthful reduced-scope labeling; they do not establish trusted time or immutable audit. Any proposed automatic-time or signed-audit claim additionally requires direct trusted-boundary proof. Unverified broad policy/control-plane guarantees stay excluded.

## 13. Reproducible two-minute storyboard and reset

### Preflight

Prepare one fresh run with signed author/read policies; author has encrypt-only gate, invigilator has base role but no decrypt gate; no attack request approvals preloaded. Verify G1–G3 eligible and active signed threshold 2. Open distinct authenticated browser profiles/windows labeled with current subject. Rehearse role/token refresh latency; perform full sign-out/sign-in when needed. Prefer separate governance operators. No credentials or preloaded grants hidden in video cuts.

### 120-second sequence (manual governance version)

| Time | Action and narration |
|---|---|
| 0:00–0:12 | Vault title/subtitle. “An exam office can store an encrypted paper without giving its app administrator the power to read it or grant access alone.” Visible synthetic/manual-release banner. |
| 0:12–0:25 | Author seals three short synthetic questions; show encrypted saved state. “Plaintext stays in the author's browser; storage receives ciphertext.” |
| 0:25–0:36 | Teacher genuine decrypt attempt fails. Show current subject and confirmed Tide denial. |
| 0:36–0:51 | App administrator reads persisted ciphertext/digest, then attempts decrypt and fails. |
| 0:51–1:04 | Administrator changes local display role to invigilator; real SDK attempt still denied. “This database row isn't protected authority.” |
| 1:04–1:23 | Administrator requests actual access; G1 approves once; show real request at 1 of 2 and unchanged denial. G2 rejects attack request. |
| 1:23–1:43 | Separate legitimate invigilator release request; G1 then G2 approve in real enclaves. Show committed state. Keep each subject visible. |
| 1:43–1:54 | Invigilator signs in afresh and opens the paper. Show three questions and session-only opened state. |
| 1:54–2:00 | “This prototype uses manual quorum release. Automatic trusted time and exam-room presence are not demonstrated.” Timeline shows evidence labels. |

Rehearse approvals beforehand without pre-signing the recorded requests. If interactive login/approval latency exceeds two minutes, use clearly captioned cuts of real operations, preserving request IDs, identities and order. Do not accelerate a clock or fabricate fast approval results. Describe the editing in the README. The core administrator-failure segment should remain the longest segment.

### Reset procedure (developer-operated, synthetic realm only)

1. Hide paper, sign out all profiles and clear app plaintext state. Retained recipient copies remain beyond control.
2. Read actual pending CRs; reject only known pending demo self-grant/release requests. Never bulk-approve all pending actions; never deny approved grants as a reset.
3. Through existing governance quorum, revoke invigilator `_tide_decryptor` and any mistakenly committed attacker read/base roles. Wait for effective commit; refresh/re-login test sessions. Account for token lifetime and stale credentials rather than promising instant revocation.
4. Confirm fresh genuine invigilator/admin/teacher sessions cannot decrypt the old record. Gate the next recording until this holds. Do not disable IGA, lower quorum, use FirstAdmin mode, or retain a hidden recovery key.
5. Delete/archive only local synthetic exam/event/override rows with an offline development command when app is stopped. Keep replay records through their freshness window or invalidate sessions and wait it out. No publicly reachable reset HTTP endpoint.
6. Allocate fresh run/exam UUIDs, prepare and sign new policy bytes for those tags, re-encrypt the synthetic fixture, and verify baseline gate allocation. Never reuse an old assignment ID with new content and assume stale policies expired.
7. Re-run A2–A5 baseline and threshold readiness. Record reset timestamp/new run ID. Old ciphertext/policy copies are not cryptographically erased by a DB deletion; approved recipients may already hold plaintext. Use a dedicated disposable synthetic environment, never real exam data.

If incompatible policies require a new realm, use normal authorized setup, real governance/offboarding requirements and new enrollment. A “reset” is not authority to silently recreate a weaker realm.

## 14. Official submission checklist

**C1 — Verified current planning requirements**

- [ ] Public GitHub repository contains a **working TideCloak-integrated prototype** and source, not just this specification. No publication occurs during specification work.
- [ ] README starts with official Project overview template, one-sentence description, and answers to five judging prompts; overview is **300 words or fewer**. Keep setup, limits, evidence and reset documentation in separate sections.
- [ ] Overview addresses the five prompts: proposed new possibility/distinctiveness; present trust constraint/what changes; beneficiaries/concrete value; TideCloak's enabling role; demonstrated interaction. Use C1's current template when preparing submission. Avoid unsupported time/location/immutable-audit claims.
- [ ] Include official “Built with TideCloak” attribution. Current badge: [badge asset](https://tide.org/badges/built-with-tidecloak.svg); current attribution target: [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked). C1 config provides these URLs; do not invent an endorsement or restyle the protected login relay. Required vs optional visual branding beyond the README template should be checked against the current page before publishing.
- [ ] Two-minute **`.mp4` inside the repository, under 100 MB**. Aim below 90 MB decimal for margin. Confirm it plays from a clean clone and the file is actually available, not merely a Git LFS pointer requiring unavailable download access.
- [ ] Setup specifies tested versions, legal/license onboarding, hosting selection, enrollment, three governance admins, signed M0 readiness, exact origins, DPoP asset/headers, signed policy preparation, synthetic fixture and failure troubleshooting. Secrets excluded; useful `.env.example` contains placeholders only.
- [ ] Video and README clearly label manual governance release and ordinary mutable/client-reported logs. No mock security presented as integrated behavior.
- [ ] Submit repository URL through the official [Google Form](https://forms.gle/HRHYjnqB86j1LFS97), linked by C1. Form availability/fields were not opened or submitted during this task; check before the authorized submission step.
- [ ] **Vietnam deadline: Thursday 22 October 2026, 18:00 ICT (UTC+7).** C1 independently lists Melbourne Friday 23 October 2026, 10:00 AEDT (UTC+11), and Malaysia Thursday 22 October 2026, 18:00 (UTC+8). These are regional deadlines, not equivalent instants. For this user use Vietnam's deadline; do not convert Melbourne time as a substitute. Any extension must come from the organizers.
- [ ] Before submission, recheck official page/config/form for changes. The page's static “closed” countdown fallback alone does not verify whether a form still accepts entries.

Suggested overview framing: “A synthetic exam vault that denies the application administrator even with ciphertext and a modified app role row; independently approved access allows the invigilator to open it. Release is manual in this prototype.” This is guidance for a later README, not a claim that a working prototype already exists.

## 15. Open questions, defaults, and blockers

| Question | Recommended default / required confirmation | Impact |
|---|---|---|
| Which network/SDK supports current `RelationshipAttestation:1`? | Use updated compatible official template; pin versions; prove author-to-invigilator round trip and negative caller checks. Confirm with Tide if unavailable. | **Core blocker** if absent; no custom clone or mock substitute. |
| Is 2-of-3 active cryptographically, including all access-granting routes? | Three linked admins, inspect signed M0, commit/replay tests and inherited roles. Do not trust realm attribute or UI alone. | **Core blocker** if a single operator can grant protected roles. |
| Can the app propose/read CRs without holding approval authority? | Narrow proposal/read credential only after live privilege tests; otherwise console proposal with explicit UI state. | Embedded panel dependency; viable console-backed MVP available. |
| Does relationship policy issuance/replacement itself require quorum? | Treat as unverified, independent from IGA. No governor has decrypt gate; all gate grants require quorum. Test alternative policy signing plus gate refusal. | Blocks universal “all policies are 2-of-3 protected” claim; does not block narrow app-admin demo if gate protections pass. |
| Does a deployed absolute not-before predicate exist, with trustworthy time? | No automatic time release in MVP. Need exact clock provenance/enforcement/skew and early-call tests before enabling. | Blocks original exact-time promise; manual quorum release is the viable smaller demo. |
| Can complete access-attempt audits be exported and independently verified? | Ordinary labeled timeline; optional policy-signature evidence only. Need documented signed receipt format, trusted key distribution and completeness semantics. | Blocks immutable/complete audit promise, not MVP. |
| What happens under master operations, disable/offboard or failover? | Keep runtime operator separate, prohibit runtime control-plane credentials, test authorized isolated paths and state exact limits. | Blocks broad complete-server-compromise/immunity claims. |
| What are effective role/token revocation latencies? | Full logout/login after grant/revoke, measure real behavior, fresh run IDs; no instant-revocation promise. | Rehearsal/reset dependency. |
| Who manages license and where is realm hosted? | Human provides email/terms choice before setup; recommend local Docker for rehearsal, subject to real choice. | Setup blocker only; no account creation in this task. |
| Is submission still accepted / changed? | Official Vietnam deadline above; verify current form/page at submission time. | Submission dependency; do not presume an extension. |

**Recommended build:** a restrained Next.js/TypeScript dashboard with SQLite ciphertext storage, real Tide browser encryption/decryption, separately authenticated demo identities and a live 2-of-3 role-grant release. Spend effort on proving the administrator cannot decrypt or self-grant even after changing the application database. Critical dependencies are network compatibility with shared policies, an effective signed governance threshold, correct JWT plus DPoP verification, and browser signing/enrollment. Ship manual release and truthful evidence labels unless trusted-time and audit-export capabilities are separately verified.
