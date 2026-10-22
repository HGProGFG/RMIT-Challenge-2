# Frontend validation — 22 October 2026

Base: Hoang's `feat/hoang-api`, commit `2729780`.

- Node 24.19.0: TypeScript check and Next.js production build passed.
- 36 automated checks passed: the inherited 33 backend checks plus 3 client-boundary checks. Generated-key fixtures do not establish real Tide integration.
- All seven view routes plus home returned HTTP 200. Unauthenticated `/api/session` and `/api/exams` returned 401.
- In-app browser QA at a **319 px viewport** found and corrected overflow from the visually hidden file input. All seven screens were then checked; no horizontal overflow remained.
- Upload: sample text loaded locally, UTF-8 counter displayed 191 bytes, synthetic-content confirmation enabled the action, and attempted sealing without an authenticated author was blocked. No upload or ciphertext was fabricated.
- Sign-in: selecting application administrator and continuing returned an explicit missing-integration message. It did not create a session or role.
- Exam detail: opening the sample showed not-ready guidance, with no fake plaintext or permission-denial claim.
- Attack panel: all three actions required a genuine administrator session; preview did not supply fake stored bytes, CR IDs or votes.
- Governance and activity displayed unconnected states and explained the limits of observations. Mobile navigation and native modal explanation were exercised.
- Screenshot: `ui-preview-mobile.png` contains only sample metadata.
- Desktop layout is implemented through responsive CSS; a full-width desktop browser was not available in this session, so desktop visual QA is not claimed.

Tide Doctor: 9 checks passed. Missing public adapter and missing initialized SDK DPoP provider remain known dependencies. The reviewed relay bytes/headers and server token verifier passed. Real authentication, shared-policy encryption/decryption, caller denials and 2-of-3 governance are not verified.

No realm, accounts, deployment, push or submission was created.
