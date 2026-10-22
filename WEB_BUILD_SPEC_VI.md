# Sealed Exam Vault / Đề thi niêm phong — Đặc tả xây dựng ứng dụng web

**Ngày soạn:** 22/10/2026, giờ Việt Nam (`Asia/Ho_Chi_Minh`).  
**Loại bàn giao:** chỉ đặc tả; chưa triển khai ứng dụng, tạo realm, tạo tài khoản, triển khai máy chủ, công bố hay nộp bài.  
**MVP khuyến nghị:** một đề thi văn bản giả lập được mã hóa; bản rõ chỉ được xử lý trong trình duyệt; các danh tính đăng nhập riêng; Tide thực thi quyền giải mã; cấp quyền mở đề bằng phê duyệt thực tế **2-trên-3**; trình diễn quản trị viên ứng dụng thử vượt quyền nhưng thất bại. **Chưa xác minh được cơ chế tự động mở đề dựa trên thời gian đáng tin cậy, nên không đưa tính năng này vào bản dựng mặc định.**

## Quy ước bằng chứng và danh mục nguồn

- **V — Đã xác minh qua tài liệu/mã nguồn:** được hỗ trợ bởi tài liệu chính thức hiện hành hoặc nội dung từ Raziel đã kết nối. Đây là xác minh hợp đồng tích hợp, không có nghĩa ứng dụng này đã chạy thử thành công.
- **P — Đề xuất:** quyết định thiết kế hoặc hợp đồng ứng dụng trong đặc tả.
- **S — Mô phỏng:** trình diễn có nhãn rõ ràng, không tạo ra thẩm quyền bảo mật thật. MVP mặc định không mô phỏng mật mã, danh tính hoặc phiếu phê duyệt.
- **U — Chưa xác minh:** cần xác nhận của nhà cung cấp hoặc kiểm tra tương thích/bảo mật trên hệ thống đang chạy trước khi đưa ra tuyên bố liên quan.

Chưa chạy thử tích hợp Tide trong quá trình soạn tài liệu. Không đổi nhãn V thành “đã kiểm thử” khi chưa có bằng chứng từ các mốc triển khai.

| Mã | Nguồn đã xem ngày 22/10/2026 | Nội dung được xác lập và giới hạn |
|---|---|---|
| C1 | [Trang UNLOCKED chính thức](https://tide.org/unlocked/#challenge), [mục nộp bài](https://tide.org/unlocked/#submit), [cấu hình trang](https://tide.org/unlocked/config.js) | Mục tiêu thử thách, thành phần bài nộp, năm câu hỏi chấm điểm, trọng số, URL nhận diện thương hiệu và hạn theo khu vực. Công cụ đọc web không truy cập được trang; HTML và `config.js` chính thức được đọc trực tiếp qua HTTPS. HTML tĩnh chứa thông báo dự phòng rằng thời gian đã hết; cần dùng hạn theo khu vực trong cấu hình và kiểm tra riêng biểu mẫu còn nhận bài hay không. |
| D1 | [Giới thiệu TideCloak](https://docs.tide.org/) | Điểm bắt đầu chính thức cho sản phẩm và thiết lập. |
| D2 | [Thiết lập E2EE](https://docs.tide.org/Admin/e2ee) | Realm Tide có giấy phép, QEA và thao tác SDK trong trình duyệt. Ví dụ công khai là tự mã hóa theo danh tính, chưa đủ cho chia sẻ từ tác giả sang giám thị. |
| D3 | [Thiết lập QEA](https://docs.tide.org/Admin/SetupIGA) | Thay đổi vai trò có quản trị, phê duyệt nhiều quản trị viên và tự áp dụng khi đủ ngưỡng. |
| D4 | [Tham chiếu Next.js](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-reference), [xác minh JWT](https://docs.tide.org/Languages/NextJS/VerifyJWT) | Provider, hook, bảo vệ tuyến và hàm xác minh JWT. Xác minh JWT không đồng nghĩa đã xác minh bằng chứng DPoP. |
| D5 | [Forseti engine](https://docs.tide.org/Core-Concepts/forseti-engine) | Thực thi chính sách trong mạng và ví dụ về khung giờ. Chưa xác lập đồng hồ đáng tin cậy cho mốc mở đề tuyệt đối hoặc nguồn gốc thời gian đó. |
| D6 | [Mô hình đe dọa](https://docs.tide.org/threat-model), [Secure Web Enclave](https://docs.tide.org/secure-web-enclave) | Mô tả kiến trúc và bảo mật của nhà cung cấp. Không chứng minh ứng dụng xuất được biên nhận kiểm toán có chữ ký hoặc chống được JavaScript độc hại do máy chủ ứng dụng cung cấp. |
| R1 | Raziel đã kết nối: `tide_choose_scenario`, `tide_scenario("relationship-attestation")`, `tide_scenario("iga-admin-governance")` | Agent Pack v1.9.33; hợp đồng tích hợp sẵn `RelationshipAttestation:1`; mã hóa và quản trị là hai luồng riêng. Tham chiếu ORK `main` c69fc4f6 ngày 16/10/2026. Các kiểm tra từ chối danh tính do Tide báo cáo, chưa được tái hiện cho ứng dụng này. |
| R2 | Raziel `tide_canon("iga-change-requests-api")` | API hiện hành theo từng yêu cầu, ngưỡng M0 đã ký đang có hiệu lực, `/approve` hai giai đoạn, phân biệt người gọi HTTP và giới hạn lúc khởi tạo. Kiểm tra nguồn f093800 ngày 07/10/2026. |
| R3 | Raziel `configure-e2ee-roles-and-policies`, `setup-forseti-e2ee`, phần mã hóa của `concepts` | Mã hóa chia sẻ cần `IAMService` và byte chính sách đã ký; hàm tiện ích mã hóa trên hook là tự mã hóa gắn với danh tính. Ưu tiên các vai trò cố định mới trong R1 thay cho ví dụ tổng quát cũ. |
| R4 | Raziel `verify-jwt-server-side`, `tide_dpop_asset` | Xác minh bằng JWK nhúng cục bộ và xác minh riêng bằng chứng RFC 9449; yêu cầu về tệp relay, rewrite và header. |
| R5 | Các phần built-in, runtime, ví dụ thời gian, Decision Builder, sandbox của `custom-contracts`; `verifiable-claims`; các mục 003, 040, 041, 071, 078 của `tide_gaps` | Giới hạn ví dụ thời gian/địa lý; hợp đồng tùy chỉnh do đội Tide triển khai; ngưỡng quản trị khác ngưỡng mạng; xác minh chữ ký cần khóa công khai có nguồn tin cậy. |
| P0 | Đề xuất cục bộ `/Users/vbhh/Downloads/y-tuong-de-thi-niem-phong.md` | Nguồn ý tưởng. Chưa coi các tuyên bố mở đúng giờ, chỉ tại phòng thi, nhật ký bất biến và chống mọi hậu quả khi máy chủ bị chiếm là khả năng đã xác lập. |

**Cách xử lý mâu thuẫn:** ưu tiên hợp đồng cụ thể, cập nhật trong R1/R2 hơn playbook tổng quát cũ. R2 đã sửa các nhận định cũ rằng tạo yêu cầu tự tính một phiếu và `/authorize` đơn giản dùng được cho MultiAdmin. Ghi lại khác biệt phiên bản; không âm thầm thay bằng Keycloak thông thường, Tideless, tự mã hóa hoặc dữ liệu giả.

## 1. Tóm tắt sản phẩm, người dùng và khả năng mới

Một cơ sở giáo dục có thể lưu đề thi đã mã hóa trên hạ tầng do quản trị viên ứng dụng vận hành mà không trao cho người đó quyền đơn phương giải mã hay tự cấp quyền mở đề. Prototype làm điều này dễ quan sát: cho quản trị viên đọc dữ liệu lưu trữ, sửa bản ghi vai trò hiển thị và yêu cầu cấp quyền thật; không thao tác nào tự tạo ra bản rõ.

Người dùng gồm người soạn đề, giám thị được chỉ định, giáo viên cần xem thông tin lịch thi, người vận hành ứng dụng và nhóm quản trị độc lập. Khả năng mới là giảm mức độ phải tin người vận hành cơ sở dữ liệu về tính bí mật của đề. Vẫn phải tin tác giả, người đã được cấp quyền, nhóm đủ ngưỡng phê duyệt, mã giao diện được cung cấp và mạng Tide đang sử dụng.

Nội dung giao diện mặc định bằng tiếng Anh: **“Encrypted exam papers. Access released by independent approval.”** Phụ đề: **“Đề thi niêm phong.”** Không quảng cáo “chỉ mở được đúng giờ thi” hoặc “chỉ mở được tại phòng thi”.

## 2. Sự phù hợp với thử thách và bằng chứng dành cho giám khảo

Điểm khác biệt là thẩm quyền nằm ngoài cơ sở dữ liệu ứng dụng. Một nhánh kiểm tra backend `if (role)` không đủ. Cần cho thấy yêu cầu giải mã thật tới mạng, dùng phiên thật của người tấn công và ciphertext thật lấy từ lưu trữ, kể cả sau khi bỏ qua kiểm tra phía ứng dụng.

| Tiêu chí C1 | Trọng số | Bằng chứng trình diễn |
|---|---:|---|
| Vision & originality — Tầm nhìn và tính mới | 25% | Người vận hành vẫn quản lý dịch vụ nhưng đề thi tiếp tục ở dạng mã hóa. |
| Trust constraint insight — Hiểu rào cản lòng tin | 20% | Quản trị viên đọc DB và sửa vai trò cục bộ nhưng vẫn không mở được đề. |
| Value & impact — Giá trị và tác động | 20% | Ví dụ giả lập rõ ràng về phòng khảo thí; giảm số người cần quyền đọc mọi đề. Không tự đặt số liệu sự cố. |
| Why TideCloak matters — Vai trò thiết yếu của TideCloak | 20% | SDK thật từ chối giải mã; yêu cầu cấp quyền thật dừng ở 1/2 phiếu; chỉ áp dụng sau phiếu của danh tính thứ hai. |
| Prototype & storytelling — Prototype và cách kể chuyện | 15% | Một chuỗi tấn công rồi cấp quyền dễ hiểu, có giới hạn được công bố và giám thị mở thành công. |

Ngăn bằng chứng hiển thị: phiên bản môi trường, số byte và mã băm ciphertext, kết quả thử đã lọc dữ liệu nhạy cảm, ID yêu cầu thay đổi thật, ngưỡng/số phiếu từ nguồn có thẩm quyền, trạng thái đã áp dụng và danh tính hiện hành. Không quay token, mật khẩu, khóa trình duyệt hoặc liên kết đăng ký đầy đủ.

## 3. Phạm vi MVP, phần loại trừ và giả định

**P — Phạm vi:** mỗi lượt demo có một đề UTF-8 dạng văn bản thuần, tối đa 16 KiB; một tác giả, một giám thị, một giáo viên, một quản trị viên ứng dụng và ba danh tính phê duyệt riêng. Mọi nội dung, tên và metadata đều giả lập. Hỗ trợ ô soạn văn bản và nhập `.txt`; chỉ hiển thị văn bản đã escape. Không cần bộ phân tích PDF.

Gồm bảy màn hình ở mục 5, một bản ghi niêm phong, cấp quyền mở đề qua quản trị và dòng thời gian. Loại trừ chấm điểm, hồ sơ sinh viên, dữ liệu cá nhân, email, thanh toán, đa cơ sở giáo dục, quản lý hàng loạt đề, dịch vụ khôi phục, xác minh vị trí, DRM và trang giới thiệu trang trí.

Khi soạn bản gốc, workspace là Git checkout trống, không có ứng dụng hoặc `AGENTS.md` trong các vị trí workspace/thư mục cha đã kiểm tra. Khi triển khai, bắt đầu từ template Tide phù hợp. Công việc đặc tả không tạo khung ứng dụng.

**Quyết định về mở đề:** nhóm quản trị cấp thủ công `_tide_decryptor` cho giám thị sau hai phiếu. Thời gian dự kiến chỉ để tham khảo. Hai người phê duyệt có thể quyết định cấp sớm; không được khiến người xem hiểu rằng có đồng hồ độc lập ngăn việc đó. Bộ lập lịch hoặc phép so sánh ngày ở backend không thay thế cho cơ chế còn thiếu.

**Giả định đe dọa trong demo:** kẻ tấn công kiểm soát DB ứng dụng và cấu hình ứng dụng thông thường, nhưng không kiểm soát phiên của người được phép đọc, cấu hình xác minh được ghim độc lập, hai danh tính quản trị hoặc đủ thành viên mạng Tide. Trường hợp kiểm soát toàn bộ máy chủ và phân phối frontend độc hại được phân tích riêng tại mục 10.

## 4. Hành trình, danh tính và ma trận vai trò/hành động

Từng danh tính demo phải đăng nhập thật. Bộ chọn chỉ chọn đích đăng nhập hoặc hồ sơ trình duyệt; không sửa claim danh tính. Ghi nhận issuer + subject và khóa người dùng Tide khi SDK yêu cầu. Tên gọi thân thiện không chứng minh danh tính.

| Danh tính | Metadata | Mã hóa/niêm phong | Giải mã | Đề nghị cấp quyền | Phê duyệt thay đổi | Hạ tầng |
|---|---|---|---|---|---|---|
| Tác giả | Có | Một lần cho lượt của mình | Không có quyền đọc qua SDK; vốn đã biết nội dung gốc | Không có UI mặc định | Không | Không |
| Giám thị | Có | Không | Khi đã cấp quyền qua quản trị và có chính sách hợp lệ | Có thể đề nghị mở quyền | Không | Không |
| Giáo viên | Có | Không | Bị từ chối | Không có UI mặc định | Không | Không |
| Quản trị viên ứng dụng | Có | Không | Bị từ chối | Có, chỉ đề nghị | Không | Vận hành app/lưu trữ |
| G1, G2, G3 | Có | Không | Mặc định bị từ chối | Có | Mỗi người tính một phiếu; cần 2-trên-3 theo M0 đã ký | Quản trị realm |
| Người vận hành master/khởi tạo TideCloak | Chỉ thiết lập | Không có quyền app | Mặc định không có quyền app | Bảo trì/thiết lập có thể ảnh hưởng ranh giới tin cậy | Không được trở thành đường vòng lúc chạy | Vận hành IAM; khác quản trị viên app |
| Thành viên mạng Tide/ORK | Metadata giao thức theo thiết kế | Tham gia giao thức | Tham gia thao tác được phép | Không có vai trò UI app | Không phải các lá phiếu quản trị của con người | Vận hành Fabric; ngưỡng riêng |

**P — Phân vai trong realm:** tác giả giữ `author` + `_tide_encryptor`; giám thị giữ `invigilator` nhưng chưa có `_tide_decryptor` trước khi mở quyền; giáo viên giữ `teacher`; quản trị viên app giữ `app-admin`. Nhóm G1–G3 giữ `tide-realm-admin` và các quyền quản trị tối thiểu mà console đã xác minh cần dùng; không ai giữ vai trò thao tác mã hóa hoặc giải mã. Không thêm `_tide_encryptor`/`_tide_decryptor` vào vai trò mặc định hay vai trò tổng hợp dành cho tất cả. Credential ứng dụng lúc chạy không được phê duyệt, ký chính sách hoặc mạo danh người dùng.

**Hành trình chính:**

1. Tác giả đăng nhập, xem đề giả lập cục bộ, mã hóa bằng chính sách chỉ ghi đã chuẩn bị cho đề và lưu ciphertext.
2. Giáo viên đăng nhập, xem metadata, thử mở và nhận từ chối từ SDK/mạng.
3. Quản trị viên app đọc ciphertext, ghi `invigilator` vào vai trò hiển thị trong DB app rồi thử lại: vẫn bị từ chối. Đề nghị quyền thật tạo yêu cầu có quản trị, chưa cấp quyền.
4. G1/G2 xem yêu cầu thật của quản trị viên. G1 ký một lần; vẫn không mở được. G2 từ chối yêu cầu đó. Sau đó G1/G2 phê duyệt một yêu cầu riêng, hợp lệ, mở quyền cho giám thị.
5. Sau khi quyền được áp dụng, giám thị đăng nhập lại, tải chính sách chỉ đọc và ciphertext, rồi giải mã trong trình duyệt. Không gửi bản rõ qua API ứng dụng.

Một người giữ cả bảy hồ sơ trình duyệt chỉ chứng minh tách danh tính, không chứng minh bảy con người độc lập. Nếu có thể, dùng người/thiết bị riêng cho quản trị và mô tả cách quay thực tế.

## 5. Đặc tả màn hình, bố cục, nội dung và trạng thái

### Hệ thống bố cục và hình ảnh chung

Desktop: thanh điều hướng trái 224 px, thanh danh tính trên 64 px, vùng nội dung rộng tối đa 1200 px, khoảng cách 24 px. Điều hướng: Vault, Activity, Administration, Governance; chỉ hiển thị mục thích hợp nhưng vẫn thực thi quyền ở API và Tide. Ở chiều rộng 375 px: menu gọn, thẻ một cột, nút xếp dọc. Không để thông tin thiết yếu bị che vì tràn ngang.

Font sans-serif hệ thống; thân bài 16 px, nhãn 14 px, tiêu đề trang 28 px. Bề mặt trắng/xám và một màu nhấn indigo; màu trạng thái chỉ bổ trợ từ ngữ/biểu tượng. Tương phản AA, tối thiểu 4,5:1 cho chữ thường; focus rõ, nút/heading đúng ngữ nghĩa, nhãn trường đầy đủ, vùng chạm 44 px, thứ tự bàn phím hợp lý, kết quả qua `aria-live`, hỗ trợ `prefers-reduced-motion`. Modal giữ và khôi phục focus. Không thêm hoạt ảnh trang trí. Timestamp hiển thị UTC cùng giờ Việt Nam và múi giờ.

Banner thường trực bằng tiếng Anh: **“Live Tide integration · Manual governance release · Synthetic content.”** Nếu chưa xác minh cấu hình: **“Protected operations unavailable — configuration not verified.”** Mọi mô phỏng tùy chọn phải hiện **“SIMULATION — no protected authority changed”** xuyên suốt và không được dùng làm bằng chứng bảo mật.

### 5.1 Đăng nhập và chọn danh tính — `/sign-in`

Tên sản phẩm/phụ đề, mô tả ngắn, thẻ danh tính kèm vai trò, nút “Sign in with Tide” và subject đã xác minh sau đăng nhập. Nội dung: “Choosing this card does not grant its role. Authenticate the matching account.” Dùng hồ sơ/cửa sổ trình duyệt riêng khi quay. Đổi danh tính phải đăng xuất, xóa trạng thái/bản rõ đề và xác nhận phiên mới. Không dùng query parameter làm danh tính, tài khoản dịch vụ chung hoặc mặc định SSO chọn đúng người.

Trạng thái: khởi tạo, chuyển hướng, hủy đăng nhập, chặn popup/lưu trữ, hết phiên, sai hồ sơ. Nếu sai: “This session belongs to [alias]. Sign out to use another identity.” Không âm thầm tắt DPoP để đăng nhập được.

### 5.2 Kho đề — `/vault`

Tiêu đề trang; một thẻ/hàng gồm tên đề giả lập, tác giả, loại nội dung, thời điểm niêm phong, giờ dự kiến, trạng thái mở quyền và “View exam”. Chú thích: “Schedule is advisory. This prototype releases access by two independent approvals.” Tác giả có “Upload synthetic exam”. Có trạng thái trống, skeleton tải metadata, lỗi tải có thể thử lại và banner dịch vụ không sẵn sàng.

Tách các nhãn: **Sealed**, **Awaiting release approval**, **Access released**, **Opened in this session**. Countdown về 0 chỉ đổi lời nhắc thành “Scheduled time reached — approval still required”, không đổi quyền.

### 5.3 Tải đề và niêm phong — `/vault/new`

Tên đề, lịch dự kiến kèm xác nhận múi giờ, chọn tệp `.txt` hoặc soạn trực tiếp, xem trước có nhãn, bộ đếm byte, checkbox “Synthetic exam only”, fingerprint chính sách đã duyệt và “Encrypt and seal”. Đọc/giải mã UTF-8/xem trước tệp diễn ra cục bộ. Chuẩn bị chính sách ghi đã ký cho ID lượt mới trước khi cho phép niêm phong. Nội dung: “Encryption runs in this browser. The server receives encrypted bytes.”

Tiến trình: đọc → kiểm tra → mã hóa với Tide → lưu ciphertext → niêm phong. Lỗi loại/kích thước tệp hiển thị ngay trường nhập. Thiếu chính sách: “A governance administrator must prepare this exam's encryption policy.” Lỗi mạng/chữ ký không tạo đề đã niêm phong. Nếu lỗi lưu, thử lại cùng kết quả mã hóa bằng idempotency key; chặn gửi trùng. Thành công thì xóa trạng thái văn bản/tệp; không hứa JavaScript xóa sạch mọi dấu vết bộ nhớ.

### 5.4 Chi tiết và thử mở đề — `/vault/:id`

Bên trái: metadata, ID và digest được ghi nhận cho lượt. Bên phải: trạng thái, “Attempt to open”, danh tính hiện tại, tình trạng chính sách, kết quả và dòng thời gian ngắn. Bản rõ hiển thị như văn bản đã escape, font monospace, có “Hide paper”, không tự tải về. Chỉ giải mã khi người dùng chủ động yêu cầu.

Thành công: **“Opened in this browser for Invigilator. Authorized readers can copy this content.”** Từ chối: **“Access denied by Tide. This identity has no protected read authority.”** Trước khi cấp quyền: **“Access has not been released by governance.”** Không ghi “too early” nếu chưa xác minh điều kiện thời gian đáng tin cậy. Phân biệt kiểm tra trước của app với từ chối thật từ mạng.

Lỗi: hết phiên → đăng nhập; chính sách/chữ ký hoặc ciphertext sai → chặn; mất mạng → “Could not verify protected operation; paper remains closed”; lỗi SDK không phân loại được → “Opening could not be verified.” Lỗi mạng/ngưỡng tổng quát chưa đủ để kết luận bị từ chối quyền. Hiện mã chẩn đoán đã lọc và correlation ID; chỉ chuyển thông báo hợp đồng lồng bên trong thành lý do từ chối khi nhận diện chắc chắn.

### 5.5 Bảng thử vượt quyền — `/administration/attacks`

Ba thẻ đánh số, mỗi thẻ kèm bằng chứng kết quả thật:

1. **Inspect stored ciphertext:** đọc lại blob đã lưu; hiển thị số byte, encoding, SHA-256, trích đoạn đã escape và nút tải ciphertext. Digest mang nhãn “Integrity reference; not a signature.” Hướng dẫn đối chiếu bằng truy vấn DB chỉ đọc. Không thay bằng chuỗi ngẫu nhiên tạo riêng cho demo.
2. **Request invigilator access:** đích cố định là subject app-admin hiện tại; vai trò được allowlist. Hiện ID CR thật, vai trò bị ảnh hưởng, ngưỡng và trạng thái chờ. Nếu cần hai yêu cầu cấp vai trò thì hiển thị cả hai, không tạo số phiếu gộp giả. Không có nút “approve as admin”.
3. **Change application display role:** chỉ cập nhật `DemoRoleOverride.displayRole`, hiện trước/sau, rồi gọi SDK giải mã thật với phiên không thay đổi và ciphertext đã lưu. Nội dung: “This row changes the app's label. Tide's signed credential and permissions have not changed.” Ghi rõ đây là sửa thật một bản ghi không có thẩm quyền, không phải sửa vai trò Tide.

Kiểm tra token giả tùy chọn nằm trong kiểm thử tích hợp, không cần giao diện biên tập token. Không gộp từ chối quyền và mất dịch vụ vào trạng thái thành công giả “attack blocked”.

### 5.6 Quản trị phê duyệt — `/governance`

Danh sách yêu cầu thật gồm đích, tác động bảo mật, người đề nghị, thời gian tạo, loại thao tác, ngưỡng từ hệ thống, các người ký riêng biệt và trạng thái. Khung chi tiết thể hiện chính xác vai trò thêm/bớt và phụ thuộc. “Approve in Tide” mở luồng enclave được hỗ trợ trong trình duyệt đăng nhập của chính người duyệt. Chỉ có “Reject request” sau khi vừa đọc lại yêu cầu ở trạng thái `PENDING`. Cảnh báo với yêu cầu kẻ tấn công: “This would give this identity protected exam access.”

Hiện **“1 of 2 required approvals · 3 eligible governance identities”**, không phải 1/3. Không đếm số lần nhấn nút. Chưa có CR thật thì không gắn nhãn đang chờ quorum. Thiếu ngưỡng/số phiếu → “Approval state unavailable”; không mặc định 0 hoặc 2. Chỉ báo “Access granted” khi nguồn có thẩm quyền cho biết đã áp dụng. Khi xung đột, đọc lại và chặn chỉnh sửa dữ liệu cũ. Phương án thu gọn: màn hình xem riêng của app liên kết tới console Tide thật để phê duyệt thay vì tự viết một luồng chưa xác minh.

### 5.7 Dòng thời gian — `/activity`

Thời điểm, danh tính, thao tác, kết quả, nguồn, correlation/CR ID và loại bằng chứng. Lọc theo đề/thao tác; phân trang, có giới hạn. Ghi nhận niêm phong, kết quả SDK do client báo, API từ chối, sửa vai trò cục bộ, đề nghị cấp quyền, từng phiếu quan sát được, mở quyền đã áp dụng và mở đề do client báo.

Mục log thường ghi **“Application log — editable by infrastructure operator.”** Callback client ghi **“Client reported.”** Trạng thái quản trị sao chép từ Tide ghi **“Observed from TideCloak”**, không phải “cryptographically verified”. Chỉ hiện **“Signature verified”** khi đã xác minh độc lập hiện vật tương ứng, kèm byte nào và khóa ghim nào được kiểm tra. Có trạng thái trống, đang tải, đồng bộ một phần, mất kết nối và bằng chứng không hợp lệ.

## 6. Vòng đời và máy trạng thái

Tách trạng thái nội dung, mở quyền và mở bản rõ trong phiên.

| Thành phần | P — Trạng thái và chuyển đổi | Nguồn thẩm quyền |
|---|---|---|
| Nội dung | `PREPARING` → `DRAFT` → `ENCRYPTING` → `SEALED`; lỗi mã hóa về draft; lỗi lưu thử lại cùng ciphertext; không có tuyến sửa bình thường sau niêm phong | Luồng app; chủ DB vẫn có thể phá/sửa dữ liệu |
| Mở quyền | `UNRELEASED` → `REQUEST_PENDING` → `RELEASED`; từ chối về unreleased; thiếu/mâu thuẫn bằng chứng → `UNKNOWN_BLOCKED` | Quyền realm đã áp dụng, chính sách hợp lệ và phiên mới; cache chỉ phục vụ hiển thị |
| Mở bản rõ | `CLOSED` → `OPENING` → `OPENED` / `DENIED` / `UNAVAILABLE`; ẩn/đăng xuất về closed | Kết quả SDK thật trong trình duyệt hiện tại |
| Lịch | `BEFORE_ADVISORY_TIME` / `ADVISORY_TIME_REACHED` | Đồng hồ hiển thị, không đổi quyền |
| CR của IGA | `PENDING` → `APPROVED` / `DENIED` / `CANCELLED` | TideCloak R2; `APPROVED` nghĩa là đã áp dụng |

“Ready to commit” là thuộc tính của yêu cầu chờ, không phải trạng thái đã áp dụng tự đặt. `/approve` thống nhất trong R2 thường tự áp dụng khi đủ ngưỡng. App có thể có bản nháp đề nghị trước khi gửi Tide, nhưng không hiển thị đó như CR IGA thật. Sửa hàng dữ liệu của CR đang chờ làm mất các phiếu trước; MVP không cung cấp tính năng này. Đổi nhãn CR đã phê duyệt sang từ chối không thu hồi quyền; thu hồi cần yêu cầu gỡ vai trò mới và có thể chưa vô hiệu hóa ngay credential đã phát hành.

## 7. Stack và kiến trúc khuyến nghị

**P — Stack:** Next.js App Router, TypeScript strict mode, Tailwind và thành phần UI tối thiểu có khả năng truy cập. Dùng phiên bản tương thích của `@tidecloak/nextjs`, `@tidecloak/js`, `heimdall-tide` và các phụ thuộc chính sách từ tài liệu tham chiếu Raziel có phiên bản. Ghim phiên bản đã kiểm thử trong lockfile; ghi image digest của realm và tương thích ORK. Dùng template auth/DPoP có sẵn của Tide cùng `templates/relationship-attestation/relationship.ts`. Không dựng lại tuần tự hóa bảo mật từ mô tả trong tài liệu này.

**P — Lưu trữ:** SQLite cục bộ qua driver nhẹ phù hợp, một tiến trình Node, một blob đề giả lập. Nguồn Tide yêu cầu lưu ciphertext/byte chính sách đã ký nhưng không bắt buộc nhà cung cấp DB. SQLite là lựa chọn giảm thiết lập, không phải backend đã được Tide chứng nhận. DB của TideCloak tách riêng. Nếu về sau chạy nhiều instance: PostgreSQL và kho chống replay DPoP dùng chung có thao tác nguyên tử; ngoài MVP.

```text
Trình duyệt tác giả --bản rõ cục bộ--> Tide SDK / SWE <--> mạng ORK Tide
        |                                  kiểm tra quyền + giao thức mật mã
        +--ciphertext + metadata công khai--> API Next.js --> SQLite

Trình duyệt giám thị <--ciphertext + chính sách đã ký-- API Next.js
        +--yêu cầu SDK/SWE với danh tính hiện hành--> ORK
        <--kết quả giải mã khi đủ quyền---------------+
        +--chỉ hiển thị bản rõ cục bộ

Trình duyệt G1/G2/G3 --phiên riêng + enclave phê duyệt--> TideCloak IGA
Next.js --credential chỉ đề nghị/đọc nếu cần------------> TideCloak IGA
```

Đây là luồng logic. SDK có thể mã hóa lai cục bộ và dùng mạng cho thao tác khóa được bảo vệ. Không khẳng định mọi byte nội dung đi qua ORK, không tự thiết kế định dạng AES/bọc khóa. Giữ ciphertext SDK như dữ liệu opaque.

**Bản rõ tồn tại tại:** tệp tác giả chọn, xem trước trong trình duyệt, xử lý SDK tạm thời, buffer/DOM nhận kết quả của giám thị. Không gửi văn bản nguồn/đã giải mã vào API, SSR, telemetry, bộ báo lỗi, local/session storage, cache, log, thumbnail hoặc backup. Xóa trạng thái khi ẩn/chuyển trang/đăng xuất; response được bảo vệ dùng `Cache-Control: no-store`; không cache bản rõ bằng service worker. Trình duyệt/OS và người nhận có thể giữ bản sao. SDK có thể quản lý khóa DPoP trong lưu trữ trình duyệt; không hứa mọi khóa chỉ tồn tại trong RAM, không sao chép chúng vào storage của app.

**Cấu hình:** được chứa client/realm ID công khai, JWK công khai đã ghim từ adapter và metadata endpoint. Không chứa khóa giải mã đề tái sử dụng, tài khoản dịch vụ có quyền giải mã, phiên quản trị, refresh token của người nhận hoặc mật khẩu master khởi tạo. Credential khởi tạo nằm ngoài runtime và Git. Khóa xác minh là gốc tin cậy cần ghim riêng; máy chủ độc hại thay được cả code lẫn khóa có thể giả giao diện/bộ xác minh.

## 8. Kế hoạch tích hợp TideCloak đã xác minh, phụ thuộc và khoảng trống

### 8.1 Xác thực và DPoP

**V — D2–D4, R4:** danh tính Tide trong realm bật QEA phát hành credential cần cho E2EE. Hàm thật là `verifyTideCloakToken(config, token, allowedRoles?)`, trả claim hoặc null. Hàm xác minh JWT, **không xác minh bằng chứng DPoP**. Bắt buộc adapter xuất ra có `jwk.keys`; nếu thiếu, helper có thể lấy khóa từ xa, làm yếu mô hình ghim khóa dự kiến. Giới hạn thuật toán token theo realm đã xác minh, với Tide QEA là EdDSA; kiểm tra issuer, `azp`, claim thời gian/hết hạn bắt buộc và đúng namespace vai trò realm/client. Không giả định `aud` bằng client ID; kiểm tra claim thật và quy định cách xử lý audience phù hợp.

**P — Mỗi API được bảo vệ:** xác minh token và claim bắt buộc, rồi kiểm tra chữ ký proof bằng JWK của proof, `typ`, thuật toán cho phép, thumbprint `cnf.jkt`, `ath`, phương thức `htm`, URL ngoài đã chuẩn hóa `htu`, độ mới `iat` và `jti` chỉ dùng một lần với thao tác nguyên tử. Token ràng buộc gửi dưới dạng Bearer vẫn phải có proof; từ chối token không ràng buộc. Dùng `templates/dpop-verify/verifyDpop.ts` đã kiểm thử của pack, không chỉ dựa trên đoạn minh họa. Lưu định danh replay cùng hạn dùng và unique constraint trong SQLite; một Map riêng trên từng instance không đủ. Nếu server yêu cầu nonce, dùng đúng trao đổi đã xác minh.

**V/P — Provider:** đặt `useDPoP: { mode: 'strict', alg: 'ES256' }` trong config, không đặt như JSX prop. Sao chép `public/tide_dpop_auth.html` từ SDK tương thích; pack ghi nhận tệp có trong `@tidecloak/js >= 0.14.34`; hoặc lấy đúng asset của pack. Bản đã xem: 9120 byte, SHA-256 `9d7844b938f0a2565fa910d3d30e9b8797cbfd6e0b73d59d804169a089aea757`. Kiểm tra lại khi đổi phiên bản. Giữ rewrite `/tide_dpop/:path*`, CSP riêng và `Allow-CSP-From: *` sau quy tắc header tổng; kiểm tra header thực sự được phục vụ. Không áp ngoại lệ relay cho toàn website. Kiểm tra popup/iframe/lưu trữ trình duyệt, dùng `secureFetch` cho yêu cầu được bảo vệ. Chỉ tin header origin chuyển tiếp khi ở sau proxy đã cấu hình tin cậy.

Middleware hỗ trợ điều hướng nhưng không thay kiểm tra trong handler hoặc mạng. Khi triển khai, chạy `tide_doctor`, xử lý lỗi và đăng nhập thật trước khi tuyên bố hoạt động.

### 8.2 Mã hóa chia sẻ và chính sách đề

**V — R1/R3:** ví dụ `useTideCloak().doEncrypt/doDecrypt` không có policy là tự mã hóa. Danh tính khác không mở được chỉ vì nhận vai trò cùng tên. Chia sẻ dùng `IAMService.doEncrypt(items, signedPolicyBytes)` và `IAMService.doDecrypt(items, signedPolicyBytes)`, policy là `Uint8Array` đã ký. Gọi `IAMService` đã khởi tạo theo đúng reference, không giả định hook chuyển tiếp cùng overload.

Dùng hợp đồng tích hợp sẵn `RelationshipAttestation:1`; R1 báo cáo có trên ORK cập nhật từ 16/10/2026. Khả năng có sẵn trên mạng sẽ chọn vẫn là **U**. Nếu thiếu, không tự tải bản hợp đồng sao chép tùy chỉnh.

**P — Hai chính sách đã ký cho mỗi UUID đề mới:**

| Trường | Chính sách tác giả | Chính sách giám thị |
|---|---|---|
| `contractId` | `RelationshipAttestation:1` | Như tác giả |
| `modelId` trong constructor | `["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"]` | Như tác giả |
| approval / execution | `IMPLICIT` / `PRIVATE` | Như tác giả |
| key | `vendorId` của realm | Như tác giả |
| `subjectType` | `Role` | `Role` |
| `subjectId` | `author` | `invigilator` |
| `assignmentId` | UUID đề mới | Cùng UUID |
| tham số `roles` | Chuỗi JSON `["_tide_encryptor"]` | Chuỗi JSON `["_tide_decryptor"]` |
| `clientId` | Bỏ qua vì vai trò realm | Bỏ qua |

Mọi tham số là chuỗi. Mỗi item có đúng một tag `[examId]` cho cả mã hóa và giải mã. Lấy phiên bản từ `Models.Policy.latestVersion`; constructor dùng `modelId` số ít dù instance có thể có `modelIds`. Sao chép mã tuần tự hóa/ký hiện hành. Ký qua ceremony enclave trong trình duyệt của `tide-realm-admin` đã đăng nhập, không phải gửi JSON cho backend tự ký. Chỉ lưu policy đã ký, phân tích đúng subject/record dự kiến và xác minh thành công/đã thử vòng tích hợp. Chưa chuẩn bị policy thành công thì chặn upload.

**Ranh giới quan trọng:** R1 nói chính sách relationship được phê duyệt khi ký trong enclave, **không phải** CR IGA thông thường. Không coi popup ký policy như phê duyệt IGA 2-trên-3. Chưa rõ quyền ký policy trên mạng được chọn có đòi đúng hai con người như vậy không: **U**. Vì thế MVP không cấp `_tide_decryptor` cho bất kỳ người quản trị nào; quyền đọc đòi cả chính sách hợp lệ lẫn vai trò cổng được cấp qua quản trị. Một người ký policy khác không được nhờ đó tự đọc được; phải thử trực tiếp. Tuyên bố mạnh hơn “mọi thay thế policy đều cần 2-trên-3” bị chặn đến khi xác minh độc lập.

### 8.3 Quản trị và bảo vệ chính luật quản trị

**V — D3/R2:** dùng Tide mode (`iga.attestor=tide`), bật QEA, tài khoản MultiAdmin đã liên kết và policy M0 `tide-realm-admin` đã ký. Phê duyệt bằng username của Tideless không thay thế được. Bootstrap/FirstAdmin có cơ chế yếu hơn, một người; phải hoàn thành trước khi trình diễn hệ thống đã được bảo vệ.

**P — Ngưỡng cụ thể:** ba quản trị viên đủ điều kiện, ngưỡng trong M0 đã ký hiện hành bằng **2**, tức **2-trên-3**. R2 ghi `max(1, floor(0.7 × active admins))` là giá trị dự phòng/dự kiến; ngưỡng trong policy đang ký mới là cổng hiệu lực, thay qua `REGEN_ADMIN_POLICY`. Không đặt hằng JavaScript hoặc thuộc tính realm rồi mặc định M0 đã đổi. Cần diagnostics và kiểm tra từ chối áp dụng khi thiếu phiếu. Với hai admin, công thức làm tròn xuống có thể vẫn là 1; dùng ba là chủ ý.

| Thay đổi nhạy cảm | Cơ chế/bằng chứng cần có |
|---|---|
| Cấp/gỡ `invigilator` hoặc `_tide_decryptor` | CR IGA thật dưới ngưỡng hiện hành; chưa commit thì chưa có credential hiệu lực; refresh/đăng nhập lại sau đó. |
| Thành viên nhóm, role tổng hợp/mặc định, token mapper có thể chuyển quyền | Coi như cấp đặc quyền. Xác minh từng đường được quản trị ở bản đã chọn và không thừa kế quyền đọc ngoài ý muốn. IGA bật không có nghĩa mọi endpoint ghi đều được bao phủ. |
| Mở quyền đề | Cấp `_tide_decryptor` cho giám thị qua hai phiếu; đây là mở quyền, không phải mở khóa theo đồng hồ. |
| Sửa thời gian hiển thị | Metadata của app; không mở quyền; ghi log như metadata có thể sửa. |
| Thay policy đọc đã ký | Có ký trong enclave admin; chưa xác minh cùng ngưỡng 2-trên-3. Tách người quản trị khỏi các cổng giải mã, cố định bộ policy đã chuẩn bị cho demo. “Đóng băng” của app không ràng buộc realm admin độc hại. |
| Đổi thành viên quản trị, ngưỡng/M0, tắt IGA, offboard/xóa realm | Kiểm tra đường control plane có quản trị, phụ thuộc và tái tạo M0. R2 có sàn quorum khi gỡ admin, tối thiểu offboard mặc định 3. Không cấp quyền runtime tới những thao tác này. Đường thay thế chưa được bao phủ chặn tuyên bố quản trị mạnh hơn. |

Quản trị viên app không thuộc G1–G3. Kiểm tra mạnh hơn tùy chọn: một Tide admin thật thử tự cấp và commit trực tiếp nhưng không đạt ngưỡng. R2 **không** xác lập quy tắc chung “người đề nghị không được tự duyệt”; người đề nghị đủ điều kiện có thể tính một phiếu. Gọi `/approve` trùng có thể trả recorded thay vì lỗi nhưng không được thêm phiếu.

### 8.4 Thời gian, vị trí và toàn vẹn kiểm toán

**U — Tự động mở đề:** D5/R5 có ví dụ kiểm tra ngày/giờ và nhắc tag khóa thời gian, nhưng chưa có tích hợp trọn luồng xác lập một mốc not-before tuyệt đối, đầu vào thời gian đáng tin cậy, sai lệch/đảo đồng hồ và điểm thực thi lúc giải mã cho policy relationship này. R5 chặn gọi đồng hồ không xác định trực tiếp trong sandbox tùy chỉnh. Hết hạn policy không chứng minh khóa trước một mốc. Danh sách kiểm tra của `RelationshipAttestation:1` có subject/role/tag/expiry; chưa xác lập tham số lịch mở. Không thêm tag `DecryptTimeLock` vào hợp đồng này: quy tắc khớp tag chính xác sẽ từ chối và tên tag không chứng minh nguồn thời gian đáng tin.

**Mặc định:** cấp quyền thủ công qua quản trị, lịch tham khảo, không nút tua giờ. Nếu cần mô phỏng UI, đặt ở màn giải thích tách biệt có nhãn S, không thay đổi grant thật. Nếu Tide xác nhận tự động mở: ghi đúng contract/model đang triển khai, mốc UTC đã ký, nguồn/đơn vị kiểm soát đồng hồ, thực thi ở node, sai lệch và ngữ nghĩa ranh giới, quản trị thay policy, kiểm tra gọi sớm trực tiếp. Sau đó quay cửa sổ thật khoảng 60–90 giây, không chỉnh đồng hồ app/trình duyệt. Chưa đủ kiểm tra thì chưa được tuyên bố tự mở theo thời gian.

**U — Vị trí:** chưa có kiểm soát hiện diện tại phòng thi/thiết bị được xác minh độc lập. Tham số “country” hoặc geolocation trình duyệt không chứng minh hiện diện phòng thi. MVP không có tuyên bố vị trí.

**U — Nhật ký:** D6 mô tả kiến trúc audit có chữ ký, nhưng chưa xác lập API xuất/bộ xác minh được hỗ trợ cho từng lần giải mã/từ chối của app. Dòng thời gian mặc định là log app có thể sửa. Byte policy đã ký có thể chứng minh toàn vẹn chính policy đó khi xác minh bằng khóa ghim riêng; không chứng minh con người đọc lúc nào, có đọc không, đủ mọi lần thử hay lịch sử bất biến. Diagnostics/`finalSignature` chưa tự trở thành biên nhận xác minh độc lập khi chưa biết định dạng thông điệp đã ký. Tính năng tùy chọn phải xác minh offline, thất bại sau sửa một byte và công bố phần kiểm tra bị bỏ qua; nếu chưa làm được thì không gắn nhãn.

### 8.5 Phụ thuộc thiết lập khi triển khai sau này

Trước khi tạo hạ tầng, cần người dùng cung cấp email quản lý giấy phép và đồng ý rõ ràng với [điều khoản Tide](https://tide.org/legal); không suy ra từ yêu cầu viết spec. Trước tạo realm, hỏi Docker cục bộ hay Skycloak hosted; Raziel nói không chuyển vị trí realm về sau. Mặc định để lập kế hoạch là Docker cục bộ có mạng thật, chờ lựa chọn thực tế. Sau bootstrap tuân thủ câu hỏi branding/profile của Raziel; không tự tạo email/hồ sơ.

Chuẩn bị template/SDK tương thích, callback origin chính xác, adapter ghim, ba tài khoản quản trị đăng ký độc lập và toàn bộ role/mapper dự kiến. Hoàn tất quản trị, tái tạo M0, không còn phụ thuộc bootstrap/adoption chưa giải quyết; loại credential khởi tạo khỏi runtime. Tài liệu này không cho phép tạo tài khoản, triển khai hợp đồng hoặc nhắn bên ngoài. Triển khai Forseti tùy chỉnh còn thử nghiệm, do đội Tide thực hiện; MVP thu gọn tránh phụ thuộc đó.

## 9. Mô hình dữ liệu và hợp đồng API

Toàn bộ mục này là **P — thiết kế ứng dụng**, trừ endpoint Tide được ghi rõ. Không tên hàm đề xuất nào được coi là SDK Tide.

### Schema lưu trữ

| Thực thể | Trường và ràng buộc | Dữ liệu nhạy cảm/thẩm quyền |
|---|---|---|
| `DemoRun` | UUID `id` PK, realm/client ID, createdAt, mode=`LIVE_MANUAL_RELEASE`, fingerprint policy dự kiến, fingerprint khóa ghim, manifest phiên bản | Không secret. Fingerprint trong DB sửa được chỉ là tham chiếu hiển thị nếu chưa ghim độc lập. |
| `Exam` | UUID PK, runId FK, title ≤120 ký tự, authorIssuer/subject, advisoryReleaseAt UTC, sealedAt, contentType=`text/plain;charset=utf-8`, ciphertext BLOB, ciphertextSha256, byteLength, version=1, state | Không lưu tên tệp nguồn chứa thông tin cá nhân; không bản rõ/hash bản rõ. Mỗi lượt một đề niêm phong; update bình thường không thay ciphertext. |
| `ExamPolicy` | UUID, examId, purpose=`WRITE`/`READ`, contractId, subjectType/Id, signedBytes BLOB, digest, version, tham chiếu bằng chứng ký | Byte đã ký opaque kèm metadata phân tích; chữ ký phải khớp nội dung. Không khóa ký. Unique theo đề/mục đích/phiên bản. |
| `GovernanceLink` | UUID app, examId, requesterIssuer/subject, targetIssuer/subject, vai trò trong allowlist, ID CR Tide, trạng thái/số phiếu/ngưỡng quan sát gần nhất, observedAt | Cache đọc, không phải nguồn quyền hiệu lực; đánh dấu khi cũ. |
| `DemoRoleOverride` | runId + issuer/subject unique, enum displayRole, updatedAt | Chỉ dành cho hiển thị/tấn công cục bộ; không dùng cho mật mã hoặc vai trò API thật. |
| `ActivityEvent` | UUID, runId/examId, actorIssuer/subject, kind, outcome, source, code, correlationId, Tide CR ID, observedAt, artifact/digest tùy chọn | Quan sát app/client có thể sửa. Allowlist trường; không bản rõ/token/header thô. |
| `DpopReplay` | Thumbprint khóa proof + jti unique, expiresAt | Insert nguyên tử; giữ hết cửa sổ độ mới; lỗi DB thì đóng thao tác được bảo vệ. |

Không lưu checksum bản rõ: đề có thể ít entropy, checksum giúp đoán nội dung. Digest ciphertext dùng đối chiếu lưu trữ, không xác thực nguồn tác giả. Tạo UUID mới mỗi reset để không trộn policy cũ với đề mới.

### API HTTP của ứng dụng

Ngoại trừ vỏ đăng nhập và asset công khai, mọi route cần JWT + DPoP; kiểm tra đúng role khi được chỉ định, kiểm soát same-origin cho thao tác ghi, giới hạn body, schema và tần suất; `no-store`. Dùng issuer/subject trong claim đã xác minh; bỏ qua actor role do client gửi. Lỗi: `{error:{code,message,correlationId,retryable}}`; thành công kèm correlationId và phiên bản tài nguyên. Thiếu phụ thuộc xác thực/cấu hình thì không cho thực hiện.

Mã HTTP: `401` phiên/proof không hợp lệ; `403` danh tính hợp lệ thiếu quyền API; `409` xung đột trạng thái/phiên bản; `413` quá giới hạn; `422` dữ liệu sai; `503` phụ thuộc xác minh không sẵn sàng. Từ chối SDK trong trình duyệt là kết quả riêng, không giả thành HTTP 403 của app.

| Hợp đồng | Đầu vào → đầu ra | Điểm thực thi |
|---|---|---|
| `GET /api/session` | → alias/subject đã xác minh, role chính xác, readiness tích hợp | Bộ xác minh API; nhãn không cấp quyền |
| `POST /api/exams/prepare` | tác giả gửi `{title,advisoryReleaseAt}` + idempotency key → examId mới, tình trạng chờ policy | Kiểm tra tác giả; không bản rõ; chuẩn bị policy trước niêm phong |
| `POST /api/exams/:id/seal` | `{ciphertextBase64,writePolicyId,contentType}` + version/idempotency key → metadata niêm phong, digest do server tính | Quyền sở hữu/trạng thái/kích thước; SDK mã hóa trước POST. Chỉ nhận envelope có giới hạn, đúng định dạng reference. API không chứng minh đó là đề thi hoặc client đã mã hóa trung thực |
| `GET /api/exams`, `GET /api/exams/:id` | → metadata giả lập và trạng thái mở quyền quan sát được | Người tham gia demo đã đăng nhập |
| `GET /api/exams/:id/ciphertext` | → ciphertext thực đã lưu, encoding/digest | Cố ý cho giáo viên/admin đã đăng nhập tải: tính bí mật phải tồn tại dù có ciphertext |
| `GET /api/exams/:id/policy?purpose=READ` | → policy đọc đã ký hoặc trạng thái chưa sẵn sàng rõ ràng | Trong demo cố định này cho người tham gia đã đăng nhập để thử từ chối trực tiếp. Policy lộ metadata subject/record; triển khai rộng hơn phải hạn chế theo đối tượng |
| `POST /api/exams/:id/access-requests` | `{kind:"SELF_ACCESS"|"INVIGILATOR_RELEASE"}` → `202` với CR ID thật, hoặc lỗi thiết lập/dịch vụ rõ ràng | App-admin chỉ tự đề nghị; người mở quyền chỉ nhắm giám thị cố định; allowlist target/role phía server |
| `GET /api/governance/requests` | → CR đã lọc và timestamp nguồn | App-admin xem yêu cầu của mình; quản trị xem yêu cầu demo liên quan; cache không cấp quyền |
| `PUT /api/demo/display-role` | app-admin gửi `{displayRole:"invigilator",runId}` → hàng trước/sau | Chỉ demo giả lập chạy thật; không grant thật; route vắng mặt ở production |
| `POST /api/activity/client-observations` | `{examId,kind,outcome,code,correlationId}` → ghi nhận client-reported | Claim thật và enum giới hạn; không chứng thực giải mã thành công |
| `GET /api/activity` | → quan sát phân trang và nhãn bằng chứng | Vai trò API, giới hạn theo lượt |

**Không có `/api/decrypt`, `/api/plaintext`, mạo danh server, route master key hoặc route reset production.** Thử mở diễn ra cục bộ: tải ciphertext/policy đọc đã chuẩn bị; gọi SDK chia sẻ thật với danh tính hiện tại; phân loại kết quả thật; chỉ giữ/xóa bản rõ trong trình duyệt theo thao tác người dùng.

**Lưu policy:** nếu reference cần, thêm route tiếp nhận policy đã ký riêng cho quản trị. Base64 có giới hạn; kiểm tra contract, subject, operation, assignment và chữ ký bằng thư viện đã xem. Không tạo `approved=true` từ server. Chưa xác lập được định dạng xác minh chữ ký thì giữ route bị vô hiệu hóa đến khi reference chạy vòng thật thành công.

**Cầu nối đề nghị:** ưu tiên thao tác console Tide được hỗ trợ. Nếu app cần credential dịch vụ để đề nghị/đọc, chỉ cấp quyền đọc/ghi role mapping bắt buộc, không quyền phê duyệt/ký/mạo danh; không có quyền giải mã. Xác minh mọi thao tác ghi của nó thành yêu cầu có quản trị. Hỗ trợ phân quyền chi tiết là phụ thuộc thiết lập; nếu không có, người vận hành quản trị tạo đề nghị trong console thật và app ghi “Awaiting operator proposal” đến khi có CR thật. Không tạo trạng thái chờ quorum giả để giấu phụ thuộc.

### Trao đổi quản trị Tide đã xác minh — R2

Base: `{tidecloak}/admin/realms/{realm}`. Đề nghị role mapping dùng admin API được hỗ trợ, ví dụ `POST /users/{targetId}/role-mappings/realm`, body là role representation thật `{id,name}`. Kiểm tra trực tiếp nhận `202` và `Location`/CR ID. Không ghi đè mù quáng vai trò đã có.

- `GET /iga/change-requests?status=PENDING`, `GET /iga/change-requests/{id}` lấy bản ghi nguồn. Danh sách dùng `authorizationCount`, `authorizers[]`, `threshold`, `readyToCommit`, phụ thuộc và status.
- Trình duyệt người duyệt dùng chính danh tính đó gọi `POST /iga/change-requests/{id}/approve` với `{}`. Nếu `mode="needs-approval"`, đưa `requestModel` qua đúng reference enclave; gửi `{requestModel:"<base64 signed request>"}` về cùng endpoint. Đọc `mode`, `authCount`, `threshold`, `committed`, status. Tên trường số phiếu khác giữa danh sách và response phê duyệt.
- Không proxy phiếu của con người bằng danh tính dịch vụ: R2 tính người gọi HTTP, không phải nhãn người trong chữ ký. Nhiều người qua một token dịch vụ chỉ là một caller và làm sai trách nhiệm.
- Không dùng `/tide-admin/change-set/*` cũ. `/authorize` dành cho bootstrap/tương thích cũ, từ chối MultiAdmin thông thường. `/commit` phải từ chối dưới quorum (`412`), không tự tạo phiếu. Xác nhận tự commit của `/approve` trên bản ghim.
- Chỉ với `PENDING`, có thể dùng `POST /iga/change-requests/{id}/deny`. Từ chối `APPROVED` không thu hồi. `GET .../{id}/diagnostic-bundle` giúp xem ngưỡng/bằng chứng, không phải bộ xác minh nhật ký bất biến đầy đủ.

## 10. Mô hình đe dọa và giới hạn từng tuyên bố

| Mối đe dọa | Kết quả mong đợi | Ranh giới/rủi ro còn lại |
|---|---|---|
| Giáo viên/admin có DB dump, ciphertext, policy | Danh tính thật không giải mã nếu thiếu role được bảo vệ và policy khớp | Phải là SDK từ chối thật, không chỉ UI vô hiệu hóa. DB bị chiếm vẫn lộ metadata, bị xóa/thay. |
| Sửa role trong DB app thành invigilator | Credential đã ký và quyền mạng không đổi | Role app không có quyền mật mã. API sai vẫn có thể lộ metadata/giao diện giả. |
| App-admin đề nghị tự cấp quyền thật | Chờ; một phiếu chưa đủ; commit bị chặn | Phải có M0 đã ký 2-trên-3 và không thừa kế vai trò cổng. |
| Một người quản trị Tide ký policy khác | Vẫn không tự đọc vì bản thân/giáo viên/app-admin thiếu `_tide_decryptor` | Chưa xác minh quorum khi ký policy; không nói “mọi policy cần hai người ký”. |
| Token bị đánh cắp/giả hoặc proof replay | API từ chối chữ ký/ràng buộc/replay sai; mạng xác minh yêu cầu | DPoP ràng buộc người gửi, không chứng minh thiết bị vật lý lành mạnh hoặc chống code độc chạy trong trình duyệt hợp lệ. |
| Sửa lịch app/đẩy đồng hồ trình duyệt | Không đổi quyền thật | Không tuyên bố thời gian độc lập; hai người quản trị có thể cấp sớm. |
| Thay policy chưa ký, sai tag/record hoặc blob hỏng | SDK thất bại, không hiện bản rõ | Sửa cả digest trong DB có thể lừa màn kiểm tra app; không chứng minh nguồn tác giả. |
| Máy chủ cung cấp frontend độc hại | Có thể lấy input tác giả, chụp bản rõ người nhận hoặc đánh lừa UI phê duyệt | Ngoài tuyên bố hẹp về lưu trữ/quyền. SWE giữ khóa không làm bản rõ/UI app trở nên đáng tin. Static build kiểm soát riêng, asset được ký/ghim, CSP/SRI và rà soát phê duyệt độc lập giảm rủi ro; demo không chứng minh miễn nhiễm toàn bộ frontend supply chain. |
| Tác giả/người nhận được phép làm lộ đề | Không ngăn được | Tác giả biết nội dung; giám thị sao chép, chụp, gửi được. Không DRM. |
| Giả dữ liệu vị trí/phòng thi | Chưa có kiểm soát | Cần attestation vị trí/thiết bị xác minh độc lập. |
| Thông đồng/chiếm tài khoản quản trị | Hai người hợp lệ cấp được quyền | Ba tài khoản trên một laptop bị chiếm không tạo độc lập con người. |
| Master/IAM, tắt IGA, offboard, failover | Phải kiểm tra phạm vi và hậu quả mật mã thật | Không suy từ demo app-admin sang mọi đường master/recovery/Ragnarok. Không âm thầm hạ bảo vệ qua reset mật khẩu/khóa. |
| Mạng gián đoạn/không đủ node | Thao tác được bảo vệ không sẵn sàng | Không khóa khẩn cấp hoặc thành công giả. Ngưỡng Fabric khác 2-trên-3 con người. |
| Người vận hành sửa/xóa log | Có thể xảy ra | Không có tuyên bố nhật ký đầy đủ/bất biến; hiện vật đã ký chỉ bảo vệ các byte xác định. |

Guard của API bảo vệ tài nguyên app; Tide thực thi thao tác mật mã chia sẻ. “DB đã mã hóa” không tự chứng minh toàn vẹn, phân quyền đúng, frontend an toàn hoặc cả hệ thống an toàn.

## 11. Các mốc triển khai theo thứ tự

### M0 — Luồng dọc tích hợp thật đầu tiên, ưu tiên cao nhất

Trước khi làm đẹp dashboard: hoàn tất chấp thuận giấy phép/hosting và bootstrap tương thích; có danh tính tác giả/giáo viên/admin/giám thị thật; kích hoạt ngưỡng ba người quản trị; chuẩn bị một cặp policy ghi/đọc. Trang kỹ thuật tối thiểu: đăng nhập thật → tác giả mã hóa chia sẻ → lưu/đọc ciphertext → giáo viên/admin bị SDK từ chối trực tiếp → cấp hợp lệ quyền cho người nhận qua quản trị → giám thị đăng nhập mới → giải mã chia sẻ thành công. Chỉ so bản gốc và bản giải mã trong test harness giả lập. Ghi phiên bản, digest, kết quả đã lọc và CR ID. Không thay bằng tự mã hóa chỉ một người.

Điều kiện hoàn tất: chia sẻ giữa danh tính thực sự hoạt động; hai kiểm tra âm là từ chối role/policy chứ không phải mất mạng; ciphertext lấy từ lưu trữ. Nếu thiếu contract built-in, dừng tuyên bố tính năng được bảo vệ và xác nhận tương thích với Tide. Mô phỏng có nhãn không hoàn tất M0.

### M1 — Chứng minh quản trị và các phép thử vượt quyền

Xác minh M0 2-trên-3 có hiệu lực, self-grant chờ, một phiếu không đủ, cùng danh tính không đếm hai lần, phiếu thứ hai/commit thật cho giám thị và sửa role cục bộ. Kiểm tra người quản trị không có cổng giải mã; một người ký policy đọc khác vẫn không đọc được. Kiểm tra role/composite/default/membership và phạm vi đổi policy/ngưỡng; ghi đường chưa xác minh. Không thử phá hủy offboard/reset trên môi trường thật; chỉ realm giả lập cô lập khi được cho phép sau này.

Điều kiện hoàn tất: cảnh quản trị viên thử tấn công có bằng chứng thật. Nếu grant nhạy cảm vượt quorum, chặn demo quảng bá; không che bằng kiểm tra app.

### M2 — Lưu trữ và ranh giới API có kiểu

Làm schema, upload ciphertext có giới hạn, owner/write-once/idempotency, không tuyến server bản rõ, verifier token/proof và chống replay nguyên tử. Hoàn tất chuẩn bị/ký policy, cầu nối đề nghị CR hoặc console fallback có nhãn. Loại bootstrap khỏi runtime. Lỗi tích hợp chặn thao tác bảo vệ.

### M3 — Bảy màn hình hoàn chỉnh

Làm shell, trạng thái dễ tiếp cận, nhãn bằng chứng chính xác, banner mở quyền thủ công, hồ sơ đăng nhập riêng. Chỉ hiển thị trạng thái API/SDK thật. Timeline ghi rõ mục nào có thể sửa/do client báo.

### M4 — Bằng chứng, reset và diễn tập

Hoàn tất tiêu chí mục 12, thử reset với ID/policy mới, thu bằng chứng dễ đọc, diễn tập 120 giây. Bổ sung setup tái hiện được, manifest và giới hạn. Thời gian đáng tin hoặc audit có chữ ký chỉ thêm sau M0–M4 cùng kiểm tra ranh giới riêng.

### M5 — Chuẩn bị bài nộp, chưa công bố trong công việc này

Chuẩn bị overview ≤300 từ, setup riêng, video <100 MB, quét secret, nhận diện thương hiệu và checklist. Việc công bố/nộp sau đó cần yêu cầu của người dùng; đặc tả này không thực hiện.

## 12. Tiêu chí nghiệm thu và kiểm tra tích hợp/bảo mật trọng tâm

Mọi tiêu chí LIVE chạy trên môi trường tích hợp có phiên bản ghim. Trong repository tương lai, lưu kết quả đã lọc tại `docs/evidence/`. Mock unit test kiểm tra hiển thị được nhưng không thay bằng chứng bảo mật. Ghi PASS, FAIL hoặc NOT VERIFIED; bỏ qua không phải đạt.

| Mã | Cách thử | Bằng chứng đạt |
|---|---|---|
| A1 | Upload văn bản giả lập có marker duy nhất; đọc hàng DB/backup; xem payload upload và log server | Blob khớp ciphertext/digest UI; không có marker/văn bản nguồn giải mã được trong dữ liệu lưu hoặc body/log API. Fixture công khai có thể tồn tại riêng, không nằm trong dữ liệu đề lưu trữ. |
| A2 | Giáo viên gọi SDK chia sẻ với ciphertext thật + policy đọc hợp lệ | Từ chối role/subject rõ ràng; không bản rõ; bỏ kiểm tra route/UI không đổi kết quả. |
| A3 | App-admin làm A2 | Vẫn từ chối; kiểm tra riêng server không có credential giải mã tái sử dụng. |
| A4 | Self-grant thật, G1 duyệt, thử commit trực tiếp rồi G1 duyệt lại | CR thật, ngưỡng hiệu lực 2, số phiếu vẫn 1, không áp dụng, phiên app-admin mới vẫn không giải mã. Từ chối yêu cầu tấn công còn chờ sau đó. |
| A5 | Sửa displayRole trực tiếp trong DB và panel; bỏ qua precheck frontend | Subject/role trong token không đổi, SDK vẫn từ chối. |
| A6 | Đẩy đồng hồ trình duyệt/sửa advisoryReleaseAt rồi gọi SDK trực tiếp | Chưa grant thì quyền không đổi. UI/README/video ghi không có trusted automatic time lock. Đây là kết quả đúng của phạm vi thu gọn, không phải bằng chứng đồng hồ thực thi. |
| A7 | G1/G2 duyệt grant `_tide_decryptor` cho giám thị; giám thị đăng nhập lại | Grant đã áp dụng từ nguồn; subject thật; SDK trả văn bản byte-identical; server không nhận bản rõ; giáo viên/admin vẫn bị từ chối. |
| A8 | Tag thiếu/sai/thừa, policy chưa ký/bị sửa/sai subject, ciphertext hỏng | Tất cả bị chặn; không đổi sang tự mã hóa/fallback; lỗi không rõ không gắn nhãn “đã chứng minh từ chối quyền”. |
| A9 | JWT hết hạn/sai issuer/azp/chữ ký/thuật toán, thiếu cấu hình khóa, token không ràng buộc, DPoP thiếu/sai/replay/sai method/URL/ath | API từ chối từng ca; ca đúng thành công; replay nguyên tử qua đồng thời/khởi động lại trong cửa sổ proof; URL ngoài đúng sau proxy. |
| A10 | Xem M0; thử self-grant, membership/role/composite/default, thành viên/ngưỡng quản trị, đề nghị tắt IGA bằng một người | Ghi nhạy cảm vẫn chờ theo quorum, không xuất hiện quyền phái sinh. Ghi rõ đường chưa thử. Vượt quorum khi cấp quyền là blocker; bỏ tuyên bố rộng chưa hỗ trợ. |
| A11 | Một người quản trị ký policy cho mình/app-admin nhưng thiếu gate | Giải mã trực tiếp bị từ chối; không identity quản trị/default/automation thừa kế `_tide_decryptor`. Quorum ký policy là NOT VERIFIED nếu chưa chứng minh. |
| A12 | Sửa/xóa log app; nếu có artifact ký, xuất và xác minh offline bằng khóa ghim độc lập, sửa một byte đã ký | UI thừa nhận log sửa được. Chữ ký tùy chọn thất bại khi sửa và nêu phạm vi byte; không badge bất biến toàn hệ thống. Chưa có verifier thì audit integrity là NOT VERIFIED. |
| A13 | Ngắt Tide, policy sai định dạng, hết phiên giữa thao tác | Đề vẫn đóng; không mock thành công; chưa lưu xong không báo niêm phong; có hướng dẫn thử lại/đăng nhập. |
| A14 | Reset rồi truy cập URL/ciphertext/policy/override cũ | Lượt/tag/policy mới; gate giám thị gỡ qua quản trị và phiên mới; không web reset/bootstrap bypass/auto-approve vô điều kiện. Không hứa thu hồi bản rõ người nhận đã giữ. |
| A15 | Kiểm tra bàn phím/mobile/tương phản, diễn tập 120 giây | Mọi hành động dùng được bằng bàn phím, focus/trạng thái rõ; không secret trong video; bảy màn dùng được ở 375 px. |

Rà thêm source/config/network để phát hiện telemetry bản rõ, render HTML không an toàn, mục tiêu role tùy ý, truy cập tài nguyên người khác, log Authorization, quyền phê duyệt của service và cache “released” cũ. Chạy test tập trung, typecheck/build và test DPoP có sẵn; không xây bộ test rộng không liên quan.

**Điều kiện phát hành demo:** A1–A7, A9, A11 và hành vi đóng khi không xác minh được là bắt buộc cho luồng cốt lõi. A6/A12 có thể đạt bằng công bố trung thực phạm vi thu gọn; không biến thành bằng chứng thời gian/audit bất biến. Muốn tuyên bố thêm về hai khả năng đó phải có kiểm tra trực tiếp ở ranh giới tin cậy. Không đưa bảo đảm policy/control plane rộng còn chưa xác minh vào quảng bá.

## 13. Kịch bản hai phút và quy trình reset tái hiện được

### Chuẩn bị

Một lượt mới có policy ghi/đọc đã ký; tác giả chỉ có gate mã hóa; giám thị có role nền nhưng chưa có gate giải mã; yêu cầu tấn công chưa có phiếu nạp sẵn. Xác minh G1–G3 đủ điều kiện và M0 đã ký có ngưỡng 2. Mở hồ sơ/cửa sổ riêng, hiện subject hiện tại. Đo độ trễ cập nhật role/token; đăng xuất/đăng nhập lại đầy đủ khi cần. Ưu tiên người quản trị riêng. Không giấu credential/grant có sẵn trong các đoạn cắt.

### Kịch bản 120 giây — phiên bản mở quyền thủ công

| Thời gian | Thao tác và lời dẫn |
|---|---|
| 0:00–0:12 | Tiêu đề/phụ đề kho đề. “Phòng khảo thí lưu đề mã hóa mà không trao cho quản trị viên app quyền đọc hoặc tự cấp quyền.” Banner nội dung giả lập/mở quyền thủ công luôn thấy. |
| 0:12–0:25 | Tác giả niêm phong ba câu hỏi giả lập; cho thấy đã lưu mã hóa. “Bản rõ ở trình duyệt tác giả; lưu trữ nhận ciphertext.” |
| 0:25–0:36 | Giáo viên thử giải mã thật và thất bại; hiện subject và từ chối Tide đã xác nhận. |
| 0:36–0:51 | Admin đọc ciphertext/digest đã lưu, thử giải mã và thất bại. |
| 0:51–1:04 | Admin sửa role hiển thị thành invigilator; SDK thật vẫn từ chối. “Bản ghi DB này không tạo quyền được bảo vệ.” |
| 1:04–1:23 | Admin đề nghị quyền thật; G1 duyệt một lần; CR thật 1/2, vẫn bị từ chối; G2 từ chối yêu cầu tấn công. |
| 1:23–1:43 | Yêu cầu riêng mở quyền hợp lệ cho giám thị; G1/G2 ký trong enclave thật; hiện đã áp dụng, từng danh tính rõ ràng. |
| 1:43–1:54 | Giám thị đăng nhập mới và mở đề; hiện ba câu hỏi và trạng thái chỉ trong phiên. |
| 1:54–2:00 | “Prototype mở quyền thủ công qua quorum. Chưa trình diễn tự mở theo đồng hồ đáng tin hoặc xác minh phòng thi.” Timeline có nhãn bằng chứng. |

Diễn tập trước, không ký sẵn yêu cầu sẽ quay. Nếu đăng nhập/phê duyệt lâu hơn hai phút, cắt cảnh thao tác thật và chú thích rõ, giữ ID yêu cầu, danh tính, thứ tự. Không tăng tốc đồng hồ hoặc tạo kết quả phê duyệt giả. Mô tả việc biên tập trong README. Phần admin thất bại dài nhất.

### Reset — do nhà phát triển vận hành, chỉ realm giả lập

1. Ẩn đề, đăng xuất mọi hồ sơ, xóa trạng thái bản rõ app. Bản sao người nhận giữ nằm ngoài khả năng thu hồi.
2. Đọc CR đang chờ thật; chỉ từ chối self-grant/release demo đã biết còn `PENDING`. Không duyệt hàng loạt mọi yêu cầu; không dùng deny trên grant đã duyệt để reset.
3. Dùng quorum hiện hành gỡ `_tide_decryptor` của giám thị và mọi role nền/đọc vô tình cấp cho kẻ tấn công. Chờ áp dụng thật; refresh/đăng nhập lại. Tính thời hạn token/credential cũ, không hứa thu hồi tức thì.
4. Xác nhận phiên mới của giám thị/admin/giáo viên không giải mã đề cũ. Chưa đạt thì chưa quay lại. Không tắt IGA, giảm quorum, chuyển FirstAdmin hoặc giữ khóa khôi phục bí mật.
5. Xóa/lưu trữ các hàng đề/event/override giả lập cục bộ bằng lệnh phát triển offline khi app dừng. Giữ replay record hết cửa sổ hoặc vô hiệu phiên và đợi đủ thời gian. Không reset HTTP công khai.
6. Tạo UUID lượt/đề mới, chuẩn bị/ký policy cho tag mới, mã hóa lại fixture và kiểm tra phân vai nền. Không tái dùng assignment ID với nội dung mới rồi giả định policy cũ hết hiệu lực.
7. Chạy lại A2–A5 cơ sở và kiểm tra ngưỡng. Ghi thời điểm/ID lượt mới. Xóa DB không xóa mật mã mọi bản ciphertext/policy đã sao chép, người nhận có thể giữ bản rõ. Chỉ dùng môi trường giả lập riêng, không đề thật.

Nếu cần realm mới vì không tương thích policy, tuân thủ thiết lập được cho phép, governance/offboarding thật và enrollment mới. “Reset” không cho phép âm thầm dựng realm yếu hơn.

## 14. Checklist bài nộp theo nguồn chính thức

**C1 — Yêu cầu lập kế hoạch đã xác minh**

- [ ] GitHub repository công khai có **prototype hoạt động tích hợp TideCloak**, source và video; không chỉ tài liệu này. Công việc đặc tả chưa công bố repository.
- [ ] README bắt đầu bằng template Project overview chính thức, mô tả một câu và năm câu trả lời; **overview không quá 300 từ**. Setup, giới hạn, bằng chứng, reset ở mục riêng.
- [ ] Trả lời đủ năm ý: khả năng mới/tính khác biệt; rào cản lòng tin/điều thay đổi; người hưởng lợi/giá trị cụ thể; TideCloak tạo khả năng gì; tương tác đã trình diễn. Dùng template C1 hiện hành khi chuẩn bị nộp. Không tuyên bố thời gian/vị trí/audit bất biến chưa hỗ trợ.
- [ ] Ghi nhận “Built with TideCloak” theo nguồn. [Badge hiện tại](https://tide.org/badges/built-with-tidecloak.svg); [liên kết ghi nhận hiện tại](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked). Không tự đặt chứng thực của Tide hoặc sửa relay đăng nhập được bảo vệ. Kiểm tra lại phần bắt buộc/tùy chọn của branding ngoài template README trước công bố.
- [ ] Video **hai phút, `.mp4`, trong repository, dưới 100 MB**; nên dưới 90 MB thập phân để có dư địa. Thử phát sau clean clone; không chỉ có Git LFS pointer không tải được nội dung.
- [ ] Setup ghi phiên bản đã kiểm thử, giấy phép/điều khoản, chọn hosting, enrollment, ba người quản trị, M0 sẵn sàng, origin, DPoP asset/header, chuẩn bị policy đã ký, fixture và xử lý lỗi. Không secret; `.env.example` chỉ placeholder.
- [ ] Video/README ghi mở quyền thủ công, log có thể sửa/client-reported. Không trình bày mock bảo mật như tích hợp thật.
- [ ] Nộp URL repository qua [Google Form chính thức](https://forms.gle/HRHYjnqB86j1LFS97) mà C1 liên kết. Chưa mở/nộp form trong công việc đặc tả; kiểm tra trường và khả năng nhận bài trước bước nộp được cho phép.
- [ ] **Việt Nam: thứ Năm 22/10/2026, 18:00 ICT, UTC+7.** C1 còn ghi Melbourne: thứ Sáu 23/10/2026, 10:00 AEDT, UTC+11; Malaysia: thứ Năm 22/10/2026, 18:00, UTC+8. Đây là hạn theo khu vực, không phải cùng một thời điểm quy đổi. Người dùng này dùng hạn Việt Nam; không lấy giờ Melbourne đổi sang thay thế. Gia hạn chỉ do ban tổ chức xác nhận.
- [ ] Trước khi nộp, xem lại trang/config/form chính thức. Thông báo countdown tĩnh “closed” không tự chứng minh form còn hay hết nhận bài.

Gợi ý định hướng overview: “Kho đề giả lập từ chối quản trị viên ứng dụng dù họ có ciphertext và sửa vai trò trong DB; phê duyệt độc lập cho phép giám thị mở đề. Prototype dùng mở quyền thủ công.” Đây là hướng viết README sau này, không khẳng định đã có prototype hoạt động.

## 15. Câu hỏi mở, mặc định và blocker

| Câu hỏi | Mặc định khuyến nghị/xác nhận cần có | Tác động |
|---|---|---|
| Mạng/SDK nào hỗ trợ `RelationshipAttestation:1` hiện tại? | Template chính thức cập nhật, ghim phiên bản; thử tác giả → giám thị và các ca từ chối caller; nếu thiếu thì xác nhận với Tide. | **Blocker cốt lõi** nếu không có; không clone contract hoặc thay mock. |
| 2-trên-3 có hiệu lực mật mã trên mọi đường cấp quyền không? | Ba admin liên kết, xem M0 đã ký, thử commit/replay, rà role thừa kế; không chỉ tin thuộc tính realm/UI. | **Blocker cốt lõi** nếu một người tự cấp được quyền bảo vệ. |
| App đề nghị/đọc CR mà không nắm quyền phê duyệt được không? | Credential hẹp sau thử quyền thật; nếu không, đề nghị bằng console với trạng thái UI rõ ràng. | Phụ thuộc panel; vẫn có MVP dựa console. |
| Phát hành/thay relationship policy có cần quorum không? | Chưa xác minh, tách IGA; người quản trị không có gate giải mã; cấp gate qua quorum; thử policy thay thế + bị từ chối vì gate. | Chặn tuyên bố “mọi policy được 2-trên-3 bảo vệ”; không chặn demo app-admin hẹp nếu kiểm tra gate đạt. |
| Có not-before tuyệt đối cùng nguồn thời gian đáng tin không? | MVP không tự mở theo thời gian; cần nguồn/điểm thực thi/sai lệch và thử gọi sớm. | Chặn lời hứa đúng giờ ban đầu; mở quyền thủ công là bản nhỏ khả thi. |
| Xuất/xác minh độc lập mọi lần thử truy cập được không? | Timeline có nhãn thường; chỉ thêm bằng chứng policy ký nếu được. Cần định dạng receipt, nguồn khóa và ngữ nghĩa đầy đủ. | Chặn hứa audit đầy đủ/bất biến, không chặn MVP. |
| Master, disable/offboard/failover ảnh hưởng thế nào? | Tách người vận hành runtime, không credential control plane, kiểm tra cô lập được cho phép và nêu giới hạn. | Chặn bảo đảm toàn diện khi máy chủ bị chiếm/“miễn nhiễm”. |
| Độ trễ cập nhật/thu hồi role/token? | Đăng xuất/đăng nhập sau cấp/gỡ, đo hành vi thật, ID mới; không hứa tức thì. | Phụ thuộc diễn tập/reset. |
| Ai quản lý giấy phép, realm đặt đâu? | Người dùng cho email/đồng ý điều khoản trước setup; khuyến nghị Docker cục bộ để diễn tập nhưng chờ lựa chọn. | Blocker thiết lập, không cần tạo tài khoản trong công việc này. |
| Form còn nhận bài/yêu cầu đã đổi chưa? | Dùng hạn Việt Nam nêu trên; xác minh form/trang lúc nộp. | Phụ thuộc nộp bài; không mặc định có gia hạn. |

**Bản dựng khuyến nghị:** dashboard Next.js/TypeScript tiết chế, SQLite lưu ciphertext, mã hóa/giải mã Tide thật trong trình duyệt, danh tính đăng nhập riêng và mở quyền qua grant cần 2-trên-3 phiếu. Tập trung chứng minh admin không giải mã hoặc tự cấp quyền được ngay cả khi sửa DB ứng dụng. Phụ thuộc quan trọng: mạng tương thích policy chia sẻ, ngưỡng quản trị đã ký thực sự có hiệu lực, xác minh đúng JWT cùng DPoP và ceremony ký/đăng ký trong trình duyệt. Giữ mở quyền thủ công và nhãn bằng chứng trung thực trừ khi đã xác minh riêng thời gian đáng tin và khả năng xuất audit.
