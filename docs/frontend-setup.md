# Frontend handoff — Sealed Exam Vault

Built on `origin/feat/hoang-api` at `2729780`. The backend, database, verifier, reference relay and security checks are retained.

## Run locally

Use Node 24 (the backend uses `node:sqlite`):

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The unconnected default is a **workspace preview with one sample metadata record**, not a fake authenticated application. All seven screens can be explored without creating an account. Preview never generates ciphertext, grants a role, supplies fake votes or displays a fake successful decryption.

Routes: `/vault`, `/sign-in`, `/vault/new`, `/vault/:id`, `/administration/attacks`, `/governance`, `/activity`. The home route also displays the vault. The upload form reads UTF-8 text locally, validates the 16 KiB byte limit and offers a synthetic fixture.

## Browser integration for Dinh

`src/lib/tide/browser/adapter.ts` defines an **application port**, not asserted Tide SDK exports. A trusted client provider can install a reviewed implementation using `configureBrowserTide(adapter)` before the session provider initializes. Its default is disconnected and throws for protected operations.

- `login(roleHint)` authenticates a real account. The role hint must never rewrite claims. It returns only after the SDK has initialized a usable session, or redirects through the supported callback flow.
- `secureFetch(path, init)` must send the real DPoP-bound token and a fresh proof, including Origin for same-origin mutations, as required by Hoang's backend. No access token is passed through a component prop or persisted by the UI.
- `encrypt({examId, plaintext, policy})` runs in the author browser through the reviewed shared-policy SDK path. Return the **canonical base64 representation of the actual envelope bytes**, matching the server's storage and the inverse decoding in `decrypt`. Do not double-base64 a textual SDK envelope. Dinh must confirm exact encoding and ciphertext overhead before enabling it.
- `decrypt({examId, ciphertextBase64, policy})` returns the shared `DecryptResult`. Only an actual successful SDK result may use `opened`. Only a confirmed contract/role refusal may use `denied`; generic threshold/network errors must remain unavailable/error. Unknown runtime results must fail closed.
- `logout()` completes SDK sign-out. The app clears sensitive component state immediately, suppresses stale crypto results and asks the user to finish Tide sign-out if SDK logout fails.

The UI obtains its identity only from verified `/api/session`, not from role selection or browser storage. Session identity switching requires logout first. The backend policy and governance readiness fields remain separately visible to integration code; authentication alone is not a claim that cryptography or quorum is ready.

Upload: prepare with stable key → fetch **both** signed policies → encrypt locally → seal with stable key → show persisted result. If saving fails after encryption, retry the same encrypted bytes and key without running encryption again. Navigating away or signing out clears source text and pending in-memory ciphertext. Signed-policy ingestion remains governance-only through Hoang's route and verifier port.

Opening: fetch actual ciphertext and read policy → call browser adapter → render escaped text only for `opened`. Closing/hiding, navigation and logout clear the rendered paper. Operations completing after logout/unmount are ignored. A logging failure does not change the actual SDK outcome; timeline data remains client-reported.

Admin panel: read actual bytes/digest, submit actual self-access request, mutate only the display-role row, then link to a genuine SDK opening attempt. The display-role endpoint is development-only and must be explicitly enabled via Hoang's `DEMO_ATTACKS_ENABLED=true`; production returns 404. Each CR's counts remain separate and missing counts display as unknown.

Governance approvals are performed in each human's supported Tide console, never through a server service identity. An optional `NEXT_PUBLIC_TIDE_CONSOLE_URL` may point to the reviewed HTTPS console. Only verified governance sessions receive the external console link. The current UI does not invent an approval ceremony.

## Verification and known limits

- `npm run typecheck`, `npm run build`, and all 36 checks (33 inherited backend checks plus 3 browser-boundary checks) passed on Node 24.19.0.
- Browser QA checked the mobile preview, local sample text / byte counter, unauthenticated seal rejection, identity selection without role creation, and opening without fake plaintext.
- Tide Doctor: 9 passes; missing public adapter failure and missing real SDK DPoP configuration warning remain explicit integration dependencies.
- Real login, shared encryption, network-enforced denial, policy signature verification and 2-of-3 governance are **not verified** by this UI build.
- Automatic trusted-time release, room presence, immutable auditing and complete malicious-frontend resistance are not claimed.
- No realm, account, publication or submission was created.
