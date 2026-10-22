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

Tide's MCP maps the intended integration to RelationshipAttestation:1: separate author write and invigilator read policies, with governed release. This submission uses the challenge's Plan C: selectable demo accounts, fixed roles, record access and two-of-three simulated approval. Its application runtime makes no Tide login, licensing or ORK calls.

### 5. Prototype & storytelling

Seal a synthetic paper, try opening as a teacher or administrator, approve release as two different governors, then open as the invigilator. The simulator labels every screen and event. Browser AES-GCM uses demo keys held by the local server; it provides no Tide distributed-security guarantee. Release is manual, the schedule advisory and logs editable.

## Demo video

[Watch or download the Plan C demo](https://media.githubusercontent.com/media/HGProGFG/RMIT-Challenge-2/main/docs/demo/plan-c-demo-2026-10-22.mp4).

The recording demonstrates the local simulation. [The original MP4](docs/demo/plan-c-demo-2026-10-22.mp4) is stored with Git LFS; use `git lfs pull` to download it after cloning.

## Setup

Use Node.js 24 and npm:

```sh
npm ci
npm run demo
```

Open [localhost:3000](http://localhost:3000). In **Plan C · Demo accounts**, choose **Exam author** and click **Switch simulated identity**. Check **Current identity** before creating a paper. There are seven synthetic accounts and no Tide login, password, license or realm is needed. The server binds to loopback and stores demo state in `data/simulation.sqlite`.

Create as many demo papers as needed without resetting the vault. Each paper keeps its own key, policies and release approvals. Use **Release exam** to choose the paper before requesting access; governance requests display its title.

Follow the [Plan C guide and future Tide integration plan](docs/simulation.md) for the complete demo. `npm run dev` also starts Plan C. The previous live provider, policy-signing screen and OAuth callback have been removed from the runtime. Earlier adapters and tests remain as reference for future integration; there is no switch to a live mode in this build.

- [Backend setup and authentication boundary](docs/backend-setup.md)
- [Frontend setup and browser adapter handoff](docs/frontend-setup.md)
- [Tide setup, seven identities and live acceptance gates](docs/tide-setup.md)
- [API contracts](docs/api-contract.md)
- [Team integration](docs/team-integration.md)
- [Backend validation boundaries](docs/evidence/backend-validation.md)
- [Full build specification](WEB_BUILD_SPEC.md)

No `.env.local` is required for Plan C. Use only synthetic papers. Earlier setup documents describe the future live integration, not prerequisites for this prototype.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run verify:dpop
```

Tests cover both the isolated simulator and the real integration's fail-closed application boundaries. Simulator results are not live Tide evidence. The challenge's network-load fallback permits simulated submissions; disclose the mode and remaining live validation explicitly.
