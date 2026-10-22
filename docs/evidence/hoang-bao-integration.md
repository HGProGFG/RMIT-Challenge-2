# Hoang + Bao integration verification

22 October 2026, Asia/Bangkok (UTC+7).

Sources: Hoang `c1d4d60` and Bao `992935d`, combined on `feat/hoang-bao-integration`. Current backend migrations/guards/run lifecycle are retained; Bao's original UI history is preserved in the merge.

- 59 automated checks passed: 51 backend, 3 browser-boundary and 5 client/backend integration checks. The integration checks use locally generated signing keys and explicit synthetic policy fixtures, never a real Tide realm.
- Strict typecheck and production build passed, including all seven UI routes and the protected catch-all API.
- Client API checks cover the complete session response, resuming prepared metadata, Headers-based idempotency, seal/policy/ciphertext shapes and distinguishing 401 session invalidation from a role-based 403.
- Browser preview: sample paper appears with explicit unconnected labels; local synthetic text shows 191 bytes; unauthenticated seal is blocked; selecting a role does not create a session; attempting to open shows not-ready guidance with no fabricated plaintext.
- The captured vault screenshot contains only sample metadata. The desktop capture is 1265 × 712 pixels. The available compact layout also exposed the navigation menu and readable stacked form; no claim of exhaustive accessibility or device testing is made.
- Screenshot: `hoang-bao-integration.png`.

The integrated UI consumes actual server readiness and active-run fields. Pending rejection is enabled only by the reviewed denial capability; observations remain mutable/cache/client evidence with their existing limitations.

Real Tide login, cross-identity encryption/decryption, signed-policy validation, actual proposals/denials and active signed 2-of-3 enforcement remain NOT VERIFIED pending Dinh's adapters and live environment. No realm, account, deployment or challenge submission was created.
