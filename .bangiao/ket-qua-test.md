# Kết quả kiểm thử: 4 trang nghiệp vụ + sidebar + closeAlertAction + export route

**Skill đã dùng:** `test-driven-development`, `verification-before-completion`.
**Phạm vi:** chỉ đọc + chạy test. Không sửa file sản phẩm nào (đã kiểm lại danh sách file tạo/sửa ở cuối).

## KẾT LUẬN: XANH

Không có test rớt. Không phát hiện lỗi chặn. Có 3 điểm quan sát không chặn + 2 hạng mục không kiểm chứng được trong môi trường này (nêu ở cuối).

## 1. Bằng chứng chạy lệnh

| # | Lệnh | Kết quả | Ghi chú |
|---|------|---------|---------|
| 1 | `npx tsc --noEmit` | **exit 0, 0 dòng output** | Chạy 3 lần: trước khi thêm test, sau khi thêm test (bắt 2 lỗi type trong test của tôi → đã sửa test), và lần cuối xanh |
| 2 | `npx vitest run` (baseline, trước khi thêm test) | **exit 0 — 176 passed / 14 file** | Đúng kỳ vọng, không regression |
| 3 | `npx vitest run` (sau khi thêm test) | **exit 0 — 237 passed / 20 file** | 176 test cũ giữ nguyên + 61 test mới |
| 4 | `npm run build` | **KHÔNG chạy được** | EPERM `.next\trace` rồi treo: dev server (`next dev`, PID 30792) đang chạy sẵn và giữ lock `.next`. Lỗi môi trường, không phải lỗi code |

## 2. Test mới (61 test / 6 file)

| File | Số test | Bao nhóm nào |
|------|---------|--------------|
| `src/server/close-alert-role.test.ts` | 8 | Ma trận quyền `closeAlertAction` (admin/bod/PIC/non-PIC/viewer/anonymous + alertId rác) |
| `src/server/report-export-route.test.ts` | 11 | `GET /api/report/export` (403 cho viewer/data-entry/anonymous, 200 + 3 sheet cho admin/bod, header navy, ô SPI/CPI rỗng) + `getReportData` |
| `src/server/pages-role-guard.test.ts` | 20 | Guard role 4 trang (mọi tổ hợp role × trang) |
| `src/server/compliance-page.test.ts` | 4 | Logic lọc "chưa nộp số liệu" của `/compliance` (render tĩnh) |
| `src/server/operation-pages-render.test.ts` | 9 | Nội dung render `/report`, `/alerts`, `/audit` (đường thuận lợi + trạng thái rỗng) |
| `src/i18n/messages.test.ts` | 9 | Đối chiếu key vi/en + mọi key literal dùng trong code đều tồn tại |

Ba nhóm theo yêu cầu:
- **Đường chạy thuận lợi**: admin/bod mở được 4 trang; admin/bod đóng được alert; PIC đóng alert của mình; admin/bod tải được file Excel 3 sheet; `/report` render đủ KPI + P0-Red + bảng; `/audit` render Cũ → Mới.
- **Trường hợp biên đã nêu tên trong kế hoạch**: chưa login → `/vi/login`; sai role → `homeForRole`; alert rỗng; audit rỗng (`common.noData`); P0-Red rỗng (`common.noData`); dự án không có fact tháng (spi/cpi null, pctActual 0, backlog 0, ô Excel rỗng); alertId không tồn tại; `getLatestFact(..., 'all')` cho "cập nhật gần nhất".
- **Trường hợp phải thất bại**: viewer/data-entry/anonymous bị 403 ở export route; viewer + data-entry non-PIC + anonymous bị `Forbidden` ở `closeAlertAction` **và alert giữ nguyên đang mở, audit log không ghi** (assert side-effect, không chỉ assert return value); data-entry/viewer bị đá khỏi 4 trang; bod bị đá khỏi `/audit`.

Lưu ý về vùng phủ: seed có đủ fact cho **cả 17 dự án** ở tháng 2026-09 (đã kiểm bằng probe: `PROBE no-fact-this-month: (none)`), nên nhánh "dòng có dữ liệu" của `/compliance` **không thể** chạm tới bằng dữ liệu seed — tôi phải tự dựng fixture (`repo.createProject` + `saveProjectProfile({actualStartDate})` + `addAssignment`) mới phủ được nhánh này.

## 3. Kiểm tra tĩnh (đọc file) — tất cả ĐẠT

| Hạng mục | Bằng chứng |
|----------|-----------|
| 4 page tồn tại | `app/[locale]/(app)/{report,alerts,compliance,audit}/page.tsx` |
| Guard report | `report/page.tsx:23-26` — `getCurrentUser` + `redirect(login)` + `!['admin','bod'].includes(user.role)` → `homeForRole` |
| Guard alerts | `alerts/page.tsx:9-12` — admin+bod |
| Guard compliance | `compliance/page.tsx:13-16` — admin+bod |
| Guard audit | `audit/page.tsx:10-13` — `if (user.role !== 'admin')` (CHỈ admin) |
| `closeAlertAction` | `src/server/actions.ts:325-335` — `const user = (await requireProject(alert?.projectId ?? -1)) ?? (await requireRole(['bod']))`; không có `requireRole(['bod'])` thì BOD bị chặn |
| `requireProject` giữ nguyên | `actions.ts:27-33` — admin, hoặc data-entry có assignment; **không đụng**, nên quyền ghi số liệu/ảnh không đổi |
| Export route auth | `app/api/report/export/route.ts:10-13` — `!user \|\| !['admin','bod'].includes(user.role)` → 403 |
| `OPERATIONS_NAV` | `AppShell.tsx:43-47` — report/alerts/compliance, roles `['admin','bod']` |
| `ADMIN_NAV` | `AppShell.tsx:49-55` — audit/import/data-dictionary/data-schema/admin, roles `['admin']` |
| Không còn `SYSTEM_NAV` / `nav.system` | `grep -rn "SYSTEM_NAV\|nav\.system" app src i18n` → **0 kết quả**. Render 2 section `nav.operations` (`AppShell.tsx:123-130`) + `nav.administration` (`:132-139`), mỗi section chỉ render khi mảng lọc theo role không rỗng |
| 4 icon mới | `src/components/icons/index.tsx:204-233` — `IconReport`, `IconBell`, `IconChecklist`, `IconHistory` trong section `// ---- Operations ----` |
| i18n | vi.json và en.json **366 key mỗi file, khớp 100%**; có đủ `nav.{report,alerts,compliance,audit,operations,administration}` + section `report/compliance/audit` + `alert.title/alert.owner`; `nav.system` vẫn còn (vi.json:35) nhưng không còn nơi dùng — đúng như kế hoạch cho phép |
| `getReportData` | `src/server/report.ts:22` — trả `{ kpis, p0Red, rows }`; `p0Red` lọc `priority==='P0' && (penalty==='risk'\|\|'penalized')`; `spi/cpi` làm tròn 2 số, `pctActual/backlog` fallback 0 |
| Bảng đúng brand | `table-zebra` + `min-w-[980px]` ở cả 4 bảng; `formatPct/formatTyd/formatDate/formatDateTime` đều truyền `locale` |

## 4. Kiểm chứng test có "răng" (RED evidence)

Vì code sản phẩm đã có sẵn (không được phép sửa để chạy RED theo nghĩa TDD), tôi tạo **file nháp chứa kỳ vọng của hành vi TRƯỚC thay đổi**, chạy và xác nhận chúng **RỚT đúng lý do**, rồi xoá:

```
× BOD đóng alert vẫn bị Forbidden nếu chưa có nhánh bod  → expected { ok: true } to deeply equal { ok: false, error: 'Forbidden' }
× viewer tải file (kỳ vọng CŨ)                            → expected 403 to be 200
× /report không redirect với viewer (kỳ vọng CŨ)          → expected true to be false
× key không tồn tại bị báo thiếu                          → expected [ 'nav.bogusKey' ] to deeply equal []
× compliance: dự án thiếu fact lại hiện empty?            → expected '<div …' to contain 'compliance.empty'
× alerts: alert đã đóng vẫn được truyền?                  → expected [Array(14)] to have a length of 15
× audit: nhật ký rỗng lại render bảng?                    → expected '<div …' to contain '<table'
```

Nghĩa là: nếu ai gỡ nhánh `requireRole(['bod'])` ở `actions.ts:329`, gỡ check role ở export route, gỡ guard ở page, gỡ điều kiện `!closedAt`, hay bỏ lọc `fact` ở compliance thì test hiện tại sẽ rớt.

Lần chạy teeth đầu tiên cho nhóm BOD **không hợp lệ** (rớt vì mock `@/server/cache` thiếu `overviewTag`, không phải rớt vì hành vi) — đã làm lại đúng cách và ghi lại đây để không tính nhầm là bằng chứng.

## 5. Điểm quan sát (không chặn, không phải test rớt)

1. **Cột "Loại" ở `/alerts` hiển thị nhãn "Trạng thái"**: `AlertList.tsx` dùng `t('common.status')` cho header cột alert type, trong khi kế hoạch mục 6 gọi cột này là "Loại". `thay-doi.md` đã tự khai báo điểm này và chốt wording chấp nhận được — tôi giữ nguyên, chỉ nêu lại để Reviewer xác nhận.
2. **`thay-doi.md` vs code**: mục "File SỬA" mô tả `/alerts` truyền `canClose={user.role === 'admin'}` (theo kế hoạch §5), nhưng code thực tế là `canClose={user.role === 'admin' || user.role === 'bod'}` (`alerts/page.tsx:24`). Code **đúng** theo quyết định Q1 (BOD đóng được alert) và tôi đã có test khoá hành vi này; chỉ là mô tả trong `thay-doi.md` lệch so với code.
3. **Hai định nghĩa "Backlog" cùng xuất hiện trên `/report`**: KPI card `kpis.backlog` (tổng contractValue dự án `Chuan_bi`) và cột bảng `FactFinancial.backlog` là hai số khác nhau — đúng như TODO đã biết ở `queries.ts:177`, kế hoạch chốt không sửa. Không test, không tính là lỗi.

## 6. Hạng mục KHÔNG kiểm chứng được trong môi trường này

1. **`npm run build`**: không chạy được vì `next dev` (PID 30792, tiến trình có sẵn từ trước) giữ lock `.next/trace` → EPERM rồi treo. Đã dừng đúng tiến trình build của mình (PID 4848/32264), **không đụng dev server**. Đề nghị Reviewer chạy `npm run build` khi dev server đã tắt.
2. **Smoke test trình duyệt + kiểm tra DB**: không có MCP `playwright` và `postgres` trong bộ tool của tôi → không mở trang thật, không đọc lại DB. Thay đổi có đụng UI (4 trang mới + sidebar + nút đóng alert) nên **smoke test UI thật vẫn còn để mở**. Không mất nhiều ý nghĩa vì tầng dữ liệu đang là mock-repo in-memory (không Prisma/DB theo `thay-doi.md`), nên kiểm tra read-only trên Postgres là N/A.

## 7. File tôi tạo/sửa

Chỉ tạo file test mới, không sửa file sản phẩm:

- `src/server/close-alert-role.test.ts`
- `src/server/report-export-route.test.ts`
- `src/server/pages-role-guard.test.ts`
- `src/server/compliance-page.test.ts`
- `src/server/operation-pages-render.test.ts`
- `src/i18n/messages.test.ts`

File nháp dùng cho probe/teeth (`src/__probe.test.ts`, `src/__teeth.test.ts`, `src/__teeth2.test.ts`, `src/__teeth3.test.ts`) đã xoá sạch — đã kiểm `ls src/__*.test.ts` → không còn.

Tác động phụ ngoài ý muốn của lệnh đã chạy: `tsconfig.tsbuildinfo` (do `tsc --incremental`) và thư mục `.next/` (do lần `next build` bị treo) có bị chạm — cả hai đều là artifact build, không phải mã nguồn.

## 8. Ghi chú hạ tầng test

Để import được `.tsx` (page component) trong vitest, test phải gán `globalThis.React` trước khi gọi component, vì `tsconfig.json` để `jsx: "preserve"` nên esbuild hạ JSX của các file `.tsx` được import về classic runtime (`React.createElement`). Tôi xử lý trong chính file test, **không sửa `vitest.config.ts`/`tsconfig.json`**. Nếu sau này muốn test component nhiều hơn, nên thêm `esbuild: { jsx: 'automatic' }` vào `vitest.config.ts` (việc của Reviewer, ngoài phạm vi tôi được phép sửa).
