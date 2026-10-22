# Plan C prototype and future Tide integration plan

The UNLOCKED challenge's network-load notice permits simulated integrations. Plan C is now the application's only runtime: it never starts Tide login, imports a realm export or waits for activation. Every screen carries a simulation banner and every event uses the `SIMULATION` source.

## Run locally

Use Node.js 24:

```sh
npm ci
npm run demo
```

Open [http://localhost:3000](http://localhost:3000). Both `npm run demo` and `npm run dev` bind Next.js to `127.0.0.1:3000`, use a separate build directory and do not edit `.env.local`. Stop an existing server on port 3000 first. No environment file, Docker container or Tide account is required.

The API requires an HTTP loopback `APP_ORIGIN`. Before a mutation the adapter reads `/api/simulation/bootstrap` on the same origin and sends its unpredictable CSRF nonce in `X-Sealed-Demo-CSRF`. Missing or forged nonces are refused and no CORS permissions are enabled. This works with embedded previews whose Origin or Fetch Metadata differs from a normal browser. Real tokens or policies are never accepted. Local sessions and demo keys are stored in `data/simulation.sqlite`. Do not expose this local demo through a tunnel or public proxy.

## Demo journey

1. In **Plan C · Demo accounts**, select **Exam author**, then **Switch simulated identity**. Confirm **Current identity: Simulated author**. Open **New exam**, enter a title, click **Use sample text**, confirm synthetic content, then **Encrypt and seal**. If no author is active, the page shows **Use Exam author** and disables sealing. You can create multiple papers: **New exam** always starts a fresh form, and **Create another exam** starts the next paper after sealing. Existing papers and their approvals are preserved.
2. Switch to **Teacher**. Open the exam and click **Attempt to open**. The local policy refuses access. Repeat as **Application administrator**.
3. As the administrator, open **Admin attack panel**. Inspect the stored ciphertext, change the display role and request self-access. A display label changes no authority; the fixed recipient policy refuses an administrator self-grant. A governor can reject that request.
4. Switch to **Invigilator**. Opening is still refused. Choose the paper in **Release exam**, then click **Request invigilator release** and open **Governance**. From a paper's detail page, the request is pinned to that paper. Each governance row shows its paper title so governors can approve the correct request.
5. Switch to **Governor 1** and click **Simulate approval** for the invigilator request. It stays pending at one approval. That same account cannot vote twice.
6. Switch to **Governor 2** and approve the same request. It commits at two distinct governor accounts. Governor 3 is available as the alternative second approver.
7. Switch back to **Invigilator**, open the exam and click **Attempt to open**. The browser displays the original synthetic paper. Teacher, administrator and author remain unable to open it through the simulated read grant.
8. Open **Activity** to inspect labeled local events. To delete all demo papers and start a clean run, switch to **Application administrator** and click **Reset all demo papers and votes**. This deletes all simulation papers, keys and votes, without touching live data. Reset is not required to create another paper. Approving one paper never releases another.

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

Earlier browser adapter source is retained in `src/lib/tide/browser/sdk-adapter.ts`, with server adapters under `src/lib/tide/server/`, as reference for this future integration plan. These are not imported by the application routes or provider. The runtime uses only `src/lib/simulation/`; the real provider, policy-signing screen and OAuth callback are removed.

The live adapter uses role subjects, so all holders of both `invigilator` and `_tide_decryptor` would satisfy its read policy. The application release request targets the configured invigilator identity; role membership and governance must therefore be protected in the real realm. A future policy requiring exactly one named person can use a `User` subject and their exact `tideuserkey`, as described by the MCP, but that is not the policy currently implemented.

## Limits and future live integration

The simulator demonstrates product behavior, not distributed cryptographic authority. Anyone using this local demo can select another synthetic account. Two accounts do not prove two independent humans. Policies are marked simulation records rather than signed Tide policies. The demo server holds encryption keys and can read its own database; an operator who controls that server can bypass its rules. AES-GCM protects the demonstration ciphertext, but a compromised frontend can capture input and opened content.

The simulator also deliberately restricts release to the fixed invigilator. It does not demonstrate arbitrary role grants, policy-signing ceremonies, instant revocation, a time lock or protection from a malicious administrator changing the simulator code.

This build has no live-mode switch. A future integration would need to restore a reviewed provider and route dispatch, supply the real realm export, configure independent accounts and complete all live acceptance gates in [the historical Tide setup notes](tide-setup.md). A simulation cookie, vote or policy never satisfies those gates.

## Verification

`tests/simulation.test.ts` exercises actual browser AES-GCM through the simulation API: sealing, exact plaintext recovery, metadata-only access, forged sessions, cross-origin rejection, wrong/extra tags, display-role changes, self-grant refusal, duplicate votes, two-account commitment, persistence after database reopen, ciphertext tampering, and logout revocation. The existing real-authentication tests continue to check their original fail-closed boundaries. Run `npm test`, `npm run typecheck` and `npm run build`.
