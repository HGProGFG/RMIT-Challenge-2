# Phân chia công việc — Sealed Exam Vault

**Thành viên:** Hoang, Bao, Dinh.

**Bản phân công cập nhật:** 22/10/2026.

**Mục tiêu:** ba người làm song song, mỗi phần có người phụ trách và đầu ra để ghép vào ứng dụng.

## 1. Phân công chính

| Thành viên | Phụ trách | Đầu ra chính | Nhánh đề xuất |
|---|---|---|---|
| **Bao** | Frontend, trải nghiệm sử dụng, trình bày demo | 7 màn hình, trạng thái rõ ràng, README và kịch bản video | `feat/bao-ui` |
| **Hoang** | Backend, database, API, ghép ứng dụng | Scaffold Next.js/TypeScript, lưu ciphertext, API đã xác thực | `feat/hoang-api` |
| **Dinh** | TideCloak, danh tính, mã hóa và quản trị quyền | Đăng nhập thật, adapter Tide, quy trình phê duyệt 2-of-3 | `feat/dinh-tide` |

Các đường dẫn và nhánh dưới đây là kế hoạch triển khai; bản phân công này chưa tạo ứng dụng hay cấu hình Tide.

## 2. Phạm vi chung

- Một đề thi giả lập dạng UTF-8 `.txt`, tối đa **16 KiB plaintext**.
- Mã hóa và giải mã trong trình duyệt của người dùng đã đăng nhập. API chỉ nhận ciphertext và metadata.
- Danh tính riêng: author, invigilator, teacher, app-admin và ba tài khoản governance.
- Quyền đọc của invigilator được cấp bằng **hai phê duyệt độc lập trong nhóm ba người**.
- Thời gian thi hiển thị mang tính tham khảo. MVP dùng phê duyệt thủ công để phát hành quyền đọc.
- UI lấy kết quả thật từ API/Tide. Khi chưa cấu hình xong phải hiện `not_ready` hoặc `unavailable`.

## 3. Bao — Frontend và demo

### Công việc

- [ ] Xây dựng giao diện chung: navigation, thanh danh tính, bố cục desktop/mobile.
- [ ] Làm màn đăng nhập: chọn tài khoản để chuyển tới luồng đăng nhập do Dinh cung cấp; hiển thị subject/role đã xác thực.
- [ ] Làm kho đề, màn tạo đề và màn chi tiết: nhập/đọc `.txt` tại trình duyệt, đếm byte, gọi mã hóa rồi gửi ciphertext tới API của Hoang.
- [ ] Làm thao tác mở đề: tải ciphertext và signed policy, gọi adapter trình duyệt của Dinh, hiển thị plaintext dưới dạng text đã escape.
- [ ] Làm bảng thử vượt quyền của admin: xem ciphertext thật, yêu cầu tự cấp quyền, đổi nhãn vai trò trong app rồi thử giải mã lại.
- [ ] Làm màn governance và activity: hiển thị request/count/status thật; nút phê duyệt mở luồng Tide được Dinh xác nhận.
- [ ] Phân biệt rõ đang tải, chờ phê duyệt, từ chối, lỗi mạng, chưa sẵn sàng và mở thành công. Không biến lỗi mạng thành “đã chặn tấn công”.
- [ ] Hoàn thiện README: overview tối đa 300 từ, hướng dẫn chạy liên kết tới tài liệu của Hoang/Dinh, giới hạn của prototype.
- [ ] Viết kịch bản và quay video khoảng 2 phút, dưới 100 MB, dùng dữ liệu giả lập.

### Sở hữu file dự kiến

`src/app/**/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`, `README.md`, `docs/demo-script.md`.

### Bàn giao và điều kiện hoàn thành

Bao bàn giao bảy màn hình: sign-in, vault, upload, detail, admin attacks, governance, activity. Kiểm tra các trạng thái lỗi, thao tác bàn phím và bố cục mobile. Có thể dùng fixture ghi rõ nhãn để làm bố cục; phần chứng minh bảo mật phải chạy bằng tích hợp thật.

## 4. Hoang — Backend, database và tích hợp ứng dụng

### Công việc

- [ ] Tạo scaffold Next.js/TypeScript và chốt cấu trúc thư mục tối thiểu để Bao/Dinh bắt đầu cùng lúc.
- [ ] Chốt application types trong `src/lib/contracts.ts` với Bao và Dinh trước khi ba nhánh triển khai sâu.
- [ ] Tạo schema/migration cho exam, signed policy, governance links, display-role override, activity và DPoP replay cache.
- [ ] Làm API prepare/seal/list/detail/ciphertext/policy; lưu ciphertext nguyên dạng, tính digest từ ciphertext và trả lại dữ liệu đã lưu thật.
- [ ] Áp dụng ownership, write-once, idempotency, kiểm tra input và giới hạn request. Giới hạn ciphertext dựa trên overhead của envelope mà Dinh xác nhận; không áp cứng 16 KiB cho ciphertext.
- [ ] Gắn JWT/DPoP verifier của Dinh vào API; kiểm tra quyền ở server bằng claims đã xác thực; triển khai replay cache có thao tác ghi nguyên tử.
- [ ] Làm API yêu cầu cấp quyền và đọc trạng thái thông qua integration server của Dinh. Chỉ hiện pending khi đã có Tide change-request ID thật.
- [ ] Làm endpoint đổi nhãn vai trò demo và activity. Nhãn vai trò app không được dùng làm quyền giải mã.
- [ ] Giữ plaintext, access token và proof khỏi database/logs; activity chỉ ghi các trường được cho phép.
- [ ] Viết `docs/backend-setup.md`, cấu hình mẫu không chứa secret và chủ trì ghép ba nhánh qua PR.

### Sở hữu file dự kiến

`src/app/api/**`, `src/lib/contracts.ts`, `src/lib/db/**`, `src/lib/server/**`, migration/schema, `package.json`, lockfile, cấu hình build và `.env.example`.

### Bàn giao và điều kiện hoàn thành

Hoang bàn giao API có schema và lỗi thống nhất, một vòng lưu/đọc ciphertext thật, và hướng dẫn chạy local. Kiểm tra từ chối request không hợp lệ, ghi trùng, ghi đè đề đã seal và proof replay. Dinh cung cấp yêu cầu verifier; Hoang chịu trách nhiệm nối verifier và replay cache vào toàn bộ API được bảo vệ.

## 5. Dinh — TideCloak, mã hóa và governance

### Công việc

- [ ] Xác nhận phiên bản SDK, môi trường Tide và các bước license/hosting/onboarding cần hoàn tất trước khi tạo realm.
- [ ] Cấu hình callback/origin và đăng nhập thật; cung cấp provider/session/logout cho Bao. Chuyển tài khoản phải xác nhận đúng danh tính và xóa plaintext khỏi trạng thái UI.
- [ ] Chuẩn bị các tài khoản/role riêng cho demo; kiểm tra author, teacher, app-admin và governance không vô tình có quyền đọc.
- [ ] Chứng minh luồng chia sẻ giữa hai danh tính: author mã hóa để invigilator có thể giải mã sau khi được cấp quyền. Tự mã hóa rồi tự giải mã chưa đủ cho yêu cầu này.
- [ ] Chuẩn bị signed write/read policy cho từng exam/run và adapter mã hóa/giải mã chỉ chạy trong trình duyệt.
- [ ] Cung cấp verifier chạy ở server: JWT và DPoP binding, method/URL, thời hạn, token hash; thống nhất hợp đồng replay cache với Hoang.
- [ ] Cung cấp integration cho đề xuất/đọc change request; xác nhận quorum 2-of-3, một người không được tính hai lần và quyền chỉ có hiệu lực sau commit thật.
- [ ] Thực hiện phê duyệt bằng phiên đăng nhập riêng của từng governor. Nếu chưa xác minh được approval UI tự xây, dùng console Tide được hỗ trợ.
- [ ] Chứng minh teacher/admin bị từ chối với ciphertext đã lưu; invigilator mở được sau release và đăng nhập lại; teacher/admin vẫn bị từ chối sau release.
- [ ] Viết `docs/tide-setup.md` và lưu evidence đã loại secret: phiên bản, policy fingerprint, CR IDs, trạng thái/count/threshold, kết quả thử quyền và giới hạn chưa xác minh.

### Sở hữu file dự kiến

`src/lib/tide/browser/**`, `src/lib/tide/server/**`, `src/providers/**`, `src/hooks/use-tide*`, `docs/tide-setup.md`, `docs/evidence/tide/**`.

### Bàn giao và điều kiện hoàn thành

Dinh bàn giao adapter thật, hướng dẫn cấu hình và bằng chứng cho luồng từ chối → phê duyệt → mở được. Tách module browser/server để Hoang không import đường giải mã vào API. Không có secret phê duyệt, ký policy hay giải mã trong runtime của ứng dụng.

## 6. Các điểm bàn giao cần chốt trước

Đây là **hợp đồng của ứng dụng**, không phải tên export được khẳng định của SDK Tide.

| Điểm nối | Người cung cấp → người sử dụng | Dữ liệu/quy tắc cần thống nhất |
|---|---|---|
| Session phía browser | Dinh → Bao | issuer, subject, alias, verified roles, trạng thái session, đăng nhập/đăng xuất |
| Mã hóa/giải mã browser | Dinh → Bao | examId, signed policy, ciphertext; plaintext chỉ tồn tại trong browser |
| Verification phía server | Dinh → Hoang | verified claims hoặc lỗi; hợp đồng kiểm tra replay nguyên tử |
| API lưu trữ | Hoang → Bao | prepare → policy sẵn sàng → mã hóa → seal → tải ciphertext/policy |
| Governance | Dinh → Hoang → Bao | CR IDs thật dạng mảng, target/roles, status, số phiếu/ngưỡng và thời điểm quan sát |
| Activity/evidence | Hoang + Dinh → Bao | actor đã xác thực, nguồn quan sát, outcome/code, correlationId; không gửi plaintext |

Quy tắc cho kết quả giải mã: chỉ nhánh `opened` được chứa plaintext. Các nhánh `denied`, `not_ready`, `unavailable`, `error` không chứa plaintext. Đếm phiếu dựa trên dữ liệu Tide; thiếu count/threshold phải hiển thị chưa xác định, không mặc định bằng 0.

API tối thiểu do Hoang cung cấp:

| Endpoint | Mục đích |
|---|---|
| `GET /api/session` | Danh tính đã xác thực và readiness |
| `POST /api/exams/prepare` | Tạo examId và trạng thái chuẩn bị policy |
| `POST /api/exams/:id/seal` | Lưu ciphertext sau mã hóa |
| `GET /api/exams`, `GET /api/exams/:id` | Metadata và trạng thái quan sát |
| `GET /api/exams/:id/ciphertext` | Ciphertext thật đã lưu |
| `GET /api/exams/:id/policy?purpose=READ` | Signed read policy hoặc trạng thái chưa sẵn sàng |
| `POST /api/exams/:id/access-requests` | Yêu cầu self-access hoặc release cho invigilator được chỉ định |
| `GET /api/governance/requests` | Trạng thái Tide đã lọc và thời điểm lấy dữ liệu |
| `PUT /api/demo/display-role` | Thay nhãn vai trò app trong demo |
| `GET /api/activity`, `POST /api/activity/client-observations` | Timeline có nhãn nguồn quan sát |

Chính sách quyền, lỗi và schema chi tiết bám theo `WEB_BUILD_SPEC.md`. API không có route nhận plaintext để giải mã.

## 7. Thứ tự làm song song

| Mốc | Bao | Hoang | Dinh | Điều kiện chuyển mốc |
|---|---|---|---|---|
| **A — Chốt nền** | Chốt 7 màn và field cần dùng | Scaffold tối thiểu, contracts/API | Chốt boundary browser/server và dependency Tide | Cả ba cùng dùng types và file ownership đã thống nhất |
| **B — Làm độc lập** | Dựng màn hình với fixture có nhãn | Schema, API, persistence và guards | Đăng nhập, policy, crypto, quorum thật | Mỗi phần có đầu ra để nối, nêu rõ phần chưa sẵn sàng |
| **C — Ghép luồng đầu tiên** | Nối upload/open và trạng thái | Lưu/đọc ciphertext thật | Teacher/admin bị từ chối; release; invigilator mở | Hoàn thành một luồng thật trước khi trau chuốt giao diện |
| **D — Chứng minh và hoàn thiện** | Admin panel, UX, README, video | Kiểm tra API/storage/replay, sửa lỗi ghép | Một phiếu chưa đủ, hai phiếu commit, evidence | Các kiểm tra cốt lõi có kết quả và giới hạn rõ ràng |

Nếu Tide chưa sẵn sàng, Bao vẫn làm giao diện và Hoang vẫn làm persistence/API; thao tác được bảo vệ giữ trạng thái chưa sẵn sàng. Dinh ghi blocker cụ thể để cả nhóm xử lý.

## 8. Cách phối hợp và nghiệm thu

- Mỗi người tạo PR từ nhánh của mình. Hoang chủ trì ghép; Bao kiểm tra UI; Dinh kiểm tra thay đổi ảnh hưởng auth/crypto/governance.
- Hoang sửa dependency, cấu hình gốc và contracts sau khi thống nhất. Bao/Dinh báo dependency cần thêm để tránh xung đột lockfile.
- Bao là người cập nhật README; Hoang và Dinh cung cấp nội dung qua tài liệu riêng. Ba người cùng tham gia buổi rehearsal cuối.
- Mỗi ngày cập nhật ngắn: đã xong, đang làm, blocker, cần ai bàn giao gì. Không commit credential/token/license key.

Demo hoàn thành khi thể hiện được: author seal đề giả → teacher bị Tide từ chối → admin đọc được ciphertext và đổi nhãn app nhưng vẫn không giải mã được → self-grant đang chờ sau một phiếu và bị từ chối → request release riêng cho invigilator có hai phê duyệt thật → invigilator đăng nhập lại và mở đúng đề. Timeline ghi rõ là quan sát của ứng dụng; các tuyên bố time-lock tự động, ràng buộc phòng thi và audit bất biến nằm ngoài phạm vi MVP.
