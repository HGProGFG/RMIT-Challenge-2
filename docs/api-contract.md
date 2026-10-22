# API contract for Bao and Dinh

All endpoints require DPoP-bound session credentials; call with the authenticated SDK's `secureFetch`. Every protected response is no-store. Errors use `{error:{code,message,correlationId,retryable}}`. Successes use `{data:...,correlationId,version:1}`; the envelope version is separate from `exam.version` (1 prepared, 2 sealed).

Mutations require `Origin: APP_ORIGIN`, JSON and strict schema fields only. Prepare, seal and access requests require a stable `Idempotency-Key` across retries, with a fresh DPoP proof for each HTTP request. Unknown properties including `plaintext`, actor/role overrides and arbitrary observations are rejected.

| Method/path | Body/query | Data |
| --- | --- | --- |
| GET `/api/session` | — | `{identity:{issuer,subject,alias,roles},readiness:{authentication,policy,governance},mode,scheduleIsAdvisory}` |
| POST `/api/exams/prepare` | `{title,advisoryReleaseAt}` | 201 `{exam,policyStatus:"not_ready"}`; author only. A fresh exam/run UUID, with policies prepared separately. |
| GET `/api/exams` | `limit=1..100`, `offset=0..1000000` | `{exams,limit,offset,accessReleaseStatus:"unknown"}` |
| GET `/api/exams/:id` | — | `{exam,accessReleaseStatus:"unknown",scheduleIsAdvisory:true}` |
| POST `/api/exams/:id/policies` | `{purpose:"WRITE"\|"READ",signedBytesBase64}` | 201 `{policy}`; governor only; disabled until reviewed Tide signature verifier is ready. |
| GET `/api/exams/:id/policy` | `purpose=WRITE\|READ` (READ default) | `{policy}` or 503 `POLICY_NOT_READY`; any verified demo participant can fetch policies for direct negative tests. |
| POST `/api/exams/:id/seal` | `{ciphertextBase64,writePolicyId,contentType:"text/plain;charset=utf-8",expectedVersion:1}` | `{exam}`; owner author, configured ciphertext limit, both policies required. |
| GET `/api/exams/:id/ciphertext` | — | `{ciphertextBase64,encoding:"base64",sha256,byteLength,integrityLabel}`; teacher/admin intentionally included. |
| POST `/api/exams/:id/access-requests` | `{kind:"SELF_ACCESS"\|"INVIGILATOR_RELEASE"}` | 202 `{id,observation}` with real IDs, or explicit 503. Self: app-admin, current subject, roles invigilator+_tide_decryptor. Release: designated invigilator/governor, fixed recipient, role _tide_decryptor. |
| GET `/api/governance/requests` | — | `{requests,observedAt,authority}`; app-admin sees own, governor sees demo links; fetches live observations each time. |
| PUT `/api/demo/display-role` | `{runId,displayRole:"invigilator"}` | `{before,after,authorityChanged:false,verifiedRoles}`; app-admin only and enabled development demo only. |
| GET `/api/activity` | optional `examId`, `limit`, `offset` | `{events,limit,offset,evidenceLabel}`; synthetic demo observations only. |
| POST `/api/activity/client-observations` | `{examId,kind:"DECRYPT_ATTEMPT",outcome,code,correlationId}` | 201 `{recorded:true,source:"CLIENT_REPORTED",authority}`; never authoritative proof of an opening. |

`title` is 1–120 trimmed characters. `advisoryReleaseAt` must be an ISO timestamp with timezone; stored as UTC. Plaintext stays in the browser, with a 16 KiB UTF-8 limit checked before encryption. Signed policy bytes are limited to 64 KiB, independently from ciphertext. `.env.example` deliberately does not guess envelope overhead.

Client observation codes must match outcomes: `opened→SDK_OPENED`, `denied→SDK_ROLE_DENIED|SDK_POLICY_DENIED`, `not_ready→POLICY_NOT_READY`, `unavailable→NETWORK_UNAVAILABLE`, `error→SDK_UNKNOWN`. A generic network/threshold error must not become a permission-denial claim. Client correlation IDs are UUIDs; the server response has its own correlation ID.

Governance observations have this application shape, not Tide's raw HTTP shape:

```ts
{
  changeRequestIds: string[];
  requests: Array<{
    changeRequestId: string;
    status: "PENDING" | "COMMITTED" | "REJECTED" | "UNAVAILABLE";
    authorizationCount: number | null;
    threshold: number | null;
    authorizers: string[] | null;
  }>;
  observedAt: string; // actual live fetch time, ISO UTC
  source: "TIDE";
}
```

Two separate role proposals mean two CR states, not one fabricated combined vote. Display missing threshold/count as unavailable, never 0. Gate release on actual committed requests and a successful genuine browser decrypt; a local app row cannot grant network authority.

HTTP errors: 401 invalid session/proof; 403 verified participant lacks privilege or same-origin check fails; 404 missing/disabled route; 409 ownership-independent state, idempotency or frozen-record conflict; 413 size; 422 schema/encoding; 429 rate limit; 503 missing/unavailable dependency. Errors and logs never echo tokens, proofs, bodies, SDK exception text or policy keys.

Do not add a server decrypt/plaintext route. Render plaintext only from the `opened` discriminant in `DecryptResult`; the other branches cannot contain plaintext. Fetch ciphertext and the READ policy, decrypt with Dinh's current browser identity, and clear paper state on hide/logout/navigation.
