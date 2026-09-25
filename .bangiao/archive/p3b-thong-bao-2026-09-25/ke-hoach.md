# P3B — Thông báo cảnh báo (webhook + email) · N-3 chặn số tiền · e2e Playwright — Kế hoạch triển khai

> Người viết: planner (skill `writing-plans`). Coder CHỈ đọc file này. Làm đúng thứ tự Task 1 → Task 9, mỗi Task = 1 commit,
> chạy cổng kiểm trước khi commit. Không làm gì ngoài phạm vi ghi ở đây.

**Mục tiêu:** (1) N-3: mọi số tiền bị chặn ở SERVER với người `canViewFinance = false` (trang, chart, API export, báo cáo).
(2) T16 phần thông báo: admin cấu hình kênh webhook/email + người nhận trong Quản trị; engine T11 mở alert mới → gửi
(không chặn luồng lưu, chống gửi trùng, thử lại có giới hạn, ghi lỗi, chống SSRF). (3) Bộ e2e Playwright cho luồng chính.

**Kiến trúc:** N-3 = hàm thuần `src/lib/finance-gate.ts` che dữ liệu TRƯỚC khi đưa vào client component / file Excel (không sửa
`queries.ts`). Thông báo = repo mới `*-repo-notify.ts` (gộp vào `repo` bằng `Object.assign`, khuôn P2B `read-prisma`) + thư mục
`src/server/notify/` (webhook, email, dispatcher) + móc vào `alert-engine.ts`/`jobs.ts`. **KHÔNG migration** (bảng
`notify_channel`, `notify_recipient`, cột `alert_log.notify*` đã có từ P2A).

**Kỹ thuật:** Next.js 14.2.35 app router (KHÔNG nâng) · Prisma 6.19 · PostgreSQL localhost:5433 DB `ddc_control_tower_b` ·
next-intl 3.26 · Vitest 2.1 (`include: src/**/*.test.ts`, node, `DDC_FAKE_TODAY=2026-09-16`) · zod 4 · exceljs 4.4 ·
`src/lib/secret-box.ts` (AES-256-GCM, env `NOTIFY_SECRET_KEY`). Gói mới (chờ Q1/Q2): `nodemailer`, `@types/nodemailer`, `@playwright/test`.

---

## ĐÃ CHỐT (chủ dự án trả lời 2026-09-25) — coder làm theo đây

- **Q1 = (a)** cài `nodemailer` (+ `@types/nodemailer` devDep) — cài qua `NODE_EXTRA_CA_CERTS` (PEM xuất từ kho CA gốc Windows), KHÔNG tắt kiểm TLS. Task 7 làm trong P3B.
- **Q2 = (a)** thêm `@playwright/test` (devDep), ưu tiên bản khớp Chromium có sẵn `chromium-1243`; không được thì `npx playwright install chromium` qua `NODE_EXTRA_CA_CERTS`. Task 9 làm trong P3B.
- **Q3 = (a)** SMTP được phép IP private (LAN); vẫn chặn loopback, link-local, metadata, 0.0.0.0, multicast. Webhook luôn chặn IP nội bộ.
- **Q4 = (a)** thông báo ra ngoài KHÔNG kèm số tiền (cảnh báo công nợ: tên dự án + loại cảnh báo + link vào app).
- **Q5 = (a)** (điều phối chốt theo đề xuất, khớp ý "liên quan đến đơn vị tiền"): SPI/CPI (tỉ số), %KH/%TT, tấn, số người/thiết bị KHÔNG phải số tiền → vẫn hiện cho mọi người.
- **Q6 = (b)** **đọc cột DB `user_roles.canViewFinance` từng người**: admin luôn xem được; role khác xem được khi cột = true (viewer mặc định false). Sửa `resolveAccess()` (`src/lib/auth.ts:30-44`) + nơi dựng session/JWT để giá trị cập nhật đúng (đổi quyền có hiệu lực ở lần đăng nhập/refresh kế tiếp — ghi rõ cơ chế); Quản trị phải có chỗ bật/tắt quyền này cho từng tài khoản (nếu chưa có thì thêm, chỉ admin; ghi audit_log). Kiểm seed: tài khoản BOD/data-entry mẫu nên có giá trị hợp lý (BOD true; data-entry theo seed hiện có — nếu seed chưa đặt thì để true để không đổi hành vi hiện tại của họ, ghi rõ). Có test phân quyền. `auth.ts` không phải file nóng; A không đụng.
- **Q7 = (a)** P3B không đụng `DataEntryForm`/`nhap-lieu` — ghi "Lưu ý cho A" trong phien-B.md: form nhập vẫn hiện/nhận số tiền cho data-entry; với Q6 mới, A nên gate phần nhập tài chính theo `canViewFinance` trong/sau P3A.
- **Q8 = (a) ĐÃ LÀM** (điều phối 2026-09-25): `.env` B `NEXTAUTH_URL=http://localhost:3001`. Coder tự thêm `NOTIFY_SECRET_KEY` (nếu chưa có) + biến `E2E_*` vào `.env` B và `.env.example` (không ghi giá trị thật vào git).

→ Mục dưới giữ để tra cứu, **không còn câu nào bỏ ngỏ**.

## CÂU HỎI CÒN BỎ NGỎ (đã trả lời — xem ĐÃ CHỐT ở trên)

Coder làm theo MẶC ĐỊNH đề xuất nếu chủ dự án chưa trả lời, TRỪ các câu ghi "CHẶN".

| # | Câu hỏi | Lựa chọn | MẶC ĐỊNH đề xuất | Chặn / đổi ở đâu |
|---|---|---|---|---|
| **Q1** | Gửi email cần gói SMTP. `package.json` **chưa có** `nodemailer`. Cho phép cài `nodemailer` + `@types/nodemailer` (devDep)? Mạng máy này chặn TLS khi tải tarball → cài bằng `NODE_EXTRA_CA_CERTS` (xuất Windows root CA ra PEM; KHÔNG tắt kiểm TLS). | (a) cài nodemailer (MIT, không phụ thuộc thêm); (b) tự viết SMTP client bằng `node:tls` (không khuyến nghị: STARTTLS/AUTH dễ sai, tốn test); (c) P3B chỉ làm webhook, email để sau | (a) | **CHẶN Task 7**. Chưa có trả lời → làm Task 8 với email trả lỗi `email_unavailable` (xem Task 7 "stub"), Task 7 làm sau khi có trả lời |
| **Q2** | E2E cần `@playwright/test` — **chưa có** trong `node_modules`; `phien-B.md` ghi "Không cài playwright vào node_modules dự án". Máy đã có sẵn Chromium của Playwright ở `%LOCALAPPDATA%\ms-playwright\chromium-1243` (do Playwright MCP tải). Cho phép thêm devDependency? | (a) thêm `@playwright/test` (devDep, ghim bản khớp chromium-1243 nếu được, không thì `npx playwright install chromium` qua `NODE_EXTRA_CA_CERTS`); (b) đặt e2e ở thư mục riêng ngoài repo có `package.json` riêng; (c) bỏ e2e khỏi P3B | (a) | **CHẶN Task 9** |
| Q3 | Máy chủ SMTP được phép là IP nội bộ (relay trong LAN công ty) không? Webhook thì luôn chặn IP nội bộ. | (a) SMTP cho phép IP private (10/8, 172.16/12, 192.168/16), vẫn chặn loopback/link-local/metadata/0.0.0.0/multicast; (b) chặn như webhook | (a) | `isBlockedSmtpIp` (Task 3) |
| Q4 | Nội dung thông báo gửi ra ngoài (webhook/email) của cảnh báo **công nợ quá hạn** (R5, message có "… tỷ") có kèm số tiền không? | (a) KHÔNG kèm: thay message bằng tên luật (`ruleTriggered`); (b) gửi nguyên văn (người nhận do admin chọn) | (a) — email/webhook có thể bị chuyển tiếp | `noticeFromAlert` (Task 3) |
| Q5 | SPI, CPI (tỉ số EV/PV, EV/AC — không có đơn vị tiền), %KH/%TT, tấn, số người/thiết bị có tính là "đơn vị tiền" không? | (a) KHÔNG — vẫn hiện cho mọi người; (b) ẩn SPI/CPI với người không có quyền tài chính | (a) | Task 1–2 chỉ chặn số có đơn vị tiền |
| Q6 | `resolveAccess()` (`src/lib/auth.ts:30-44`) đặt `canViewFinance = role !== 'viewer'`, **bỏ qua cột DB `user_roles.canViewFinance`** → thực tế chỉ viewer bị chặn; admin/BOD/data-entry luôn thấy tiền. Có sửa để đọc cột DB không? | (a) giữ như hiện tại (P3B không đụng auth); (b) đọc cột DB (fail-closed) — cần thêm UI bật/tắt quyền trong Quản trị | (a) — P3B chặn theo `user.canViewFinance` nên nếu sau này đổi (b) thì các chỗ chặn vẫn đúng | Không Task nào đụng `auth.ts` nếu (a) |
| Q7 | Form Nhập liệu (`DataEntryForm`, `nhap-lieu/page.tsx`) vẫn nhận `project.contractValue`, `fact.ac/pv/ev` và tự tính EAC/VAC cho data-entry. Hiện data-entry luôn có quyền tài chính (Q6) nên chưa lộ, nhưng đây là file A đang sửa ở P3A. | (a) P3B KHÔNG đụng; A xử lý trong/ sau P3A; (b) B sửa sau khi P3A merge | (a) | Ghi vào `phien-B.md` mục "Lưu ý cho A" |
| Q8 | `.env` của B (ngoài git) có `NEXTAUTH_URL=http://localhost:3000` (cổng của A) → đăng nhập e2e trên 3001 có thể bị chuyển sang 3000. Cho coder sửa `.env` B: `NEXTAUTH_URL=http://localhost:3001` + thêm `NOTIFY_SECRET_KEY=<32 byte base64 mới>` + biến `E2E_*`? | (a) coder sửa `.env` B; (b) chủ dự án tự sửa | (a) | Task 8 (khoá), Task 9 (e2e) |

**Quyết định kỹ thuật đã tự chốt (reviewer có thể lật):**

| # | Quyết định | Lý do |
|---|---|---|
| K1 | Chặn tiền = che dữ liệu ở server component/route TRƯỚC khi truyền cho client (`null` thay số), không chỉ ẩn thẻ. Không sửa `queries.ts`/`cache.ts` (cache dùng chung mọi user; che SAU cache). | Số không nằm trong RSC payload / file Excel; tránh file nóng |
| K2 | Người không quyền chọn sắp xếp "Giá trị" → ép về `priority` (thứ tự theo giá trị HĐ cũng là rò rỉ). | Rò gián tiếp |
| K3 | Webhook: chỉ `https:`; `http:` chỉ khi env `NOTIFY_WEBHOOK_ALLOW_HTTP=1`. Whitelist tuỳ chọn env `NOTIFY_WEBHOOK_ALLOW_HOSTS` (phẩy; `a.com` = đúng tên, `.a.com` = mọi tên con). IP nội bộ/loopback/metadata **luôn** chặn kể cả có whitelist. Phân giải DNS 1 lần, kiểm MỌI địa chỉ, rồi kết nối thẳng tới IP đã kiểm (chống DNS rebinding); không theo redirect. | SSRF |
| K4 | Gửi = "xếp hàng rồi chạy nền" (`queueAlertNotifications`, không `await`) trong tiến trình Node; timeout webhook 5 s, SMTP 5 s kết nối/10 s socket. | Không chặn luồng lưu. App sẽ chạy VPS (Node thường trú) nên promise nền chạy tiếp được |
| K5 | Chống trùng: "giành quyền" bằng `updateMany` có điều kiện `notifyAttempts = n AND notifySentAt IS NULL AND closedAt IS NULL` (+1 lần thử). `notifyChannel` = danh sách kênh đã gửi OK (`webhook:1,email:2`), lần thử lại bỏ qua kênh đã OK. `notifySentAt` chỉ ghi khi MỌI kênh đích OK. | Chạy song song / thử lại không gửi 2 lần |
| K6 | Thử lại tối đa `NOTIFY_MAX_ATTEMPTS = 3`, chỉ alert còn mở, mở trong `NOTIFY_RETRY_WINDOW_DAYS = 7` ngày, đã thử ≥ 1 lần. Chạy mỗi lần `runDueJobs` (≤ 1 lần/10 phút/tiến trình) và trong job `alerts_daily`. Alert chưa từng được xếp hàng (vd alert seed, alert mở khi chưa có kênh nào bật) **không** được gửi bù. | Không bắn hàng loạt alert cũ khi vừa bật kênh |
| K7 | `notifyError` chỉ chứa MÃ lỗi (`webhook:1=timeout; email:2=smtp_auth`), không bao giờ chứa URL/thông điệp gốc (có thể chứa bí mật). Tối đa 500 ký tự. | Không lộ bí mật qua DB/UI |
| K8 | `secretHint`: webhook = `secretHint(url)` (4 ký tự cuối); mật khẩu SMTP = `'••••••'` (không lộ ký tự nào). Host webhook (không bí mật) lưu `settings.webhookHost` để admin nhận ra kênh. | Mật khẩu ngắn không được lộ ký tự |
| K9 | Email gửi 1 thư: `to = fromAddress`, `bcc = danh sách người nhận` (không lộ danh sách). Có `smtpUser` mà không `smtpSecure` → `requireTLS: true` (không gửi mật khẩu trần). | Riêng tư + an toàn |
| K10 | Mock notify lưu trong `globalThis.__ddcNotifyMock` riêng (không thêm vào `RepoData`, không đổi `SEED_VERSION`), `repo.reset()` xoá luôn. | Tránh đụng `history.ts` (A có thể sửa seed ở P3A) |
| K11 | Schema zod của thông báo đặt ở file MỚI `src/server/validation-notify.ts` (không sửa `validation.ts`). | Giảm xung đột với A |
| K12 | E2E chạy tuần tự (1 worker) trên `http://localhost:3001`, `globalSetup` kiểm `DATABASE_URL` chứa `ddc_control_tower_b` (không thì dừng) rồi `npx prisma db seed` + xoá kênh thông báo tên bắt đầu `E2E `. | Không bao giờ ghi nhầm DB của A; dữ liệu seed lặp lại được |

---

## Ràng buộc chung (áp cho mọi Task)

- **Trước Task 1:** đọc `D:\_project\DDC_dieu-phoi\phien-A.md`; chạy `npx tsc --noEmit` + `npm test` qua PowerShell tại
  `D:\_project\DDC_Control_Tower-B` (ổ `D:` chữ hoa), ghi số test xanh làm **baseline** vào `phien-B.md`.
- Cổng kiểm mỗi Task: `npx tsc --noEmit` sạch + `npm test` xanh (≥ baseline, không xoá/skip test cũ). Task 9 thêm build:
  `$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES="D:\_project\DDC_dieu-phoi\tools\font-mock.js"; npm run build`.
- **File nóng P3B sẽ sửa:** `src/i18n/messages/vi.json`, `src/i18n/messages/en.json` (Task 1, 2, 8). Coi thêm `package.json` +
  `package-lock.json` là nóng (Task 7, 9). Trước khi sửa: kiểm `phien-A.md` không giữ, ghi vào mục "Đang giữ" của `phien-B.md`,
  commit xong thì nhả. **CẤM** đụng: `prisma/schema.prisma`, `prisma/migrations/`, `app/globals.css`, `src/server/actions.ts`,
  `src/server/repo/prisma-repo.ts`, `src/server/queries.ts`, `src/server/project-queries.ts`, `src/server/cache.ts`.
- **Không đụng file của A (P3A):** `src/components/form/*` (DataEntryForm, CreateProjectForm, …), `app/[locale]/(app)/nhap-lieu/*`,
  `src/server/validation.ts`, `src/data/seed/*`, `prisma/seed.ts`, `src/lib/auth.ts`. Chỉ thêm 1 thẻ ở `app/[locale]/(app)/admin/page.tsx`.
- i18n: 2 nhóm MỚI `financeGate`, `notifyAdmin` thêm ở **cuối** `vi.json`/`en.json` (sau nhóm `alertClose`, theo thứ tự đó).
  Không sửa key cũ. `src/i18n/messages.test.ts` kiểm vi/en khớp.
- Repo: tầng trên import `@/server/repo`; hàm repo mới có ở CẢ prisma (async) lẫn mock (sync), cùng tên/tham số/kiểu trả về.
- Server action mới: dòng 1 `'use server'`, trả `{ ok: true, ... } | { ok: false, error }`, quyền bằng `requireRoleUser(['admin'])`
  (`src/server/action-guards.ts`), ghi `logActivity` — chép khuôn `src/server/actions-master.ts`.
- Style: không thêm CSS; dùng class có sẵn (`inp`, `btn`, `btn ghost`, `tbl`, `tbl sticky`, `scroll`, `sumbar`, `sumbar bad`,
  `hintline`, `chip`, `sect`, `empty`, `kpis`, `k5`, `g2`) — chép khuôn `src/components/admin/FactoryEditor.tsx`.
- Test action: chép đầu `src/server/actions-master.test.ts` (mock `next/cache`, `@/server/repo` → mock-repo, `@/lib/session`,
  `login()`, `repo.reset()` trong `beforeEach`). Test trang: chép `src/server/projects-detail-page-finance-guard.test.ts` /
  `src/server/operation-pages-render.test.ts`. Test route Excel: chép `src/server/export-route.test.ts`.
- "Hôm nay" lấy qua `src/lib/clock.ts`; `new Date()` chỉ dùng làm timestamp.
- Không sửa `PROGRESS.md`, `.serena/memories/`. Sau mỗi commit cập nhật `phien-B.md`.
- Commit: `feat(p3b): ...` / `test(p3b): ...` / `chore(p3b): ...`, tiếng Việt KHÔNG dấu.
- Mật khẩu seed KHÔNG ghi vào file commit nào (kể cả e2e) — đọc từ `.env`.

## Bản đồ file

| File | Task | Việc |
|---|---|---|
| `src/lib/finance-gate.ts` + `.test.ts` (mới) | 1 | hàm che tiền |
| `src/components/dashboard/OverviewWidgets.tsx` | 1 | truyền/che `canViewFinance` |
| `src/components/dashboard/DrillCharts.tsx`, `charts.tsx` (`GroupBar`) | 1 | chế độ không có "Trị" |
| `src/components/dashboard/ProjectTable.tsx`, `Watchlist.tsx` | 1 | kiểu `SafeProjectSummary`, ẩn cột giá trị |
| `app/[locale]/(app)/overview/page.tsx` | 1 | truyền quyền, ép sort |
| `src/server/overview-finance-gate.test.ts` (mới) | 1 | test |
| `app/[locale]/(app)/projects/[id]/page.tsx` | 2 | che HĐ, S-curve, What-if, message alert, không nạp tài chính |
| `app/[locale]/(app)/alerts/page.tsx`, `report/page.tsx` | 2 | che |
| `app/api/export/route.ts`, `app/api/report/export/route.ts` | 2 | bỏ cột tiền |
| `src/server/projects-detail-finance-gate.test.ts`, `src/server/finance-gate-pages.test.ts`, `src/server/export-finance-gate.test.ts` (mới) | 2 | test |
| `src/lib/notify-url.ts` + test, `src/lib/notify-message.ts` + test (mới) | 3 | SSRF tĩnh, nội dung |
| `src/server/repo/types.ts` | 4 | type thông báo |
| `src/server/repo/prisma-repo-notify.ts`, `mock-repo-notify.ts` (mới), `index.ts`, `mock-repo.ts` | 4 | repo |
| `src/server/repo/prisma-repo-entry.ts`, `mock-repo-entry.ts` | 4 | `insertEngineAlertsReturningIds` |
| `src/server/repo/notify.test.ts`, `prisma-repo-notify.test.ts` (mới) | 4 | test |
| `src/server/notify/webhook.ts` + test (mới) | 5 | gửi webhook |
| `src/server/notify/dispatch.ts` + test (mới), `src/server/alert-engine.ts`, `src/server/jobs.ts` | 6 | điều phối + móc |
| `src/server/notify/email.ts` + test (mới), `package.json`, `package-lock.json` | 7 | email (Q1) |
| `src/server/validation-notify.ts`, `src/server/actions-notify.ts` + test (mới) | 8 | action admin |
| `src/components/admin/NotifyChannelEditor.tsx` (mới), `app/[locale]/(app)/admin/page.tsx`, `src/server/admin-notify-page.test.ts` (mới) | 8 | UI |
| `.env.example` | 3, 9 | env mới |
| `playwright.config.ts`, `e2e/**` (mới), `package.json`, `.gitignore`, `.env.example` | 9 | e2e (Q2) |
| `src/i18n/messages/vi.json`, `en.json` 🔥 | 1, 2, 8 | nhóm `financeGate`, `notifyAdmin` |

---

## Task 1 — N-3 phần Tổng quan: hàm che tiền + che widget

**Commit:** `feat(p3b): N-3 che so tien o Tong quan - finance-gate, Luong & Tri, bang du an, watchlist`

### 1.1 `src/lib/finance-gate.ts` (mới, thuần)

```ts
import type { ProjectSummary } from '@/server/queries';

/** ProjectSummary an toàn để đưa cho client: 3 trường tiền có thể là null (đã che). */
export type SafeProjectSummary = Omit<ProjectSummary, 'contractValue' | 'eac' | 'vac'> & {
  contractValue: number | null; eac: number | null; vac: number | null;
};
export function maskProjectSummary(s: ProjectSummary, canViewFinance: boolean): SafeProjectSummary;
  // can=false → contractValue/eac/vac = null, trường khác giữ nguyên; can=true → trả bản sao y nguyên
export function maskProjectSummaries(list: ProjectSummary[], canViewFinance: boolean): SafeProjectSummary[];

export interface GroupValueRow { key: string; tonnage: number; value: number }
export function maskGroupRows(rows: GroupValueRow[], canViewFinance: boolean): Array<{ key: string; tonnage: number; value: number | null }>;
  // can=false → value = null

export type ListSort = 'priority' | 'name' | 'value' | 'spi' | 'pctActual';
export function safeListSort(sort: ListSort, canViewFinance: boolean): ListSort; // 'value' && !can → 'priority'

/** Luật cảnh báo có số tiền trong message (R5 công nợ quá hạn). */
export function isMoneyAlert(a: { ruleCode: string | null; ruleTriggered: string }): boolean;
  // ruleCode === 'ar_overdue' HOẶC (ruleCode == null && ruleTriggered.startsWith('Công nợ quá hạn'))
export function maskAlertMessage<T extends { ruleCode: string | null; ruleTriggered: string; message: string }>(
  a: T, canViewFinance: boolean, hiddenText: string,
): T; // isMoneyAlert && !can → { ...a, message: hiddenText }; ngược lại trả a
```

Test `src/lib/finance-gate.test.ts`: summary có `contractValue 123.4, eac 150, vac -26.6` → can=false ra 3 null, `spi/cpi/pctActual/tonnage`
giữ nguyên, object gốc KHÔNG bị sửa; can=true ra bằng `toEqual` gốc; `maskGroupRows` can=false → mọi `value === null`, `tonnage` giữ;
`safeListSort('value', false) === 'priority'`, `('value', true) === 'value'`, `('spi', false) === 'spi'`; `isMoneyAlert` đúng với
`ar_overdue`, với dòng cũ `ruleCode null` + `'Công nợ quá hạn > 5% HĐ'`, sai với `spi_low`; `maskAlertMessage` thay message chỉ khi
money + !can.

### 1.2 `charts.tsx` — `GroupBar`

Props thêm `showValue?: boolean` (mặc định `true`), `data` đổi kiểu `{ key: string; tonnage: number; value: number | null }[]`.
`showValue === false`: KHÔNG vẽ `Bar dataKey="value"`, KHÔNG vẽ `Line`, KHÔNG có `YAxis yAxisId="right"`; thay bằng 1 `Bar yAxisId="left"
dataKey="tonnage" name="Lượng (tấn)" fill={c.cost}` giữ `onClick={(d) => onSelect?.(d?.key)}` + `className="cursor-pointer"` (vẫn drill được).
`showValue === true`: giữ nguyên như hiện tại.

### 1.3 `DrillCharts.tsx` — `GroupByCard`

Props thêm `showValue?: boolean` (mặc định `true`), `data` kiểu như 1.2. Tiêu đề: `showValue ? t('overview.tonnageValueByTeam', { group })
: t('financeGate.tonnageByGroup', { group })`. Truyền `showValue` xuống `GroupBar`.

### 1.4 `OverviewWidgets.tsx`

- `GroupBarCard({ month, groupBy, filters, canViewFinance }: {...; canViewFinance: boolean })` → `<GroupByCard data={maskGroupRows(data, canViewFinance)} groupBy={groupBy} showValue={canViewFinance} />`.
- `WatchlistCard({ month, filters, canViewFinance })` → `<Watchlist items={maskProjectSummaries(items, canViewFinance)} />`.
- `ProjectListCard({ ..., canViewFinance })`: gọi `loadProjectList({ ..., sort: safeListSort(sort, canViewFinance) })`;
  `<ProjectTable items={maskProjectSummaries(list.items, canViewFinance)} ... canViewFinance={canViewFinance} />`.
- `type ListSort` cục bộ bỏ, import từ `@/lib/finance-gate`. `KpiGrid`, `BacklogOverdueCard`, `SCurveCard` giữ nguyên (đã chặn ở trang).

### 1.5 `ProjectTable.tsx`, `Watchlist.tsx`

- `ProjectTable` Props: `items: SafeProjectSummary[]`, thêm `canViewFinance: boolean`. `!canViewFinance`: bỏ `<option value="value">`,
  bỏ `<th>` + `<td>` giá trị HĐ, `colSpan` hàng rỗng = 12 (có quyền: 13 như cũ).
- `Watchlist`: `items: SafeProjectSummary[]`; `reasonsOf(t, s: SafeProjectSummary)` (chỉ dùng spi/cpi/penalty — không đổi logic).

### 1.6 `overview/page.tsx`

`sort` = `safeListSort(<giá trị đọc từ URL>, canViewFinance)`; truyền `canViewFinance` cho `GroupBarCard`, `WatchlistCard`, `ProjectListCard`.

### 1.7 i18n nhóm `financeGate` (cuối file, sau `alertClose`)

| key | vi | en |
|---|---|---|
| `tonnageByGroup` | Lượng theo {group} | Tonnage by {group} |
| `tonnage` | Khối lượng HĐ | Contract tonnage |
| `alertHidden` | Cảnh báo công nợ quá hạn (số tiền chỉ hiện cho người có quyền tài chính) | Overdue receivables alert (amount shown to finance users only) |

### 1.8 Test `src/server/overview-finance-gate.test.ts` (mới)

Mock: `next-intl/server` (`getTranslations → (k) => k`, `getLocale → 'vi'`); `@/server/cache` → mọi `loadX` là `vi.fn` trả fixture
(`loadTonnageByGroup` → `[{ key: 'KD1', tonnage: 900, value: 55.5 }]`; `loadProjectList` → `{ items: [summary contractValue 123.4, eac 150, vac -26.6], total: 1, page: 1, totalPages: 1 }`;
`loadWatchlist` → `[cùng summary]`); `next/dynamic` → `() => (props) => { dynProps.push(props); return null }` (ghi props);
`./ProjectTable` và `./Watchlist` (đường dẫn `@/components/dashboard/ProjectTable|Watchlist`) → ghi props rồi trả null.
Gọi trực tiếp `await GroupBarCard({... canViewFinance})` rồi `renderToStaticMarkup`, tương tự 2 widget kia. Khẳng định:
- viewer (false): props GroupByCard có `showValue === false`, mọi `data[i].value === null`; props ProjectTable có `canViewFinance === false`,
  `items[0].contractValue/eac/vac === null`; `JSON.stringify(propsProjectTable)` không khớp `/"contractValue":\d/`; Watchlist items che tương tự;
  `ProjectListCard({ sort: 'value', canViewFinance: false })` → `loadProjectList` được gọi với `sort: 'priority'`.
- admin (true): `value === 55.5`, `contractValue === 123.4`, sort `'value'` giữ nguyên.

**Nghiệm thu Task 1:** `tsc` + `npm test` xanh; dev 3001 đăng nhập viewer: Tổng quan không còn cột "Giá trị HĐ", chart nhóm chỉ còn cột
"Lượng (tấn)" và vẫn bấm drill được; admin thấy như cũ.

---

## Task 2 — N-3 phần Chi tiết dự án, Cảnh báo, Báo cáo, Export Excel

**Commit:** `feat(p3b): N-3 che so tien o Chi tiet du an, canh bao, bao cao va file Excel`

### 2.1 `app/[locale]/(app)/projects/[id]/page.tsx`

- Trong `Promise.all`: `repo.getFinancial(id)` → `canViewFinance ? repo.getFinancial(id) : Promise.resolve([] as FactFinancial[])`
  (import type `FactFinancial` từ `@/server/repo/types`).
- Khối `.val` ở header: có quyền → như cũ; không quyền → `<div className="val"><div className="l">{t('financeGate.tonnage')}</div>
  <div className="v">{formatTon(project.tonnage)} tấn</div></div>` (không có giá trị HĐ).
- Cụm chart xu hướng: `<div className={canViewFinance ? 'g2' : ''}>`; thẻ S-curve (`detail.sCurve12`) chỉ render khi `canViewFinance`;
  `const sCurve = canViewFinance ? facts.map(...) : []` (không dựng mảng tiền khi không quyền). Thẻ SPI/CPI giữ nguyên.
- Thẻ What-if: điều kiện `latest && canViewFinance`.
- Danh sách alert: `alerts.map((a) => maskAlertMessage(a, canViewFinance, t('financeGate.alertHidden')))` trước khi render.
- KHÔNG đổi gì khác (KPI SPI/CPI/%TT, nhân lực, Gantt, chuỗi giá trị giữ nguyên — Q5).

### 2.2 `app/[locale]/(app)/alerts/page.tsx`

`open = ... .map((a) => ({ ...maskAlertMessage(a, user.canViewFinance, t('financeGate.alertHidden')), projectName: ... }))`.

### 2.3 `app/[locale]/(app)/report/page.tsx`

`const canViewFinance = user.canViewFinance`. Không quyền: bỏ `KpiCard` backlog, `Rise className="kpis k5"`; bảng bỏ `<th>`/`<td>` backlog,
`colSpan` hàng rỗng 5. Có quyền: như cũ.

### 2.4 `app/api/export/route.ts`

Sau kiểm role: `const canViewFinance = user.canViewFinance`. Cột `eac` và `value` chỉ thêm vào `ws.columns` khi `canViewFinance`;
`addRow` chỉ gán 2 trường đó khi có quyền. `sort`: `safeListSort((sp.get('sort') as ListSort) || 'priority', canViewFinance)`.

### 2.5 `app/api/report/export/route.ts`

Không quyền: sheet KPI bỏ dòng `'Backlog (tỷ)'`; sheet `DanhSachDuAn` bỏ cột `backlog` (không gán `backlog` khi addRow).

### 2.6 Test

- `src/server/projects-detail-finance-gate.test.ts` (mới, boilerplate y hệt `projects-detail-page-finance-guard.test.ts`):
  - viewer (`canViewFinance:false`, dự án 1 có trong assignment viewer): HTML không chứa `metric.contractValue`, `detail.sCurve12`,
    `whatif.title`, `detail.financial`; có `financeGate.tonnage`, `detail.spiCpi12`. `JSON.stringify(element)` không chứa `"pv":`, `"bac":`.
  - Thêm alert tiền: `repo.insertEngineAlerts([{ projectId: 1, alertType: 'Amber', ruleCode: 'ar_overdue', dedupeKey: 'ar_overdue:e2e',
    ruleTriggered: 'Công nợ quá hạn > 5% HĐ', message: 'Công nợ quá hạn 12.5 tỷ = 6.0% giá trị HĐ', owner: 'BOD', deadline: '2026-09-30',
    openedAt: new Date().toISOString() }])` → viewer: HTML chứa `financeGate.alertHidden`, không chứa `12.5 tỷ`; admin: chứa `12.5 tỷ`.
  - admin (`true`): chứa `metric.contractValue`, `detail.sCurve12`, `whatif.title`.
  - `repo.getFinancial` được spy: viewer → không được gọi.
- `src/server/finance-gate-pages.test.ts` (mới, boilerplate `operation-pages-render.test.ts`): BOD `canViewFinance:false` (giả lập) →
  ReportPage HTML không chứa `kpi.backlog`; BOD true → có. AlertsPage: props AlertList (ghi lại) với alert `ar_overdue` có
  `message === 'financeGate.alertHidden'` khi false, nguyên văn khi true.
- `src/server/export-finance-gate.test.ts` (mới, khuôn `export-route.test.ts` + `report-export-route.test.ts`): `/api/export` BOD false →
  dòng tiêu đề không có `'EAC'`, `'Giá trị HĐ (tỷ)'`, `exportProjects` gọi với `sort: 'priority'` khi `?sort=value`; admin → có 2 cột.
  `/api/report/export` BOD false → sheet KPI không có `'Backlog (tỷ)'`, sheet `DanhSachDuAn` không có tiêu đề `'Backlog (tỷ)'`; admin có.
- Rà: `npm test` phải còn xanh cả `projects-detail-page-render.test.ts`, `operation-pages-render.test.ts`, `report-export-route.test.ts`,
  `export-route.test.ts` (không sửa các test đó).

**Nghiệm thu Task 2:** `tsc` + `npm test` xanh; dev 3001 viewer mở `/vi/projects/1`: không thấy giá trị HĐ, S-curve, What-if; "View source"
không có chuỗi `"pv":`. Rà thêm bằng `Grep` `formatTyd|contractValue|revenue|\bac\b` trong `app/` và `src/components/` — mọi chỗ còn lại
phải thuộc: trang chỉ admin (`/admin`, `/audit`), form của A (Q7), hoặc đã có chặn `canViewFinance`. Ghi kết quả rà vào `thay-doi.md`.

---

## Task 3 — Thông báo: kiểm URL chống SSRF + dựng nội dung (hàm thuần)

**Commit:** `feat(p3b): thong bao - kiem URL webhook chong SSRF va dung noi dung canh bao`

### 3.1 `src/lib/notify-url.ts` (mới; chỉ dùng `node:net`)

```ts
export type WebhookUrlError = 'invalid_url' | 'bad_protocol' | 'has_credentials' | 'host_not_allowed' | 'blocked_ip' | 'too_long';
export interface WebhookPolicy { allowHttp: boolean; allowHosts: string[] }
/** NOTIFY_WEBHOOK_ALLOW_HTTP === '1'; NOTIFY_WEBHOOK_ALLOW_HOSTS tách ',', trim, lowercase, bỏ rỗng. */
export function webhookPolicyFromEnv(env?: NodeJS.ProcessEnv): WebhookPolicy;
export function hostMatchesAllowList(host: string, allow: string[]): boolean; // 'a.com' = đúng tên; '.a.com' = tên con (x.a.com), KHÔNG gồm a.com
/** Kiểm tĩnh (không DNS). */
export function checkWebhookUrl(raw: string, policy: WebhookPolicy): { ok: true; url: URL } | { ok: false; error: WebhookUrlError };
/** IP không hợp lệ → true. */
export function isBlockedIp(ip: string): boolean;
/** Q3=(a): chỉ chặn loopback, link-local (gồm 169.254.169.254), 0.0.0.0/8, ::, multicast, 255.255.255.255; cho private. */
export function isBlockedSmtpIp(ip: string): boolean;
```
Quy tắc `checkWebhookUrl` (theo thứ tự): trim; > 2048 ký tự → `too_long`; `new URL` lỗi → `invalid_url`; protocol ≠ `https:` và không
(`http:` && allowHttp) → `bad_protocol`; có `username`/`password` → `has_credentials`; hostname (bỏ `[]` của IPv6) rỗng → `invalid_url`;
là IP (`net.isIP`) và `isBlockedIp` → `blocked_ip`; hostname là `localhost` hoặc kết thúc `.localhost`, `.local`, `.internal`, `.lan` → `blocked_ip`;
`allowHosts.length > 0` và không khớp → `host_not_allowed`.
`isBlockedIp` dùng `net.BlockList`: IPv4 `0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24,
192.0.2.0/24, 192.168.0.0/16, 198.18.0.0/15, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4`; IPv6 `::/128, ::1/128, fc00::/7,
fe80::/10, ff00::/8, 2001:db8::/32`. IPv6 dạng `::ffff:a.b.c.d` / `::ffff:7f00:1` và NAT64 `64:ff9b::/96` → tách IPv4 nhúng rồi kiểm IPv4.

Test `src/lib/notify-url.test.ts`: `https://hooks.slack.com/services/X` OK; `http://x.com` → `bad_protocol` (allowHttp false), OK khi true;
`ftp://x`, `file:///etc/passwd`, `javascript:alert(1)` → `bad_protocol`; `https://u:p@x.com` → `has_credentials`; `https://127.0.0.1/`,
`https://2130706433/`, `https://0x7f.1/`, `https://[::1]/`, `https://[::ffff:127.0.0.1]/`, `https://169.254.169.254/latest/meta-data`,
`https://10.1.2.3/`, `https://192.168.1.1/`, `https://localhost/`, `https://db.internal/` → `blocked_ip`; allowHosts `['.office.com']` →
`https://x.webhook.office.com/` OK, `https://office.com/` và `https://evil.com/` → `host_not_allowed`; allowHosts có `127.0.0.1` vẫn
`blocked_ip`; chuỗi 2049 ký tự → `too_long`. `isBlockedIp('8.8.8.8') === false`, `('abc') === true`, `('64:ff9b::7f00:1') === true`.
`isBlockedSmtpIp('10.0.0.5') === false`, `('127.0.0.1') === true`, `('169.254.169.254') === true`.

### 3.2 `src/lib/notify-message.ts` (mới, thuần)

```ts
import type { AlertLog, AlertSeverity } from '@/server/repo/types';
export interface AlertNotice {
  alertId: number; projectId: number; projectName: string; severity: AlertSeverity; ruleCode: string | null;
  rule: string; message: string; deadline: string; owner: string; openedAt: string; url: string | null;
}
export function severityPasses(alert: AlertSeverity, min: AlertSeverity): boolean; // min 'Red' → chỉ Red; min 'Amber' → Red + Amber
export function alertUrl(baseUrl: string | undefined, projectId: number): string | null; // base không phải http(s) hợp lệ → null; `${base bỏ '/' cuối}/vi/projects/${id}`
/** Q4=(a): isMoneyAlert(alert) → message = alert.ruleTriggered (không số tiền). */
export function noticeFromAlert(alert: AlertLog, projectName: string, baseUrl: string | undefined): AlertNotice;
export function testNotice(baseUrl: string | undefined): AlertNotice; // alertId 0, projectId 0, projectName 'DDC Control Tower', severity 'Amber', rule 'TEST', message 'Tin nhắn thử từ DDC Control Tower', url = baseUrl hợp lệ ? base : null
export function noticeSubject(n: AlertNotice): string; // `[DDC][Đỏ] <projectName> - <rule>` ('Vàng' cho Amber); bỏ \r \n; cắt 200 ký tự
export function noticeText(n: AlertNotice): string;   // các dòng: Dự án, Mức độ, Luật, Nội dung, Người phụ trách, Hạn xử lý, Mở lúc, Link (nếu có)
export function webhookPayload(format: 'generic' | 'slack' | 'teams', n: AlertNotice): string;
  // generic: JSON {"event":"alert.opened","alert":{...AlertNotice}}; slack/teams: JSON {"text": subject + "\n" + text}
```
`.env.example` thêm cuối:
```
# Webhook thong bao: mac dinh chi https. Dat 1 de cho http (chi dung noi bo, khong khuyen nghi).
NOTIFY_WEBHOOK_ALLOW_HTTP=
# Danh sach host webhook duoc phep (phay). 'a.com' = dung ten, '.a.com' = moi ten con. Trong = moi host cong khai.
NOTIFY_WEBHOOK_ALLOW_HOSTS=
```
Test `src/lib/notify-message.test.ts`: `severityPasses` 4 tổ hợp; subject có `[DDC][Đỏ]`, message chứa `\r\nBcc: x` → subject không còn CR/LF;
`noticeFromAlert` alert `ar_overdue` → `message === ruleTriggered`, không chứa `tỷ`; alert `spi_low` giữ message; `alertUrl('javascript:x', 1) === null`,
`alertUrl('http://localhost:3001/', 5) === 'http://localhost:3001/vi/projects/5'`; `webhookPayload('slack', n)` parse ra `{ text }`;
`'generic'` có `alert.alertId`.

**Nghiệm thu Task 3:** `tsc` + `npm test` xanh.

---

## Task 4 — Thông báo: repo kênh/người nhận + trạng thái gửi của alert

**Commit:** `feat(p3b): thong bao - repo kenh, nguoi nhan va trang thai gui alert (prisma + mock)`

### 4.1 `src/server/repo/types.ts` (thêm vào khối "Nền thông báo P3B", không sửa type cũ)

- `NotifyChannelSettings` thêm `webhookHost?: string; // host webhook (không bí mật) để admin nhận ra kênh`.
- Sửa comment dòng 433 thành `// ---- Thông báo P3B (kênh/người nhận) ----`.
- Thêm:
```ts
/** undefined = giữ bí mật cũ; null = xoá; object = thay (đã mã hoá ở tầng action). */
export interface NotifyChannelInput {
  id?: number; kind: NotifyKind; name: string; isEnabled: boolean; minSeverity: AlertSeverity;
  settings: NotifyChannelSettings; secret?: { enc: string; hint: string } | null;
}
export interface NotifyRecipientInput { id?: number; channelId: number; email: string; minSeverity: AlertSeverity; isEnabled: boolean }
/** CHỈ dùng trong server (dispatcher) - không bao giờ truyền cho client. */
export interface NotifyChannelForSend extends NotifyChannel { secretEnc: string | null; recipients: NotifyRecipient[] }
export interface NotifyFinish { sentChannels: string | null; sentAt: string | null; error: string | null }
```

### 4.2 Hàm repo (prisma async ở `prisma-repo-notify.ts` → `export const notifyRepoPrisma = {...}`; mock sync ở `mock-repo-notify.ts` →
`export function makeNotifyMockRepo(deps: { getData: () => RepoData; persist: () => void })` + `export function resetNotifyMock(): void`)

```ts
listNotifyChannels(): NotifyChannel[]                       // id tăng dần; hasSecret = secretEnc != null; KHÔNG có secretEnc
getNotifyRecipients(channelId?: number): NotifyRecipient[]   // sắp channelId, email
saveNotifyChannel(input: NotifyChannelInput, by: string): { id: number } | 'not_found'
deleteNotifyChannel(id: number, by: string): boolean         // xoá luôn người nhận (prisma: onDelete Cascade; mock: lọc tay)
saveNotifyRecipient(input: NotifyRecipientInput, by: string): { id: number } | 'not_found' | 'duplicate' | 'wrong_kind'
  // email lowercase trim; not_found = kênh không có (hoặc id người nhận không có); wrong_kind = kênh không phải email;
  // duplicate = trùng (channelId, email) với dòng KHÁC (prisma: bắt P2002)
deleteNotifyRecipient(id: number, by: string): boolean
getChannelsForSend(opts: { onlyEnabled: boolean; ids?: number[] }): NotifyChannelForSend[] // kèm recipients của kênh
getAlertsByIds(ids: number[]): AlertLog[]
getAlertsForNotifyRetry(maxAttempts: number, openedSinceIso: string, limit: number): AlertLog[]
  // closedAt null, notifySentAt null, 1 <= notifyAttempts < maxAttempts, openedAt >= openedSinceIso, openedAt tăng dần, take limit
claimAlertNotify(id: number, expectedAttempts: number): boolean
  // prisma: updateMany where { id, notifyAttempts: expectedAttempts, notifySentAt: null, closedAt: null } data { notifyAttempts: { increment: 1 } } → count === 1
finishAlertNotify(id: number, r: NotifyFinish): void         // ghi notifyChannel = r.sentChannels, notifySentAt, notifyError (cắt 500)
```
- Audit (`audit()` có sẵn: prisma `./prisma-repo-entry`, mock `./mock-repo-entry`): bảng `notify_channel` field `create|update|delete`,
  old/new = `JSON.stringify({ kind, name, isEnabled, minSeverity, settings })`; khi `secret` thay/xoá thêm 1 dòng field `secret`,
  newValue = `hint` hoặc `'(xoá)'`. Bảng `notify_recipient` field `create|update|delete`, giá trị = `email/minSeverity/isEnabled`.
  **Không bao giờ** ghi `secretEnc` hay bí mật gốc vào audit.
- Prisma `settings` (Json) → `NotifyChannelSettings` qua helper nội bộ `parseSettings(json)`: chỉ lấy đúng 7 khoá đã khai, sai kiểu thì bỏ.
- Prisma `getAlertsByIds`/`getAlertsForNotifyRetry`: tự map row → `AlertLog` bằng helper nội bộ `toAlertLog` trong file này
  (giống `prisma-repo.ts:339-363`, KHÔNG import/sửa `prisma-repo.ts`).
- Mock: kho `globalThis.__ddcNotifyMock ??= { channels: [] as Array<NotifyChannel & { secretEnc: string | null }>, recipients: [] as NotifyRecipient[] }`;
  alert đọc/ghi qua `getData().alerts`; `resetNotifyMock()` xoá kho.

### 4.3 Gộp vào `repo`

- `src/server/repo/index.ts`: `import { notifyRepoPrisma } from './prisma-repo-notify';` và `export const repo = Object.assign(prismaRepo, readRepoPrisma, notifyRepoPrisma);`.
- `src/server/repo/mock-repo.ts`: import `{ makeNotifyMockRepo, resetNotifyMock } from './mock-repo-notify'`; trong `reset()` thêm dòng đầu
  `resetNotifyMock();`; cuối file thêm `Object.assign(repo, makeNotifyMockRepo({ getData, persist }));`.

### 4.4 `insertEngineAlertsReturningIds` (file `prisma-repo-entry.ts`, `mock-repo-entry.ts`)

Thêm `insertEngineAlertsReturningIds(rows: NewEngineAlert[]): number[]` (prisma: `Promise<number[]>`) = thân hiện tại của `insertEngineAlerts`
nhưng gom `id` dòng tạo mới (prisma: `const row = await prisma.alertLog.create(...)` → `row.id`). `insertEngineAlerts` đổi thành gọi hàm mới
và trả `.length` (hành vi cũ giữ nguyên, test cũ không sửa).

### 4.5 Test

- `src/server/repo/notify.test.ts` (mới, mock-repo, `repo.reset()` mỗi test): tạo kênh webhook `{ secret: { enc: 'v1:a:b:c', hint: '••••1234' } }` →
  `listNotifyChannels()[0]` có `hasSecret true`, `secretHint '••••1234'`, **không có khoá `secretEnc`** (`'secretEnc' in x === false`) và
  `JSON.stringify(list)` không chứa `v1:`; sửa kênh với `secret` undefined → vẫn giữ `hasSecret`; `secret: null` → `hasSecret false`;
  `saveNotifyChannel({ id: 999, ... })` → `'not_found'`; người nhận: thêm `A@X.COM ` → lưu `a@x.com`; thêm lại `a@x.com` → `'duplicate'`;
  thêm vào kênh webhook → `'wrong_kind'`; xoá kênh → người nhận của kênh biến mất; audit có dòng `notify_channel`/`secret` với newValue
  `'••••1234'` và không dòng audit nào chứa `v1:`; `claimAlertNotify(id, 0)` lần 1 true, lần 2 (vẫn expected 0) false; alert đã đóng → false;
  `finishAlertNotify` ghi đủ 3 cột; `getAlertsForNotifyRetry(3, since, 10)` chỉ trả alert `attempts` 1–2, mở, chưa gửi, trong cửa sổ;
  `repo.reset()` xoá kho kênh; `insertEngineAlertsReturningIds` trả mảng id có trong `getAlerts()`, gọi lại lần 2 trả `[]`.
- `src/server/repo/prisma-repo-notify.test.ts` (mới, mock `@/server/db` theo `src/server/repo/prisma-repo-save.test.ts`):
  `claimAlertNotify` gọi `alertLog.updateMany` đúng `where`/`data` như 4.2; `listNotifyChannels` dùng `select` KHÔNG có `secretEnc`
  (hoặc map bỏ — khẳng định kết quả không có khoá này); `parseSettings({ smtpPort: 'x', evil: 1 })` → `{}`.

**Nghiệm thu Task 4:** `tsc` + `npm test` xanh (gồm test cũ `entry.test.ts` về `insertEngineAlerts`).

---

## Task 5 — Thông báo: gửi webhook (ghim IP đã kiểm, timeout)

**Commit:** `feat(p3b): thong bao - gui webhook ghim IP da kiem, timeout 5s, khong theo redirect`

`src/server/notify/types.ts` (mới):
```ts
export type NotifyErrorCode =
  | 'invalid_url' | 'bad_protocol' | 'has_credentials' | 'host_not_allowed' | 'blocked_ip' | 'too_long'
  | 'dns_failed' | 'timeout' | 'conn_failed' | `http_${number}`
  | 'secret_missing' | 'secret_key_missing' | 'secret_decrypt_failed'
  | 'no_recipients' | 'smtp_auth' | 'smtp_conn' | 'smtp_rejected' | 'email_unavailable' | 'bad_config';
export type SendResult = { ok: true } | { ok: false; error: NotifyErrorCode };
export type LookupFn = (host: string) => Promise<Array<{ address: string; family: number }>>;
```

`src/server/notify/webhook.ts` (mới):
```ts
export const WEBHOOK_TIMEOUT_MS = 5000;
export interface WebhookDeps {
  lookup?: LookupFn;                                   // mặc định: dns.promises.lookup(host, { all: true, verbatim: true })
  request?: typeof import('node:https').request;        // test tiêm; mặc định theo protocol: node:https.request / node:http.request
  policy?: WebhookPolicy;                              // mặc định webhookPolicyFromEnv()
  timeoutMs?: number;
}
export async function sendWebhook(rawUrl: string, body: string, deps?: WebhookDeps): Promise<SendResult>; // KHÔNG throw
```
Luồng: `checkWebhookUrl` (lỗi → trả mã đó) → host là IP thì dùng luôn, không thì `lookup` (lỗi/rỗng → `dns_failed`; **bất kỳ** địa chỉ nào
`isBlockedIp` → `blocked_ip`) → lấy địa chỉ đầu → `request({ host: <IP>, port: url.port || (https ? 443 : 80), path: url.pathname + url.search,
method: 'POST', servername: <hostname> (chỉ https và host không phải IP), agent: false, headers: { Host: url.host, 'Content-Type':
'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'DDC-Control-Tower/1' } })` → hẹn giờ `timeoutMs` hết thì
`req.destroy()` → `timeout`; lỗi socket → `conn_failed`; phản hồi: `res.resume()` (bỏ body); 200–299 → ok; khác (gồm 3xx) → `http_<status>`.
`body` > 16 384 byte → `bad_config`. **Không** `console.log` URL.

Test `src/server/notify/webhook.test.ts` (tiêm `lookup` + `request` giả, không ra mạng): URL `https://127.0.0.1/x` → `blocked_ip` và
`request` KHÔNG được gọi; lookup trả `[{8.8.8.8},{10.0.0.1}]` → `blocked_ip`; lookup ném → `dns_failed`; lookup `[93.184.216.34]` +
request giả trả 204 → ok và `request` nhận `host '93.184.216.34'`, `servername 'example.com'`, `headers.Host 'example.com'`; trả 302 →
`http_302`; request không bao giờ phản hồi + `timeoutMs 50` → `timeout`; request emit `error` → `conn_failed`.

**Nghiệm thu Task 5:** `tsc` + `npm test` xanh.

---

## Task 6 — Thông báo: điều phối gửi + móc vào engine T11 và job

**Commit:** `feat(p3b): thong bao - dieu phoi gui khi engine mo alert moi, chong trung, thu lai toi da 3 lan`

`src/server/notify/email.ts` — nếu Task 7 CHƯA làm, tạo tạm (stub) để Task 6/8 biên dịch:
```ts
export interface SmtpConfig { host: string; port: number; secure: boolean; user: string | null; pass: string | null; from: string }
export async function sendEmail(cfg: SmtpConfig, to: string[], subject: string, text: string): Promise<SendResult> {
  return { ok: false, error: 'email_unavailable' };
}
```

`src/server/notify/dispatch.ts` (mới):
```ts
export const NOTIFY_MAX_ATTEMPTS = 3;
export const NOTIFY_RETRY_WINDOW_DAYS = 7;
export const NOTIFY_RETRY_BATCH = 50;
export interface DispatchDeps { sendWebhook?: typeof sendWebhook; sendEmail?: typeof sendEmail; baseUrl?: string }
export interface DispatchStats { sent: number; failed: number; skipped: number }
export async function dispatchAlertNotifications(alertIds: number[], deps?: DispatchDeps): Promise<DispatchStats>; // KHÔNG throw
export async function retryPendingNotifications(deps?: DispatchDeps): Promise<DispatchStats>;                   // KHÔNG throw
/** Gửi 1 kênh (dùng cho cả gửi thật lẫn "Gửi thử"). severityFilter=false: bỏ lọc mức độ người nhận (Gửi thử). */
export async function sendToChannel(ch: NotifyChannelForSend, n: AlertNotice, deps?: DispatchDeps, severityFilter?: boolean): Promise<SendResult>;
/** Xếp hàng chạy nền, nối tiếp nhau trong tiến trình; KHÔNG throw, KHÔNG await được từ ngoài. */
export function queueAlertNotifications(alertIds: number[]): void;
export function __notifyQueueIdleForTest(): Promise<void>;
```
- `baseUrl` mặc định `process.env.NEXTAUTH_URL`.
- `sendToChannel`: webhook → `secretEnc` null → `secret_missing`; `openSecret` ném `secret_key_missing` → mã đó, lỗi khác → `secret_decrypt_failed`;
  → `sendWebhook(url, webhookPayload(settings.webhookFormat ?? 'generic', n))`. Email → người nhận `isEnabled` (+ `severityPasses(n.severity, r.minSeverity)`
  khi `severityFilter` true, mặc định true); rỗng → `no_recipients`; `settings.smtpHost`/`fromAddress` thiếu → `bad_config`; mật khẩu = `secretEnc ? openSecret : null`
  → `sendEmail({ host, port: smtpPort ?? 587, secure: smtpSecure ?? false, user: smtpUser || null, pass, from: fromAddress }, emails, noticeSubject(n), noticeText(n))`.
- Xử lý 1 alert (dùng chung cho 2 hàm trên): bỏ qua (`skipped`) nếu `closedAt` / `notifySentAt` / `notifyAttempts >= MAX`; kênh đích =
  kênh bật có `severityPasses(alert.alertType, ch.minSeverity)`, chưa có trong `alert.notifyChannel` (tách `,`), với email phải còn ≥ 1 người nhận
  qua lọc mức độ; không có đích → `skipped` (không ghi gì); `claimAlertNotify(id, alert.notifyAttempts)` false → `skipped`; gửi lần lượt từng
  kênh (`noticeFromAlert(alert, project?.projectName ?? '-', baseUrl)`); gộp `sentChannels` cũ + mới OK; `finishAlertNotify(id, { sentChannels: tập ?
  join(',') : null, sentAt: mọi đích OK ? new Date().toISOString() : null, error: mọi đích OK ? null : 'webhook:1=timeout; email:2=smtp_auth' })`
  → `sent` hoặc `failed`. Mọi ngoại lệ: `console.error('[notify] loi alert', id)` (KHÔNG in URL/bí mật) + tính `failed`.
- `retryPendingNotifications`: `repo.getAlertsForNotifyRetry(MAX, addDays(now, -7) ISO, NOTIFY_RETRY_BATCH)` rồi xử lý như trên.
- Kênh lấy bằng `repo.getChannelsForSend({ onlyEnabled: true })` 1 lần mỗi lượt; không có kênh bật → trả ngay `{0,0,alertIds.length}`.

Móc:
- `src/server/alert-engine.ts`: `runAlertEngine` dùng `repo.insertEngineAlertsReturningIds`, trả `{ checked, created, createdIds }`
  (`created = createdIds.length`); ngay sau khi insert: `if (createdIds.length) queueAlertNotifications(createdIds);`. `runAlertEngineSafe` giữ nguyên.
- `src/server/jobs.ts`: nhánh `alerts_daily` sau `runAlertEngine`: `await retryPendingNotifications();` (detail giữ nguyên `checked=.. created=..`);
  `runDueJobs`: trong `try`, sau 2 khối `if`, thêm `await retryPendingNotifications();`.

Test `src/server/notify/dispatch.test.ts` (mới, mock-repo; tiêm `sendWebhook`/`sendEmail` giả; đặt/xoá `process.env.NOTIFY_SECRET_KEY` = khoá 32 byte
base64 ở `beforeEach/afterEach`; bí mật tạo bằng `sealSecret`):
- 1 kênh webhook bật `minSeverity 'Amber'` + alert mới Red → `sent 1`; alert có `notifySentAt`, `notifyChannel 'webhook:<id>'`, `notifyAttempts 1`, `notifyError null`;
  gọi `dispatchAlertNotifications` lần 2 cùng id → `skipped 1`, sender không bị gọi thêm.
- Kênh `minSeverity 'Red'` + alert Amber → `skipped`, `notifyAttempts` vẫn 0.
- Sender trả `timeout` → `failed 1`, `notifyError === 'webhook:<id>=timeout'`, `notifySentAt null`, attempts 1; `retryPendingNotifications` lần 2, 3 →
  attempts 3; lần 4 → sender không bị gọi.
- 2 kênh (webhook OK, email lỗi) → `notifyChannel 'webhook:<id>'`, sentAt null; lần thử lại chỉ gọi email.
- Alert đóng trước khi gửi → skipped. Alert seed (attempts 0) KHÔNG nằm trong `retryPendingNotifications`.
- `secretEnc` hỏng → `notifyError` chứa `secret_decrypt_failed`, không chứa `v1:`.
- `sendToChannel` email với 0 người nhận → `no_recipients`; `severityFilter false` + người nhận `minSeverity 'Red'` + notice Amber → vẫn gửi.
- Engine: tạo kênh webhook bật, giả dữ liệu để `runAlertEngine({ projectIds: [1] })` tạo alert mới (khuôn `alert-engine.test.ts:40-50`), `vi.mock`
  `@/server/notify/webhook` trả ok → `await __notifyQueueIdleForTest()` → alert mới có `notifySentAt`. `runAlertEngineSafe` với sender ném lỗi vẫn resolve.
- `jobs.test.ts` cũ phải xanh nguyên văn (regex `^checked=\d+ created=\d+$`).

**Nghiệm thu Task 6:** `tsc` + `npm test` xanh.

---

## Task 7 — Thông báo: gửi email SMTP (CHỜ Q1)

**Commit:** `feat(p3b): thong bao - gui email SMTP bang nodemailer, timeout, requireTLS khi co mat khau`

- Q1=(a): ghi `package.json`/`package-lock.json` vào "Đang giữ"; cài bằng PowerShell: xuất CA gốc Windows (`Cert:\LocalMachine\Root`,
  `Cert:\CurrentUser\Root`, `Cert:\LocalMachine\CA`) ra PEM ở thư mục scratch, `$env:NODE_EXTRA_CA_CERTS=<pem>; npm install nodemailer@<X> ; npm install -D @types/nodemailer`
  với `<X>` = bản mới nhất lấy bằng `npm view nodemailer version` (ghi `^<X>` vào package.json). CẤM `NODE_TLS_REJECT_UNAUTHORIZED=0` / `strict-ssl=false`.
- `src/server/notify/email.ts` thay stub:
```ts
export const SMTP_CONNECT_TIMEOUT_MS = 5000;
export const SMTP_SOCKET_TIMEOUT_MS = 10000;
export interface EmailDeps {
  createTransport?: (opts: Record<string, unknown>) => { sendMail(m: Record<string, unknown>): Promise<{ accepted: unknown[]; rejected: unknown[] }> };
  lookup?: LookupFn;
}
export async function sendEmail(cfg: SmtpConfig, to: string[], subject: string, text: string, deps?: EmailDeps): Promise<SendResult>; // KHÔNG throw
```
  Luồng: `to` rỗng → `no_recipients`; host là IP thì kiểm `isBlockedSmtpIp`, không thì `lookup` (lỗi → `dns_failed`; bất kỳ địa chỉ `isBlockedSmtpIp` →
  `blocked_ip`); `createTransport` mặc định = `(await import('nodemailer')).createTransport`; tuỳ chọn: `{ host, port, secure, auth: user ? { user, pass: pass ?? '' } : undefined,
  requireTLS: !secure && !!user, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000, tls: { minVersion: 'TLSv1.2' } }`;
  thư: `{ from, to: from, bcc: to, subject, text }`; `accepted.length === 0` → `smtp_rejected`; lỗi `code`: `EAUTH` → `smtp_auth`, `ETIMEDOUT` → `timeout`,
  `EENVELOPE` → `smtp_rejected`, khác → `smtp_conn`.
- Nếu `npm run build` (Task 9) lỗi do bundle nodemailer: thêm `experimental: { serverComponentsExternalPackages: ['nodemailer'] }` vào `next.config.mjs`
  (giữ khoá ngắn, commit riêng `chore(p3b): ...`).
- Test `src/server/notify/email.test.ts` (tiêm `createTransport` giả): tuỳ chọn truyền vào có `requireTLS true` khi có user + `secure false`, `auth undefined` khi không user;
  thư có `bcc` = danh sách, `to` = from; lỗi `{ code: 'EAUTH' }` → `smtp_auth`; `accepted: []` → `smtp_rejected`; host `127.0.0.1` → `blocked_ip` và transport không tạo;
  host `10.0.0.5` → được gửi (Q3=a).

**Nghiệm thu Task 7:** `tsc` + `npm test` xanh; `package.json` chỉ thêm đúng 2 gói.

---

## Task 8 — Thông báo: action + UI Quản trị (CRUD kênh, người nhận, bật/tắt, Gửi thử)

**Commit:** `feat(p3b): thong bao - Quan tri CRUD kenh webhook/email, nguoi nhan, bat tat va Gui thu`

### 8.1 `src/server/validation-notify.ts` (mới, zod)

```ts
export const notifyChannelSchema // z.discriminatedUnion('kind', [...]) - chung: id?: int>0; name: trim 1..80; isEnabled: boolean; minSeverity: 'Red'|'Amber';
  //   secret?: string (trim, max 2048; '' = không đổi); clearSecret?: boolean
  // webhook: webhookFormat: 'generic'|'slack'|'teams' (mặc định 'generic')
  // email: smtpHost: trim 1..253, regex /^[A-Za-z0-9.-]+$/ hoặc IP hợp lệ; smtpPort: int 1..65535; smtpSecure: boolean;
  //        smtpUser: trim max 254 ('' = không auth); fromAddress: z.email() max 254
export const notifyRecipientSchema // { id?: int>0; channelId: int>0; email: z.email() trim lowercase max 254; minSeverity; isEnabled }
export const idSchema // int > 0
```

### 8.2 `src/server/actions-notify.ts` (mới, `'use server'`, mọi action `requireRoleUser(['admin'])`, null → `Forbidden`)

```ts
type ChannelErr = 'Forbidden' | 'Invalid input' | 'Not found' | 'secret_key_missing' | 'secret_required' | 'blocked_ip' | WebhookUrlError;
export async function saveNotifyChannelAction(input: unknown): Promise<{ ok: true; id: number } | { ok: false; error: ChannelErr }>;
export async function setNotifyChannelEnabledAction(id: number, isEnabled: boolean): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'secret_required' }>;
export async function deleteNotifyChannelAction(id: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }>;
export async function saveNotifyRecipientAction(input: unknown): Promise<{ ok: true; id: number } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'duplicate' | 'wrong_kind' }>;
export async function deleteNotifyRecipientAction(id: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }>;
export async function testNotifyChannelAction(id: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'rate_limited' | NotifyErrorCode }>;
```
`saveNotifyChannelAction` theo thứ tự: quyền → zod → nếu `id`: kênh phải có (`listNotifyChannels`), `kind` không đổi (đổi → `Invalid input`) →
bí mật: `secret` khác rỗng: webhook `checkWebhookUrl(secret, webhookPolicyFromEnv())` lỗi → trả mã; `!hasSecretKey()` → `secret_key_missing`;
`{ enc: sealSecret(secret), hint: kind === 'webhook' ? secretHint(secret) : '••••••' }`; `clearSecret` (chỉ email) → `null`; còn lại `undefined` →
`settings`: webhook `{ webhookFormat, webhookHost: <hostname của URL mới, hoặc giữ settings cũ nếu không đổi URL> }`; email `{ smtpHost, smtpPort, smtpSecure,
smtpUser: smtpUser || undefined, fromAddress }` (smtpHost là IP và `isBlockedSmtpIp` hoặc = `localhost` → `blocked_ip`) → kiểm `secret_required`:
bật mà (webhook không có bí mật sau lưu) hoặc (email có `smtpUser` mà không có mật khẩu sau lưu) → lỗi → `repo.saveNotifyChannel` →
`logActivity(user, 'notify_channel_save', String(id))` (KHÔNG ghi bí mật). `setNotifyChannelEnabledAction` kiểm `secret_required` y như trên.
`testNotifyChannelAction`: `rateLimit(\`notify-test:${user.email}\`, 5, 60_000)` không ok → `rate_limited`; kênh từ `getChannelsForSend({ onlyEnabled: false, ids: [id] })`
(kể cả đang tắt); `sendToChannel(ch, testNotice(process.env.NEXTAUTH_URL), undefined, false)`; `logActivity(user, 'notify_test', \`${id}:${ok ? 'ok' : error}\`)`.
Không ghi `alert_log`. Không action nào trả `secretEnc`/bí mật.

### 8.3 `src/components/admin/NotifyChannelEditor.tsx` (mới, client; khuôn `FactoryEditor.tsx`)

Props: `{ channels: NotifyChannel[]; recipients: NotifyRecipient[]; secretKeyReady: boolean }`.
- `!secretKeyReady` → `<p className="sumbar bad">{t('notifyAdmin.keyMissing')}</p>` ở đầu (vẫn hiển thị danh sách).
- `<p className="hintline">{t('notifyAdmin.hint')}</p>`.
- Bảng kênh (`tbl sticky` trong `scroll` maxHeight 320): tên · loại · mức tối thiểu · bí mật (`secretHint` hoặc `-`; webhook kèm `settings.webhookHost`) ·
  trạng thái (nút bật/tắt → `setNotifyChannelEnabledAction`) · nút Sửa / Gửi thử / Xoá (`window.confirm(t('notifyAdmin.confirmDelete', { name }))`).
  Không kênh → `<p className="empty">{t('notifyAdmin.empty')}</p>`.
- Form thêm/sửa (1 form, nút "Thêm kênh" mở form trống, "Sửa" nạp kênh): loại (`select`, khoá khi sửa), tên, mức tối thiểu (`sevRed`/`sevAmber`), ô "Bật";
  webhook: URL (`type="password"`, `autoComplete="off"`, không bao giờ điền sẵn; khi sửa kênh có bí mật: placeholder `t('notifyAdmin.secretKeep', { hint })`),
  định dạng; email: host, cổng (mặc định 587), ô "SSL/TLS ngay", tài khoản, mật khẩu (`type="password"`, cùng quy tắc placeholder), địa chỉ gửi, ô "Xoá mật khẩu" (chỉ khi đang có).
  Lưu → `saveNotifyChannelAction` → OK: đóng form + `router.refresh()`; lỗi → `sumbar bad`.
- Kênh email: dưới mỗi dòng kênh là bảng người nhận (email · mức · bật/tắt · Xoá có confirm) + dòng thêm (email, mức, nút "Thêm người nhận").
- "Gửi thử": nút bị khoá trong lúc chờ; OK → `<p className="sumbar">{t('notifyAdmin.testOk')}</p>`; lỗi → thông báo lỗi.
- Ánh xạ lỗi: `'Forbidden'` → `err.forbidden`; `'Invalid input'` → `err.invalid`; `'Not found'` → `err.not_found`; mã bắt đầu `http_` →
  `t('notifyAdmin.err.http', { status })`; mã có trong nhóm `err` → `t(\`notifyAdmin.err.${code}\`)`; còn lại → `err.generic` `{ msg: code }`.
- Sau khi lưu xong, xoá sạch state ô bí mật (không giữ bí mật trong state).

### 8.4 `app/[locale]/(app)/admin/page.tsx`

Thêm import `NotifyChannelEditor`, `hasSecretKey` (`@/lib/secret-box`), `IconAlert` (đã có trong `@/components/icons`). Thêm thẻ NGAY SAU thẻ `fxRates`:
```tsx
<Card className="overflow-visible">
  <CardHeader title={t('notifyAdmin.title')} action={<IconAlert size={18} />} />
  <CardBody>
    <NotifyChannelEditor channels={await repo.listNotifyChannels()} recipients={await repo.getNotifyRecipients()} secretKeyReady={hasSecretKey()} />
  </CardBody>
</Card>
```

### 8.5 i18n nhóm `notifyAdmin` (cuối file, sau `financeGate`)

| key | vi | en |
|---|---|---|
| `title` | Kênh thông báo cảnh báo | Alert notification channels |
| `hint` | Gửi khi hệ thống mở cảnh báo mới. URL webhook và mật khẩu SMTP được mã hoá, không hiển thị lại. | Sent when a new alert opens. Webhook URLs and SMTP passwords are encrypted and never shown again. |
| `keyMissing` | Máy chủ chưa cấu hình NOTIFY_SECRET_KEY — chưa lưu được URL webhook / mật khẩu SMTP. | NOTIFY_SECRET_KEY is not configured on the server — webhook URLs / SMTP passwords cannot be saved. |
| `empty` | Chưa có kênh nào. | No channels yet. |
| `name` | Tên kênh | Channel name |
| `kind` | Loại | Type |
| `kindWebhook` | Webhook | Webhook |
| `kindEmail` | Email | Email |
| `minSeverity` | Mức tối thiểu | Minimum severity |
| `sevRed` | Chỉ Đỏ | Red only |
| `sevAmber` | Vàng và Đỏ | Amber and Red |
| `status` | Trạng thái | Status |
| `enabled` | Đang bật | On |
| `disabled` | Đang tắt | Off |
| `enable` | Bật | Enable |
| `disable` | Tắt | Disable |
| `secret` | Bí mật | Secret |
| `webhookUrl` | URL webhook | Webhook URL |
| `webhookFormat` | Định dạng | Format |
| `fmtGeneric` | JSON chung | Generic JSON |
| `fmtSlack` | Slack | Slack |
| `fmtTeams` | Microsoft Teams | Microsoft Teams |
| `smtpHost` | Máy chủ SMTP | SMTP host |
| `smtpPort` | Cổng | Port |
| `smtpSecure` | SSL/TLS ngay từ đầu (cổng 465) | Implicit SSL/TLS (port 465) |
| `smtpUser` | Tài khoản SMTP | SMTP username |
| `smtpPass` | Mật khẩu SMTP | SMTP password |
| `fromAddress` | Địa chỉ gửi | From address |
| `secretKeep` | Để trống = giữ nguyên ({hint}) | Leave blank to keep ({hint}) |
| `secretClear` | Xoá mật khẩu đã lưu | Remove saved password |
| `add` | Thêm kênh | Add channel |
| `edit` | Sửa | Edit |
| `save` | Lưu | Save |
| `cancel` | Huỷ | Cancel |
| `delete` | Xoá | Delete |
| `confirmDelete` | Xoá kênh {name}? Người nhận của kênh cũng bị xoá. | Delete channel {name}? Its recipients are deleted too. |
| `test` | Gửi thử | Send test |
| `testOk` | Đã gửi thử thành công. | Test message sent. |
| `recipients` | Người nhận | Recipients |
| `recipientEmail` | Email người nhận | Recipient email |
| `addRecipient` | Thêm người nhận | Add recipient |
| `noRecipients` | Chưa có người nhận. | No recipients yet. |
| `confirmDeleteRecipient` | Xoá người nhận {email}? | Remove recipient {email}? |
| `err.forbidden` | Chỉ admin được cấu hình thông báo. | Only admins can configure notifications. |
| `err.invalid` | Dữ liệu không hợp lệ. | Invalid input. |
| `err.not_found` | Không tìm thấy kênh / người nhận. | Channel / recipient not found. |
| `err.secret_key_missing` | Chưa cấu hình NOTIFY_SECRET_KEY — không mã hoá được bí mật. | NOTIFY_SECRET_KEY is missing — cannot encrypt the secret. |
| `err.secret_required` | Cần nhập URL webhook / mật khẩu SMTP trước khi bật kênh. | Enter the webhook URL / SMTP password before enabling. |
| `err.secret_missing` | Kênh chưa có URL webhook. | Channel has no webhook URL. |
| `err.secret_decrypt_failed` | Không giải mã được bí mật (khoá đã đổi?) — nhập lại. | Cannot decrypt the secret (key changed?) — enter it again. |
| `err.invalid_url` | URL không hợp lệ. | Invalid URL. |
| `err.bad_protocol` | Chỉ chấp nhận URL https. | Only https URLs are allowed. |
| `err.has_credentials` | URL không được chứa tài khoản/mật khẩu. | URL must not contain credentials. |
| `err.host_not_allowed` | Máy chủ này không nằm trong danh sách được phép. | This host is not in the allow list. |
| `err.blocked_ip` | Địa chỉ trỏ vào mạng nội bộ — bị chặn. | Address points to an internal network — blocked. |
| `err.too_long` | URL quá dài. | URL too long. |
| `err.duplicate` | Email này đã có trong kênh. | This email is already in the channel. |
| `err.wrong_kind` | Chỉ kênh email mới có người nhận. | Only email channels have recipients. |
| `err.dns_failed` | Không phân giải được tên máy chủ. | Could not resolve host. |
| `err.timeout` | Quá thời gian chờ phản hồi. | Timed out. |
| `err.conn_failed` | Không kết nối được. | Connection failed. |
| `err.http` | Máy nhận trả mã {status}. | Receiver returned status {status}. |
| `err.no_recipients` | Kênh chưa có người nhận đang bật. | Channel has no active recipients. |
| `err.smtp_auth` | SMTP từ chối đăng nhập. | SMTP authentication failed. |
| `err.smtp_conn` | Lỗi kết nối SMTP. | SMTP connection error. |
| `err.smtp_rejected` | SMTP từ chối người nhận. | SMTP rejected the recipients. |
| `err.email_unavailable` | Chưa bật gửi email trên máy chủ. | Email sending is not available on the server. |
| `err.bad_config` | Cấu hình kênh chưa đủ. | Channel configuration is incomplete. |
| `err.rate_limited` | Gửi thử quá nhiều — chờ 1 phút. | Too many tests — wait a minute. |
| `err.generic` | Lỗi: {msg} | Error: {msg} |

### 8.6 Test

- `src/server/actions-notify.test.ts` (mới, khuôn `actions-master.test.ts`; `NOTIFY_SECRET_KEY` đặt/xoá ở before/afterEach; `vi.mock('@/server/notify/webhook')`
  trả `{ ok: true }`):
  - data-entry, bod, viewer, chưa đăng nhập → `Forbidden` cho cả 6 action.
  - admin tạo webhook `secret 'https://hooks.example.com/abcd1234'` bật → ok; `listNotifyChannels()` có `secretHint '••••1234'`, `settings.webhookHost 'hooks.example.com'`,
    `JSON.stringify(repo.listNotifyChannels())` không chứa `hooks.example.com/abcd1234`; kho mock có `secretEnc` bắt đầu `v1:` và `openSecret` ra đúng URL.
  - `secret 'https://127.0.0.1/x'` → `blocked_ip`; `'http://x.com'` → `bad_protocol`; bật webhook không bí mật → `secret_required`; thiếu env khoá → `secret_key_missing`.
  - Sửa kênh với `secret ''` → bí mật giữ nguyên; đổi `kind` → `Invalid input`; id 999 → `Not found`.
  - Email: `smtpUser 'u'` không mật khẩu + bật → `secret_required`; có mật khẩu `'Pa55word'` → hint `'••••••'` (không chứa `word`); `smtpHost 'localhost'` → `blocked_ip`.
  - Người nhận: thêm vào kênh webhook → `wrong_kind`; trùng → `duplicate`; email sai → `Invalid input`.
  - `testNotifyChannelAction` → ok, sender được gọi 1 lần với payload có `TEST`; gọi 6 lần liên tiếp → lần 6 `rate_limited`; kênh không tồn tại → `Not found`.
  - Không action nào trả giá trị chứa `v1:` (kiểm `JSON.stringify(res)`).
- `src/server/admin-notify-page.test.ts` (mới): mock `next/navigation` (redirect ném), `next-intl/server`, `@/lib/session`, `@/server/repo` (mock-repo),
  `@/server/audit-log-page` (như `operation-pages-render.test.ts:31-41`), mọi component `@/components/admin/*` khác trả `null`, `NotifyChannelEditor` ghi props.
  Tạo kênh có bí mật qua repo trước khi render → props có đủ kênh, `JSON.stringify(props)` không chứa `secretEnc`, `v1:`, URL gốc; viewer → redirect.

**Nghiệm thu Task 8:** `tsc` + `npm test` xanh; dev 3001 (có `NOTIFY_SECRET_KEY` trong `.env` B — Q8): admin tạo kênh webhook
`https://example.invalid/hook` → thấy `••••hook`; "Gửi thử" → báo lỗi phân giải tên; tạo `https://127.0.0.1/x` → báo chặn; F5 lại form không hiện URL.

---

## Task 9 — E2E Playwright luồng chính (CHỜ Q2) + cổng build

**Commit:** `test(p3b): e2e Playwright luong chinh - dang nhap, tong quan, chi tiet, nhap lieu, import, canh bao, quan tri, phan quyen tien`

### 9.1 Cài + cấu hình

- Q2=(a): giữ khoá `package.json`/`package-lock.json`; `$env:NODE_EXTRA_CA_CERTS=<pem>; npm install -D @playwright/test@<bản>` — thử bản khớp trình duyệt
  sẵn có `chromium-1243` (xem `npx playwright --version` sau cài; nếu báo thiếu trình duyệt: `npx playwright install chromium` cùng `NODE_EXTRA_CA_CERTS`).
- `package.json` scripts thêm `"test:e2e": "playwright test"`. KHÔNG sửa script `test`.
- `.gitignore` thêm: `e2e/.auth/`, `e2e/.report/`, `test-results/`, `playwright-report/`.
- `.env.example` thêm cuối (không điền giá trị):
```
# E2E (npm run test:e2e) - chay tren cong 3001 + DB ddc_control_tower_b. Mat khau lay tu tai khoan seed, KHONG commit.
E2E_ADMIN_EMAIL=
E2E_ADMIN_PASSWORD=
E2E_PM_EMAIL=
E2E_PM_PASSWORD=
E2E_VIEWER_EMAIL=
E2E_VIEWER_PASSWORD=
```
- `playwright.config.ts` (gốc repo): `testDir: 'e2e'`, `fullyParallel: false`, `workers: 1`, `retries: 0`, `timeout: 60_000`,
  `reporter: [['list'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]]`, `globalSetup: './e2e/global-setup.ts'`,
  `use: { baseURL: 'http://localhost:3001', locale: 'vi-VN', trace: 'retain-on-failure' }`,
  `webServer: { command: 'npx next dev -p 3001', url: 'http://localhost:3001/vi/login', reuseExistingServer: true, timeout: 180_000,
  env: { NEXTAUTH_URL: 'http://localhost:3001' } }`,
  `projects: [{ name: 'setup', testMatch: /auth\.setup\.ts/ }, { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ }]`.
- `e2e/helpers/env.ts`: `loadDotEnv(): Record<string, string>` (đọc `.env` gốc, tách `KEY=VALUE`, bỏ dòng `#`, bỏ nháy bao) + `need(key)` (thiếu → throw
  `Thieu <KEY> trong .env - xem .env.example`).
- `e2e/helpers/i18n.ts`: `export function vi(key: string, vars?: Record<string, string | number>): string` đọc `src/i18n/messages/vi.json`, thay `{x}`.
  Mọi selector chữ dùng `vi('...')` (không gõ cứng chữ tiếng Việt), ưu tiên `getByRole`/`getByText`/`getByLabel`; selector CSS chỉ dùng id/class có sẵn
  (`#res-manpower`, `#eq-gantt`, `.valueChainCard`, `.kpis`, `.recharts-wrapper`).
- `e2e/global-setup.ts`: `env = loadDotEnv()`; `DATABASE_URL` không chứa `/ddc_control_tower_b` → throw (dừng toàn bộ); `NEXTAUTH_URL` ≠ `http://localhost:3001`
  → throw hướng dẫn sửa `.env` (Q8); thiếu `NOTIFY_SECRET_KEY` → throw; `execSync('npx prisma db seed', { stdio: 'inherit', env: { ...process.env, DATABASE_URL } })`;
  `new PrismaClient({ datasourceUrl: DATABASE_URL })` → `notifyChannel.deleteMany({ where: { name: { startsWith: 'E2E ' } } })` → `$disconnect()`.
- `e2e/auth.setup.ts`: đăng nhập lần lượt admin / pm / viewer (`E2E_*`) tại `/vi/login` (ô `type=email`, ô mật khẩu `getByLabel(vi('auth.password'))`,
  nút `getByRole('button', { name: vi('auth.signIn') })`), chờ URL rời `/login`, lưu `e2e/.auth/<admin|pm|viewer>.json`.
  Các spec dùng `test.use({ storageState: 'e2e/.auth/<role>.json' })`.

### 9.2 Spec (mỗi file 1 luồng; chạy tuần tự theo tên)

| File | Vai | Bước + khẳng định |
|---|---|---|
| `e2e/01-login.spec.ts` | (không state) | sai mật khẩu → thấy `vi('auth.invalidCredentials')`; admin đúng → URL `/vi/overview`; pm → `/vi/nhap-lieu`; đăng xuất (menu cài đặt → `vi('nav.logout')`) → về `/vi/login`; chưa đăng nhập mở `/vi/admin` → bị đưa về `/login` |
| `e2e/02-overview.spec.ts` | admin | `vi('overview.title')` hiện; `.kpis` đầu tiên có 6 thẻ; ≥ 4 `.recharts-wrapper`; bảng dự án có ≥ 1 dòng link `/projects/`; đổi ô sắp xếp sang `vi('common.value')` → URL có `sort=value`; bấm 1 dòng → sang trang chi tiết |
| `e2e/03-project-detail.spec.ts` | admin | `/vi/projects/1`: `h2` tên dự án; 6 thẻ KPI; bấm thẻ `vi('resourceKpi.manpowerTotal')` → `#res-manpower` nằm trong khung nhìn; `.valueChainCard` có ≥ 1 hàng `.stage`; `#eq-gantt` hiện (có hàng hoặc chữ `vi('equipmentGantt.noPlan')`); `#res-shift .recharts-wrapper` hiện; thấy tiêu đề `vi('detail.sCurve12')`, `vi('whatif.title')`, `vi('metric.contractValue')` |
| `e2e/04-data-entry.spec.ts` | pm | `/vi/nhap-lieu?project=1`: bấm lần lượt tên các bước wizard, mỗi bước không lỗi trang; bước `vi('dailyEntry.step')`: thấy `vi('dailyEntry.manpower')`; tăng 1 ô số đầu tiên của bảng nhân lực theo ca (đọc selector trong `src/components/form/ResourceEntryPanel.tsx`); bấm nút có chữ bắt đầu bằng phần tĩnh của `vi('dailyEntry.save')` → thấy thông báo khớp phần tĩnh của `vi('dailyEntry.saved')`; tải lại trang → ô giữ giá trị mới |
| `e2e/05-import.spec.ts` | pm | bước `vi('dailyEntry.step')`, khối `vi('dailyImport.title')`: bấm `vi('dailyImport.template')` → sự kiện download tên `.xlsx`; mở file bằng `exceljs`, điền 1 dòng hợp lệ (ngày hôm nay, nhà thầu đầu tiên có trong file mẫu, số nhỏ), lưu vào `test-results/`; upload → `vi('dailyImport.preview')` → thấy tóm tắt khớp `vi('dailyImport.summary', { ok: 1, invalid: 0 })`; bấm nút ghi → thấy thông báo `done`. Trang `/vi/import` (admin state riêng trong cùng file bằng `test.describe` + `test.use`): tải trang OK, upload 1 file `.txt` → thấy lỗi, trang không vỡ |
| `e2e/06-alerts.spec.ts` | admin | `/vi/alerts`: đếm dòng N ≥ 1; dòng đầu bấm `vi('alert.closeAlert')`, nhập `vi('alertClose.action')` = `Da xu ly e2e`, bấm `vi('alertClose.confirm')` → còn N-1 dòng; nhập hành động 2 ký tự → thấy `vi('alertClose.err.action_short')` |
| `e2e/07-admin.spec.ts` | admin | `/vi/admin`: thẻ `vi('fxRates.title')`: sửa tỷ giá USD tháng hiện tại → lưu → hiện nguồn `vi('fxRates.source.manual')`; thẻ `vi('factoryAdmin.title')`: thêm khu vực `E2E KV <timestamp>` công suất 1000 → xuất hiện trong bảng; thẻ `vi('notifyAdmin.title')`: thêm kênh webhook `E2E Webhook`, URL `https://example.invalid/hook`, bật → bảng có `••••hook`, mở lại form sửa: ô URL trống; `vi('notifyAdmin.test')` → thấy `vi('notifyAdmin.err.dns_failed')`; lưu URL `https://127.0.0.1/x` → thấy `vi('notifyAdmin.err.blocked_ip')`; thêm kênh email `E2E Mail` (host `smtp.example.invalid`, cổng 587, from `noreply@daidung.com.vn`), thêm người nhận `e2e@daidung.com.vn` → hiện trong danh sách; xoá cả 2 kênh (chấp nhận confirm) → biến mất; toàn trang không có chuỗi `v1:` |
| `e2e/08-finance-gate.spec.ts` | viewer | `/vi/overview`: không có `vi('kpi.backlog')`, không có chữ `Trị (tỷ VNĐ)`, không có cột `vi('metric.contractValue')`, không có option `vi('common.value')`; `/vi/projects/1`: không có `vi('metric.contractValue')`, `vi('detail.sCurve12')`, `vi('whatif.title')`, `vi('detail.financial')`; `page.content()` không khớp `/\d[\d.,]*\s?tỷ/`; `request.get('/api/export')` → 403, `/api/report/export` → 403; `/vi/admin` → bị đưa về trang chủ của viewer |

### 9.3 Nghiệm thu Task 9

- `npm run test:e2e` (PowerShell, dev server 3001 tự bật hoặc dùng lại) → 8 file xanh, chạy lại lần 2 vẫn xanh (seed lại mỗi lần).
- `npm test` KHÔNG chạy file nào trong `e2e/` (vitest `include` chỉ `src/**`); `npx tsc --noEmit` sạch (gồm file e2e).
- Build: `$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES="D:\_project\DDC_dieu-phoi\tools\font-mock.js"; npm run build` biên dịch xong.
- Ghi vào `ket-qua-test.md`: số test Vitest, số e2e, thời gian chạy e2e.

---

## Trường hợp biên bắt buộc (tổng hợp — mỗi dòng phải có test ở Task tương ứng)

1. Người không quyền tài chính: số tiền không nằm trong HTML, RSC payload (props client), file Excel; sắp xếp theo giá trị bị ép `priority` (T1, T2).
2. User thiếu hẳn field `canViewFinance` → coi như `false` (đang có ở trang chi tiết; giữ nguyên `?? false`) (T2).
3. Alert R5 (message có tiền) — che cho người không quyền, và không kèm số tiền khi gửi ra ngoài (Q4) (T2, T3).
4. SSRF: IP loopback/private/link-local/metadata dạng thập phân, hex, IPv6, IPv4-mapped, NAT64; tên `localhost`/`.internal`; DNS trả lẫn IP công khai + nội bộ;
   redirect 3xx không theo; URL có user:pass; giao thức lạ (T3, T5).
5. Bí mật: không trả về client, không vào audit/activity/`notifyError`/console; mật khẩu SMTP không lộ ký tự nào qua hint; ô bí mật để trống = giữ; thiếu
   `NOTIFY_SECRET_KEY` → báo rõ, không lưu; khoá đổi → `secret_decrypt_failed`, không vỡ (T4, T6, T8).
6. Gửi lỗi/chậm không làm hỏng lưu số liệu (`runAlertEngineSafe` vẫn resolve; gửi chạy nền, timeout) (T6).
7. Chống trùng khi chạy song song / chạy lại; không gửi lại kênh đã OK; tối đa 3 lần; alert đã đóng không gửi; alert cũ/seed không gửi bù (T6).
8. Lọc mức độ ở cả kênh lẫn người nhận; kênh email không người nhận phù hợp → không tính lần thử (T6).
9. "Gửi thử" có rate limit, chạy được với kênh đang tắt, không ghi `alert_log` (T8).
10. E2E không bao giờ chạy trên DB của A; không commit mật khẩu seed (T9).

## Quy ước chép từ file có sẵn

| Việc | Chép khuôn từ |
|---|---|
| Server action admin | `src/server/actions-master.ts` |
| Test action | `src/server/actions-master.test.ts` |
| Repo tách file + gộp | `src/server/repo/prisma-repo-entry.ts`, `mock-repo-entry.ts`, `index.ts` (`Object.assign`) |
| Test prisma-repo mock `@/server/db` | `src/server/repo/prisma-repo-save.test.ts` |
| Test render trang server | `src/server/projects-detail-page-finance-guard.test.ts`, `src/server/operation-pages-render.test.ts` |
| Test route Excel | `src/server/export-route.test.ts`, `src/server/report-export-route.test.ts` |
| UI bảng CRUD admin | `src/components/admin/FactoryEditor.tsx` |
| Hàm "không bao giờ throw" + log | `src/server/alert-engine.ts` `runAlertEngineSafe`, `src/server/jobs.ts` `runJob` |
| Mã hoá bí mật | `src/lib/secret-box.ts` (+ test `secret-box.test.ts` cách đặt env khoá) |
| i18n nhóm mới cuối file | nhóm `alertClose` ở `src/i18n/messages/vi.json` |
