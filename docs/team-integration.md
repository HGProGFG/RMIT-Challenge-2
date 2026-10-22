# Team integration handoff

Hoang's foundation lives on `feat/hoang-api`. Bao owns application screens and README; Dinh owns live Tide setup and browser/server Tide adapters. Root dependency/lockfile changes and shared contracts should go through the backend integration PR to reduce conflicts.

## Bao

Base UI work on the backend scaffold; replace the temporary `src/app/page.tsx` and layout. Use `src/lib/contracts.ts` and `docs/api-contract.md`. Keep `.txt` reading, byte count, encryption, plaintext rendering and cleanup browser-only. The API always uses `{data,...}` or `{error:...}`. Do not add route-local copies of the server verifier.

The upload sequence is prepare → wait for WRITE and READ policies → browser encrypt → seal → read back stored ciphertext. Opening is browser SDK decryption, never an API plaintext response. The admin display-role attack is available with `npm run dev` and `DEMO_ATTACKS_ENABLED=true`; it is absent in production. Each profile must actually sign in.

FUNCTION_PLAN additions are additive: `VerifiedIdentity`, readiness/missing fields, UI state types, summaries, `SignedPolicyRef.policyId`, governance `view` and activity `entries` are available alongside existing fields. Backend state PREPARED maps to DRAFT in summaries. Operator creates the active run offline before prepare; UI never chooses arbitrary historical runs. Session exposes readiness/version evidence for the drawer. Full mapping is in `docs/function-plan-status.md`.

## Dinh

Supply `src/lib/tide/server/**` exports for the application port in `src/lib/server/tide-integration.ts`. Keep the existing JWT/DPoP route protection connected to SQLite; review real claim format/roles and update the boundary if the chosen realm differs. Supply browser provider/session/secureFetch and shared policy encrypt/decrypt to Bao. Confirm envelope overhead before setting MAX_CIPHERTEXT_BYTES.

Policy verification must authenticate and parse exact signed bytes. Proposal/read integration must return actual IDs, separate per-request counts and statuses, fixed allowlisted targets and authoritative committed state. The local implementation cannot prove an active 2-of-3 Tide policy. Approval happens in each governor's session or supported console; the backend never approves as a service account. Keep readiness unavailable until verified.

Set `browserReadiness` only after the actual provider is connected. The new `denyReadiness`/`denyChangeRequest` boundary is separate from proposal/read readiness. Keep it unavailable unless the governor's own authorization and a conditional pending-only denial can be preserved; otherwise use the supported console. The API does not forward its DPoP proof to another URL, sign as a governor, approve or commit. Record a genuine realm image digest in `TIDECLOAK_REALM_IMAGE_DIGEST` for evidence; unknown stays null.

## Merge procedure

1. Bring the backend PR into main, then rebase/merge the UI and Tide branches onto it. Resolve `contracts.ts`, package and config changes once on the integration branch.
2. Review Bao's pages and Dinh's adapters in their own PRs. Preserve file ownership and replace only the temporary scaffold shell. Never merge unreviewed fixture auth into runtime.
3. Run tests, typecheck, production build and Tide doctor against the combined checkout and running server. Compare the byte-exact DPoP relay and served headers.
4. Run real author → seal → teacher/admin negative calls → one-vote pending/under-threshold denial → second distinct approval/commit → fresh invigilator opening. Record sanitized IDs and results. Local unit fixtures cannot satisfy this step.
5. Bao finishes the README/video only after observed behavior and limits are known.

Bao's `codex/sealed-vault-web` branch is now combined with the current backend on `feat/hoang-bao-integration`. Merge resolution retains the current backend and Bao's seven screens, updates shared session/role/readiness contracts, resumes existing prepared papers and connects pending-only rejection controls. Source work is preserved from PR #1 and PR #2. The combined revision has 59 local checks plus typecheck/build and browser preview verification.

Dinh's SDK implementation is now supplied on `feat/dinh-tide`: strict DPoP provider/callback,
policy-bound browser crypto, governor enclave policy signing, bounded pinned-key policy verifier,
and a gated proposal/read transport with console fallback. It recognizes the real
`realm-management/tide-realm-admin` claim separately from raw realm roles. The combined revision
has 68 local regression checks, typecheck, production build and HTTP smoke checks. See
[Tide setup](tide-setup.md) and [live evidence status](evidence/tide/status.json).

Live realm creation, human enrollment, envelope measurement and the A1–A15 security demonstration
remain outstanding. Docker's Linux engine/WSL is unavailable on the current machine. Tide doctor
still fails its missing-adapter check; the real adapter must come from the licensed realm.
This integration does not claim completed live security checks. Review the combined PR before
bringing the team revision into main.
