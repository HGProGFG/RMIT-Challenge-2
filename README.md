[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

_Sealed Exam Vault / Đề thi niêm phong explores storing encrypted exam papers without giving the application administrator unilateral permission to open them._

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

An examination office can operate a digital vault while separating infrastructure control from the authority to read its papers. The central interaction asks the administrator to try bypassing those boundaries.

### 2. Trust constraint insight

Ordinary backend permissions rely on whoever controls the server or database. The intended integrated flow uses signed Tide policies and independent governance so changing an application role record does not create protected read authority.

### 3. Value & impact

Exam authors, invigilators and institutions benefit from narrower access. An operator can maintain the application without routinely receiving the original paper. This prototype uses only synthetic text and no student records.

### 4. Why TideCloak matters

The target is genuine browser encryption and network-enforced decryption, with a verified two-of-three governed role grant. The build includes the backend, seven-screen interface, real Tide SDK provider, browser policy crypto and governor policy signing. Realm setup and live cross-identity/quorum validation remain incomplete.

### 5. Prototype & storytelling

The interface demonstrates the intended upload, storage inspection, administrator attack, approval and opening journey. Unconnected screens are explicitly labeled preview and do not fake security outcomes. Release is manual; the schedule is advisory. Activity logs are mutable observations, not immutable audit evidence.

## Setup

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No account is needed to explore the labeled workspace preview. Protected operations require a real Tide integration.

- [Backend setup and authentication boundary](docs/backend-setup.md)
- [Frontend setup and browser adapter handoff](docs/frontend-setup.md)
- [Tide setup, seven identities and live acceptance gates](docs/tide-setup.md)
- [API contracts](docs/api-contract.md)
- [Team integration](docs/team-integration.md)
- [Backend validation boundaries](docs/evidence/backend-validation.md)
- [Full build specification](WEB_BUILD_SPEC.md)

Copy `.env.example` to `.env.local` only when configuring the live environment. Never commit credentials, tokens, private keys or plaintext papers. Follow real license, terms, hosting and independent-account setup before creating a realm.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run verify:dpop
```

The inherited generated-key tests establish application behavior, not live Tide enforcement. Real negative decryption and quorum evidence must be recorded before describing this as a completed Tide-integrated challenge entry.
