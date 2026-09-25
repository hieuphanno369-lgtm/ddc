# P3B — Thông báo webhook/email + N-3 gate số tiền + e2e Playwright — Tóm tắt thay đổi

Nhánh `feature/p3b-thong-bao` (từ `main` @ `d50db4c`). **KHÔNG có migration Prisma** (đúng kế
hoạch — bảng `notify_channel`/`notify_recipient`, cột `alert_log.notify*`, cột
`user_roles.canViewFinance` đã có sẵn từ P2A). 69 file thay đổi, +5165/-101 dòng (không tính
`.bangiao/`). Cổng kiểm cuối cùng: `tsc --noEmit` sạch, **136 file / 1558 test Vitest xanh**,
**21/21 test e2e Playwright xanh** (chạy 2 lần liên tiếp), `npm run build` xanh.

## Danh sách commit (theo Task)

| Commit | Nội dung |
|---|---|
| `5a9b733` | docs(bangiao): thêm `ke-hoach.md` vào nhánh |
| `de6a344` | **Q6**: đọc `canViewFinance` từ cột DB `user_roles` từng người + UI bật/tắt trong Quản trị |
| `bb0d4c3` | **Task 1**: N-3 che số tiền ở Tổng quan (finance-gate.ts, Lượng & Trị, bảng dự án, watchlist) |
| `8160835` | **Task 2**: N-3 che số tiền ở Chi tiết dự án, cảnh báo, báo cáo, file Excel |
| `2e520a3` | **Task 3**: `notify-url.ts` chống SSRF + `notify-message.ts` dựng nội dung |
| `d131172` | **Task 4**: repo kênh/người nhận + trạng thái gửi alert (prisma + mock) |
| `daf15fc` | **Task 5**: gửi webhook, ghim IP đã kiểm, timeout 5s, không theo redirect |
| `3a9cef4` | **Task 6**: điều phối gửi khi engine mở alert mới, chống trùng, thử lại tối đa 3 lần |
| `1d424c3` | **Task 7**: gửi email SMTP thật bằng nodemailer |
| `d02fecd` | **Task 8**: action + UI Quản trị CRUD kênh/người nhận + Gửi thử |
| `a231a0e` | **Task 9**: e2e Playwright luồng chính (8 spec) |

## File sửa/tạo chính (theo nhóm)

- **Q6 (quyền tài chính từng người):** `src/lib/auth.ts` (`resolveAccess()`), `src/server/actions-user-finance.ts` (mới),
  `src/server/repo/{prisma-repo-entry,mock-repo-entry}.ts` (thêm `setUserCanViewFinance`),
  `src/components/admin/UserEditor.tsx` (cột "Xem tài chính" bật/tắt, ẩn với tài khoản admin vì luôn được).
- **N-3 (che số tiền):** `src/lib/finance-gate.ts` (mới, thuần), `src/components/dashboard/{OverviewWidgets,ProjectTable,
  Watchlist,charts,DrillCharts}.tsx`, `app/[locale]/(app)/overview/page.tsx`, `app/[locale]/(app)/projects/[id]/page.tsx`,
  `app/[locale]/(app)/alerts/page.tsx`, `app/[locale]/(app)/report/page.tsx`, `app/api/export/route.ts`,
  `app/api/report/export/route.ts`.
- **Thông báo (lõi thuần):** `src/lib/notify-url.ts`, `src/lib/notify-message.ts` (mới).
- **Thông báo (repo):** `src/server/repo/types.ts` (thêm type), `src/server/repo/{prisma-repo-notify,mock-repo-notify}.ts`
  (mới), `src/server/repo/{index,mock-repo}.ts` (gộp), `src/server/repo/{prisma-repo-entry,mock-repo-entry}.ts`
  (thêm `insertEngineAlertsReturningIds`).
- **Thông báo (gửi):** `src/server/notify/{types,webhook,email,dispatch}.ts` (mới), `src/server/alert-engine.ts`,
  `src/server/jobs.ts` (móc vào).
- **Thông báo (Quản trị):** `src/server/validation-notify.ts`, `src/server/actions-notify.ts` (mới),
  `src/components/admin/NotifyChannelEditor.tsx` (mới), `app/[locale]/(app)/admin/page.tsx` (1 thẻ mới).
- **e2e:** `playwright.config.ts`, `e2e/**` (mới, 8 spec + auth.setup + global-setup + 2 helper).
- **i18n:** `src/i18n/messages/{vi,en}.json` — nhóm mới `financeGate`, `notifyAdmin` (cuối file); 2 key
  `activity.notify_channel_save`/`activity.notify_test`; 2 key `admin.canViewFinanceOn/Off/Always`.
- **Khác:** `package.json`/`package-lock.json` (3 gói mới), `.env.example` (biến mới), `.gitignore` (thư mục e2e).

## Gói đã cài (đúng như Q1/Q2 cho phép, qua `NODE_EXTRA_CA_CERTS`, KHÔNG tắt kiểm TLS)

- `nodemailer@6.10.1` (dependency) + `@types/nodemailer@8.0.2` (devDependency).
  **Lệch kế hoạch nhỏ:** kế hoạch nói "cài bản mới nhất" — bản mới nhất theo dist-tag `latest` là
  `10.0.10`, nhưng `next-auth@4.24.7` peer-depend `nodemailer@^6.6.5` → cài `10.x` báo lỗi
  `ERESOLVE`. Đã chọn `6.10.1` (bản 6.x mới nhất, khớp peer dep) thay vì dùng `--force`/
  `--legacy-peer-deps` (kế hoạch cấm hạ thấp an toàn kiểm phụ thuộc).
- `@playwright/test@1.63.0` (devDependency) — bản mới nhất, bundle sẵn Chromium revision `1243`
  khớp CHÍNH XÁC với `chromium-1243` đã có ở `%LOCALAPPDATA%\ms-playwright` → không tải thêm gì.

## Quyết định kỹ thuật (ngoài K1–K12 đã có trong kế hoạch)

1. **Q6 đặt ở đâu:** kế hoạch không gán Task số cho việc sửa `auth.ts`/thêm UI bật-tắt (vì mặc định
   đề xuất ban đầu là giữ nguyên (a), chủ dự án chốt lại (b) sau). Coder làm như 1 bước riêng trước
   Task 1, file mới `src/server/actions-user-finance.ts` (không đụng `actions.ts`), repo function mới
   trong `prisma-repo-entry.ts`/`mock-repo-entry.ts` (không đụng `prisma-repo.ts`).
2. **`mock-repo.ts` đổi cách gộp:** `export const repo = Object.assign({...coreRepo, ...}, createReadMock(...),
   makeNotifyMockRepo(...))` thay vì 2 câu lệnh `Object.assign(repo, X)` rời — hành vi runtime y hệt (cùng
   1 object, cùng mutate), NHƯNG kiểu tĩnh của `repo` giờ gồm đủ các hàm gộp (test import thẳng
   `./mock-repo` mới gọi được `saveNotifyChannel` v.v. mà không lỗi biên dịch).
3. **`insertEngineAlertsReturningIds`**: gọi qua `this.insertEngineAlertsReturningIds(...)` bên trong
   `insertEngineAlerts` (cả 2 bản prisma/mock) — object method tự tham chiếu sibling qua `this`, hoạt
   động đúng vì luôn gọi qua `repo.insertEngineAlerts(...)`.
4. **08-finance-gate.spec.ts**: đổi `page.content()` (kế hoạch ghi) thành `page.locator('body').innerText()`
   khi kiểm "không có chuỗi tiền" — `page.content()` là HTML thô gồm cả payload RSC/script hydrate,
   chứa nguyên catalog i18n (vd `"Tiền tệ \u0026 tỷ giá"`) dù component đó không render cho viewer,
   gây báo giả (chuỗi JSON-escape `\u0026 tỷ` cũng khớp regex `/\d[\d.,]*\s?tỷ/`). `innerText()` chỉ
   lấy chữ THẬT SỰ hiển thị cho người dùng — đúng tinh thần kiểm tra hơn.
5. **07-admin.spec.ts** locator kênh thông báo/tỷ giá: khoanh vùng trong khối chứa tiêu đề thẻ
   (`.card`/`table.tbl` lọc theo chữ đặc trưng) trước khi thao tác — nút "Lưu" trùng chữ giữa
   `NotifyChannelEditor` và `FactoryEditor` (mỗi dòng `FactoryEditor` luôn có sẵn nút "Lưu"), không
   khoanh vùng sẽ vi phạm strict-mode (nhiều phần tử khớp) hoặc bấm nhầm dòng.
6. **`auth.setup.ts`**: ô mật khẩu (`PasswordInput`) chỉ có nhãn dạng `<span>` cạnh input (không phải
   `<label for>`), không dùng `getByLabel` trực tiếp được như kế hoạch gợi ý — định vị qua
   `.field` chứa đúng chữ nhãn (vẫn lấy chữ qua `vi()`, không gõ cứng tiếng Việt, không sửa
   `LoginForm.tsx` vì không thuộc phạm vi Task 9).
7. **05-import.spec.ts** (upload `.txt` ở `/vi/import`): rà code thấy `ImportPanel.tsx` **không có
   UI hiển thị lỗi** khi `importExcelAction` trả `ok:false` (không phải lỗi P3B gây ra, không thuộc
   phạm vi sửa) — test chỉ khẳng định "trang không vỡ, input vẫn còn" thay vì "thấy chữ lỗi" như
   kế hoạch mô tả (không có gì để khẳng định).

## Cách chạy e2e

```powershell
cd D:\_project\DDC_Control_Tower-B
npm run test:e2e
```

- Cổng 3001, DB `ddc_control_tower_b`. `playwright.config.ts` tự bật `next dev -p 3001` nếu chưa
  chạy sẵn (`reuseExistingServer: true`).
- `globalSetup` (`e2e/global-setup.ts`) đọc `.env`, khẳng định chắc chắn `DATABASE_URL` chứa
  `ddc_control_tower_b` và `NEXTAUTH_URL=http://localhost:3001` (dừng toàn bộ nếu sai — không bao
  giờ ghi nhầm DB của A), rồi `npx prisma db seed` + xoá kênh thông báo tên bắt đầu `E2E `.
- Cần trong `.env` (đã có sẵn, KHÔNG commit): `NOTIFY_SECRET_KEY`, `E2E_ADMIN_EMAIL/PASSWORD`,
  `E2E_PM_EMAIL/PASSWORD`, `E2E_VIEWER_EMAIL/PASSWORD` (đọc từ tài khoản seed có sẵn).
- Kết quả lần chạy cuối (2 lần liên tiếp, không sửa gì giữa 2 lần): **21/21 xanh**, ~1.5 phút/lần.
- Báo cáo HTML: `e2e/.report/index.html` (gitignore).

## Việc để sau (không thuộc phạm vi P3B)

- `ImportPanel.tsx` (`/vi/import`) không hiển thị lỗi khi import thất bại — lỗ hổng UX có sẵn, phát
  hiện khi viết e2e, không sửa (ngoài phạm vi kế hoạch P3B).
- Form Nhập liệu (`DataEntryForm`, `nhap-lieu`) chưa gate theo `canViewFinance` — xem "Lưu ý cho A".

## Lưu ý cho A

1. **Q6 đã đổi cơ chế quyền tài chính**: `resolveAccess()` (`src/lib/auth.ts`) giờ đọc cột DB
   `user_roles.canViewFinance` TỪNG NGƯỜI (không còn suy từ role) — admin luôn `true` bất kể cột
   DB; Quản trị (`UserEditor.tsx`) có nút bật/tắt cho từng tài khoản (trừ admin). Có hiệu lực ở
   lần đăng nhập/refresh JWT kế tiếp của người bị đổi quyền (JWT callback chỉ gọi lại
   `resolveAccess()` khi có `user` mới, tức lúc đăng nhập).
2. **P3B không đụng `DataEntryForm`/`nhap-lieu`/form dự án** (đúng Q7 đã chốt) — form nhập liệu vẫn
   hiện/nhận giá trị HĐ, AC/PV/EV, EAC/VAC cho `data-entry` dù Q6 mới thắt chặt quyền xem. **Đề
   nghị A gate phần nhập tài chính theo `canViewFinance` trong/sau P3A** (vì hiện tại data-entry
   luôn có `canViewFinance=true` theo seed nên chưa lộ, nhưng sẽ lộ ngay khi Quản trị tắt quyền đó
   cho 1 tài khoản data-entry cụ thể).
3. **File `auth.ts` không phải file nóng** trong quy ước P3B, nhưng đã bị B sửa (Q6 cho phép) — nếu
   A cũng cần sửa file này, kiểm diff trước khi merge.
4. `src/i18n/messages/{vi,en}.json` có 2 nhóm mới ở CUỐI file (`financeGate`, `notifyAdmin`) + vài
   key lẻ trong nhóm `activity`/`admin` đã có sẵn — không đụng key nào của A.

## Câu hỏi cho chủ dự án

Không có câu hỏi nghiệp vụ mới phát sinh trong P3B — Q1–Q8 trong `ke-hoạch.md` đã đủ để làm hết cả
9 Task + Q6.
