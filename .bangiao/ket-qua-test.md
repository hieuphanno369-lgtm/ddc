# ĐỎ

Kiểm thử độc lập P3B (`feature/p3b-thong-bao`, `git diff d50db4c..HEAD`). Skill đã dùng:
`ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.

Tất cả cổng kiểm mà coder giao (`tsc`, `npm test`, `npm run test:e2e`) đều XANH đúng như
`.bangiao/thay-doi.md` báo cáo. Điểm khiến kết quả tổng là **ĐỎ** không phải do các Task P3B đã
làm mà do **2 lỗi bảo mật/thiết kế có thật** phát hiện khi kiểm thử sống (Playwright MCP, không
phải test của coder) nằm ở ranh giới Q6 (quyền tài chính từng người) — đúng như security-reviewer
đã ghi ở `.bangiao/danh-gia-bao-mat.md` (phán quyết sẵn có: "CẦN SỬA"). Một trong hai lỗi đã được
mã hoá thành test tự động và **test đó đang ĐỎ một cách có chủ đích** — xem mục 3.

## 1. Cổng kiểm (đều XANH)

| Cổng | Kết quả |
|---|---|
| `npx tsc --noEmit` (PowerShell, `D:\_project\DDC_Control_Tower-B`) | Sạch, không lỗi |
| `npm test` (bộ test gốc của coder, trước khi tôi thêm gì) | **136 file / 1558 test xanh** |
| `npm run test:e2e` (cổng 3001, DB `ddc_control_tower_b`), chạy 2 lần liên tiếp | **21/21 xanh cả 2 lần** (~2.4 phút/lần) |
| `git status` sau khi coder xong | Sạch (không rác) |
| `package.json` diff | Chỉ thêm `nodemailer`, `@types/nodemailer`, `@playwright/test` + script `test:e2e` — đúng cam kết |

Sau khi tôi thêm `src/server/qa-p3b-independent.test.ts` (11 test độc lập, không đụng code sản
phẩm): `npm test` = **137 file (136 xanh + 1 có 1 ca đỏ) / 1569 test (1568 xanh + 1 đỏ)**. Ca đỏ
duy nhất là **cố ý** — xem mục 3.

## 2. N-3 (che số tiền) — kiểm sống bằng Playwright MCP, XANH

Đăng nhập BOD sau khi admin tắt `canViewFinance` qua UI Quản trị, đăng nhập lại (JWT mới):

- **Tổng quan**: không còn thẻ Backlog (KPI thứ 6), chart đổi tên "Lượng theo Team KD" (không còn
  "& Trị"), chỉ còn legend "Lượng (tấn)", cột "Giá trị HĐ" và option sort "Giá trị" biến mất khỏi
  bảng dự án. Quét `innerText` + `outerHTML` toàn trang bằng regex `/\d[\d.,]*\s?tỷ/`: chỉ có 1 khớp
  giả — `"\u0026 tỷ"` từ chuỗi i18n "Tiền tệ & tỷ giá" (catalog next-intl nhúng cho hydrate, không
  phải số tiền) — khớp đúng lưu ý #4 trong `thay-doi.md`. Không khớp `"contractValue":\d`,
  `"eac":\d`, `"vac":-?\d`, hay bất kỳ số tiền thật nào (477,8 / 784,6 / 825,6 / 55 tỷ…).
- **Chi tiết dự án** (`/vi/projects/1`): không có "Giá trị HĐ", không có "Đường cong S", không có
  What-if; chỉ còn "Khối lượng HĐ … tấn". SPI/CPI vẫn hiện (đúng Q5).
- **Cảnh báo** (`/vi/alerts`): không alert nào lộ số tiền (không có alert R5 công nợ trong dữ liệu
  hiện tại — hành vi che message R5 được xác nhận riêng qua `src/lib/finance-gate.test.ts` +
  `projects-detail-finance-gate.test.ts` của coder, đã đọc code và đồng ý đúng logic).
- **Báo cáo** (`/vi/report`): không có "Backlog", không khớp regex tiền.
- **`/api/export`** (BOD, `credentials:'include'`): 200, tải file thật qua
  `mcp__playwright__browser_network_request` (không phải paste tay), mở bằng `exceljs`: header CHỈ
  có `Mã DA, Tên dự án, Khách hàng, Team KD, Loại hình, Thị trường, Trạng thái, Priority, % KH, % TT,
  SPI, CPI` — **không có "EAC", không có "Giá trị HĐ"**.
- **`/api/report/export`** (BOD): sheet `KPI` không có dòng "Backlog (tỷ)"; sheet `DanhSachDuAn`
  không có cột backlog.
- Bật lại quyền BOD → thấy lại số tiền (xác nhận cơ chế 2 chiều).
- Cơ chế có hiệu lực: xác nhận qua code (`src/lib/auth.ts` `jwt` callback chỉ gọi lại
  `resolveAccess()` khi có `user` mới = lúc đăng nhập) **và** qua thực nghiệm (đăng nhập lại BOD sau
  khi admin đổi quyền → thấy hiệu lực ngay).
- **Audit + phân quyền action**: `setUserCanViewFinanceAction` ghi cả `activity_log`
  ("Đổi quyền xem tài chính") lẫn `audit_log` (bảng `user_roles`, field `canViewFinance`, old→new) —
  thấy trực tiếp trên `/vi/audit`. Test độc lập (`qa-p3b-independent.test.ts`) xác nhận: BOD (không
  phải admin) gọi action này → `Forbidden`, DB không đổi; chưa đăng nhập → `Forbidden`; tự
  data-entry gọi cho chính mình → `Forbidden`; email không tồn tại → `Not found`.

Ảnh: `.bangiao/anh-test/01-admin-user-editor-canviewfinance.png`,
`03-admin-audit-log-canviewfinance-restore.png`.

## 3. Hai lỗi có thật — kiểm sống, KHÔNG chỉ tin security-reviewer

`.bangiao/danh-gia-bao-mat.md` (đã có sẵn trong nhánh, phán quyết "CẦN SỬA", 5 lỗi mức trung T-1…T-5)
— tôi tái hiện độc lập 2 trong số đó bằng Playwright MCP + 1 test tự động:

### T-1 — `/vi/nhap-lieu` lộ số tiền cho data-entry dù đã tắt `canViewFinance` (xác nhận SỐNG)

Admin tắt quyền tài chính của `pm@daidung.com.vn` (data-entry) qua Quản trị → đăng nhập lại bằng
`pm` → vào `/vi/nhap-lieu?project=1` → tab "2 Tài chính" **vẫn hiện** `AC (tỷ) = 210`,
`SPI/CPI/EAC/VAC` (EAC 265.89, VAC 211.91) ở khối "Kết quả dự kiến". Ảnh:
`.bangiao/anh-test/02-BUG-T1-nhap-lieu-lo-tien-data-entry-tat-quyen.png`.

Đây **không thuộc phạm vi P3B** (Q7 đã chốt rõ: P3B không đụng `DataEntryForm`/`nhap-lieu`, việc
này để A xử lý trong/sau P3A — coder đã ghi đúng lưu ý này trong `thay-doi.md`). Nhưng Q6 (do P3B
thêm) tạo ra "cảm giác an toàn giả": admin tắt được nút nhưng số tiền vẫn lộ ở trang này. Không tính
là lỗi của P3B, nhưng **phải biết trước khi công bố tính năng "tắt quyền xem tài chính" cho người
dùng cuối**.

### T-2 — Đổi vai trò (role) ghi đè âm thầm `canViewFinance` đã tắt (XÁC NHẬN SỐNG + TEST TỰ ĐỘNG ĐỎ)

`src/server/actions.ts:281` (file **KHÔNG** thuộc phạm vi sửa của P3B, code có từ trước) —
`setUserRoleAction` gọi `repo.setUserRole(email, role, role !== 'viewer')`: tham số thứ 3 ép
`canViewFinance` theo role, ghi đè bất kỳ giá trị nào Q6 đã đặt riêng.

Tái hiện sống: admin tắt `canViewFinance` của `pm` (đúng, thấy "Không" trong bảng + audit
`pm@daidung.com.vn -> false`) → đổi vai trò `pm` sang "BOD" (không liên quan gì tới quyền tài
chính) → cột "Xem tài chính" của `pm` tự động nhảy về "Có" — **không có audit_log riêng cho lần đổi
`canViewFinance` này**, chỉ có activity "Đổi quyền" (role). Đổi `pm` về lại "Nhập liệu (PM/PIC)":
vẫn "Có" — quyền đã tắt trước đó không bao giờ được khôi phục lại đúng ý admin.

Tôi đã viết test tái hiện lỗi này trong `src/server/qa-p3b-independent.test.ts`
(`describe('Q6 - ...')`, ca `'[BIET LOI - T-2] doi vai tro KHONG duoc am tham bat lai
canViewFinance da bi admin tat truoc do'`). **Test này ĐỎ với code hiện tại**:

```
FAIL src/server/qa-p3b-independent.test.ts > Q6 - phan quyen doi canViewFinance qua action
  (server action, khong phai UI) > [BIET LOI - T-2] doi vai tro KHONG duoc am tham bat lai
  canViewFinance da bi admin tat truoc do
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
  at src/server/qa-p3b-independent.test.ts:193:23
```

10/11 test khác trong file này XANH (bao gồm 2 test SSRF độc lập, 2 test `webhook.ts` tiêm
lookup/request giả, các ca biên `finance-gate.ts`, và 3 ca phân quyền action còn lại). Tôi **không
sửa** `src/server/actions.ts` hay bất kỳ file sản phẩm nào — theo đúng ràng buộc tester.

## 4. SSRF webhook — kiểm sống qua UI thật (không chỉ tin unit test của coder)

Tạo kênh webhook thật qua `/vi/admin` (admin, có `NOTIFY_SECRET_KEY` trong `.env`):

| URL nhập | Kết quả UI |
|---|---|
| `http://2130706433/x` | "Chỉ chấp nhận URL https." (`bad_protocol`, http bị chặn mặc định) |
| `https://2130706433/x` (127.0.0.1 dạng thập phân) | "Địa chỉ trỏ vào mạng nội bộ — bị chặn." |
| `https://[::ffff:127.0.0.1]/x` | "Địa chỉ trỏ vào mạng nội bộ — bị chặn." |
| `https://169.254.169.254/latest/meta-data` | "Địa chỉ trỏ vào mạng nội bộ — bị chặn." |
| `https://example.invalid/hook` | Lưu OK, hiện `••••hook (example.invalid)` — không lộ URL đầy đủ |

Xác nhận `new URL(...)` (WHATWG) tự chuẩn hoá `2130706433`→`127.0.0.1`, `0x7f.1`→`127.0.0.1` trước
khi `notify-url.ts` kiểm — đã chạy thử bằng `node` độc lập để chắc chắn không phải diễn giải sai.

"Gửi thử" trên kênh `example.invalid`: lần 1 → "Không phân giải được tên máy chủ." (`dns_failed`,
activity log chỉ ghi mã `9:dns_failed`, **không có URL**); bấm liên tục đến lần 6 → "Gửi thử quá
nhiều — chờ 1 phút." (rate limit 5 lần/phút hoạt động đúng).

Kiểm rò bí mật trên `outerHTML` trang `/vi/admin`: không có `v1:`, không có `secretEnc`, không có
URL gốc `example.invalid/hook` hay `smtp.example.invalid` (chỉ có host rút gọn qua `webhookHost`).

Đã thêm 2 test độc lập cho `webhook.ts` (tiêm `request`/`lookup` giả, không ra mạng thật): redirect
3xx trả `http_3xx` và **không gọi lại request lần 2** (không theo redirect); DNS trả lẫn 1 địa chỉ
công khai + 1 địa chỉ nội bộ → `blocked_ip` và **`request` không được gọi lần nào** (không rò rỉ kết
nối tới địa chỉ công khai trước khi kiểm hết danh sách). Cả 2 test này XANH.

Email SMTP tới `127.0.0.1`/`10.0.0.5`: đã đọc code (`email.ts` dùng `isBlockedSmtpIp`, Q3=a) và bộ
test `email.test.ts` của coder — không lặp lại bằng UI vì cần cấu hình SMTP thật; tin cậy qua đọc
code + test đã có, không phát hiện sai lệch.

## 5. Hồi quy — XANH

`/vi/projects/1` (admin): chart, Gantt thiết bị, Chuỗi giá trị, KPI %TT hiện đủ, không vỡ trang.
`/vi/admin` (tỷ giá, khu vực sản xuất): không kiểm sâu lại (đã có e2e `07-admin.spec.ts` xanh, không
phát hiện gì bất thường khi thao tác kênh thông báo). `npm run test:e2e` đã bao `/vi/nhap-lieu`,
`/vi/import`, đăng nhập/xuất — xanh cả 2 lần. Không kiểm `/en` (đọc `messages.test.ts` của coder đã
xác nhận vi/en khớp key, không thấy dấu hiệu MISSING_MESSAGE cho 2 nhóm mới).

## 6. Phát hiện ngoài phạm vi — vấn đề hạ tầng (không phải lỗi code P3B)

Biến môi trường Windows **User-level `NEXTAUTH_URL=http://localhost:3000`** (xem
`[Environment]::GetEnvironmentVariable('NEXTAUTH_URL','User')`) **đè lên** giá trị
`http://localhost:3001` trong `.env` của worktree B, vì process.env kế thừa từ OS có precedence cao
hơn giá trị nạp từ `.env`. Hệ quả quan sát được: trang "Sign out" của NextAuth dựng `<form
action="http://localhost:3000/...">` (tuyệt đối, sang cổng của A) thay vì tương đối. Vì cookie phiên
đăng nhập chỉ gắn theo domain `localhost` (không phân biệt cổng), việc đăng xuất vẫn hoạt động đúng
(cookie bị xoá chung), nhưng bất kỳ chỗ nào đọc trực tiếp `process.env.NEXTAUTH_URL` (vd
`dispatch.ts` build `baseUrl` mặc định, `alertUrl()` trong link cảnh báo gửi ra ngoài,
`testNotifyChannelAction`) sẽ dùng nhầm cổng 3000 trên máy này cho tới khi biến User-level được gỡ
hoặc được set về 3001. `e2e/global-setup.ts` đã tự vệ đúng bằng cách kiểm tra
`NEXTAUTH_URL === 'http://localhost:3001'` và dừng nếu sai — nên bộ e2e không bị ảnh hưởng. Đề nghị
chủ dự án xoá/sửa biến User-level này trên máy, không phải việc của coder.

## 7. Trạng thái dọn dẹp

- DB `ddc_control_tower_b` đã `npx prisma db seed` lại — 4 tài khoản về đúng seed gốc
  (`admin/bod/pm.canViewFinance=true`, `viewer.canViewFinance=false`), không còn kênh thông báo nào,
  xác nhận lại qua UI `/vi/admin` sau khi seed.
- Dev server cổng 3001 tôi tự khởi động đã dừng bằng `taskkill /PID <root> /T /F` (chỉ cây tiến
  trình của tôi, đã truy vết đủ 8 tiến trình cha-con tới đúng lệnh `npm run dev -- -p 3001` tôi
  chạy) — không đụng cổng 3000 (PID 20972, không phải của tôi, còn nguyên).
- `git status`: chỉ còn `.bangiao/anh-test/` (3 ảnh), `.bangiao/danh-gia-bao-mat.md` (báo cáo có sẵn
  của security-reviewer, không phải tôi tạo — giữ nguyên vì chứa thông tin liên quan trực tiếp),
  `src/server/qa-p3b-independent.test.ts` (test của tôi). Không có file rác khác (log tạm đã xoá).

## 8. Tóm tắt số liệu

- Unit/integration (Vitest): coder 136 file / 1558 test xanh; tester thêm 1 file / 11 test
  (10 xanh + **1 đỏ có chủ đích**, tổng 137 file / 1569 test, 1568 xanh).
- E2E (Playwright): 21/21 xanh, 2 lần chạy liên tiếp.
- Lỗi/khiếm khuyết: **T-1** (rò tiền `/vi/nhap-lieu`, xác nhận sống, ngoài phạm vi P3B nhưng cần chủ
  dự án biết), **T-2** (đổi role ghi đè `canViewFinance`, xác nhận sống + có test tự động đỏ tái
  hiện được), cộng với 3 lỗi mức trung khác (T-3, T-4, T-5) đã có sẵn trong
  `.bangiao/danh-gia-bao-mat.md` mà tôi không tái hiện lại (không đủ phạm vi thời gian, không phải
  vì nghi ngờ độ chính xác — T-3/T-4/T-5 là phát hiện tĩnh hợp lý khi đọc code).

**Khuyến nghị**: KHÔNG merge cho tới khi ít nhất T-2 (và lý tưởng là T-1) được xử lý hoặc chủ dự án
tường minh chấp nhận rủi ro — vì cả hai đều trực tiếp làm rỗng tác dụng của Q6, hạng mục mà đề bài
kiểm thử ghi rõ là "quan trọng nhất".
