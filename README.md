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

Tide's MCP maps this to RelationshipAttestation:1: a separate author write policy and named invigilator read policy, with governed release. The live SDK, token/DPoP verification and policy adapters are implemented. While realm initialization is blocked, an explicit local simulator demonstrates sign-in, fixed roles, record access and two-of-three approval.

### 5. Prototype & storytelling

Seal a synthetic paper, try opening as a teacher or administrator, approve release as two different governors, then open as the invigilator. The simulator labels every screen and event. Browser AES-GCM uses demo keys held by the local server; it provides no Tide distributed-security guarantee. Release is manual, the schedule advisory and logs editable.

## Setup

Use Node.js 24 and npm:

```sh
npm ci
npm run demo
```

Open [localhost:3000](http://localhost:3000). Use the **Local simulation controls** to switch among seven synthetic identities. No Tide account, license key or active realm is needed for this mode. The server binds to loopback and stores demo state separately in `data/simulation.sqlite`.

Follow the [simulation guide and Tide integration plan](docs/simulation.md) for the complete demo. To use the live integration, configure `.env.local`, leave `TIDE_SIMULATION=false`, and run `npm run dev`. Live operations remain blocked until the realm and its acceptance checks are ready.

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

Tests cover both the isolated simulator and the real integration's fail-closed application boundaries. Simulator results are not live Tide evidence. The challenge's network-load fallback permits simulated submissions; disclose the mode and remaining live validation explicitly.
