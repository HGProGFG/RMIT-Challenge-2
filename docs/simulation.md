# Local simulation and Tide integration plan

The UNLOCKED challenge's network-load notice permits simulated integrations. This mode makes the complete Sealed Exam Vault journey usable while the real realm waits for initialization. Every screen carries a simulation banner and every event uses the `SIMULATION` source.

## Run locally

Use Node.js 24:

```sh
npm ci
npm run demo
```

Open [http://localhost:3000](http://localhost:3000). The launcher explicitly sets `TIDE_SIMULATION=true`, binds Next.js to `127.0.0.1:3000`, uses a separate build directory and does not edit your real `.env.local`. Stop an existing server on port 3000 first. No Docker container or Tide account is required for this mode.

The simulation API requires an HTTP loopback `APP_ORIGIN` and exact request origin. It is disabled by default. It does not accept real tokens or policies. Its local sessions and demo keys are stored in `data/simulation.sqlite`, separate from the live database. Do not expose this demo through a tunnel or public proxy.

## Demo journey

1. In **Local simulation controls**, select **Exam author**, then **Switch simulated identity**. Open **New exam**, enter a title, click **Use sample text**, confirm synthetic content, then **Encrypt and seal**. One exam is supported per demo run.
2. Switch to **Teacher**. Open the exam and click **Attempt to open**. The local policy refuses access. Repeat as **Application administrator**.
3. As the administrator, open **Admin attack panel**. Inspect the stored ciphertext, change the display role and request self-access. A display label changes no authority; the fixed recipient policy refuses an administrator self-grant. A governor can reject that request.
4. Switch to **Invigilator**. Opening is still refused. Click **Request invigilator release**, then open **Governance**.
5. Switch to **Governor 1** and click **Simulate approval** for the invigilator request. It stays pending at one approval. That same account cannot vote twice.
6. Switch to **Governor 2** and approve the same request. It commits at two distinct governor accounts. Governor 3 is available as the alternative second approver.
7. Switch back to **Invigilator**, open the exam and click **Attempt to open**. The browser displays the original synthetic paper. Teacher, administrator and author remain unable to open it through the simulated read grant.
8. Open **Activity** to inspect labeled local events. To repeat from a clean run, switch to **Application administrator** and click **Reset demo paper and votes**. This deletes the simulation paper, keys and votes, without touching live data.

Switching identities clears any displayed plaintext. Sessions expire after eight hours; signing out revokes the local session. The scheduled release is advisory and never automatically releases a paper.

## Where TideCloak fits

This plan follows Tide MCP's `relationship-attestation` scenario and the existing live adapters. The MCP describes separate endpoint authorization and network enforcement at encryption/decryption.

| Boundary | Local simulation today | Live Tide integration |
| --- | --- | --- |
| Sign-in | Seven selectable synthetic accounts; opaque HttpOnly, SameSite cookies | TideCloak SDK sign-in; realm identity and actual claims |
| API access | Server checks a fixed synthetic role on every request | Pinned JWT signature, issuer, audience, expiry, roles and DPoP verification in `src/lib/server/auth.ts` |
| Author writes | Local write policy tied to the author and exam ID | `RelationshipAttestation:1`, realm `Role` subject `author`, write-only `_tide_encryptor` permission |
| Invigilator reads | Local read policy tied to the invigilator and exam ID | Separate realm `Role` subject `invigilator` and `_tide_decryptor` realm role; the ORK checks the subject, operation and exactly one tag `[examId]` |
| Policy approval | Explicitly simulated policy records created when preparing an exam | A real `tide-realm-admin` approves signing in the Tide enclave; store verified signed policy bytes |
| Release governance | Two different allowlisted governor accounts; duplicate votes refused; fixed invigilator recipient | Real IGA change requests and a verified two-of-three active governance policy; each human signs in their own Tide session |
| Browser crypto | Web Crypto AES-GCM; local server holds demo keys | Tide SDK policy-enabled encryption/decryption, with authority enforced by the ORK network |
| Evidence | Mutable local events labeled `SIMULATION` | Actual returned change-request statuses, cross-identity refusals and measured quorum results; app logs still remain mutable |

The live browser adapter is `src/lib/tide/browser/sdk-adapter.ts`; server policy and governance adapters are under `src/lib/tide/server/`. The simulator is isolated under `src/lib/simulation/`. The route selects it only from the server's explicit environment flag. It does not bypass a failing real login or automatically fall back after a network error.

The live adapter uses role subjects, so all holders of both `invigilator` and `_tide_decryptor` would satisfy its read policy. The application release request targets the configured invigilator identity; role membership and governance must therefore be protected in the real realm. A future policy requiring exactly one named person can use a `User` subject and their exact `tideuserkey`, as described by the MCP, but that is not the policy currently implemented.

## Limits and switching to live Tide

The simulator demonstrates product behavior, not distributed cryptographic authority. Anyone using this local demo can select another synthetic account. Two accounts do not prove two independent humans. Policies are marked simulation records rather than signed Tide policies. The demo server holds encryption keys and can read its own database; an operator who controls that server can bypass its rules. AES-GCM protects the demonstration ciphertext, but a compromised frontend can capture input and opened content.

The simulator also deliberately restricts release to the fixed invigilator. It does not demonstrate arbitrary role grants, policy-signing ceremonies, instant revocation, a time lock or protection from a malicious administrator changing the simulator code.

Stop the demo, leave `TIDE_SIMULATION=false` in `.env.local`, configure the real realm's exported adapter and pinned keys, then run `npm run dev`. Follow [Tide setup](tide-setup.md) for seven independent accounts, native policy approval, governed role assignments and all live acceptance gates. A simulation cookie, vote or policy never satisfies those gates. The real activation/provisioning failure remains a separate unresolved network dependency.

## Verification

`tests/simulation.test.ts` exercises actual browser AES-GCM through the simulation API: sealing, exact plaintext recovery, metadata-only access, forged sessions, cross-origin rejection, wrong/extra tags, display-role changes, self-grant refusal, duplicate votes, two-account commitment, persistence after database reopen, ciphertext tampering, and logout revocation. The existing real-authentication tests continue to check their original fail-closed boundaries. Run `npm test`, `npm run typecheck` and `npm run build`.
