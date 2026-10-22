# Tide reference assets

Source: official [`@tideorg/mcp@1.9.33`](https://www.npmjs.com/package/@tideorg/mcp), downloaded from its registry tarball. Upstream repository: https://github.com/tide-foundation/raziel-mcp.

Copied without modification:

- `templates/dpop-verify/verifyDpop.ts` → `src/lib/server/vendor/verifyDpop.ts`.
- `templates/nextjs-e2ee-vault/public/tide_dpop_auth.html` → `public/tide_dpop_auth.html`.

Relay SHA-256: `9d7844b938f0a2565fa910d3d30e9b8797cbfd6e0b73d59d804169a089aea757` (9,120 bytes). Preserve byte-exact content; do not retype it.

Application code wraps the reference verifier with pinned origin, an ES256 public-key restriction, bounded proof/JTI lengths, durable SQLite replay claims scoped to proof thumbprint, and retention covering future-dated accepted proofs. Its in-memory default is never used by the application.

The package declares `SEE LICENSE IN LICENSE`; retain upstream notices and review current Tide licensing with Dinh's SDK/realm onboarding. No additional licensing permission is asserted by this document.
