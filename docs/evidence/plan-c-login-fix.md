# Plan C account selection fix

The running application's logs showed repeated 403 responses from simulated login/logout, followed by unauthenticated 401 session responses. Consequently the upload screen never received an author session. The previous gate relied on Origin and Fetch Metadata values that can differ in embedded previews.

Plan C is now the only application runtime. The actual Tide provider, policy-signing component and OAuth callback have been removed from the user journey; routes no longer dispatch into live Tide code. Existing adapter sources and generated-key tests remain as future integration references.

Mutations require an unpredictable nonce fetched from a same-origin bootstrap response. The browser adapter automatically adds it as `X-Sealed-Demo-CSRF`. External sites receive no CORS permission to read that nonce; missing/forged values are rejected. Opaque Origin and embedded-preview Fetch Metadata no longer prevent a correctly bootstrapped local login. The fixed role checks, duplicate-vote rejection and key-release conditions remain on the server.

The account panel shows the active identity, starts with an unselected placeholder, and synchronizes with the actual session. The upload screen disables sealing without an author and offers a direct **Use Exam author** action. Delayed 401 responses from a previous account cannot clear a newer session.

Validation:

- 71 tests passed, including the complete AES-GCM workflow with embedded-preview request metadata, nonce rejection and the delayed-401 regression.
- TypeScript and optimized production build passed.
- Running HTTP checks selected an author with `Origin: null` and `Sec-Fetch-Site: cross-site`, verified the actual author realm role, checked nonce-less POST rejection, rendered the new account/upload/governance screens and signed out. No existing paper data was modified.
- Visual browser checks remain unavailable because browser control is disabled in Work settings.

This is a synthetic challenge prototype. The local server holds its demonstration keys and the accounts/approvals provide no real Tide cryptographic guarantee.
