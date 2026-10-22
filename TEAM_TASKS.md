# Team Task Split — Sealed Exam Vault

Three parallel workstreams for the RMIT UNLOCKED Challenge 2 prototype.

## Ownership

### Hoang — TideCloak integration

- Verify the authorized Tide environment, SDK version, and supported shared-encryption flow.
- Configure separate demo identities for author, invigilator, teacher, application administrator, and three governance holders.
- Prove the real cross-identity flow: author seals synthetic text; ciphertext is persisted; teacher and administrator are denied; the invigilator opens only after a real two-of-three governed grant.
- Return sanitized evidence: SDK/version manifest, ciphertext digest, request IDs, authoritative approval state, and outcomes. Never include credentials or tokens.
- Own the Tide adapter and document any capability that remains unavailable or unverified.

### Bao — App and API

- Scaffold the Next.js and TypeScript application, data model, and API boundaries.
- Store and return ciphertext only. Enforce the 16 KiB input limit, write-once behavior, and idempotent saves.
- Verify authenticated API requests with the required JWT and DPoP checks; keep plaintext out of server routes, logs, and analytics.
- Connect the APIs to Hoang's adapter. An application display-role edit must never change Tide identity or protected access.
- Keep protected operations unavailable when Tide configuration or verification is not ready; do not add a mock security fallback.

### Dinh — UI, README, and demo

- Build the sign-in, vault, upload, exam detail, administrator attack, governance, and activity views.
- Show explicit states such as Sealed, Awaiting release approval, Access released, Denied, and Unavailable. Keep manual release and synthetic-data notices visible.
- Use presentation fixtures only for layout work; disable protected actions until the live Tide result is connected.
- Complete the README overview (300 words or fewer) and separate setup and limitations sections.
- Prepare the two-minute demo using synthetic exam content. Keep the video under 100 MB and keep secrets off screen.

## Shared interface

Hoang owns the implementation of this domain-level contract against the verified Tide SDK. Bao and Dinh should build against the contract and report integration mismatches before changing it.

```ts
export type OperationState =
  | "ready"
  | "pending"
  | "denied"
  | "unavailable"
  | "not_ready";

export interface TidePort {
  getStatus(): Promise<{ state: OperationState; detail?: string }>;
  sealExam(input: {
    examId: string;
    plaintext: Uint8Array;
  }): Promise<{
    ciphertext: Uint8Array;
    digest: string;
    policyRef: string;
  }>;
  openExam(input: {
    examId: string;
    ciphertext: Uint8Array;
    policyRef: string;
  }): Promise<{
    plaintext: Uint8Array;
    state: OperationState;
  }>;
  requestInvigilatorGrant(input: { examId: string }): Promise<{
    requestId: string;
    state: OperationState;
  }>;
  getGrantStatus(requestId: string): Promise<{
    state: OperationState;
    approvalsRequired?: number;
    approvalsReceived?: number;
  }>;
}
```

**Boundary:** encryption and decryption run in the authenticated browser session. The application API handles ciphertext and metadata only. Approval counts and released status must come from Tide's authoritative state, never from UI clicks or app-owned role rows.

## Parallel workflow

1. Agree on the interface, response states, and file ownership before coding.
2. Work in parallel: Hoang proves Tide capabilities, Bao scaffolds storage and API boundaries, and Dinh builds the views against presentation fixtures.
3. Integrate at the first real vertical slice: seal synthetic content, persist ciphertext, verify teacher/admin denial, complete two distinct approvals, then open as the invigilator.
4. If live Tide behavior cannot be verified, keep protected actions unavailable and state the blocker. Do not claim automatic time release, exam-room enforcement, or immutable audit.

## File ownership proposal

- **Hoang:** Tide adapter and integration evidence.
- **Bao:** application API, storage, request verification, and schema.
- **Dinh:** UI components, README, and demo materials.
