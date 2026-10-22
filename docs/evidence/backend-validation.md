# Backend verification

Date: 22 October 2026 (Asia/Bangkok, UTC+7).

Scope: application backend only. Tests use locally generated signing keys, random opaque ciphertext and explicitly marked synthetic policy fixtures. They neither authenticate to Tide nor reproduce Tide network permission enforcement.

| Check | Result/boundary |
| --- | --- |
| Next.js production compilation | Passed with Next 16.4.2 on Node 24.19.0. |
| TypeScript strict checking | Passed, including all test files. |
| Backend automated checks | 51 checks passed, including proposal/denial validation with explicit adapter test doubles, run isolation, offline reset and migration upgrade. |
| Prepare/seal idempotency and ownership | Local automated checks passed, persisted SQLite. |
| Ciphertext larger than plaintext limit, exact readback/digest | Local automated checks passed with 20/40 KB random opaque bytes. |
| Sealed record overwrite | API/repository conflicts and SQL update trigger tested. |
| JWT/DPoP invalid/missing/expired/wrong issuer/client/method/URL/ath/binding | Local generated-key checks passed; genuine Tide token compatibility not verified. |
| Duplicate proof | Concurrent requests and database close/reopen tested; one acceptance only. |
| Forwarded-host injection, private proof key, unrelated client role | Rejected in local tests. |
| Policy ingestion without reviewed verifier | Disabled with 503; no unsigned runtime policy accepted. |
| Governance without adapter | 503; no fabricated pending state or counts. |
| Active run scope | Lists, details, ciphertext/policy, governance, activity and display changes exclude archived runs. Missing run never creates one implicitly. |
| Offline reset | Dry-run/apply tested in subprocesses; fresh run/exam UUIDs, old policy removal, other-run isolation and replay retention verified. |
| Database maintenance lock | A second process cannot migrate/reset while the application process owns the database. |
| Migration upgrade | Version-1 rows preserved, migration history idempotent, no automatic active-run selection. |
| Governor deny route | Live-state check, wrong-role/CR/stale rejection, committed-state/race conflict and unconfirmed rejection tested with adapter doubles. Real Tide denial remains NOT VERIFIED. |
| Readiness/version manifest | Missing dependencies, unavailable state, exact relay fingerprint, public-key fingerprint and null unknown SDK/image values verified locally. |
| Running production server HTTP checks | Home returns 200; protected endpoints return 401 with no-store; rewritten relay is byte-exact and sends its expected CSP/Allow-CSP-From headers. |
| Tide doctor, static + running server | Nine passes; missing public adapter failure and missing browser DPoP provider warning. These are explicit Dinh integration dependencies, not suppressed. |
| Real shared encryption/decryption, network denials, genuine 2-of-3 | NOT VERIFIED; requires Dinh's live realm/accounts/policies/SDK. |
| Bao UI and whole-team merge | NOT VERIFIED; no remote feature branches existed at handoff. |

No evidence here supports automatic time release, exam-room presence, immutable logs, complete server-compromise immunity or a completed challenge submission.
