# Kế hoạch function — Sealed Exam Vault

**Nguồn:** `TEAM_TASKS.md` (phân công 22/10/2026) + `WEB_BUILD_SPEC.md` (spec 22/10/2026).
**Deadline nộp bài Việt Nam:** thứ Năm 22/10/2026, 18:00 ICT (UTC+7).
**Phạm vi file này:** liệt kê đầy đủ từng function cần viết, chữ ký, input/output, điều kiện fail-closed và người phụ trách. Đây là hợp đồng của ứng dụng, **không phải** tên export được khẳng định của SDK Tide; tên nào thuộc SDK thì ghi rõ trong cột ghi chú.

---

## 0. Quy ước chung cho mọi function

| Quy ước | Nội dung |
|---|---|
| Fail closed | Thiếu xác minh, thiếu policy, thiếu dữ liệu Tide → trả `not_ready` / `unavailable` / `503`. Không bao giờ trả plaintext, không bao giờ coi lỗi mạng là "đã chặn tấn công". |
| Plaintext | Chỉ tồn tại trong trình duyệt. Không function server nào nhận, log, cache hay hash plaintext. |
| Nhãn vai trò app | `DemoRoleOverride.displayRole` không bao giờ được đọc trong guard quyền hay đường crypto. |
| Đếm phiếu | `authorizationCount` / `threshold` là optional. Thiếu → hiển thị "chưa xác định", không mặc định `0` hay `2`. |
| Đặt tên | `camelCase` cho function, `PascalCase` cho type, route handler đặt theo HTTP verb (`GET`, `POST`, `PUT`). |
| Lỗi | Mọi route trả `{ error: { code, message, correlationId, retryable } }`. |
| Header | Mọi response được bảo vệ: `Cache-Control: no-store`. |

**Đường găng M0** (đánh dấu ★ trong các bảng dưới): function nào thiếu thì không có demo nào chạy được.

---

## 1. Bản đồ phụ thuộc

```
Trình duyệt (nơi duy nhất có plaintext)
  UI pages + hooks — Bao
      | plaintext
      v
  src/lib/tide/browser — Dinh  <--- giao thức ---> Mạng Tide ORK (giữ thẩm quyền giải mã)
      |
      | ciphertext + metadata
      v
Next.js server (chỉ nhận ciphertext)
  src/app/api/** route handlers — Hoang
  src/lib/server/** verifier + guard — Hoang nối, Dinh cấp hợp đồng
  src/lib/tide/server — Dinh  <--- CR ---> TideCloak IGA (ngưỡng 2-of-3)
      |
      v
  SQLite — Hoang
```

Ba điểm nối phải chốt chữ ký trước khi code sâu: `getSession()` (Dinh → Bao), `encryptExam()` / `decryptExam()` (Dinh → Bao), `POST /api/exams/:id/seal` (Hoang → Bao).

---

## 2. Contracts chung — Hoang, `src/lib/contracts.ts` ★

| Khai báo | Nội dung | Ai dùng |
|---|---|---|
| `type VerifiedIdentity` | `issuer`, `subject`, `alias`, `realmRoles: string[]`, `clientRoles`, `tideUserKey?` | cả ba |
| `type IntegrationReadiness` | `tide: 'ready' \| 'not_ready' \| 'unavailable'`, `missing: string[]` | Bao, Hoang |
| `enum ExamState` | `PREPARING`, `DRAFT`, `ENCRYPTING`, `SEALED` | Hoang, Bao |
| `enum ReleaseState` | `UNRELEASED`, `REQUEST_PENDING`, `RELEASED`, `UNKNOWN_BLOCKED` | cả ba |
| `enum OpenState` | `CLOSED`, `OPENING`, `OPENED`, `DENIED`, `UNAVAILABLE` | Bao, Dinh |
| `enum ScheduleState` | `BEFORE_ADVISORY_TIME`, `ADVISORY_TIME_REACHED` | Bao |
| `type ExamSummary` | `id`, `title`, `authorAlias`, `contentType`, `sealedAt`, `advisoryReleaseAt`, `byteLength`, `ciphertextSha256`, `state`, `releaseState` | Hoang → Bao |
| `type SignedPolicyRef` | `policyId`, `purpose: 'WRITE' \| 'READ'`, `signedBytesBase64`, `digest`, `contractId`, `subjectId`, `assignmentId`, `version` | Hoang ↔ Dinh |
| `type PolicyReadiness` | `{status:'ready', policy}` \| `{status:'not_ready', reason}` | cả ba |
| `type DecryptOutcome` | union có tag: `opened` (**trường duy nhất** chứa `plaintext`), `denied`, `not_ready`, `unavailable`, `error` | Dinh → Bao |
| `type GovernanceRequestView` | `appRequestId`, `tideChangeRequestIds: string[]`, `targetSubject`, `requestedRoles`, `status`, `authorizationCount?`, `threshold?`, `observedAt` | Dinh → Hoang → Bao |
| `type ActivityEntry` | `id`, `at`, `actorAlias`, `kind`, `outcome`, `source: 'APP_LOG' \| 'CLIENT_REPORTED' \| 'OBSERVED_FROM_TIDECLOAK'`, `code`, `correlationId`, `changeRequestId?` | Hoang → Bao |
| `type ApiError` | `{error:{code,message,correlationId,retryable}}` | cả ba |
| `const LIMITS` | `MAX_PLAINTEXT_BYTES = 16384`, `MAX_CIPHERTEXT_BYTES` (Dinh chốt theo overhead envelope), `MAX_TITLE = 120` | cả ba |

---

## 3. Tầng dữ liệu — Hoang, `src/lib/db/**`

| Function | File | Vào → ra | Ràng buộc |
|---|---|---|---|
| `openDb()` ★ | `db/client.ts` | → handle SQLite | WAL, `foreign_keys=ON` |
| `migrate()` ★ | `db/migrate.ts` | → áp migration theo thứ tự | idempotent, chạy khi app dừng |
| `createDemoRun(input)` | `db/runs.ts` | realm/client id, version manifest → `DemoRun` | mỗi reset sinh `runId` mới |
| `getActiveRun()` | `db/runs.ts` | → `DemoRun \| null` | không tự tạo run khi thiếu |
| `insertExam(input)` ★ | `db/exams.ts` | `{runId,title,authorIssuer,authorSubject,advisoryReleaseAt}` → `Exam(PREPARING)` | `title ≤ 120`, chưa có ciphertext |
| `sealExam(input)` ★ | `db/exams.ts` | `{examId,ciphertext:Buffer,sha256,byteLength,expectedVersion}` → `Exam(SEALED)` | write-once: `UPDATE … WHERE state != 'SEALED' AND version = ?`; 0 dòng → `VersionConflict` |
| `getExam(id)` ★ | `db/exams.ts` | → `Exam \| null` | không kèm ciphertext trong truy vấn metadata |
| `listExams(runId)` | `db/exams.ts` | → `Exam[]` | chỉ run hiện tại |
| `readCiphertext(examId)` ★ | `db/exams.ts` | → `{bytes,sha256,byteLength}` | digest tính lại từ bytes vừa đọc |
| `insertPolicy(input)` ★ | `db/policies.ts` | `{examId,purpose,contractId,subjectType,subjectId,assignmentId,signedBytes,digest,version}` → `ExamPolicy` | unique `(examId,purpose,version)`; chỉ nhận sau khi verify chữ ký |
| `getLatestPolicy(examId,purpose)` ★ | `db/policies.ts` | → `ExamPolicy \| null` | lấy `version` cao nhất |
| `upsertGovernanceLink(input)` | `db/governance.ts` | `{appRequestId,examId,requester,target,roles,tideChangeRequestIds}` → bản ghi | mảng CR rỗng = chưa có CR thật |
| `updateObservedStatus(input)` | `db/governance.ts` | `{appRequestId,status,authorizationCount?,threshold?,observedAt}` → bản ghi | ghi `null` khi Tide không trả, không điền `0` |
| `getGovernanceLink(id)` | `db/governance.ts` | → bản ghi + cờ `stale` | cache đọc, không phải thẩm quyền |
| `setDisplayRole(input)` | `db/overrides.ts` | `{runId,issuer,subject,displayRole}` → `{before,after}` | unique `(runId,issuer,subject)`; không join vào guard |
| `getDisplayRole(...)` | `db/overrides.ts` | → nhãn hiển thị | chỉ phục vụ màn demo |
| `appendActivity(event)` | `db/activity.ts` | `ActivityEvent` → id | lọc allowlist trường trước insert |
| `queryActivity(filter)` | `db/activity.ts` | `{runId,examId?,kind?,cursor,limit}` → trang | phân trang bắt buộc |
| `claimDpopJti(input)` ★ | `db/dpop.ts` | `{jkt,jti,expiresAt}` → `true` nếu lần đầu | `INSERT` unique `(jkt,jti)`; lỗi DB → ném để API trả `503` |
| `purgeExpiredJti(now)` | `db/dpop.ts` | → số dòng xóa | chỉ xóa sau cửa sổ tươi của proof |
| `deleteRunData(runId)` | `db/reset.ts` | → xóa exam/activity/override | CLI offline, không có route HTTP |

Không có trong schema: cột plaintext, cột hash của plaintext, cột chứa access token hay DPoP proof.

---

## 4. Tầng server lib — Hoang, `src/lib/server/**`

### 4.1 Xác minh request

| Function | File | Chữ ký | Hành vi |
|---|---|---|---|
| `verifyRequest(req, opts)` ★ | `server/auth.ts` | `(Request, {requiredRoles?}) => Promise<VerifiedIdentity>` | Gọi `verifyTideCloakToken` rồi `verifyDpop` của Dinh; ném `UnauthorizedError` / `ForbiddenError`; không bao giờ chấp nhận token không có binding |
| `extractProof(req)` | `server/auth.ts` | `(Request) => {proofJwt, accessToken}` | Thiếu header `DPoP` → ném luôn, kể cả khi token gửi dạng Bearer |
| `canonicalUrl(req)` | `server/auth.ts` | `(Request) => string` | Dựng `htu` theo origin tin cậy đã cấu hình; chỉ tin `x-forwarded-*` sau proxy đã khai báo |
| `enforceReplay(proof)` ★ | `server/replay.ts` | `({jkt,jti,iat}) => Promise<void>` | Gọi `claimDpopJti`; trùng → `UnauthorizedError('proof_replayed')`; lỗi DB → `ServiceUnavailableError` |
| `requireRole(identity, role)` ★ | `server/guards.ts` | `(VerifiedIdentity, string) => void` | Chỉ đọc `realmRoles` từ claims đã xác minh, không đọc body, không đọc `DemoRoleOverride` |
| `requireOwner(identity, exam)` | `server/guards.ts` | `(VerifiedIdentity, Exam) => void` | So `issuer + subject`, không so alias |
| `requireState(exam, allowed)` | `server/guards.ts` | `(Exam, ExamState[]) => void` | Sai trạng thái → `409` |

### 4.2 Vệ sinh request và response

| Function | File | Chữ ký | Hành vi |
|---|---|---|---|
| `parseBody(req, schema, maxBytes)` | `server/validate.ts` | `<T>(Request, ZodSchema<T>, number) => Promise<T>` | Quá hạn mức → `413`; sai schema → `422` |
| `withIdempotency(key, scope, fn)` | `server/idempotency.ts` | `(string, string, () => Promise<T>) => Promise<T>` | Khóa theo `(subject, scope, key)`; lần hai trả lại kết quả đã lưu, không chạy lại |
| `rateLimit(identity, bucket)` | `server/ratelimit.ts` | `(VerifiedIdentity, string) => void` | Giới hạn theo subject, vượt → `429` |
| `jsonOk(data, correlationId)` | `server/respond.ts` | → `Response` | Gắn `no-store`, `correlationId`, `version` của tài nguyên |
| `jsonError(code, status, correlationId)` | `server/respond.ts` | → `Response` | Bảng mã lỗi thống nhất; message đã khử thông tin nhạy cảm |
| `newCorrelationId()` | `server/respond.ts` | → `string` | Dùng chung cho log và UI |
| `assertSameOrigin(req)` | `server/respond.ts` | `(Request) => void` | Mọi request thay đổi dữ liệu |

### 4.3 Nhật ký hoạt động

| Function | File | Chữ ký | Hành vi |
|---|---|---|---|
| `recordActivity(event)` | `server/activity.ts` | `(ActivityInput) => Promise<void>` | Lọc allowlist trường, gắn `source='APP_LOG'`, cấm plaintext/token/raw header |
| `recordClientObservation(identity, body)` | `server/activity.ts` | → `Promise<void>` | Gắn `source='CLIENT_REPORTED'`; enum giới hạn; không coi là bằng chứng giải mã thành công |
| `sanitizeOutcome(err)` | `server/activity.ts` | `(unknown) => {code, retryable}` | Chỉ map các mã lỗi đã biết; lỗi lạ → `unknown`, không gán nhãn "bị từ chối" |

### 4.4 Readiness

| Function | File | Chữ ký | Hành vi |
|---|---|---|---|
| `getIntegrationReadiness()` ★ | `server/readiness.ts` | → `IntegrationReadiness` | Kiểm tra: có JWK đã pin, có realm/client id, có asset DPoP, có governance config. Thiếu bất kỳ cái nào → `not_ready` kèm danh sách `missing` |
| `getVersionManifest()` | `server/readiness.ts` | → `{sdkVersions, realmImageDigest, dpopAssetSha256}` | Phục vụ evidence drawer, không chứa secret |

---

## 5. Route handlers — Hoang, `src/app/api/**`

Mỗi file export đúng các HTTP verb cần thiết. Thứ tự bắt buộc trong mọi handler: `assertSameOrigin` → `verifyRequest` → `enforceReplay` → `rateLimit` → `requireRole` → `parseBody` → nghiệp vụ → `recordActivity` → `jsonOk`.

| Route | Function | Nghiệp vụ | Mã lỗi riêng |
|---|---|---|---|
| `GET /api/session` ★ | `session/route.ts: GET` | Trả `VerifiedIdentity` + `getIntegrationReadiness()` | `503` khi verifier chưa cấu hình |
| `POST /api/exams/prepare` ★ | `exams/prepare/route.ts: POST` | `requireRole('author')` → `insertExam` → trả `examId` + trạng thái policy `pending` | `422` title sai, `409` trùng idempotency key khác payload |
| `POST /api/exams/[id]/seal` ★ | `exams/[id]/seal/route.ts: POST` | `requireOwner` → `requireState([PREPARING,DRAFT])` → kiểm `MAX_CIPHERTEXT_BYTES` → `sealExam` → digest tính từ bytes server nhận | `413` quá hạn mức, `409` đã seal hoặc sai version |
| `GET /api/exams` | `exams/route.ts: GET` | `listExams(runId)` + `releaseState` quan sát được | — |
| `GET /api/exams/[id]` | `exams/[id]/route.ts: GET` | `getExam` + trạng thái quan sát | `404` |
| `GET /api/exams/[id]/ciphertext` ★ | `exams/[id]/ciphertext/route.ts: GET` | Trả ciphertext thật cho **mọi** danh tính demo, kể cả teacher và app-admin (cố ý: bí mật phải sống sót khi kẻ tấn công có ciphertext) | `404` |
| `GET /api/exams/[id]/policy` ★ | `exams/[id]/policy/route.ts: GET` | `getLatestPolicy(id, purpose)` → `PolicyReadiness` | `not_ready` khi chưa ký, không phải `404` |
| `POST /api/exams/[id]/access-requests` ★ | `exams/[id]/access-requests/route.ts: POST` | `kind='SELF_ACCESS'`: target cố định = subject app-admin đã xác thực. `kind='INVIGILATOR_RELEASE'`: target cố định = invigilator chỉ định. Gọi `igaClient.proposeRoleGrant` → `202` + CR ID thật | `503` nếu chưa có cầu nối CR; **cấm** bịa `pending` |
| `GET /api/governance/requests` ★ | `governance/requests/route.ts: GET` | Gọi `igaClient.listChangeRequests` → lọc → `updateObservedStatus` → trả kèm `observedAt` | `503` khi không gọi được Tide |
| `POST /api/governance/requests/[id]/deny` | `governance/requests/[id]/deny/route.ts: POST` | Chỉ cho CR vừa fetch còn `PENDING` | `409` nếu trạng thái đã đổi |
| `PUT /api/demo/display-role` ★ | `demo/display-role/route.ts: PUT` | `requireRole('app-admin')` → `setDisplayRole` → trả `{before, after}` | `422` nếu `displayRole` ngoài enum |
| `GET /api/activity` | `activity/route.ts: GET` | `queryActivity` phân trang, gắn nhãn nguồn | — |
| `POST /api/activity/client-observations` | `activity/client-observations/route.ts: POST` | `recordClientObservation` | `422` ngoài enum |
| `POST /api/policies/ingest` | `policies/ingest/route.ts: POST` | Chỉ bật nếu round trip chữ ký đã chứng minh: verify bytes đã ký (contract, subject, assignment, operation) rồi `insertPolicy` | `503` khi chưa chứng minh được định dạng — giữ tắt |

**Không tồn tại:** `/api/decrypt`, `/api/plaintext`, route impersonate, route master key, route reset công khai.

---

## 6. Tide browser — Dinh, `src/lib/tide/browser/**`

| Function | File | Chữ ký | Ghi chú |
|---|---|---|---|
| `TideProvider` ★ | `providers/tide-provider.tsx` | component bọc app | Cấu hình `useDPoP: {mode:'strict', alg:'ES256'}` **trong config**, không phải prop JSX |
| `getSession()` ★ | `browser/session.ts` | `() => Promise<VerifiedIdentity \| null>` | Trả issuer/subject/alias/roles đã xác thực; alias không phải danh tính |
| `signIn(target)` ★ | `browser/session.ts` | `(profileHint) => Promise<void>` | Chọn đích đăng nhập, **không** ghi đè claim |
| `signOut()` ★ | `browser/session.ts` | `() => Promise<void>` | Xóa plaintext khỏi state UI trước khi chuyển danh tính |
| `secureFetch(input, init)` ★ | `browser/fetch.ts` | wrapper `fetch` | Gắn access token + DPoP proof đúng method/URL cho mọi request được bảo vệ |
| `prepareWritePolicy(examId)` ★ | `browser/policy.ts` | `(string) => Promise<SignedPolicyRef>` | Ceremony ký trong enclave của `tide-realm-admin`; **không** POST JSON cho backend để ký |
| `prepareReadPolicy(examId)` ★ | `browser/policy.ts` | `(string) => Promise<SignedPolicyRef>` | Cùng `assignmentId` với policy write |
| `toPolicyBytes(ref)` | `browser/policy.ts` | `(SignedPolicyRef) => Uint8Array` | Giải base64 thành `Uint8Array` cho IAMService |
| `encryptExam(input)` ★ | `browser/crypto.ts` | `({examId, plaintext, policy}) => Promise<{ciphertextBase64, byteLength}>` | `IAMService.doEncrypt(items, signedPolicyBytes)`; mỗi item đúng **một** tag `[examId]` |
| `decryptExam(input)` ★ | `browser/crypto.ts` | `({examId, ciphertext, policy}) => Promise<DecryptOutcome>` | `IAMService.doDecrypt(...)`; phân loại kết quả thật thành `opened` / `denied` / `not_ready` / `unavailable` / `error` |
| `classifySdkError(err)` ★ | `browser/crypto.ts` | `(unknown) => DecryptOutcome` | Chỉ map các message lồng nhau đã biết sang `denied`; lỗi ngưỡng/mạng chung → `unavailable`, **không** gọi là từ chối quyền |
| `clearPlaintext(ref)` | `browser/crypto.ts` | `(ref) => void` | Xóa buffer khi ẩn/điều hướng/đăng xuất; README nói rõ JS không bảo đảm xóa bộ nhớ pháp y |

Ranh giới bắt buộc: không file nào trong `src/lib/tide/browser/**` được import vào `src/app/api/**`.

---

## 7. Tide server — Dinh, `src/lib/tide/server/**`

| Function | File | Chữ ký | Kiểm tra |
|---|---|---|---|
| `verifyTideCloakToken(config, token, allowedRoles?)` ★ | `server/jwt.ts` | → claims \| `null` | Helper thật của SDK. Khẳng định adapter có `jwk.keys` nhúng; giới hạn thuật toán theo realm (Tide QEA EdDSA); kiểm `iss`, `azp`, hạn dùng, namespace role chính xác; **không** giả định `aud` bằng client id |
| `verifyDpop(proofJwt, ctx)` ★ | `server/dpop.ts` | `(string, {method, url, accessToken}) => Promise<{jkt, jti, iat}>` | Chữ ký bằng JWK trong proof, `typ`, thuật toán cho phép, `cnf.jkt` khớp token, `ath` khớp hash token, `htm`, `htu`, `iat` còn tươi. Dùng `templates/dpop-verify/verifyDpop.ts` của pack, không dùng snippet minh họa |
| `getPinnedJwk()` | `server/jwt.ts` | → JWK | Đọc từ cấu hình đã pin; thiếu → ném, không fetch khóa từ xa |
| `igaClient.proposeRoleGrant(input)` ★ | `server/iga.ts` | `({targetUserId, realmRoles}) => Promise<{changeRequestIds: string[]}>` | `POST /users/{id}/role-mappings/realm` với representation `{id,name}` thật; bắt `202` + `Location`/CR ID; không ghi đè assignment sẵn có |
| `igaClient.listChangeRequests(filter)` ★ | `server/iga.ts` | `({status}) => Promise<GovernanceRequestView[]>` | `GET /iga/change-requests?status=PENDING`; đọc `authorizationCount`, `authorizers[]`, `threshold`, `readyToCommit`, dependencies |
| `igaClient.getChangeRequest(id)` ★ | `server/iga.ts` | → bản ghi quyền uy | `GET /iga/change-requests/{id}` |
| `igaClient.denyChangeRequest(id)` | `server/iga.ts` | → kết quả | Chỉ gọi khi CR đang `PENDING`; deny CR đã `APPROVED` **không phải** thu hồi |
| `igaClient.readDiagnostics(id)` | `server/iga.ts` | → bundle | Chỉ để kiểm tra ngưỡng; không phải verifier audit bất biến |

**Tuyệt đối không có** trong `src/lib/tide/server/**`: hàm approve, hàm commit, hàm ký policy, hàm impersonate. Phê duyệt chỉ xảy ra trong trình duyệt của từng governor (`POST /iga/change-requests/{id}/approve` với `{}`, rồi `{requestModel}` nếu trả `mode="needs-approval"`), vì R2 tính HTTP caller chứ không tính nhãn người trong chữ ký.

---

## 8. Frontend — Bao, `src/app/**` và `src/components/**`

### 8.1 Hook

| Function | File | Chữ ký | Hành vi |
|---|---|---|---|
| `useSession()` ★ | `hooks/use-session.ts` | → `{identity, readiness, status}` | Bọc `getSession`; trạng thái: khởi tạo, chuyển hướng, hủy login, popup/storage bị chặn, hết phiên, sai profile |
| `useExams()` | `hooks/use-exams.ts` | → `{exams, state, retry}` | Rỗng / đang tải / lỗi tải lại được / dịch vụ không sẵn sàng |
| `useExam(id)` | `hooks/use-exam.ts` | → `{exam, policy, state}` | Gộp metadata + `PolicyReadiness` |
| `useDecryptAttempt(examId)` ★ | `hooks/use-decrypt.ts` | → `{outcome, attempt()}` | Tải ciphertext + signed policy, gọi `decryptExam`, báo `client-observations`; chỉ giữ plaintext khi `opened` |
| `useGovernanceRequests()` ★ | `hooks/use-governance.ts` | → `{requests, observedAt, state}` | Refetch sau xung đột; chặn sửa dữ liệu cũ |
| `useActivity(filter)` | `hooks/use-activity.ts` | → trang timeline | Lọc theo exam/action, phân trang |
| `useDisplayRoleAttack()` | `hooks/use-attacks.ts` | → `{before, after, run()}` | Gọi `PUT /api/demo/display-role` rồi gọi lại `decryptExam` thật |

### 8.2 Component

| Component | File | Vai trò |
|---|---|---|
| `AppShell` ★ | `components/app-shell.tsx` | Nav trái 224px, thanh danh tính trên 64px, content max 1200px/spacing 24px; 375px → menu gọn, một cột, nút xếp dọc |
| `IdentityBar` ★ | `components/identity-bar.tsx` | Subject đang hoạt động + nút đăng xuất |
| `ModeBanner` ★ | `components/mode-banner.tsx` | "Live Tide integration · Manual governance release · Synthetic content"; chưa xác minh → "Protected operations unavailable — configuration not verified" |
| `StateBadge` | `components/state-badge.tsx` | `Sealed` / `Awaiting release approval` / `Access released` / `Opened in this session` — luôn kèm chữ, không chỉ màu |
| `ResultPanel` ★ | `components/result-panel.tsx` | 5 nhánh `DecryptOutcome`, `aria-live`, mã chẩn đoán + correlation ID |
| `ByteCounter` | `components/byte-counter.tsx` | Đếm byte UTF-8 so với 16 KiB, lỗi hiện inline |
| `EvidenceDrawer` | `components/evidence-drawer.tsx` | Version manifest, byte count, digest, CR ID, threshold/count, subject — không hiện token hay enrollment link |
| `AccessibleModal` | `components/modal.tsx` | Bẫy focus, khôi phục focus, `prefers-reduced-motion` |
| `TimestampPair` | `components/timestamp.tsx` | UTC + giờ Việt Nam kèm vùng |

### 8.3 Page

| Page | File | Nội dung chính |
|---|---|---|
| `/sign-in` ★ | `app/sign-in/page.tsx` | Thẻ danh tính + "Chọn thẻ này không cấp vai trò đó. Hãy đăng nhập đúng tài khoản." Sai profile → "This session belongs to [alias]…" |
| `/vault` ★ | `app/vault/page.tsx` | Một dòng đề + nhãn trạng thái + "Lịch chỉ mang tính tham khảo; prototype phát hành bằng hai phê duyệt độc lập". Countdown về 0 chỉ đổi chữ thành "Scheduled time reached — approval still required" |
| `/vault/new` ★ | `app/vault/new/page.tsx` | Picker `.txt`, preview, byte counter, checkbox "Synthetic exam only", policy fingerprint, tiến trình đọc → kiểm tra → mã hóa → lưu → sealed. Thiếu policy → "A governance administrator must prepare this exam's encryption policy." |
| `/vault/[id]` ★ | `app/vault/[id]/page.tsx` | Metadata trái, "Attempt to open" phải, plaintext dạng monospace đã escape + "Hide paper", không tự tải file |
| `/administration/attacks` ★ | `app/administration/attacks/page.tsx` | Ba thẻ đánh số: đọc ciphertext thật (byte count, SHA-256, tải về, nhãn "Integrity reference; not a signature"); yêu cầu access thật (CR ID thật, không có nút "approve as admin"); đổi nhãn vai trò app rồi gọi lại SDK |
| `/governance` ★ | `app/governance/page.tsx` | Danh sách CR thật, "1 of 2 required approvals · 3 eligible governance identities", cảnh báo trước khi duyệt request của kẻ tấn công, "Approve in Tide" mở enclave của chính approver |
| `/activity` | `app/activity/page.tsx` | Timeline với nhãn nguồn: "Application log — editable by infrastructure operator", "Client reported", "Observed from TideCloak" |

---

## 9. Tài liệu, evidence và reset

| Việc | File / script | Người |
|---|---|---|
| `README.md` | Overview ≤ 300 từ theo template C1, 5 câu trả lời giám khảo, badge "Built with TideCloak", giới hạn prototype | Bao |
| `docs/backend-setup.md` | Chạy local, migration, `.env.example` chỉ placeholder | Hoang |
| `docs/tide-setup.md` | Phiên bản SDK, realm, origin, DPoP asset + SHA-256, ba governance account, M0 | Dinh |
| `docs/demo-script.md` | Kịch bản 120 giây theo mục 13 của spec | Bao |
| `docs/evidence/**` | Policy fingerprint, CR ID, threshold/count, kết quả A1–A15, mục NOT VERIFIED | Dinh + Hoang |
| `scripts/reset-run.ts` | Xóa dữ liệu run, cấp `runId`/UUID mới, ký policy mới; chạy offline | Hoang |
| `scripts/verify-dpop-asset.ts` | So SHA-256 của `public/tide_dpop_auth.html` với giá trị đã pin | Dinh |
| Video `.mp4` | ≤ 100 MB (nhắm dưới 90 MB), trong repo, chạy được từ clone sạch | Bao |

---

## 10. Thứ tự thực thi

| Mốc | Làm gì | Điều kiện chuyển mốc |
|---|---|---|
| **M0 — lát cắt dọc thật** | License/hosting, realm, 4 danh tính, 3 governor, một cặp policy write/read, trang dev tối thiểu: login → `encryptExam` → `sealExam` → `readCiphertext` → teacher/admin bị SDK từ chối → cấp quyền cho invigilator → phiên mới → `decryptExam` mở được | Chia sẻ giữa hai danh tính chạy thật; hai test âm là từ chối quyền chứ không phải sự cố mạng; ciphertext đến từ DB. Thiếu `RelationshipAttestation:1` → dừng mọi tuyên bố bảo vệ |
| **M1 — chứng minh governance** | Ngưỡng 2-of-3 hiệu lực, self-grant pending, một phiếu bị từ chối, không đếm trùng người, phiếu thứ hai commit, sửa nhãn vai trò app, governor không có gate role | Tấn công của admin có kết quả kiểm chứng được. Nếu một người cấp được quyền → chặn demo |
| **M2 — persistence và API** | Schema, upload có hạn mức, ownership/write-once/idempotency, verifier + replay cache nguyên tử, cầu nối CR hoặc fallback console | Không còn đường plaintext phía server; lỗi tích hợp chặn thao tác được bảo vệ |
| **M3 — bảy màn hình** | Shell, trạng thái accessible, nhãn evidence, banner release thủ công, profile tách biệt | UI chỉ dùng state thật từ API/SDK |
| **M4 — evidence và tổng duyệt** | Chạy A1–A15, test reset, ghi evidence, tổng duyệt 120 giây | Mọi kiểm tra có kết quả PASS / FAIL / NOT VERIFIED, không coi bỏ qua là đạt |
| **M5 — chuẩn bị nộp** | Overview ≤ 300 từ, setup riêng, video < 100 MB, quét secret, checklist | Nộp cần người xác nhận; spec không tự thực hiện |

---

## 11. Đối chiếu function với kiểm thử nghiệm thu

| Kiểm tra | Function liên quan |
|---|---|
| A1 plaintext không rò rỉ | `sealExam`, `readCiphertext`, `recordActivity`, `parseBody` |
| A2 teacher bị từ chối | `decryptExam`, `classifySdkError`, `GET /policy`, `GET /ciphertext` |
| A3 admin bị từ chối | như A2 + rà soát không có credential giải mã phía server |
| A4 self-grant pending ở 1/2 | `igaClient.proposeRoleGrant`, `listChangeRequests`, `updateObservedStatus`, `useGovernanceRequests` |
| A5 sửa nhãn vai trò app | `setDisplayRole`, `useDisplayRoleAttack`, `requireRole` (không đọc override) |
| A6 lịch chỉ tham khảo | `ScheduleState`, `StateBadge`, copy ở `/vault` |
| A7 invigilator mở được sau 2 phiếu | `prepareReadPolicy`, `decryptExam`, `getLatestPolicy`, `signOut`/`signIn` |
| A8 policy/ciphertext hỏng | `toPolicyBytes`, `classifySdkError`, `insertPolicy` (verify chữ ký) |
| A9 JWT/DPoP sai hoặc replay | `verifyTideCloakToken`, `verifyDpop`, `enforceReplay`, `claimDpopJti`, `canonicalUrl` |
| A10 kiểm M0 và các đường control-plane | `igaClient.readDiagnostics`, `listChangeRequests` |
| A11 governor ký policy khác vẫn không đọc được | `prepareReadPolicy`, `decryptExam`, phân bổ role trong `docs/tide-setup.md` |
| A12 log có thể bị sửa | `appendActivity`, `queryActivity`, nhãn nguồn ở `/activity` |
| A13 mất kết nối giữa chừng | `getIntegrationReadiness`, `ResultPanel`, `sealExam` (không đánh dấu sealed khi chưa thành công) |
| A14 reset | `deleteRunData`, `scripts/reset-run.ts`, `purgeExpiredJti` |
| A15 bàn phím, mobile, tương phản | `AppShell`, `AccessibleModal`, `StateBadge`, `ResultPanel` |

---

## 12. Blocker cần chốt trước khi code

| Câu hỏi | Ai chốt | Nếu chưa có |
|---|---|---|
| Mạng/SDK có `RelationshipAttestation:1` không? | Dinh, cần xác nhận từ Tide | Chặn lõi. Không clone contract, không mock |
| 2-of-3 có hiệu lực trên mọi đường cấp quyền không? | Dinh, đọc M0 đã ký | Chặn lõi nếu một người cấp được quyền |
| App có đề xuất/đọc CR mà không giữ quyền duyệt không? | Dinh + Hoang | Fallback: governance operator đề xuất trong console, UI ghi "Awaiting operator proposal" |
| Ký lại relationship policy có cần quorum không? | Chưa xác minh | Giữ mọi governor không có `_tide_decryptor`; ghi NOT VERIFIED |
| `MAX_CIPHERTEXT_BYTES` bằng bao nhiêu? | Dinh đo overhead envelope | Hoang không áp cứng 16 KiB cho ciphertext |
| License email và nơi host realm (Docker local hay Skycloak)? | Người dùng quyết định | Chặn setup; mặc định đề xuất Docker local |
| Hạn thu hồi role/token thực tế là bao lâu? | Dinh đo | Luôn đăng xuất/đăng nhập lại sau khi cấp hoặc thu quyền |

Không cam kết: thời gian mở tự động có đồng hồ tin cậy, ràng buộc phòng thi, audit bất biến, miễn nhiễm khi toàn bộ server bị chiếm. Những mục này nằm ngoài MVP và phải nói rõ trong README lẫn video.
