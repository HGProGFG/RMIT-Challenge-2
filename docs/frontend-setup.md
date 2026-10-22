# Frontend handoff — Sealed Exam Vault

The integration combines Hoang's backend at `c1d4d60` with Bao's `codex/sealed-vault-web` at `992935d`. Bao's original UI started from the earlier backend at `2729780`; merge resolution retains the current migrations, active-run lifecycle, offline reset, verifier and replay protection.

## Run locally

Use Node 24 (the backend uses `node:sqlite`):

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The unconnected default is a **workspace preview with one sample metadata record**, not a fake authenticated application. All seven screens can be explored without creating an account. Preview never generates ciphertext, grants a role, supplies fake votes or displays a fake successful decryption.

Routes: `/vault`, `/sign-in`, `/vault/new`, `/vault/:id`, `/administration/attacks`, `/governance`, `/activity`. The home route also displays the vault. The upload form reads UTF-8 text locally, validates the 16 KiB byte limit and offers a synthetic fixture.

## Browser integration for Dinh

`src/lib/tide/browser/adapter.ts` defines an **application port**, not asserted Tide SDK exports. A trusted client provider installs a reviewed implementation using `configureBrowserTide(adapter)`. The session provider subscribes to initialization/replacement, clears prior sensitive state and fetches the verified API session. Its default is disconnected and throws for protected operations. Do not reconfigure the adapter for every render/token read.

- `login(roleHint)` authenticates a real account. The role hint must never rewrite claims. It returns only after the SDK has initialized a usable session, or redirects through the supported callback flow.
- `secureFetch(path, init)` must send the real DPoP-bound token and a fresh proof, including Origin for same-origin mutations, as required by Hoang's backend. No access token is passed through a component prop or persisted by the UI.
- `encrypt({examId, plaintext, policy})` runs in the author browser through the reviewed shared-policy SDK path. Return the **canonical base64 representation of the actual envelope bytes**, matching the server's storage and the inverse decoding in `decrypt`. Do not double-base64 a textual SDK envelope. Dinh must confirm exact encoding and ciphertext overhead before enabling it.
- `decrypt({examId, ciphertextBase64, policy})` returns the shared `DecryptResult`. Only an actual successful SDK result may use `opened`. Only a confirmed contract/role refusal may use `denied`; generic threshold/network errors must remain unavailable/error. Unknown runtime results must fail closed.
- `logout()` completes SDK sign-out. The app clears sensitive component state immediately, suppresses stale crypto results and asks the user to finish Tide sign-out if SDK logout fails.

The UI obtains its identity only from verified `/api/session`, not from role selection or browser storage. Session identity switching requires logout first. The backend policy and governance readiness fields remain separately visible to integration code; authentication alone is not a claim that cryptography or quorum is ready.

The shared `SessionResponse` includes verified realm/client roles, readiness/missing reasons, activeRunId, versionManifest and `capabilities.deny`. Privileged UI controls use realmRoles to match the server guards. Authenticated-but-incomplete configuration displays PROTECTED OPERATIONS UNAVAILABLE, with a collapsed evidence panel. A 401 clears session/paper state; a role-based 403 does not sign the user out. A sign-in hint that differs from the actual realm roles produces an explicit wrong-profile message.

Upload: prepare with stable key → fetch **both** signed policies → encrypt locally → seal with stable key → show persisted result. If saving fails after encryption, retry the same encrypted bytes and key without running encryption again. Navigating away or signing out clears source text and pending in-memory ciphertext. Signed-policy ingestion remains governance-only through Hoang's route and verifier port.

The operator creates the active run offline first. Upload checks its existing paper before allowing prepare: the matching author resumes its prepared metadata, a sealed paper links to detail, another author is blocked, and an unavailable run/read blocks the attempt. This avoids duplicate prepare/409 after navigation. Source text must be re-entered locally; it is never recovered from the server. Importing a file does not use its filename as a public exam title.

Opening: fetch actual ciphertext and read policy → call browser adapter → render escaped text only for `opened`. Closing/hiding, navigation and logout clear the rendered paper. Operations completing after logout/unmount are ignored. A logging failure does not change the actual SDK outcome; timeline data remains client-reported.

Admin panel: read actual bytes/digest, submit actual self-access request, mutate only the display-role row, then link to a genuine SDK opening attempt. The display-role endpoint is development-only and must be explicitly enabled via Hoang's `DEMO_ATTACKS_ENABLED=true`; production returns 404. Each CR's counts remain separate and missing counts display as unknown.

Governance approvals are performed in each human's supported Tide console, never through a server service identity. An optional `NEXT_PUBLIC_TIDE_CONSOLE_URL` may point to the reviewed HTTPS console. Only verified governance sessions receive the external console link. The current UI does not invent an approval ceremony.

Pending rows offer rejection only to a verified governor when `capabilities.deny=ready`. The request carries the app link ID and its selected Tide CR ID to the backend's pending-only deny route, then reloads actual observations. If the reviewed bridge is unavailable, the button is disabled and the supported console remains the alternative. The UI clears stale rows on load failure and shows the observation time; it never implements approve/commit itself.

## Verification and known limits

- `npm run typecheck`, `npm run build`, and 59 checks (51 backend, 3 browser-boundary and 5 client/backend integration checks) passed on Node 24.19.0.
- Browser QA checked the mobile preview, local sample text / byte counter, unauthenticated seal rejection, identity selection without role creation, and opening without fake plaintext.
- Tide Doctor: 9 passes; missing public adapter failure and missing real SDK DPoP configuration warning remain explicit integration dependencies.
- Real login, shared encryption, network-enforced denial, policy signature verification and 2-of-3 governance are **not verified** by this UI build.
- Automatic trusted-time release, room presence, immutable auditing and complete malicious-frontend resistance are not claimed.
- No realm, account, publication or submission was created.
