# P2A — Nhập liệu mới — Kế hoạch triển khai

> Người viết: planner (skill `writing-plans`). Coder CHỈ đọc file này. Làm đúng thứ tự Task 1 → Task 9,
> mỗi Task = 1 commit, chạy cổng kiểm trước khi commit. Không làm gì ngoài phạm vi ghi ở đây.

**Mục tiêu:** nhập được nhà thầu tham gia (G-18), nhân lực/thiết bị theo ngày × nhà thầu × ca (sửa ngày cũ có log, import
Excel + file mẫu), CRUD khu vực SX + sản lượng (T8), tỷ giá tháng tự lấy VCB + sửa tay + nhắc (T6), engine cảnh báo chạy
thật (T11). **1 migration gộp duy nhất** kèm nền thông báo cho P3B (P3B không có migration).

**Kỹ thuật:** Next.js 14.2.35 app router · Prisma 6.19 · PostgreSQL localhost:5433 DB `ddc_control_tower` · next-intl 3.26 ·
Vitest 2.1 (`include: src/**/*.test.ts`, môi trường node, `DDC_FAKE_TODAY=2026-09-16` ghim trong `vitest.config.ts`) ·
exceljs 4.4 (đọc/ghi Excel mới) · zod 4.

---

## CÂU HỎI CÒN BỎ NGỎ (chủ dự án chọn; coder làm theo MẶC ĐỊNH nếu chưa có trả lời, trừ Q1)

Mỗi mặc định nằm gọn ở 1 chỗ ghi trong cột cuối để đổi nhanh.

> **ĐÃ CHỐT — chủ dự án trả lời 2026-09-24: Q1–Q14 đều chọn MẶC ĐỊNH đề xuất** (Q1 = (A) thiết bị theo NGÀY; Q2 (a) N=7;
> Q3 (a); Q4 (a); Q5 (a) chặn; Q6 (a); Q7 mua chuyển khoản + (a); Q8 (a) gỡ AUD/SAR; Q9 R1–R7; Q10 (a) không tự đóng;
> Q11 PIC/BOD, Đỏ +7 / Vàng +14; Q12 giữ quyền hiện tại; Q13 (a); Q14 (a) làm Task 9). Không còn câu bỏ ngỏ.

| # | Câu hỏi | Lựa chọn | MẶC ĐỊNH đề xuất | Chặn / đổi ở đâu |
|---|---|---|---|---|
| **Q1** | **Thiết bị nhập theo CA như nhân lực, hay theo NGÀY?** (hiện bảng thiết bị không có cột ca; đổi sau phải migration mới) | (A) theo ngày — giữ bảng; (B) theo ca — thêm `shiftCode` vào `fact_daily_equipment_usage`, dữ liệu cũ dồn ca sáng | (A) | **CHẶN Task 1** — phải trả lời trước khi viết migration. Nhánh B: Task 1 mục 1.2 bước 3b + Task 4 ghi chú "Nếu Q1=B" |
| Q2 | Sửa ngày cũ: ai, lùi tối đa bao nhiêu ngày, có bắt buộc lý do? | (a) data-entry lùi ≤ N ngày, admin không giới hạn; (b) mọi người không giới hạn; (c) chỉ admin sửa ngày < hôm nay | (a) N = **7**; tháng đã khoá: không ai sửa; **bắt buộc lý do ≥ 5 ký tự** khi đổi số ĐÃ CÓ của ngày < hôm nay (ghi vào `audit_log.note`); KH được nhập trước tối đa **30 ngày** tới; TT > 0 cho ngày tương lai bị từ chối | Hằng số `src/lib/daily-entry.ts` (Task 4) |
| Q3 | File mẫu Excel nhân lực: dạng ngang hay dọc? 1 file = 1 dự án? | (a) ngang: 1 dòng = ngày × nhà thầu, cột `KH <tên ca>`/`TT <tên ca>` sinh từ `dim_shift`; (b) dọc: 1 dòng = ngày × nhà thầu × ca | (a) + **1 file = 1 dự án đang chọn** trên màn hình (không có cột mã dự án) | `src/lib/daily-import.ts` (Task 5) |
| Q4 | Ai được tạo nhà thầu MỚI (danh mục dùng chung)? Có cần CRUD nhóm thiết bị? | (a) admin + data-entry tạo ngay trong bước nhập; (b) chỉ admin ở /admin | (a); **không** làm CRUD thiết bị ở P2A (giữ 7 nhóm seed) | `createContractorAction` (Task 3) |
| Q5 | Gỡ nhà thầu khỏi dự án khi nhà thầu đã có số liệu ở dự án đó? | (a) chặn; (b) cho gỡ, số liệu cũ vẫn giữ nhưng ẩn khỏi lưới | (a) chặn, báo lỗi rõ | `removeProjectContractor` (Task 3) |
| Q6 | Sản lượng (T8) nhập theo tháng hay theo ngày? 1 dự án có chia nhiều khu vực không? | (a) tháng × 1 khu vực chính; (b) tháng × nhiều khu vực; (c) theo ngày | (a) — ô nhập ở bước "Tiến độ", ghi vào khu vực chính của dự án | Task 6 |
| Q7 | VCB: lấy tỷ giá nào, ngày nào gán cho tháng? | Loại: mua tiền mặt / **mua chuyển khoản** / bán. Ngày: (a) tỷ giá tháng M = tỷ giá lấy lần đầu trong tháng M (đầu tháng, có ngay để dùng); (b) tỷ giá tháng M = ngày làm việc cuối tháng M (tháng đang chạy sẽ thiếu tới cuối tháng) | **Mua chuyển khoản** (khớp ghi chú seed `dims.ts:42`) + (a) | `VCB_RATE_KIND` trong `src/lib/vcb-rates.ts`, `isRatesDue` (Task 7) |
| Q8 | Quyết định 4 "tiền ngoài VND: USD, EUR" có nghĩa **gỡ AUD/SAR khỏi danh mục tiền tệ** của app? | (a) gỡ hẳn (type, validation, seed, DB); (b) giữ AUD/SAR, chỉ job tự lấy USD/EUR | (a) — không dự án seed nào dùng AUD/SAR | Task 1 bước 1.2 mục 5b + `CurrencyCode` |
| Q9 | T11: bộ luật cảnh báo + mức độ | R1 SPI < 0,9 (Vàng) · R2 CPI < 0,9 (Vàng) · R3 nguy cơ phạt ≤ 30 ngày (Đỏ) · R4 đã bị phạt (Đỏ) · R5 công nợ quá hạn > 5% HĐ (Vàng) · R6 huy động nhân lực ngày gần nhất < 85% (Vàng) · R7 huy động thiết bị < 80% (Vàng). Không có luật cho dồn tải xưởng / thiếu tỷ giá (không gắn 1 dự án) | Cả R1–R7, ngưỡng lấy từ `THRESHOLDS` có sẵn | `evaluateProjectAlerts` (Task 8) |
| Q10 | Alert có tự đóng khi điều kiện hết không? | (a) không — chỉ người đóng, kèm hành động; (b) engine tự đóng, ghi "Tự đóng: điều kiện không còn" | (a) | Task 8 |
| Q11 | Người phụ trách + hạn xử lý của alert tự sinh | Người phụ trách: PIC dự án / BOD / tên phòng; Hạn: số ngày | PIC (email trong `project_assignments`, vai trò PIC) — không có PIC thì `BOD`; hạn Đỏ = hôm nay + **7**, Vàng = + **14** ngày | `ALERT_DEADLINE_DAYS` (Task 8) |
| Q12 | Ai được đóng alert, bắt buộc ghi gì? | Giữ quyền hiện tại (admin, BOD mọi alert; data-entry alert dự án được gán) hay thu hẹp | Giữ quyền hiện tại; **bắt buộc "Hành động đã xử lý" ≥ 3 ký tự**, "Ghi chú" tuỳ chọn | `closeAlertSchema` (Task 8) |
| Q13 | Nhắc thiếu tỷ giá hiện cho ai, ở đâu? | (a) admin, dải nhắc đầu mọi trang; (b) chỉ trong /admin | (a) | `app/[locale]/(app)/layout.tsx` (Task 7) |
| Q14 | Nợ F4 (reviewer P1A giao cho P2A): đổi import % tiến độ cũ từ `xlsx` 0.18.5 (có lỗ hổng) sang `exceljs` → **không còn nhận file `.xls`** (chỉ `.xlsx` + `.csv`) | (a) làm ở P2A; (b) để sau | (a) | Task 9 (bỏ Task 9 nếu chọn b) |

**Quyết định kỹ thuật đã tự chốt (không phải nghiệp vụ; reviewer có thể lật):**

| # | Quyết định | Lý do |
|---|---|---|
| K1 | Mã ca mới: `afternoon` → **`evening`** ("Ca tối"/"Evening"), đổi bằng `UPDATE dim_shift` (FK `ON UPDATE CASCADE` tự đổi `fact_daily_manpower`). `DEFAULT_SHIFT_CODE` giữ `morning` | Quyết định chủ dự án 2; không cột cố định theo ca |
| K2 | Fact theo ngày (`fact_daily_manpower`, `fact_daily_equipment_usage`) và `fact_volume` **KHÔNG** thêm version/isLatest: ghi = upsert + `audit_log` cũ→mới (+ lý do ở cột mới `audit_log.note`) + cột `updatedAt`/`updatedBy` | Đổi PK bảng ngày (mục tiêu T1 10 triệu dòng của B) quá nặng; đúng tiền lệ `saveValueChain` (upsert + audit). Lịch sử sửa nằm đủ trong `audit_log` |
| K3 | Code mới đặt trong **file mới** (`prisma-repo-entry.ts`, `mock-repo-entry.ts`, `actions-entry.ts`, `actions-master.ts`); file nóng chỉ sửa tối thiểu. **Mọi sửa `prisma-repo.ts` dồn hết vào Task 1** | Giảm xung đột với B (T1 sửa nặng `prisma-repo.ts`) |
| K4 | Job định kỳ (chưa có server/cron): bảng `job_run` + route `POST /api/cron/[job]` có `CRON_SECRET` (cron ngoài gọi) + chạy "lười" khi có người mở app (tối đa 1 lần/10 phút/tiến trình) + nút admin "Lấy ngay" | Không phụ thuộc hạ tầng; lỗi mạng chỉ ghi `job_run.status='error'`, không làm hỏng trang |
| K5 | Bí mật thông báo (webhook URL, mật khẩu SMTP): **mã hoá AES-256-GCM khi lưu DB** (`notify_channel.secretEnc`), khoá ở env `NOTIFY_SECRET_KEY` (32 byte base64); UI chỉ thấy `secretHint` (4 ký tự cuối). Không có khoá → không lưu được bí mật (báo lỗi) | Admin cấu hình được trong Quản trị (yêu cầu P3B) mà DB lộ cũng không lộ bí mật; phương án "chỉ env" không cho sửa trong UI |
| K6 | Chống trùng alert: cột `dedupeKey` + `@@unique([projectId, dedupeKey])` (Postgres coi NULL khác nhau → dòng cũ NULL không vướng) + không tạo nếu còn alert MỞ cùng `ruleCode` | Chạy engine bao nhiêu lần cũng không sinh trùng; alert đã đóng không bật lại trong cùng kỳ |
| K7 | Đọc Excel mới bằng `exceljs` (không dùng `xlsx`) | Nợ F4 |

---

## Ràng buộc chung (áp cho mọi Task)

- Cổng kiểm mỗi Task: `npx tsc --noEmit` sạch + `npm test` xanh (baseline **928/928**; không xoá/skip test cũ trừ khi Task ghi rõ).
  Task cuối thêm: build kiểm compile `$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES="D:\_project\DDC_dieu-phoi\tools\font-mock.js"; npm run build`.
- **File nóng P2A** — ghi vào mục "Đang giữ" của `D:\_project\DDC_dieu-phoi\phien-A.md` TRƯỚC Task 1 (kiểm `phien-B.md` không giữ):
  `prisma/schema.prisma`, `prisma/migrations/` (đang giữ sẵn), `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`,
  `src/i18n/messages/vi.json`, `src/i18n/messages/en.json`. **KHÔNG đụng** `app/globals.css`, `src/server/queries.ts`,
  `src/server/project-queries.ts`.
- **Không đụng file của B (P2B):** `src/components/project/*` (chart, Gantt), `app/[locale]/(app)/projects/[id]/page.tsx`,
  `app/[locale]/(app)/overview/page.tsx`, `src/components/dashboard/*`, `src/lib/data-schema.ts`, `app/[locale]/(app)/data-schema/*`.
- Repo: tầng trên import qua `@/server/repo`; mọi hàm repo mới có ở CẢ prisma (async) lẫn mock (sync), cùng tên, cùng tham số,
  kiểu trả về giống nhau (mock trả giá trị, prisma trả Promise của giá trị đó). Type dùng chung đặt ở `src/server/repo/types.ts`.
- "Hôm nay"/"tháng này" lấy từ `src/lib/clock.ts` (`todayIso`, `currentMonth`, `addDaysIso`), không `new Date()` trong logic nghiệp vụ
  (`new Date()` chỉ dùng làm timestamp ghi DB).
- Quyền: ghi dự án = `canWriteProject` (`src/server/authz.ts`); trang tự kiểm role server-side như `app/[locale]/(app)/nhap-lieu/page.tsx:18-21`.
- Server action mới: file có `'use server'` ở dòng 1, trả `{ ok: true, ... } | { ok: false, error: string }`, validate bằng zod trong
  `src/server/validation.ts`, ghi `logActivity` (`src/lib/activity.ts`) — chép khuôn `saveKeyMilestonesAction` (`src/server/actions.ts:226-235`).
- i18n: mọi key mới nằm trong **nhóm mới** (`contractorJoin`, `dailyEntry`, `dailyImport`, `factoryAdmin`, `volumeEntry`, `fxRates`, `alertClose`)
  thêm ở **cuối** `vi.json` và `en.json` (sau nhóm `logPaging`). Không sửa key cũ. `src/i18n/messages.test.ts` kiểm vi/en khớp.
- Style: không thêm CSS vào `globals.css`; dùng class có sẵn (`inp`, `inp ro`, `btn`, `btn ghost`, `tbl`, `tbl sticky`, `scroll`, `sumbar`,
  `sumbar bad`, `hintline`, `chip`, `chip c-ok`, `sect`, `f2`, `field`/`lb`, `empty`, `card`/`bd`) + Tailwind + biến CSS có sẵn.
- Comment trong `migration.sql`/`.down.sql` viết **không dấu** (theo `prisma/migrations/20260924090000_p1a_data_foundation/migration.sql`).
- Test action: chép khối `vi.mock` + `login()` đầu `src/server/actions-security.test.ts`. Test route: chép `src/server/report-export-route.test.ts`.
  Test prisma-repo: mock `@/server/db` theo `src/server/repo/prisma-repo-save.test.ts`. Test trang: theo `src/server/nhap-lieu-page-guard.test.ts`.
- Không sửa `PROGRESS.md`, `.serena/memories/`. Sau mỗi commit cập nhật `phien-A.md` (commit cuối, bước kế, file đang giữ).
- Commit: `feat(p2a): ...` / `fix(p2a): ...` / `chore(p2a): ...`, tiếng Việt KHÔNG dấu.
- `npx prisma generate` trên Windows: tắt dev server cổng 3000 trước (engine DLL bị khoá → EPERM).

## Bản đồ file

| File | Task | Việc |
|---|---|---|
| `prisma/schema.prisma` 🔥 | 1 | cột/bảng mới (mục 1.1) |
| `prisma/migrations/20260924150000_p2a_entry_foundation/migration.sql` 🔥 (mới) | 1 | migration gộp duy nhất |
| `prisma/rollback/20260924150000_p2a_entry_foundation.down.sql` (mới) | 1 | SQL hồi phục |
| `src/server/repo/types.ts` | 1,2 | type mới/đổi |
| `src/server/repo/prisma-repo.ts` 🔥 | 1 | đổi tên `repo`→`coreRepo` + spread entry; map field mới; `closeAlert`/`logAudit` thêm note |
| `src/server/repo/mock-repo.ts` | 1 | giống trên cho mock |
| `src/server/repo/prisma-repo-entry.ts`, `mock-repo-entry.ts` (mới) | 1,3–8 | hàm repo P2A |
| `src/server/repo/entry.test.ts`, `prisma-repo-entry.test.ts` (mới) | 1,3–8 | test repo |
| `src/lib/alert-keys.ts` + test (mới) | 1 | mã luật + khoá chống trùng |
| `src/lib/shifts.ts` + test, `src/data/seed/erp.ts`, `dims.ts`, `history.ts`, `history.test.ts`, `prisma/seed.ts` | 1 | ca tối, tiền tệ, alert, factory |
| `src/server/validation.ts` | 1,3–8 | schema mới, `CURRENCY` |
| `src/lib/data-dictionary.ts` | 1 | bỏ chữ AUD/SAR |
| `src/lib/secret-box.ts` + test (mới), `.env.example` | 2,7 | mã hoá bí mật; env mới |
| `src/server/action-guards.ts` (mới) | 3 | `requireRoleUser`, `requireWriteProject` |
| `src/server/actions-entry.ts` + `actions-entry.test.ts` (mới) | 3,4,5 | G-18, nhập ngày, import |
| `src/components/form/ResourceEntryPanel.tsx`, `ContractorJoinBlock.tsx`, `DailyImportBlock.tsx` (mới) | 3,4,5 | UI bước mới |
| `src/components/form/resourceEntryState.ts` + test (mới) | 4 | hàm thuần lưới |
| `src/components/form/DataEntryForm.tsx` | 3,6 | bước `resources`; ô khu vực + sản lượng |
| `src/components/form/dataEntryState.ts` + test | 6 | `factoryId`, `volumeTonnage` |
| `app/[locale]/(app)/nhap-lieu/page.tsx` + `src/server/nhap-lieu-page-guard.test.ts` | 3,4,6 | nạp dữ liệu bước mới |
| `src/lib/daily-entry.ts` + test (mới) | 4 | khoảng ngày, lý do, kiểm số |
| `src/lib/daily-import.ts` + test, `src/server/daily-import.ts` + test (mới) | 5 | parse Excel |
| `app/api/templates/daily-resources/route.ts` + `src/server/daily-template-route.test.ts` (mới) | 5 | file mẫu |
| `src/server/actions.ts` 🔥 | 6,8,9 | `saveMonthlyData` (khu vực, sản lượng, engine), `commitImportAction` (engine), `closeAlertAction` (ghi chú), `importExcelAction` (exceljs) |
| `src/server/actions-master.ts` + test (mới) | 6,7 | khu vực, tỷ giá |
| `src/components/admin/FactoryEditor.tsx`, `ExchangeRateEditor.tsx` (mới), `app/[locale]/(app)/admin/page.tsx` | 6,7 | CRUD /admin |
| `src/lib/fx.ts`, `src/lib/vcb-rates.ts`, `src/lib/job-schedule.ts` + test (mới) | 7 | tỷ giá, lịch job |
| `src/server/fx-rates.ts`, `src/server/jobs.ts` + test (mới) | 7,8 | lấy VCB, chạy job |
| `app/api/cron/[job]/route.ts` + `src/server/cron-route.test.ts` (mới) | 7 | cron ngoài gọi |
| `src/components/layout/RateReminder.tsx` (mới), `app/[locale]/(app)/layout.tsx` | 7 | nhắc thiếu tỷ giá + chạy job lười |
| `src/lib/alert-rules.ts` + test, `src/server/alert-engine.ts` + test (mới) | 8 | engine |
| `src/components/alerts/CloseAlertForm.tsx` (mới), `src/components/alerts/AlertList.tsx` | 8 | đóng alert có hành động/ghi chú |
| `src/i18n/messages/vi.json`, `en.json` 🔥 | 3–8 | nhóm key mới |

🔥 = file nóng.

---

## Task 1 — Migration gộp P2A + type + seed + ca tối

**Commit:** `feat(p2a): migration gop - ca toi, khu vuc, ty gia, canh bao, job_run, nen thong bao P3B`

### 1.1 `prisma/schema.prisma` (giữ mọi thứ khác)

Thêm enum + model mới:

```prisma
enum NotifyKind {
  webhook
  email
}

/** Nhật ký chạy job định kỳ (tỷ giá, cảnh báo hằng ngày). */
model JobRun {
  id         Int       @id @default(autoincrement())
  jobName    String    // 'alerts_daily' | 'rates_monthly'
  trigger    String    // 'cron' | 'lazy' | 'admin'
  status     String    // 'running' | 'ok' | 'error'
  detail     String    @default("")
  startedAt  DateTime  @default(now())
  finishedAt DateTime?
  startedBy  String    @default("system")

  @@index([jobName, startedAt])
  @@map("job_run")
}

/** Nền thông báo P3B: 1 dòng = 1 kênh. Bí mật (webhook URL / mật khẩu SMTP) chỉ nằm trong secretEnc (AES-256-GCM). */
model NotifyChannel {
  id          Int               @id @default(autoincrement())
  kind        NotifyKind
  name        String
  isEnabled   Boolean           @default(false)
  minSeverity AlertType         @default(Red) // Red = chỉ gửi Đỏ; Amber = gửi cả Vàng và Đỏ
  settings    Json              @default("{}") // phần KHÔNG bí mật, xem NotifyChannelSettings trong types.ts
  secretEnc   String?
  secretHint  String            @default("")
  updatedAt   DateTime          @default(now()) @updatedAt
  updatedBy   String            @default("system")
  recipients  NotifyRecipient[]

  @@map("notify_channel")
}

/** Người nhận email theo kênh + mức độ tối thiểu. */
model NotifyRecipient {
  id          Int           @id @default(autoincrement())
  channelId   Int
  email       String
  minSeverity AlertType     @default(Red)
  isEnabled   Boolean       @default(true)
  channel     NotifyChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  @@unique([channelId, email])
  @@map("notify_recipient")
}
```

Sửa model có sẵn:
- `Factory`: thêm `isActive Boolean @default(true)`.
- `ExchangeRate`: thêm `source String @default("manual")` (comment `// 'vcb' | 'manual'`).
- `AlertLog`: thêm
  `ruleCode String?`, `dedupeKey String?`, `closedBy String?`, `closeNote String @default("")`,
  `notifyChannel String?` (comment: `// P3B: danh sách kênh đã gửi, dạng 'webhook:1,email:2'; null = chưa gửi`),
  `notifySentAt DateTime?`, `notifyError String?`, `notifyAttempts Int @default(0)`;
  thêm `@@unique([projectId, dedupeKey])`, `@@index([notifySentAt])`.
- `AuditLog`: thêm `note String @default("")`.
- `FactDailyManpower`, `FactDailyEquipmentUsage`, `FactVolume`: thêm `updatedAt DateTime @default(now()) @updatedAt`, `updatedBy String @default("system")`.
- **Chỉ khi Q1 = B**: `FactDailyEquipmentUsage` thêm `shiftCode String` + `shift Shift @relation(fields: [shiftCode], references: [code], onDelete: Restrict)`,
  `@@id([projectId, contractorId, equipmentId, workDate, shiftCode])`; `Shift` thêm `equipment FactDailyEquipmentUsage[]`.

### 1.2 Migration `prisma/migrations/20260924150000_p2a_entry_foundation/migration.sql`

Sinh khung như P1A: `npx prisma migrate diff --from-url "$env:DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > <file>`
(trống thì lấy `DATABASE_URL` từ `.env`), rồi **sửa tay** thành đúng thứ tự sau (câu lệnh cột/bảng/index/FK dùng nguyên văn Prisma sinh):

1. Ca: `UPDATE "dim_shift" SET "code" = 'evening', "nameVi" = 'Ca tối', "nameEn" = 'Evening' WHERE "code" = 'afternoon';`
   (comment: FK fact_daily_manpower ON UPDATE CASCADE tu doi theo).
2. `ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` + `"updatedBy" TEXT NOT NULL DEFAULT 'system'` cho 3 bảng
   `fact_daily_manpower`, `fact_daily_equipment_usage`, `fact_volume`.
3. (3b, **chỉ khi Q1 = B**) giống P1A mục 2: `ADD COLUMN "shiftCode" TEXT NOT NULL DEFAULT 'morning'`, đổi PK sang
   `("projectId","contractorId","equipmentId","workDate","shiftCode")`, `DROP DEFAULT`, FK `fact_daily_equipment_usage_shiftCode_fkey`
   → `dim_shift("code")` ON DELETE RESTRICT ON UPDATE CASCADE. Comment: du lieu cu la tong ngay -> don vao ca sang.
4. `ALTER TABLE "dim_factory" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;`
5. Tỷ giá: `ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual'` rồi thêm tay
   `ALTER TABLE "dim_exchange_rate" ADD CONSTRAINT "dim_exchange_rate_source_check" CHECK ("source" IN ('vcb','manual'));`
   `ALTER TABLE "dim_exchange_rate" ADD CONSTRAINT "dim_exchange_rate_rate_check" CHECK ("rateToVnd" > 0);`
   5b. (**chỉ khi Q8 = a**, mặc định có):
   ```sql
   DELETE FROM "dim_exchange_rate" WHERE "currencyCode" IN ('AUD','SAR');
   DELETE FROM "dim_currency" c WHERE c."code" IN ('AUD','SAR')
     AND NOT EXISTS (SELECT 1 FROM "dim_project" p WHERE p."currencyCode" = c."code");
   ```
6. `ALTER TABLE "audit_log" ADD COLUMN "note" TEXT NOT NULL DEFAULT '';`
7. `alert_log`: 8 cột như 1.1; backfill `ruleCode` cho dòng cũ:
   ```sql
   UPDATE "alert_log" SET "ruleCode" = CASE
     WHEN "ruleTriggered" LIKE 'SPI <%' THEN 'spi_low'
     WHEN "ruleTriggered" LIKE 'CPI <%' THEN 'cpi_low'
     WHEN "ruleTriggered" LIKE 'Nguy cơ phạt%' THEN 'penalty_risk'
     WHEN "ruleTriggered" LIKE 'Đã quá mốc%' THEN 'penalty_overdue'
     ELSE NULL END;
   ```
   (`dedupeKey` dòng cũ để NULL.) Rồi unique `alert_log_projectId_dedupeKey_key` + index `alert_log_notifySentAt_idx` do Prisma sinh.
8. `CREATE TABLE "job_run"` + index; thêm tay `ALTER TABLE "job_run" ADD CONSTRAINT "job_run_status_check" CHECK ("status" IN ('running','ok','error'));`
9. `CREATE TYPE "NotifyKind"`, `CREATE TABLE "notify_channel"`, `"notify_recipient"` + unique + FK do Prisma sinh.
10. **XOÁ** mọi dòng `DROP INDEX "ux_fact_progress_latest"` / `"ux_fact_financial_latest"` nếu diff sinh ra (index partial viết tay).

Áp: tắt dev → `npx prisma migrate deploy` → `npx prisma generate`.

### 1.3 Rollback `prisma/rollback/20260924150000_p2a_entry_foundation.down.sql`

Trong `BEGIN; ... COMMIT;`, thứ tự ngược: drop `notify_recipient`, `notify_channel`, type `NotifyKind`, `job_run`; `alert_log` drop unique +
index + 8 cột; `audit_log` drop `note`; `dim_exchange_rate` drop 2 check + `source`; (5b) `INSERT INTO "dim_currency" ("code","name") VALUES
('AUD','Australian Dollar'),('SAR','Saudi Riyal') ON CONFLICT DO NOTHING;` (tỷ giá AUD/SAR không khôi phục — ghi comment); `dim_factory` drop
`isActive`; 3 bảng fact drop `updatedAt`/`updatedBy`; (3b) gộp ca thiết bị về ngày theo đúng khuôn P1A rollback mục 2
(`prisma/rollback/20260924090000_p1a_data_foundation.down.sql`); `UPDATE "dim_shift" SET "code"='afternoon',"nameVi"='Ca chiều',"nameEn"='Afternoon' WHERE "code"='evening';`;
`DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260924150000_p2a_entry_foundation';`.
Chạy: `npx prisma db execute --file prisma/rollback/20260924150000_p2a_entry_foundation.down.sql --schema prisma/schema.prisma`.

### 1.4 `src/server/repo/types.ts`

```ts
export type CurrencyCode = 'VND' | 'USD' | 'EUR';            // Q8=a; Q8=b thì giữ nguyên dòng cũ
export interface Factory { id: number; name: string; region: string; capacityTonPerYear: number; isActive: boolean }
export type FxSource = 'vcb' | 'manual';
export interface ExchangeRate {
  currencyCode: CurrencyCode; yearMonth: string; rateToVnd: number;
  source: FxSource; updatedBy: string | null; updatedAt: string | null;
}
// AlertLog thêm (giữ field cũ):
//   ruleCode: string | null; dedupeKey: string | null; closedBy: string | null; closeNote: string;
//   notifyChannel: string | null; notifySentAt: string | null; notifyError: string | null; notifyAttempts: number;
// AuditLogEntry thêm: note: string;
export type JobName = 'alerts_daily' | 'rates_monthly';
export type JobTrigger = 'cron' | 'lazy' | 'admin';
export interface JobRunEntry {
  id: number; jobName: JobName; trigger: JobTrigger; status: 'running' | 'ok' | 'error';
  detail: string; startedAt: string; finishedAt: string | null; startedBy: string;
}
```
`tsc` sẽ chỉ ra mọi chỗ dựng `AlertLog`/`AuditLogEntry`/`Factory`/`ExchangeRate` cần thêm field (seed, mock `logAudit`,
`prisma-repo` `getAlerts`/`getAuditLog`/`getDims`, `src/server/audit-log-page.ts:40-50` thêm `note: a.note`).

### 1.5 `src/lib/alert-keys.ts` (mới, thuần)

```ts
import { type IsoDate, type YearMonth } from '@/lib/clock';
export type AlertRuleCode = 'spi_low' | 'cpi_low' | 'penalty_risk' | 'penalty_overdue' | 'ar_overdue' | 'manpower_low' | 'equipment_low';
/** Tuần ISO của 1 ngày, dạng '2026-W38' (Thứ 2 đầu tuần, tuần chứa Thứ 5 đầu năm là W01). */
export function isoWeekOf(d: IsoDate): string;
export function monthKey(code: AlertRuleCode, ym: YearMonth): string;          // 'spi_low:2026-09'
export function handoverKey(code: AlertRuleCode, handover: string | null): string; // 'penalty_risk:2026-10-01' (10 ký tự đầu) | 'penalty_risk:none'
export function weekKey(code: AlertRuleCode, d: IsoDate): string;             // 'manpower_low:2026-W38'
```
Test `alert-keys.test.ts`: `isoWeekOf('2026-09-16')==='2026-W38'`, `'2021-01-03'==='2020-W53'`, `'2024-12-30'==='2025-W01'`;
`handoverKey('penalty_risk','2026-10-01T00:00:00.000Z')==='penalty_risk:2026-10-01'`; null → `':none'`.

### 1.6 Repo (mọi sửa `prisma-repo.ts` của P2A nằm ở đây)

- `prisma-repo.ts`: đổi `export const repo = {` thành `const coreRepo = {`; cuối file
  `export const repo = { ...coreRepo, ...entryPrismaRepo };` (import `entryPrismaRepo` từ `./prisma-repo-entry`).
  `getDims`: factory map thêm `isActive`; exchangeRates map thêm `source: e.source as FxSource`, `updatedBy`, `updatedAt: iso(e.updatedAt)`.
  `getAlerts`: map 8 field mới (`notifySentAt: iso(...)`). `getAuditLog`: thêm `note`.
  `logAudit(tableName, recordId, field, oldValue, newValue, changedBy, note = '')` ghi `note`.
  `closeAlert(id, action, changedBy = 'system', note = '')`: `data: { closedAt: new Date(), action, closedBy: changedBy, closeNote: note }`; audit như cũ.
- `mock-repo.ts`: cùng các thay đổi (`const coreRepo = {...}`; `export const repo = { ...coreRepo, ...makeEntryMockRepo({ getData, persist }) };`).
  `getDims` giữ trả mọi factory (kể cả ngừng dùng). `resetAllData` KHÔNG xoá `jobRuns` (log vận hành).
- `prisma-repo-entry.ts` (mới): `export const entryPrismaRepo = { ... }` — Task 1 chỉ có:
  ```ts
  async getShifts(): Promise<Shift[]>                // isActive = true, orderBy sortOrder asc
  async getDailyManpowerByShift(projectId: number, from: IsoDate, to: IsoDate): Promise<FactDailyManpowerShift[]> // sắp workDate, contractorId, shift.sortOrder
  ```
  Kèm helper nội bộ `audit(tx, tableName, recordId, field, oldValue, newValue, changedBy, note)` gọi `prisma.auditLog.create` (dùng lại ở Task 3–8).
- `mock-repo-entry.ts` (mới): `export function makeEntryMockRepo(deps: { getData: () => RepoData; persist: () => void })` trả object cùng tên hàm (sync).
  Helper audit nội bộ đẩy vào `getData().auditLog` (khuôn `mock-repo.ts` `logAudit`).
- `index.ts` giữ nguyên.

### 1.7 Seed

- `src/data/seed/erp.ts` `shifts`: dòng 2 → `{ code: 'evening', nameVi: 'Ca tối', nameEn: 'Evening', sortOrder: 2, isActive: true }`.
- `src/lib/shifts.ts`: `splitHeadcount` comment/biến: `[ca sáng, ca tối]`, biến `evening`. `shifts.test.ts`: `'afternoon'` → `'evening'`.
- `src/data/seed/history.ts`: `SEED_VERSION = '2026-09-24-p2a'`; `buildDailyResources` dùng `shiftCode: 'evening'` (đổi tên biến `afternoon*` → `evening*`);
  `RepoData` thêm `jobRuns: JobRunEntry[]` (= `[]`); `buildAlerts` thêm cho mỗi alert: `ruleCode` + `dedupeKey`
  (`spi_low`/`cpi_low` → `monthKey(code, SEED_CURRENT_MONTH)`; `penalized` → `penalty_overdue`, `risk` → `penalty_risk`, cả hai `handoverKey(code, proj.committedHandoverDate)`),
  `closedBy: null, closeNote: '', notifyChannel: null, notifySentAt: null, notifyError: null, notifyAttempts: 0`.
- `src/data/seed/dims.ts`: `factories` thêm `isActive: true`; (Q8=a) bỏ AUD/SAR ở `currencies` và `exchangeRates`; mỗi dòng tỷ giá thêm
  `source: 'manual', updatedBy: 'system', updatedAt: '2026-09-01T00:00:00Z'`.
- `prisma/seed.ts`: `exchangeRate.createMany` map `updatedAt: d(r.updatedAt)`; `alertLog.createMany` map thêm `notifySentAt: d(a.notifySentAt)`;
  thêm `await prisma.jobRun.deleteMany();` cạnh khối log. KHÔNG đụng `notify_channel`/`notify_recipient` (cấu hình giữ qua seed lại).
- `src/data/seed/history.test.ts`: test dòng 81-92 → `['evening', 'morning']`; thêm: mọi alert seed có `ruleCode` ≠ null và `dedupeKey` không trùng trong cùng dự án.
- `src/server/validation.ts`: `CURRENCY = ['VND', 'USD', 'EUR'] as const` (Q8=a). `src/lib/data-dictionary.ts:34`: "USD/EUR".

### 1.8 Test Task 1

- `src/server/repo/entry.test.ts` (mới, mock-repo): `getShifts()` trả đúng 2 mã theo thứ tự `['morning','evening']`, tên `Ca tối`;
  `getDailyManpowerByShift(1, ngày cuối seed, ngày cuối seed)` có 12 dòng, tổng KH 520 / TT 486; `closeAlert(id,'X','u@x','ghi chú')` →
  `closedBy 'u@x'`, `closeNote 'ghi chú'`; `logAudit(..., 'lý do')` → `getAuditLog()[..].note === 'lý do'`.
- `src/server/repo/prisma-repo-entry.test.ts` (mới, mock `@/server/db`): `getDailyManpowerByShift` gọi `findMany` với `workDate: { gte, lte }` 00:00Z và map `workDate` về `YYYY-MM-DD`.
- `alert-keys.test.ts` như 1.5. Test cũ có `closeAlertAction(id, 'Đã xử lý')` phải vẫn xanh.

### 1.9 Nghiệm thu Task 1

- Trước deploy ghi lại (qua `npx tsx -e` + `$queryRaw`): `SELECT "shiftCode", COUNT(*), SUM("plannedHeadcount"), SUM("actualHeadcount") FROM fact_daily_manpower GROUP BY 1`.
  Sau deploy: dòng `evening` = dòng `afternoon` cũ (số lượng + tổng), không còn `afternoon`; `SELECT COUNT(*) FROM dim_project WHERE "currencyCode" IN ('AUD','SAR')` = 0 trước khi chạy 5b.
- `migrate diff` chạy lại → chỉ còn tối đa 2 dòng DROP INDEX `ux_fact_*_latest` (dương tính giả đã biết).
- Hồi phục 1 vòng: rollback → tổng nhân lực không đổi, ca về `afternoon` → `migrate deploy` lại → `npx prisma db seed` xanh.
- Dev cổng 3000: trang chi tiết dự án 1 vẫn KH 520 / TT 486. `tsc` + `npm test` xanh.

---

## Task 2 — Nền thông báo cho P3B: mã hoá bí mật + type cấu hình

**Commit:** `feat(p2a): nen thong bao P3B - secret-box AES-256-GCM va type cau hinh kenh`

- `src/lib/secret-box.ts` (mới, chỉ server; `import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'`):
  ```ts
  export const SECRET_KEY_ENV = 'NOTIFY_SECRET_KEY';
  /** true khi env có khoá base64 giải ra đúng 32 byte. */
  export function hasSecretKey(): boolean;
  /** 'v1:' + b64(iv 12 byte) + ':' + b64(tag 16 byte) + ':' + b64(ciphertext). Thiếu khoá → throw Error('secret_key_missing'); sai độ dài → 'secret_key_invalid'. */
  export function sealSecret(plain: string): string;
  /** Sai định dạng → throw Error('secret_bad_format'); sai khoá/bị sửa → throw Error('secret_decrypt_failed'). */
  export function openSecret(sealed: string): string;
  /** '••••' + 4 ký tự cuối; chuỗi ≤ 4 ký tự → '••••'. */
  export function secretHint(plain: string): string;
  ```
- `src/server/repo/types.ts` thêm (kèm comment "P3B dùng; P2A chưa có hàm repo/UI"):
  ```ts
  export type NotifyKind = 'webhook' | 'email';
  export type AlertSeverity = 'Red' | 'Amber';
  export interface NotifyChannelSettings {
    webhookFormat?: 'generic' | 'slack' | 'teams';                  // kind = webhook
    smtpHost?: string; smtpPort?: number; smtpSecure?: boolean;       // kind = email
    smtpUser?: string; fromAddress?: string;
  }
  export interface NotifyChannel {
    id: number; kind: NotifyKind; name: string; isEnabled: boolean; minSeverity: AlertSeverity;
    settings: NotifyChannelSettings; secretHint: string; hasSecret: boolean; // KHÔNG bao giờ trả secretEnc ra UI
    updatedAt: string; updatedBy: string;
  }
  export interface NotifyRecipient { id: number; channelId: number; email: string; minSeverity: AlertSeverity; isEnabled: boolean }
  ```
- `.env.example` thêm cuối:
  ```
  # Khoa ma hoa bi mat thong bao (webhook URL, mat khau SMTP) - 32 byte base64: openssl rand -base64 32
  # Mat khoa = khong giai ma duoc bi mat da luu (phai nhap lai). Khong commit gia tri that.
  NOTIFY_SECRET_KEY=
  ```
- Test `src/lib/secret-box.test.ts` (đặt/xoá `process.env.NOTIFY_SECRET_KEY` trong `beforeEach`/`afterEach`): seal→open trả đúng chuỗi có dấu tiếng Việt;
  2 lần seal cùng chuỗi ra 2 kết quả khác nhau; sửa 1 ký tự ciphertext → `secret_decrypt_failed`; đổi khoá → `secret_decrypt_failed`;
  thiếu env → `secret_key_missing` + `hasSecretKey()===false`; khoá 16 byte → `secret_key_invalid`; `'abc'` → `secret_bad_format`;
  `secretHint('https://hooks.x/abcd1234')==='••••1234'`, `secretHint('ab')==='••••'`.
- Nghiệm thu: `tsc` + `npm test` xanh.

---

## Task 3 — G-18 Nhà thầu tham gia + khung bước "Nhân lực & Thiết bị"

**Commit:** `feat(p2a): G-18 nha thau tham gia du an va buoc Nhan luc & Thiet bi`

### Repo (prisma + mock, trong file `*-entry.ts`)

```ts
addProjectContractor(projectId: number, contractorId: number, by: string): 'added' | 'exists' | 'not_found'
  // not_found = dự án không tồn tại/không active HOẶC nhà thầu không tồn tại/không active. Audit: ('project_contractor', `${p}/${c}`, 'add', '', name, by)
removeProjectContractor(projectId: number, contractorId: number, by: string): 'removed' | 'has_data' | 'not_member'
  // has_data (Q5=a) = có ≥1 dòng fact_daily_manpower HOẶC fact_daily_equipment_usage của (projectId, contractorId). Audit field 'remove'.
createContractor(name: string, scopeOfWork: string, by: string): Contractor
  // name trim; trùng tên (không phân biệt hoa thường) với nhà thầu active → trả nhà thầu đó, không tạo. Audit ('dim_contractor', id, 'create').
```
(Prisma: bản ghi mới dùng sequence — seed đã sync `dim_contractor`.)

### `src/server/action-guards.ts` (mới, KHÔNG `'use server'`)

```ts
import { getCurrentUser, type CurrentUser } from '@/lib/session';
export async function requireRoleUser(allowed: Role[]): Promise<CurrentUser | null>;   // như requireRole ở actions.ts:18-22
export async function requireWriteProject(projectId: number): Promise<CurrentUser | null>; // getCurrentUser + canWriteProject
```

### `src/server/actions-entry.ts` (mới, `'use server'`)

```ts
export async function addProjectContractorAction(projectId: number, contractorId: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' }>
export async function removeProjectContractorAction(projectId: number, contractorId: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'has_data' | 'not_member' | 'Invalid input' }>
/** Q4=a: tạo (hoặc lấy trùng tên) rồi gắn luôn vào dự án. */
export async function createContractorAction(projectId: number, name: string, scopeOfWork: string): Promise<{ ok: true; id: number } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' }>
```
Thứ tự mỗi action: `requireWriteProject` (null → Forbidden) → zod → repo → `logActivity(user, 'project_contractor_add'|'..._remove'|'contractor_create', ...)`.
Zod (`validation.ts`): `projectContractorSchema = { projectId: int>0, contractorId: int>0 }`; `createContractorSchema = { projectId: int>0, name: trim 1..120, scopeOfWork: trim max 200 }`.

### UI

- `src/components/form/ContractorJoinBlock.tsx` (client): props `{ projectId: number; members: Contractor[]; allContractors: Contractor[]; disabled: boolean }`.
  Tiêu đề `sect` `t('contractorJoin.title')`; mỗi thành viên 1 `chip` (tên + nút ×; bấm → `window.confirm(t('contractorJoin.confirmRemove', { name }))` → action → `router.refresh()`);
  `Combobox` (`src/components/form/Combobox.tsx`) `options` = nhà thầu active chưa tham gia, `allowCreate`, `createLabel={t('contractorJoin.create')}`,
  `onCreate` gọi `createContractorAction(projectId, name, '')` trả `String(id)`; chọn → `addProjectContractorAction`. Lỗi → `<p className="sumbar bad">` theo `contractorJoin.err.<mã>`
  (`has_data`, `forbidden` cho 'Forbidden', còn lại `generic` với `{ msg }`). Không thành viên → `<p className="empty">{t('contractorJoin.empty')}</p>`.
- `src/components/form/ResourceEntryPanel.tsx` (client) — Task 3 chỉ render `ContractorJoinBlock`; Task 4 thêm lưới. Props (đủ luôn cho Task 4-5):
  ```ts
  export interface ResourceEntryPanelProps {
    projectId: number; masterCode: string; date: IsoDate; today: IsoDate;
    entryWindow: { min: IsoDate | null; max: IsoDate }; monthLocked: boolean; // KHÔNG đặt tên `window` (trùng biến toàn cục)
    members: Contractor[]; allContractors: Contractor[]; shifts: Shift[]; equipments: Equipment[];
    manpower: FactDailyManpowerShift[]; equipment: FactDailyEquipmentUsage[];
  }
  ```
  (Task 3: `entryWindow`/`date`… đã truyền nhưng chưa dùng hết.)
- `src/components/form/DataEntryForm.tsx`:
  - `export type DataEntryStep = 'progress' | 'finance' | 'profile' | 'extras' | 'resources';`
  - Props thêm `resourcesPanel: React.ReactNode`.
  - `steps` thêm `{ key: 'resources', label: t('dailyEntry.step') }` cuối.
  - Nút "Tiếp" (dòng 718): điều kiện `step !== 'resources'`.
  - Khối `<div className={`card overflow-visible ${locked ? ...}`}>` (dòng 371-678): bọc thành `{step === 'resources' ? resourcesPanel : (<div ...>...</div>)}`.
  - Nút Lưu tháng (dòng 726-732) chỉ render khi `step !== 'resources'`.
- `app/[locale]/(app)/nhap-lieu/page.tsx`:
  - `STEPS` thêm `'resources'`.
  - Tạo luôn `src/lib/daily-entry.ts` ở Task này với hằng số `DAILY_EDIT_BACK_DAYS`, `DAILY_PLAN_AHEAD_DAYS` và hàm `dailyDateWindow`, `isInWindow`
    (chữ ký + quy tắc ở Task 4; Task 4 thêm phần còn lại của file và test).
  - Ngày: `const today = todayIso()` (đã có); `const w = dailyDateWindow(user.role, today)`;
    `date` = `searchParams.date` nếu `isValidIsoDate` và `isInWindow(date, w)`, không thì `today`.
  - Nạp: `members = await repo.getContractors(project.id)`, `allContractors = await repo.getContractors()`, `shifts = await repo.getShifts()`,
    `equipments = await repo.getEquipments()`, `manpower = await repo.getDailyManpowerByShift(project.id, date, date)`,
    `equipment = await repo.getDailyEquipment(project.id, date, date)`, `monthLocked = await repo.isMonthLocked(date.slice(0, 7))`.
  - Truyền `resourcesPanel={<ResourceEntryPanel ... />}` vào `DataEntryForm`.

### i18n `contractorJoin`

| key | vi | en |
|---|---|---|
| `title` | Nhà thầu tham gia | Participating contractors |
| `empty` | Chưa có nhà thầu tham gia — thêm nhà thầu để nhập nhân lực/thiết bị. | No contractors yet — add one to enter manpower/equipment. |
| `add` | Thêm nhà thầu | Add contractor |
| `create` | + Tạo nhà thầu mới | + Create new contractor |
| `remove` | Gỡ | Remove |
| `confirmRemove` | Gỡ {name} khỏi dự án? | Remove {name} from this project? |
| `err.has_data` | Không gỡ được: nhà thầu đã có số liệu nhân lực/thiết bị ở dự án này. | Cannot remove: this contractor already has manpower/equipment data here. |
| `err.forbidden` | Bạn không có quyền sửa dự án này. | You are not allowed to edit this project. |
| `err.generic` | Lỗi: {msg} | Error: {msg} |

Thêm `dailyEntry.step`: `Nhân lực & Thiết bị` / `Manpower & Equipment` (phần còn lại nhóm `dailyEntry` ở Task 4).

### Test

- `src/server/actions-entry.test.ts` (mới): PIC `pm@daidung.com.vn` (dự án 1) — thêm nhà thầu tạo mới → `ok`, `getContractors(1)` có thêm; data-entry dự án 16 (không gán) → Forbidden; viewer, bod → Forbidden;
  gỡ nhà thầu 1 khỏi dự án 1 → `has_data`; tạo nhà thầu mới rồi gỡ ngay → `ok`; gỡ nhà thầu không thuộc dự án → `not_member`;
  `createContractorAction(1, '  nhà thầu lắp dựng a ', '')` → trả id 1 (trùng tên), không tạo dòng mới; tên rỗng → `Invalid input`; dự án 999999 → `Not found` (admin).
- `entry.test.ts` thêm: `addProjectContractor` lần 2 → `'exists'`; nhà thầu `isActive=false` → `'not_found'`; mỗi add/remove có 1 dòng audit `project_contractor`.
- `nhap-lieu-page-guard.test.ts` thêm (mock `@/components/form/ResourceEntryPanel` ghi props): admin `?project=1&step=resources` → props `members.length === 6`, `shifts` 2 dòng;
  `?date=abc` → `date === '2026-09-16'`.
- Nghiệm thu: `tsc` + `npm test` xanh; dev: `/vi/nhap-lieu?project=1&step=resources` thấy 6 chip; thêm/gỡ nhà thầu mới được.

---

## Task 4 — B: nhập nhân lực theo ca + thiết bị theo ngày, sửa ngày cũ có log

**Commit:** `feat(p2a): nhap nhan luc theo ca va thiet bi theo ngay - sua ngay cu co ly do va audit`

### `src/lib/daily-entry.ts` (thuần; file đã tạo ở Task 3 — Task 4 bổ sung phần còn lại)

```ts
export const DAILY_EDIT_BACK_DAYS = 7;     // Q2: data-entry lùi tối đa
export const DAILY_PLAN_AHEAD_DAYS = 30;   // Q2: nhập KH trước
export const DAILY_REASON_MIN = 5;
export const DAILY_VALUE_MAX = 100_000;
export interface ManpowerCellInput { contractorId: number; shiftCode: string; plannedHeadcount: number; actualHeadcount: number }
export interface EquipmentCellInput { contractorId: number; equipmentId: number; qtyPlanned: number; qtyActual: number }
/** admin: min null; data-entry: min = today - 7; max = today + 30 cho mọi role. */
export function dailyDateWindow(role: Role, today: IsoDate): { min: IsoDate | null; max: IsoDate };
export function isInWindow(d: IsoDate, w: { min: IsoDate | null; max: IsoDate }): boolean;
/** d > today và có actual > 0 ở bất kỳ ô nào → true. */
export function hasFutureActual(d: IsoDate, today: IsoDate, mp: ManpowerCellInput[], eq: EquipmentCellInput[]): boolean;
/** true khi d < today VÀ có ít nhất 1 ô ĐÃ TỒN TẠI trong DB bị đổi giá trị. */
export function needsReason(d: IsoDate, today: IsoDate, mp: ManpowerCellInput[], eq: EquipmentCellInput[],
  existingMp: FactDailyManpowerShift[], existingEq: FactDailyEquipmentUsage[]): boolean;
```

### Repo `saveDailyResources` (prisma + mock)

```ts
saveDailyResources(projectId: number, workDate: IsoDate,
  input: { manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] }, by: string, note: string)
  : { created: number; updated: number; unchanged: number }
```
Mỗi ô: không có dòng + cả 2 số = 0 → `unchanged` (không tạo dòng 0); không có dòng → create (`updatedBy: by`) → `created`; có dòng, số y hệt → `unchanged`;
khác → update (`updatedBy: by`) + audit `('fact_daily_manpower', `${p}/${c}/${date}/${shift}`, 'plannedHeadcount,actualHeadcount', `${oldKH}/${oldTT}`, `${newKH}/${newTT}`, by, note)`
(thiết bị: `'fact_daily_equipment_usage'`, recordId `${p}/${c}/${e}/${date}`, field `'qtyPlanned,qtyActual'`) → `updated`. Không bao giờ xoá dòng.
Prisma: 1 `prisma.$transaction(async (tx) => {...})` — `findMany` 2 bảng của (projectId, workDate) trước, rồi `create`/`update` từng ô, audit `tx.auditLog.createMany`.

### `saveDailyResourcesAction` (trong `actions-entry.ts`)

```ts
export async function saveDailyResourcesAction(projectId: number, workDate: string,
  payload: { manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] }, reason?: string)
  : Promise<{ ok: true; created: number; updated: number; unchanged: number } | { ok: false; error: DailySaveError; month?: string }>
export type DailySaveError = 'Forbidden' | 'Invalid input' | 'Not found' | 'out_of_window' | 'locked' | 'invalid_contractor'
  | 'invalid_shift' | 'invalid_equipment' | 'actual_future' | 'reason_required';
```
Thứ tự (dừng ở lỗi đầu tiên, KHÔNG ghi gì khi lỗi): `requireWriteProject` → zod `saveDailyResourcesSchema`
(`workDate` isoDate; `manpower` max 500 phần tử, `equipment` max 500, mọi số `z.number().int().min(0).max(DAILY_VALUE_MAX)`, `shiftCode` trim 1..20, `reason` max 500 optional)
→ `getProject` → `isInWindow(workDate, dailyDateWindow(user.role, todayIso()))` → `isMonthLocked(workDate.slice(0,7))` (`locked` + `month`)
→ mọi `contractorId` ∈ `getContractors(projectId)` → mọi `shiftCode` ∈ `getShifts()` → mọi `equipmentId` ∈ `getEquipments()` → `hasFutureActual`
→ đọc `getDailyManpowerByShift`/`getDailyEquipment` ngày đó; `needsReason` && `(reason ?? '').trim().length < DAILY_REASON_MIN` → `reason_required`
→ `repo.saveDailyResources(..., user.email, reason?.trim() ?? '')` → `logActivity(user, 'save_daily_resources', `project ${id} · ${date}`)`.
(Task 8 chèn gọi engine ngay trước `logActivity`.)

### `src/components/form/resourceEntryState.ts` (thuần, không React)

```ts
export interface ManpowerGridRow { contractorId: number; contractorName: string; cells: Record<string, { planned: string; actual: string }> } // key = shiftCode
export interface EquipmentGridRow { key: string; contractorId: number; equipmentId: number; planned: string; actual: string; isNew: boolean }
export function buildManpowerGrid(members: Contractor[], shifts: Shift[], rows: FactDailyManpowerShift[]): ManpowerGridRow[]; // mọi (thành viên × ca); thiếu dòng → '0'
export function buildEquipmentGrid(rows: FactDailyEquipmentUsage[]): EquipmentGridRow[]; // isNew=false, key=`${c}-${e}`
export function manpowerTotals(grid: ManpowerGridRow[], shifts: Shift[]): {
  byContractor: Record<number, { planned: number; actual: number }>;
  byShift: Record<string, { planned: number; actual: number }>;
  day: { planned: number; actual: number };
}; // ô không phải số nguyên hợp lệ tính 0
export function gridToPayload(mg: ManpowerGridRow[], eg: EquipmentGridRow[]):
  { ok: true; manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] } | { ok: false; error: 'bad_number' | 'duplicate_equipment'; key: string };
  // '' → 0; không phải số nguyên ≥ 0 → bad_number (key = `${contractorId}.${shiftCode}.planned` hoặc key dòng thiết bị); 2 dòng thiết bị cùng (c,e) → duplicate_equipment
```

### UI `ResourceEntryPanel.tsx` (thêm dưới `ContractorJoinBlock`, chỉ khi `members.length > 0`)

- Hàng đầu: `<input type="date" className="inp" min={entryWindow.min ?? undefined} max={entryWindow.max}>`; đổi → cập nhật query `date` (chép `updateQuery` trong `DataEntryForm.tsx`, giữ `project`, `month`, `step=resources`).
- `monthLocked` → `Badge tone="warn"` `t('dailyEntry.locked', { month })`, mọi ô `disabled`. Ngày ngoài window → `hintline` `outOfWindow`, `disabled`.
- Bảng nhân lực (`tbl`): cột Nhà thầu | với mỗi ca (theo `shifts`, tên `nameVi`/`nameEn` theo locale): KH, TT (`inp` number step 1 min 0) | Tổng ngày KH/TT (chỉ đọc). Dòng chân: tổng theo ca + tổng ngày (`manpowerTotals`).
- Bảng thiết bị: Nhà thầu (select thành viên) | Thiết bị (select `equipments`) | KH | TT | nút × chỉ ở dòng `isNew`. Nút `t('dailyEntry.addEquipment')`.
- Ngày < `today`: ô `t('dailyEntry.reason')` (`inp`, max 500) + `hintline` `reasonHint`.
- Nút `btn` `t('dailyEntry.save', { date })`: `gridToPayload` lỗi → `sumbar bad` `err.bad_number`/`err.duplicate_equipment`; ok → `saveDailyResourcesAction` → ok: `chip c-ok` `saved` + `router.refresh()`; lỗi → `sumbar bad` `t('dailyEntry.err.<mã>')` (`Forbidden`→`forbidden`, `Invalid input`/`Not found`→`generic`).
- **Nếu Q1 = B**: thiết bị cũng có cột theo ca giống bảng nhân lực; `EquipmentCellInput` thêm `shiftCode`; recordId audit thêm `/${shift}`.

### i18n `dailyEntry` (thêm vào nhóm đã tạo ở Task 3)

| key | vi | en |
|---|---|---|
| `date` | Ngày | Date |
| `manpower` | Nhân lực theo ca | Manpower by shift |
| `equipment` | Thiết bị | Equipment |
| `contractor` | Nhà thầu | Contractor |
| `planned` | KH | Plan |
| `actual` | TT | Actual |
| `dayTotal` | Tổng ngày | Day total |
| `total` | Tổng | Total |
| `addEquipment` | + Thêm dòng thiết bị | + Add equipment row |
| `reason` | Lý do sửa số ngày cũ | Reason for editing a past day |
| `reasonHint` | Bắt buộc (≥ 5 ký tự) khi sửa số đã có của ngày trước hôm nay — ghi vào nhật ký thay đổi. | Required (≥ 5 chars) when changing existing figures of a past day — stored in the audit log. |
| `save` | Lưu ngày {date} | Save {date} |
| `saved` | Đã lưu: {created} mới · {updated} sửa · {unchanged} không đổi | Saved: {created} new · {updated} changed · {unchanged} unchanged |
| `locked` | Tháng {month} đã khoá số liệu — không sửa được. | Month {month} is locked — read only. |
| `outOfWindow` | Ngày này ngoài khoảng được phép nhập/sửa. | This date is outside the allowed entry window. |
| `err.bad_number` | Có ô không hợp lệ — chỉ nhận số nguyên ≥ 0. | Invalid cell — whole numbers ≥ 0 only. |
| `err.duplicate_equipment` | Trùng dòng thiết bị (cùng nhà thầu + thiết bị). | Duplicate equipment row (same contractor + equipment). |
| `err.reason_required` | Nhập lý do (ít nhất 5 ký tự) khi sửa số của ngày cũ. | Enter a reason (at least 5 chars) to edit a past day. |
| `err.actual_future` | Không nhập số thực tế cho ngày trong tương lai. | Actual figures cannot be entered for a future date. |
| `err.out_of_window` | Ngày ngoài khoảng được phép nhập/sửa. | Date outside the allowed window. |
| `err.locked` | Tháng {month} đã khoá số liệu. | Month {month} is locked. |
| `err.invalid_contractor` | Có nhà thầu không thuộc dự án — tải lại trang. | A contractor is not in this project — reload the page. |
| `err.invalid_shift` | Ca làm việc không hợp lệ — tải lại trang. | Invalid shift — reload the page. |
| `err.invalid_equipment` | Thiết bị không hợp lệ — tải lại trang. | Invalid equipment — reload the page. |
| `err.forbidden` | Bạn không có quyền sửa dự án này. | You are not allowed to edit this project. |
| `err.generic` | Lưu thất bại: {msg} | Save failed: {msg} |

### Test

- `src/lib/daily-entry.test.ts`: window admin/data-entry (`today='2026-09-16'` → min `'2026-09-09'`, max `'2026-10-16'`); `isInWindow` biên đúng min/max;
  `hasFutureActual` (ngày mai TT 1 → true, KH 5 TT 0 → false); `needsReason`: hôm nay sửa → false; hôm qua đổi ô đã có → true; hôm qua chỉ thêm ô mới → false; hôm qua gửi y hệt → false.
- `resourceEntryState.test.ts`: grid đủ 6 × 2 ô cho dự án 1; totals ngày cuối 520/486; `'1.5'`, `'-1'`, `'abc'` → `bad_number` đúng key; `''` → 0; trùng thiết bị → `duplicate_equipment`.
- `entry.test.ts`: `saveDailyResources` — ô mới 0/0 không tạo dòng; ô mới 5/4 tạo; đổi ô có sẵn → 1 audit có `note`; gửi y hệt → `unchanged`, không audit; tổng qua `getDailyManpower` = tổng các ca.
- `prisma-repo-entry.test.ts`: `$transaction` gọi callback với tx mock; ô đổi → `tx.factDailyManpower.update` + `tx.auditLog.createMany` 1 phần tử có `note`.
- `actions-entry.test.ts`: PIC lưu hôm nay ok (created/updated đếm đúng); data-entry ngày `2026-09-08` → `out_of_window`, admin cùng ngày → ok; ngày `2026-10-17` → `out_of_window`;
  ngày mai TT>0 → `actual_future`; hôm qua đổi số cũ không lý do → `reason_required`, lý do `'nhập nhầm'` → ok và audit `note === 'nhập nhầm'`;
  nhà thầu không thuộc dự án → `invalid_contractor`; shift `'afternoon'` → `invalid_shift`; tháng khoá (`repo.lockMonth('2026-09','admin')`) → `locked` + `month`; viewer → Forbidden; số 1.5 → `Invalid input`.
- Nghiệm thu: `tsc` + `npm test` xanh; dev: sửa 1 ô ngày hôm qua không lý do → báo lỗi; có lý do → lưu, `/vi/audit` thấy dòng `fact_daily_manpower` cũ→mới; tổng ngày cập nhật ở trang chi tiết dự án 1.

---

## Task 5 — B: import Excel nhân lực/thiết bị + file mẫu

**Commit:** `feat(p2a): import Excel nhan luc thiet bi theo ngay va file mau`

### `src/lib/daily-import.ts` (thuần; nhận ô đã đọc, không đụng exceljs)

```ts
export const DAILY_IMPORT_MAX_ROWS = 5000;
export const DAILY_IMPORT_MAX_DAYS = 62;
export const SHEET_MANPOWER = 'NhanLuc';
export const SHEET_EQUIPMENT = 'ThietBi';
/** Q3=a: ['Ngày','Nhà thầu', 'KH <nameVi ca 1>','TT <nameVi ca 1>', ...] theo shifts.sortOrder. */
export function manpowerHeaders(shifts: Shift[]): string[];
export const EQUIPMENT_HEADERS = ['Ngày', 'Nhà thầu', 'Thiết bị', 'KH', 'TT'] as const;
export type CellValue = string | number | boolean | Date | null | { text?: string; result?: unknown; richText?: { text: string }[] };
/** Date (dùng getUTC*), số serial Excel (ngày 0 = 1899-12-30), chuỗi 'd/m/yyyy' | 'dd/mm/yyyy' | 'yyyy-mm-dd'; object: richText nối text, formula lấy result. Không hợp lệ → null. */
export function parseExcelDate(v: CellValue): IsoDate | null;
export function cellText(v: CellValue): string;
export type DailyImportReason = 'bad_date' | 'out_of_window' | 'unknown_contractor' | 'unknown_equipment' | 'bad_number' | 'actual_future' | 'duplicate';
export interface DailyImportRow {
  sheet: 'manpower' | 'equipment'; rowNo: number; // số dòng Excel, header = 1
  workDate: IsoDate | null; contractorName: string; equipmentName: string; // '' với sheet nhân lực
  status: 'ok' | 'invalid'; reason: DailyImportReason | null;
  manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[];
}
export interface DailyImportContext { members: Contractor[]; shifts: Shift[]; equipments: Equipment[]; window: { min: IsoDate | null; max: IsoDate }; today: IsoDate }
export type SheetParse = { ok: true; rows: DailyImportRow[] } | { ok: false; error: 'bad_header' };
export function parseManpowerSheet(header: CellValue[], rows: CellValue[][], ctx: DailyImportContext): SheetParse;
export function parseEquipmentSheet(header: CellValue[], rows: CellValue[][], ctx: DailyImportContext): SheetParse;
export function groupImportByDay(rows: DailyImportRow[]): { workDate: IsoDate; manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] }[]; // chỉ dòng ok, sắp ngày asc
```
Quy tắc: so tiêu đề sau `trim()` + không phân biệt hoa thường; thiếu cột bắt buộc → `bad_header`. Dòng mọi ô trống → bỏ qua (không tính).
Tên nhà thầu khớp `members` (trim, không phân biệt hoa thường), không khớp → `unknown_contractor`; thiết bị khớp `equipments.name` → không thì `unknown_equipment`.
Ô số trống → 0; không phải số nguyên 0..`DAILY_VALUE_MAX` → `bad_number`. Ngày ngoài window → `out_of_window`; ngày > today có TT > 0 → `actual_future`.
Trùng khoá (ngày + nhà thầu [+ thiết bị]) với dòng hợp lệ phía trên cùng sheet → `duplicate`. Thứ tự kiểm: bad_date → out_of_window → unknown_* → bad_number → actual_future → duplicate.

### `src/server/daily-import.ts` (server, exceljs)

```ts
/** Đọc buffer .xlsx; thiếu sheet nào thì sheet đó coi như rỗng. */
export async function readDailyWorkbook(buf: Buffer): Promise<
  { ok: true; manpower: { header: CellValue[]; rows: CellValue[][] }; equipment: { header: CellValue[]; rows: CellValue[][] } } | { ok: false; error: 'bad_file' }>;
/** Sinh file mẫu: sheet NhanLuc (header), ThietBi (header), DanhMuc (cột A tên nhà thầu dự án, B tên ca, C tên thiết bị), HuongDan (các dòng hướng dẫn). */
export async function buildDailyTemplate(input: { members: Contractor[]; shifts: Shift[]; equipments: Equipment[] }): Promise<Buffer>;
```
Header in đậm chữ trắng nền `FF0A1F3D` (khuôn `app/api/report/export/route.ts:53-56`); mọi chuỗi tên đi qua `safeCell` (`src/lib/excel-safe.ts`);
cột Ngày định dạng `dd/mm/yyyy`. Nội dung HuongDan (tiếng Việt, mỗi ý 1 dòng): 1 file = 1 dự án; 1 dòng = 1 ngày × 1 nhà thầu; tên nhà thầu/ca/thiết bị chép từ sheet DanhMuc;
ô trống = 0; tổng ngày app tự cộng; sửa số ngày cũ cần nhập lý do trên màn hình.

### Route `app/api/templates/daily-resources/route.ts`

`export const dynamic = 'force-dynamic'`; `GET(req: Request)`: `project` từ query (số nguyên > 0, sai → 400 `{ error: 'Invalid input' }`);
`user = await getCurrentUser()`; `!(await canWriteProject(user, id))` → 403 `{ error: 'Forbidden' }`; dự án không có → 404; trả xlsx
`Content-Disposition: attachment; filename="mau-nhan-luc-thiet-bi-<masterCode>.xlsx"`.

### Actions (`actions-entry.ts`)

```ts
export async function previewDailyImportAction(formData: FormData)
  : Promise<{ ok: true; rows: DailyImportRow[]; okCount: number; invalidCount: number; days: number } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'bad_file' | 'bad_header' | 'too_many_rows' | 'too_many_days'; sheet?: 'manpower' | 'equipment' }>
  // formData: projectId, file. File: zod dailyImportFileSchema { name: /\.xlsx$/i, size ≤ IMPORT_MAX_BYTES }. rows > 5000 → too_many_rows; số ngày hợp lệ > 62 → too_many_days.
export async function commitDailyImportAction(projectId: number,
  days: { workDate: string; manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] }[], reason?: string)
  : Promise<{ ok: true; days: number; created: number; updated: number; unchanged: number } | { ok: false; error: DailySaveError | 'too_many_days'; month?: string; workDate?: string }>
```
`commit` kiểm lại **toàn bộ** các ngày theo đúng chuỗi kiểm của `saveDailyResourcesAction` TRƯỚC khi ghi ngày nào (lỗi → trả kèm `workDate`, không ghi gì);
`reason_required` nếu bất kỳ ngày nào `needsReason`. Qua hết → gọi `repo.saveDailyResources` lần lượt từng ngày, cộng dồn đếm.
Tách chuỗi kiểm dùng chung thành hàm nội bộ `checkDailyPayload(user, projectId, workDate, payload)` trong `actions-entry.ts` để 2 action cùng gọi.

### UI `src/components/form/DailyImportBlock.tsx` (client, render trong `ResourceEntryPanel` dưới 2 bảng)

`sect` `t('dailyImport.title')`; link `btn ghost` `href=/api/templates/daily-resources?project=<id>` `t('dailyImport.template')`; input file accept `.xlsx`;
nút Xem trước → `previewDailyImportAction`; bảng preview (`tbl`, `scroll` maxHeight 320): Dòng | Sheet | Ngày | Nhà thầu | Thiết bị | Trạng thái (`Badge` ok/danger + lý do);
tóm tắt `summary`; ô lý do (hiện khi server trả `reason_required`); nút `t('dailyImport.commit', { n: days })` → `commitDailyImportAction(projectId, groupImportByDay(rows), reason)` → `done` + `router.refresh()`.

### i18n `dailyImport`

| key | vi | en |
|---|---|---|
| `title` | Nhập từ Excel | Import from Excel |
| `template` | Tải file mẫu | Download template |
| `preview` | Xem trước | Preview |
| `commit` | Ghi {n} ngày | Save {n} days |
| `summary` | {ok} dòng hợp lệ · {invalid} dòng lỗi | {ok} valid rows · {invalid} invalid |
| `rowNo` | Dòng | Row |
| `sheet.manpower` | Nhân lực | Manpower |
| `sheet.equipment` | Thiết bị | Equipment |
| `ok` | Hợp lệ | Valid |
| `done` | Đã ghi {days} ngày ({created} mới · {updated} sửa) | Saved {days} days ({created} new · {updated} changed) |
| `reason.bad_date` | Ngày không đọc được | Unreadable date |
| `reason.out_of_window` | Ngày ngoài khoảng được phép | Date outside allowed window |
| `reason.unknown_contractor` | Nhà thầu không thuộc dự án | Contractor not in project |
| `reason.unknown_equipment` | Thiết bị không có trong danh mục | Unknown equipment |
| `reason.bad_number` | Số không hợp lệ | Invalid number |
| `reason.actual_future` | Có số thực tế cho ngày tương lai | Actual figure on a future date |
| `reason.duplicate` | Trùng dòng phía trên | Duplicate of a row above |
| `err.bad_file` | File không đọc được hoặc không phải .xlsx. | Unreadable or non-.xlsx file. |
| `err.bad_header` | Sheet {sheet} sai tiêu đề cột — dùng file mẫu. | Sheet {sheet} has wrong headers — use the template. |
| `err.too_many_rows` | File quá 5000 dòng. | File exceeds 5000 rows. |
| `err.too_many_days` | File quá 62 ngày — tách nhỏ file. | File exceeds 62 days — split it. |

(Lỗi `DailySaveError` của commit dùng lại `dailyEntry.err.*`, kèm ngày nếu có.)

### Test

- `daily-import.test.ts`: `manpowerHeaders` đúng thứ tự `['Ngày','Nhà thầu','KH Ca sáng','TT Ca sáng','KH Ca tối','TT Ca tối']`;
  `parseExcelDate`: `new Date(Date.UTC(2026,8,15))`→`'2026-09-15'`, `46280`→`'2026-09-15'`, `'15/09/2026'`, `'5/9/2026'`→`'2026-09-05'`, `'2026-09-15'`, `'31/02/2026'`→null, `{ result: 46280 }`;
  mỗi `reason` có 1 ca; header thiếu cột `TT Ca tối` → `bad_header`; dòng trống bị bỏ; `groupImportByDay` gộp 2 sheet cùng ngày.
- `daily-import.test.ts` (server, tên `src/server/daily-import.test.ts`): `buildDailyTemplate` → `readDailyWorkbook` đọc lại được header đúng; sheet DanhMuc có 6 nhà thầu dự án 1; tên nhà thầu bắt đầu `=` được thêm tiền tố `'`; buffer rác → `bad_file`.
- `daily-template-route.test.ts`: chưa đăng nhập → 403; viewer → 403; data-entry không gán dự án → 403; PIC → 200 + content-type spreadsheet; `project=abc` → 400; admin dự án 999999 → 404.
- `actions-entry.test.ts`: preview file dựng bằng `buildDailyTemplate` + ghi thêm 3 dòng (1 ok, 1 nhà thầu lạ, 1 ngày hỏng) → `okCount 1`, `invalidCount 2`, `rowNo` 2,3,4; file `.xls` → `Invalid input`;
  commit 2 ngày, ngày thứ 2 ngoài window → lỗi `out_of_window` + `workDate`, **ngày thứ 1 cũng không được ghi**; commit hợp lệ → đếm đúng.
- Nghiệm thu: `tsc` + `npm test` xanh; dev: tải mẫu, điền 2 ngày, import → số hiện ở lưới + trang chi tiết.

---

## Task 6 — T8: CRUD khu vực/công suất, chọn khu vực cho dự án, nhập sản lượng tháng

**Commit:** `feat(p2a): T8 CRUD khu vuc san xuat, chon khu vuc du an va nhap san luong thang`

### Repo (entry files)

```ts
saveFactory(input: { id?: number; name: string; region: string; capacityTonPerYear: number }, by: string): Factory | 'duplicate_name' | 'not_found'
  // trùng tên (không phân biệt hoa thường) với factory KHÁC id → 'duplicate_name'; id không có → 'not_found'. Audit 'dim_factory' (create/update: cũ→mới).
setFactoryActive(id: number, isActive: boolean, by: string): boolean      // false khi không có id. Audit field 'isActive'.
getVolumes(projectId: number, yearMonth: string): FactVolume[]
saveVolume(projectId: number, yearMonth: string, factoryId: number, tonnageProcessed: number, by: string): 'created' | 'updated' | 'unchanged'
  // upsert khoá (projectId, yearMonth, factoryId); audit 'fact_volume' recordId `${p}/${ym}/${f}` field 'tonnageProcessed' khi created/updated.
```
Không có hàm xoá factory (FK Restrict; chỉ ngừng dùng).

### `src/server/actions-master.ts` (mới, `'use server'`, chỉ admin qua `requireRoleUser(['admin'])`)

```ts
export async function saveFactoryAction(input: { id?: number; name: string; region: string; capacityTonPerYear: number }): Promise<{ ok: true; id: number } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'duplicate_name' | 'Not found' }>
export async function setFactoryActiveAction(id: number, isActive: boolean): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }>
```
Zod `factorySchema`: `id` int>0 optional, `name` trim 1..120, `region` trim max 60, `capacityTonPerYear` > 0 ≤ 10_000_000. Sau ghi: `revalidateTag(profileTag)` + mọi `overviewTag(m)` của `historyMonths()` (khuôn `actions.ts:218-221`).

### `saveMonthlyData` (`src/server/actions.ts` 🔥)

- Kiểu `patch` thêm `factoryId?: number | null; volumeTonnage?: number;`. `saveMonthlyDataSchema.patch` thêm
  `factoryId: z.number().int().positive().nullable().optional()`, `volumeTonnage: z.number().min(0).max(1_000_000).optional()`.
- Ngay sau `safeParse` thành công, TRƯỚC mọi ghi:
  - `factoryId` là số → phải là factory `isActive` trong `(await repo.getDims()).factories`, không → `{ ok: false, error: 'invalid_factory' }`.
  - `volumeTonnage != null` → `target = factoryId !== undefined ? factoryId : project.factoryId` (đổi dòng 76 thành `const project = await repo.getProject(projectId); if (!project) return { ok: false, error: 'Not found' };`);
    `target == null` → `{ ok: false, error: 'no_factory' }`.
- `factoryId !== undefined` → `profilePatch.factoryId = factoryId`.
- Sau khối tài chính: `volumeTonnage != null` → `await repo.saveVolume(projectId, month, target, volumeTonnage, by)`.

### Form

- `src/components/form/dataEntryState.ts`: `FormState` thêm `factoryId: string` (`''` = chưa chọn), `volumeTonnage: string`.
  `buildBaseForm(project, fact, financial, chain, volumeTonnage: number | null = null)` → `factoryId: project.factoryId != null ? String(project.factoryId) : ''`, `volumeTonnage: volumeTonnage != null ? String(volumeTonnage) : ''`.
  `buildSavePatch`: `factoryId` đổi → `'' ? null : Number(v)`; `volumeTonnage` đổi và khác `''` → `Number`. `saveErrorKind` giữ nguyên (mã mới đi nhánh `generic`, UI xử lý riêng dưới).
- `DataEntryForm.tsx`: Props thêm `factories: Factory[]`, `volumeTonnage: number | null` (truyền vào `buildBaseForm`).
  Bước `profile`: thêm `Field` `t('volumeEntry.factory')` = `<select className="inp">` gồm `''` (`volumeEntry.none`) + factory `isActive` + factory hiện tại nếu đã ngừng (nhãn thêm `volumeEntry.inactiveSuffix`).
  Bước `progress`: thêm `Field` `t('volumeEntry.tonnage')` (`inp` number step 0.1) + `hintline` `volumeEntry.hint`.
  Hiển thị lỗi (khối `saveErr` dòng 682-691): `saveErr === 'no_factory'` → `t('volumeEntry.noFactory')`; `'invalid_factory'` → `t('volumeEntry.invalidFactory')`; còn lại như cũ.
- `nhap-lieu/page.tsx`: `factories={dims.factories}`; `volumeTonnage = project && project.factoryId != null ? (await repo.getVolumes(project.id, month)).find((v) => v.factoryId === project.factoryId)?.tonnageProcessed ?? null : null`.

### Admin UI

- `src/components/admin/FactoryEditor.tsx` (client, khuôn `FieldEditor.tsx`): bảng Tên | Vùng | Công suất (tấn/năm) | Trạng thái | thao tác;
  mỗi dòng sửa tại chỗ (3 `inp`) + nút Lưu; nút Ngừng dùng/Dùng lại; dòng cuối thêm mới. Lỗi → `sumbar bad` `factoryAdmin.err.*`.
- `admin/page.tsx`: thay card `admin.factories` (dòng 119-127) bằng card `CardHeader title={t('factoryAdmin.title')}` chứa `<FactoryEditor factories={dims.factories} />`, card đặt ngoài `g2` (full width) ngay trước `g2`.

### i18n `factoryAdmin`, `volumeEntry`

| key | vi | en |
|---|---|---|
| `factoryAdmin.title` | Khu vực / Nhà máy sản xuất | Production areas / Factories |
| `factoryAdmin.name` | Tên khu vực | Area name |
| `factoryAdmin.region` | Vùng | Region |
| `factoryAdmin.capacity` | Công suất (tấn/năm) | Capacity (t/year) |
| `factoryAdmin.status` | Trạng thái | Status |
| `factoryAdmin.active` | Đang dùng | Active |
| `factoryAdmin.inactive` | Ngừng dùng | Inactive |
| `factoryAdmin.deactivate` | Ngừng dùng | Deactivate |
| `factoryAdmin.activate` | Dùng lại | Reactivate |
| `factoryAdmin.add` | Thêm khu vực | Add area |
| `factoryAdmin.save` | Lưu | Save |
| `factoryAdmin.err.duplicate_name` | Tên khu vực đã tồn tại. | Area name already exists. |
| `factoryAdmin.err.invalid` | Dữ liệu không hợp lệ (tên bắt buộc, công suất > 0). | Invalid data (name required, capacity > 0). |
| `volumeEntry.factory` | Khu vực sản xuất | Production area |
| `volumeEntry.none` | — Chưa chọn — | — Not set — |
| `volumeEntry.inactiveSuffix` | (ngừng dùng) | (inactive) |
| `volumeEntry.tonnage` | Sản lượng gia công tháng (tấn) | Monthly processed tonnage (t) |
| `volumeEntry.hint` | Ghi vào khu vực sản xuất của dự án (bước Hồ sơ). | Recorded against the project's production area (Profile step). |
| `volumeEntry.noFactory` | Chọn khu vực sản xuất ở bước Hồ sơ trước khi nhập sản lượng. | Choose a production area in the Profile step before entering tonnage. |
| `volumeEntry.invalidFactory` | Khu vực không hợp lệ hoặc đã ngừng dùng. | Invalid or inactive production area. |

### Test

- `actions-master.test.ts` (mới): admin tạo/sửa/ngừng dùng; trùng tên (hoa thường khác) → `duplicate_name`; capacity 0 → `Invalid input`; data-entry, bod, viewer → Forbidden.
- `actions.test.ts` thêm: PIC lưu `{ factoryId: 2, volumeTonnage: 120 }` dự án 1 → ok, `getProject(1).factoryId === 2`, `getVolumes(1,'2026-09')` có dòng factory 2 = 120;
  dự án mới (factoryId null) chỉ gửi `volumeTonnage` → `no_factory`, KHÔNG ghi gì (fact không đổi version); factory đã ngừng → `invalid_factory`.
- `dataEntryState.test.ts` thêm: base có `factoryId`/`volumeTonnage`; đổi khu vực về `''` → `factoryId: null`; xoá sản lượng → không có key.
- `entry.test.ts`: `saveVolume` created → updated → unchanged, audit 2 dòng.
- Nghiệm thu: `tsc` + `npm test` xanh; dev: /admin thêm khu vực mới → chọn được ở Hồ sơ → nhập sản lượng → chart "Sản lượng vs công suất" ở Tổng quan có số (tháng 2026-09).

---

## Task 7 — T6: tỷ giá tháng (tự lấy VCB + sửa tay + nhắc) + hạ tầng job

**Commit:** `feat(p2a): T6 ty gia thang tu lay Vietcombank, sua tay, nhac thieu va ha tang job`

### Thuần

- `src/lib/fx.ts`:
  ```ts
  export const FX_CURRENCIES = ['USD', 'EUR'] as const;
  export type FxCurrency = (typeof FX_CURRENCIES)[number];
  export function missingRateCurrencies(rates: ExchangeRate[], ym: YearMonth): FxCurrency[]; // FX_CURRENCIES chưa có dòng ym
  ```
- `src/lib/vcb-rates.ts`:
  ```ts
  export const VCB_DEFAULT_URL = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
  export const VCB_RATE_KIND: 'Buy' | 'Transfer' | 'Sell' = 'Transfer'; // Q7
  /** Parse XML dạng <ExrateList><DateTime>..</DateTime><Exrate CurrencyCode="USD" Buy="25,110.00" Transfer="25,140.00" Sell="25,500.00"/>...</ExrateList>.
   *  Regex /<Exrate\s+([^>]*?)\/?>/g + thuộc tính /(\w+)="([^"]*)"/g; bỏ dấu phẩy nghìn; '-' hoặc rỗng hoặc ≤ 0 → bỏ qua. */
  export function parseVcbXml(xml: string, kind?: 'Buy' | 'Transfer' | 'Sell'): { rates: Partial<Record<FxCurrency, number>>; sourceTime: string | null };
  ```
- `src/lib/job-schedule.ts`:
  ```ts
  export interface JobRunLite { status: 'running' | 'ok' | 'error'; startedAt: string }
  export const JOB_STALE_MINUTES = 30;         // 'running' quá 30 phút coi như chết
  export const RATES_RETRY_HOURS = 6;
  export function vnDateOf(isoTs: string): IsoDate;            // Intl en-CA, timeZone APP_TIMEZONE
  /** Chưa có run 'ok' hoặc 'running' (chưa stale) mang ngày VN = today. */
  export function isAlertsDailyDue(runs: JobRunLite[], today: IsoDate, now: Date): boolean;
  /** missing = true VÀ không có run nào (mọi status) trong RATES_RETRY_HOURS giờ qua, trừ 'running' đã stale. Q7=a: không phụ thuộc ngày trong tháng. */
  export function isRatesDue(runs: JobRunLite[], missing: boolean, now: Date): boolean;
  ```

### Repo (entry files)

```ts
getExchangeRates(): ExchangeRate[]                                    // mọi dòng, yearMonth desc
upsertExchangeRate(row: { currencyCode: CurrencyCode; yearMonth: string; rateToVnd: number; source: FxSource }, by: string): void // audit 'dim_exchange_rate' `${cur}/${ym}` cũ→mới + source
deleteExchangeRate(currencyCode: CurrencyCode, yearMonth: string, by: string): boolean
startJobRun(jobName: JobName, trigger: JobTrigger, by: string): number // status 'running', trả id
finishJobRun(id: number, status: 'ok' | 'error', detail: string): void // finishedAt = now; detail cắt 1000 ký tự
getRecentJobRuns(jobName: JobName, limit: number): JobRunEntry[]      // startedAt desc
```
Mock: `jobRuns` trong `RepoData` (id tăng dần).

### Server

- `src/server/fx-rates.ts`:
  ```ts
  export async function fetchVcbRates(opts?: { fetchImpl?: typeof fetch; url?: string; timeoutMs?: number })
    : Promise<{ ok: true; rates: Partial<Record<FxCurrency, number>>; sourceTime: string | null } | { ok: false; error: 'network' | 'http' | 'parse'; detail: string }>;
    // url = opts.url ?? process.env.VCB_RATE_URL ?? VCB_DEFAULT_URL; timeout mặc định 8000ms bằng AbortController; fetch(url, { signal, cache: 'no-store' });
    // !res.ok → 'http'; parse không ra USD lẫn EUR → 'parse'; exception → 'network' (detail = message). KHÔNG throw.
  export async function refreshMonthRates(ym: YearMonth, by: string, fetchImpl?: typeof fetch)
    : Promise<{ ok: true; saved: FxCurrency[]; keptManual: FxCurrency[]; missingFromSource: FxCurrency[] } | { ok: false; error: 'network' | 'http' | 'parse'; detail: string }>;
    // Mỗi FX_CURRENCIES: đã có dòng source='manual' → keptManual (không ghi đè); có trong rates → upsert source='vcb'; không có → missingFromSource.
    // Bảo đảm dòng VND ym = 1 (source 'manual') nếu chưa có.
  ```
- `src/server/jobs.ts`:
  ```ts
  export async function runJob(name: JobName, trigger: JobTrigger, by = 'system', deps?: { fetchImpl?: typeof fetch })
    : Promise<{ status: 'ok' | 'error'; detail: string }>;
    // startJobRun → chạy → finishJobRun; mọi exception bắt lại → 'error'. Không bao giờ throw.
    // 'rates_monthly' → refreshMonthRates(currentMonth(), by); detail 'saved USD,EUR; manual: -; missing: -' hoặc '<error>: <detail>'.
    // 'alerts_daily': ở Task 7 trả { status: 'error', detail: 'unknown_job' } (có ghi job_run); Task 8 thay bằng engine thật.
  export async function runDueJobs(trigger: 'lazy' | 'cron'): Promise<void>;
    // Throttle trong tiến trình: globalThis.__ddcJobsCheckedAt; lần gọi trước < 10 phút → return. Cờ __ddcJobsBusy chống chạy chồng.
    // Kiểm isRatesDue(getRecentJobRuns('rates_monthly', 5), missingRateCurrencies(getExchangeRates(), currentMonth()).length > 0, new Date()) → runJob.
    // Bắt mọi lỗi (console.error), không throw.
  export function __resetJobThrottleForTest(): void;
  ```
- `app/api/cron/[job]/route.ts`: `export const dynamic = 'force-dynamic'`;
  `POST(req: Request, { params }: { params: { job: string } })`: `CRON_SECRET` trống → 503 `{ error: 'cron_disabled' }`;
  header `Authorization` ≠ `Bearer <CRON_SECRET>` (so bằng `timingSafeEqual` trên Buffer cùng độ dài; khác độ dài → sai) → 401 `{ error: 'Unauthorized' }`;
  `params.job` ∉ `['alerts_daily','rates_monthly']` → 404; `runJob(job, 'cron')` → 200 `{ status, detail }`. Comment đầu file: ví dụ cron ngoài
  `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/rates_monthly` (ngày 1 hằng tháng 08:30, lặp mỗi 6 giờ tới khi ok) và `/api/cron/alerts_daily` (06:00 mỗi ngày).
- `.env.example` thêm: `CRON_SECRET=` (comment: bắt buộc để cron ngoài gọi `/api/cron/*`; trống = tắt route) và `# VCB_RATE_URL=` (comment: ghi đè URL XML tỷ giá VCB; máy dev bị chặn TLS nên fetch lỗi là bình thường — dùng sửa tay).

### Actions (`actions-master.ts`, chỉ admin)

```ts
export async function saveExchangeRateAction(currencyCode: FxCurrency, yearMonth: string, rateToVnd: number): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' }>
  // zod: currencyCode enum FX_CURRENCIES; yearMonth hợp lệ và <= currentMonth(); rateToVnd > 0 < 1_000_000. Ghi source 'manual'.
export async function deleteExchangeRateAction(currencyCode: FxCurrency, yearMonth: string): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }>
export async function fetchRatesNowAction(): Promise<{ ok: true; status: 'ok' | 'error'; detail: string } | { ok: false; error: 'Forbidden' }>
  // runJob('rates_monthly', 'admin', user.email) — bỏ qua isRatesDue.
```
Mỗi action `revalidateTag(profileTag)` + `logActivity`.

### UI

- `src/components/admin/ExchangeRateEditor.tsx` (client): props `{ months: YearMonth[]; rates: ExchangeRate[]; lastRun: JobRunEntry | null }`.
  Card có `id="fx-rates"`. Trên: `hintline` `fxRates.hint`; nút `btn` `fxRates.fetchNow` → `fetchRatesNowAction` → hiện `fetchOk`/`fetchErr` + `router.refresh()`;
  dòng `lastRun` (`formatDateTime`) hoặc `never`. Bảng: Tháng | USD | EUR; mỗi ô: số (`formatTon`) + `chip` nguồn (`source.vcb`/`source.manual`) + nút sửa (mở `inp` + Lưu) + nút × (confirm `confirmDelete`). Ô trống: `-` + nút sửa.
- `admin/page.tsx`: thay card `admin.currencies` (dòng 129-140) bằng card `fxRates.title` (full width, sau card khu vực) chứa
  `<ExchangeRateEditor months={[...historyMonths(12)].reverse()} rates={await repo.getExchangeRates()} lastRun={(await repo.getRecentJobRuns('rates_monthly', 1))[0] ?? null} />`.
  Nếu sau khi bỏ 2 card mà `g2` còn 2 card (khách hàng, team) thì giữ `g2`.
- `src/components/layout/RateReminder.tsx` (server component, không `'use client'`): props `{ locale: string; month: YearMonth; currencies: FxCurrency[] }`,
  render `<div className="sumbar bad">` `t('fxRates.missing', { currencies: currencies.join(', '), month })` + link `/${locale}/admin#fx-rates` `fxRates.missingLink` (dùng `getTranslations`).
- `app/[locale]/(app)/layout.tsx`: sau khi có `user`:
  `void runDueJobs('lazy');` (KHÔNG await) ; nếu `user.role === 'admin'` (Q13=a): `const missing = missingRateCurrencies(await repo.getExchangeRates(), currentMonth())`;
  truyền `{missing.length > 0 && <RateReminder locale={locale} month={currentMonth()} currencies={missing} />}` ngay trước `{children}` bên trong `AppShell`.

### i18n `fxRates`

| key | vi | en |
|---|---|---|
| `title` | Tỷ giá theo tháng | Monthly exchange rates |
| `hint` | Tự lấy tỷ giá mua chuyển khoản Vietcombank mỗi tháng; chỉ sửa tay khi lỗi. Số nhập tay không bị ghi đè. | Vietcombank transfer-buy rate is fetched monthly; edit manually only on failure. Manual values are never overwritten. |
| `month` | Tháng | Month |
| `source.vcb` | VCB | VCB |
| `source.manual` | Nhập tay | Manual |
| `fetchNow` | Lấy ngay từ Vietcombank | Fetch from Vietcombank now |
| `lastRun` | Lần lấy gần nhất: {time} · {status} | Last fetch: {time} · {status} |
| `never` | Chưa lấy lần nào | Never fetched |
| `status.ok` | thành công | success |
| `status.error` | lỗi | failed |
| `status.running` | đang chạy | running |
| `edit` | Sửa | Edit |
| `save` | Lưu | Save |
| `delete` | Xoá | Delete |
| `confirmDelete` | Xoá tỷ giá {cur} tháng {month}? | Delete {cur} rate for {month}? |
| `fetchOk` | Đã lấy: {detail} | Fetched: {detail} |
| `fetchErr` | Không lấy được tỷ giá: {detail} | Could not fetch rates: {detail} |
| `missing` | Thiếu tỷ giá {currencies} tháng {month}. | Missing {currencies} rate for {month}. |
| `missingLink` | Cập nhật | Update |
| `err.invalid` | Tỷ giá phải là số > 0, tháng không ở tương lai. | Rate must be > 0 and month not in the future. |

### Test

- `fx.test.ts`, `vcb-rates.test.ts` (fixture XML inline 3 dòng USD/EUR/JPY + 1 dòng `Transfer="-"`): đúng số `25140`; `kind: 'Sell'`; XML rác → rates rỗng; `sourceTime` đọc từ `<DateTime>`.
- `job-schedule.test.ts`: alerts due khi chưa chạy hôm nay; không due khi đã 'ok' hôm nay (giờ VN — run lúc `2026-09-15T18:00:00Z` là ngày VN `2026-09-16`); 'running' 10 phút → không due; 'running' 40 phút → due;
  rates: missing=false → false; error 2 giờ trước → false; error 7 giờ trước → true.
- `fx-rates.test.ts` (fetch giả): ok → upsert USD/EUR source 'vcb'; đã có EUR manual → `keptManual: ['EUR']`, EUR giữ số cũ; fetch throw → `network`, không ghi gì; status 500 → `http`; body rác → `parse`.
- `jobs.test.ts`: `runJob('rates_monthly', 'admin', 'a@x', { fetchImpl })` ghi 1 `job_run` ok; fetch lỗi → run 'error' + detail, KHÔNG throw; `runDueJobs` gọi 2 lần liền chỉ chạy 1 lần (throttle), `__resetJobThrottleForTest` giữa các test.
- `cron-route.test.ts`: thiếu `CRON_SECRET` → 503; sai token → 401; token đúng job lạ → 404; đúng (mock `@/server/jobs`) → 200 và `runJob` được gọi với `'cron'`.
- `actions-master.test.ts` thêm: admin lưu/xoá tỷ giá; tháng `'2026-10'` (tương lai so với 2026-09-16) → `Invalid input`; rate 0 → `Invalid input`; data-entry → Forbidden; `fetchRatesNowAction` với fetch bị mock (`vi.stubGlobal('fetch', ...)`) trả status.
- Nghiệm thu: `tsc` + `npm test` xanh; dev (mạng bị chặn): bấm "Lấy ngay" → báo lỗi rõ, trang không vỡ, `job_run` có dòng error; xoá tỷ giá USD 2026-09 → dải nhắc hiện đầu mọi trang cho admin (data-entry không thấy); nhập tay lại → dải mất.

---

## Task 8 — T11: engine cảnh báo chạy thật + đóng alert có hành động/ghi chú

**Commit:** `feat(p2a): T11 engine canh bao chay sau moi lan luu va hang ngay, dong alert co hanh dong`

### `src/lib/alert-rules.ts` (thuần)

```ts
export const ALERT_DEADLINE_DAYS = { Red: 7, Amber: 14 } as const;  // Q11
export interface AlertRuleInput {
  project: Pick<Project, 'id' | 'contractValue' | 'committedHandoverDate' | 'penalized' | 'actualStartDate' | 'actualFinishDate'>;
  yearMonth: YearMonth; today: IsoDate;
  fact: Pick<FactProgressMonthly, 'spi' | 'cpi' | 'pctActual'> | null;       // bản isLatest của đúng yearMonth
  financial: Pick<FactFinancial, 'arOverdue'> | null;                        // bản isLatest của đúng yearMonth
  manpower: { workDate: IsoDate; planned: number; actual: number } | null;   // tổng ngày gần nhất có KH > 0 trong [today-6, today]
  equipment: { workDate: IsoDate; planned: number; actual: number } | null;
}
export interface AlertCandidate { projectId: number; ruleCode: AlertRuleCode; alertType: 'Red' | 'Amber'; ruleTriggered: string; message: string; dedupeKey: string }
export function evaluateProjectAlerts(input: AlertRuleInput): AlertCandidate[];
```
Bỏ qua mọi luật khi `deriveStatus({ actualStartDate, actualFinishDate, pctActual: fact?.pctActual ?? 0 }) === 'Hoan_thanh'`. Luật (Q9), chuỗi giữ đúng văn seed `history.ts:145-205`:

| ruleCode | Điều kiện | Loại | ruleTriggered | message | dedupeKey |
|---|---|---|---|---|---|
| `spi_low` | `fact?.spi != null && spi < THRESHOLDS.spiWarn` | Amber | `SPI < 0.9` | `SPI = 0.85 - trễ tiến độ theo giá trị` (toFixed(2)) | `monthKey` |
| `cpi_low` | tương tự CPI | Amber | `CPI < 0.9` | `CPI = x.xx - vượt chi phí` | `monthKey` |
| `penalty_overdue` | `penaltyState(...) === 'penalized'` | Red | `Đã quá mốc cam kết` | `Đã quá ngày cam kết bàn giao, chưa nghiệm thu` | `handoverKey` |
| `penalty_risk` | `penaltyState(...) === 'risk'` | Red | `Nguy cơ phạt HĐ (≤30 ngày)` | `Còn ≤30 ngày đến mốc bàn giao (<yyyy-mm-dd>), %TT chưa đạt 100%` | `handoverKey` |
| `ar_overdue` | `financial && isOverdueWarning(arOverdue, contractValue)` | Amber | `Công nợ quá hạn > 5% HĐ` | `Công nợ quá hạn <x> tỷ = <y>% giá trị HĐ` (1 số lẻ) | `monthKey` |
| `manpower_low` | `manpower && planned > 0 && actual/planned < THRESHOLDS.mobilizationDangerPct` | Amber | `Huy động nhân lực < 85%` | `Ngày dd/mm: TT a / KH p (z%)` | `weekKey(code, workDate)` |
| `equipment_low` | `equipment && isEquipmentWarning(actual, planned)` | Amber | `Huy động thiết bị < 80%` | như trên | `weekKey` |

`penaltyState` gọi với `today: new Date(`${today}T00:00:00Z`)`, `pctActual: fact?.pctActual ?? 0`. Ngưỡng in trong chuỗi lấy từ `THRESHOLDS` (không ghi cứng số).

### Repo (entry files)

```ts
// đặt ở src/server/repo/types.ts, `import type { AlertCandidate } from '@/lib/alert-rules'`
export interface NewEngineAlert extends AlertCandidate { owner: string; deadline: IsoDate; openedAt: string }
insertEngineAlerts(rows: NewEngineAlert[]): number
  // Mỗi dòng: bỏ qua nếu đã có alert (projectId, dedupeKey) bất kể đóng/mở, HOẶC có alert MỞ cùng (projectId, ruleCode). Prisma: bắt lỗi P2002 → bỏ qua. Trả số dòng tạo.
  // Dòng mới: action '', closedAt null, notify* mặc định (P3B gửi các dòng notifySentAt null).
```

### `src/server/alert-engine.ts`

```ts
export async function runAlertEngine(opts: { projectIds?: number[] }): Promise<{ checked: number; created: number }>;
  // ym = currentMonth(), today = todayIso(); dự án = listProjects() (lọc projectIds nếu có);
  // fact = getLatestFact(id, ym) (chỉ nhận khi f.yearMonth === ym); financial = getFinancial(id).find(ym);
  // manpower: getDailyManpower(id, addDaysIso(today,-6), today) cộng theo ngày, lấy ngày lớn nhất có planned > 0; equipment tương tự getDailyEquipment;
  // owner = email PIC (getAssignments(), roleInProject 'PIC') ?? 'BOD'; deadline = addDaysIso(today, ALERT_DEADLINE_DAYS[type]); openedAt = new Date().toISOString().
export async function runAlertEngineSafe(projectId: number): Promise<void>; // try/catch + console.error, KHÔNG throw
```
Q10=a: engine KHÔNG đóng alert nào.

### Nối engine

- `src/server/jobs.ts`: `runJob('alerts_daily')` → `runAlertEngine({})`, detail `checked=<n> created=<m>`; `runDueJobs` thêm kiểm `isAlertsDailyDue(getRecentJobRuns('alerts_daily', 5), todayIso(), new Date())`.
- `src/server/actions.ts` 🔥: `saveMonthlyData` gọi `await runAlertEngineSafe(projectId)` ngay trước `logActivity` (dòng 181); `commitImportAction` gọi cho từng `projectId` duy nhất đã import thành công, trước `logActivity`.
- `src/server/actions-entry.ts`: `saveDailyResourcesAction`, `commitDailyImportAction` gọi `runAlertEngineSafe(projectId)` trước `logActivity`.

### Đóng alert

- `validation.ts`: `closeAlertSchema = z.object({ alertId: z.number().int().positive(), action: z.string().trim().min(3).max(500), note: z.string().trim().max(1000) })`.
- `actions.ts` `closeAlertAction(alertId: number, action: string, note = '')`: giữ phần quyền hiện tại (dòng 347-351, Q12); sau quyền: zod lỗi → `{ ok: false, error: 'action_short' }`;
  `alert.closedAt` đã có → `{ ok: false, error: 'already_closed' }`; `repo.closeAlert(alertId, parsed.action, user.email, parsed.note)`.
- `src/components/alerts/CloseAlertForm.tsx` (client): props `{ alertId: number; onDone: () => void }`; nút `btn ghost` `t('alert.closeAlert')` → mở khung: `textarea.inp` `alertClose.action` (bắt buộc), `textarea.inp` `alertClose.note`, nút `alertClose.confirm` / `alertClose.cancel`;
  lỗi → `hintline` màu `var(--danger)` `alertClose.err.<mã>` (`Forbidden`→`forbidden`).
- `AlertList.tsx`: thay nút đóng (dòng 63-70) bằng `<CloseAlertForm alertId={a.id} onDone={() => router.refresh()} />`; xoá hàm `close`/state `busy` không dùng.

### i18n `alertClose`

| key | vi | en |
|---|---|---|
| `action` | Hành động đã xử lý | Action taken |
| `note` | Ghi chú (tuỳ chọn) | Note (optional) |
| `confirm` | Xác nhận đóng | Confirm close |
| `cancel` | Huỷ | Cancel |
| `err.action_short` | Nhập hành động đã xử lý (ít nhất 3 ký tự). | Describe the action taken (at least 3 chars). |
| `err.already_closed` | Alert này đã được đóng. | This alert is already closed. |
| `err.forbidden` | Bạn không có quyền đóng alert này. | You are not allowed to close this alert. |

### Test

- `alert-rules.test.ts`: mỗi luật 1 ca bắn + 1 ca không bắn đúng biên (SPI 0.9 không bắn, 0.89 bắn); dự án Hoàn thành → `[]`; `manpower` null → không bắn; `dedupeKey` đúng định dạng; chuỗi SPI khớp văn seed.
- `alert-engine.test.ts` (mock-repo qua `vi.mock('@/server/repo')`): `runAlertEngine({})` trên seed → `created` ≥ 0 và **chạy lần 2 tạo 0**; alert seed `spi_low` đang mở không bị tạo trùng;
  đóng 1 alert engine vừa tạo rồi chạy lại → không bật lại; hạ `actualHeadcount` ngày cuối dự án 1 xuống 50% → có `manpower_low` owner = email PIC dự án 1, deadline = `'2026-09-30'`.
- `jobs.test.ts` thêm: `runJob('alerts_daily','cron')` ghi run ok detail `checked=`; engine throw (spy) → run 'error', không throw.
- `close-alert-role.test.ts` thêm: action `'ab'` → `action_short`; đóng lần 2 → `already_closed`; đóng với note → `closeNote`, `closedBy` đúng email. Ma trận quyền cũ giữ xanh.
- `actions.test.ts` thêm: `saveMonthlyData` làm SPI < 0.9 cho dự án chưa có alert SPI tháng này → có alert `spi_low` mới; `runAlertEngineSafe` bị spy throw → `saveMonthlyData` vẫn `{ ok: true }`.
- Nghiệm thu: `tsc` + `npm test` xanh; dev: lưu số làm SPI thấp → `/vi/alerts` thấy alert mới; đóng phải nhập hành động; `POST /api/cron/alerts_daily` (đặt `CRON_SECRET` trong `.env` cục bộ) → 200.

---

## Task 9 — Nợ F4: import % tiến độ cũ đọc bằng exceljs (CHỈ khi Q14 = a)

**Commit:** `fix(p2a): import Excel doc bang exceljs thay xlsx 0.18.5 (no F4)`

- `actions.ts` 🔥 `importExcelAction`: bỏ `XLSX.read`/`sheet_to_json`; đọc bằng `exceljs` (`.xlsx`: `wb.xlsx.load(Buffer)`; `.csv`: `wb.csv.read(Readable.from(Buffer))` với `import { Readable } from 'node:stream'`),
  sheet đầu tiên, dòng 1 = header, dựng `Record<string, unknown>` mỗi dòng (ô qua `cellText` của `src/lib/daily-import.ts`), `rowNo` = số dòng Excel thật. Phần còn lại giữ nguyên.
  Lỗi đọc → `{ ok: false, error: 'Invalid file' }`. Bỏ `import * as XLSX` khỏi `actions.ts`.
- `validation.ts` `importFileSchema`: regex `/\.(xlsx|csv)$/i`, thông báo `'Chỉ chấp nhận file .xlsx/.csv'`.
- KHÔNG gỡ package `xlsx` ở P2A (test cũ dùng `XLSX.write` để dựng file — vẫn hợp lệ vì chỉ ghi, không parse file lạ). Ghi nợ cho reviewer.
- Test: `actions-import.test.ts`, `actions-security.test.ts` (P4) phải vẫn xanh; thêm: file `.xls` → lỗi schema; file CSV 2 dòng → preview đúng `rowNo`.
- Nghiệm thu: `tsc` + `npm test` xanh + build kiểm compile (lệnh ở Ràng buộc chung).

---

## Lưu ý cho B (ghi vào `phien-A.md` khi merge)

- Mã ca: `morning` (Ca sáng), **`evening` (Ca tối)** — không còn `afternoon`. Chart T12b đọc tên ca từ `dim_shift` qua `repo.getShifts()`,
  số theo ca qua `repo.getDailyManpowerByShift(projectId, from, to)` (có từ Task 1). Không ghi cứng "chiều"/"tối".
- Bảng mới cho ERD T4: `job_run`, `notify_channel`, `notify_recipient`; cột mới ở `alert_log`, `audit_log.note`, `dim_factory.isActive`,
  `dim_exchange_rate.source`, `updatedAt/updatedBy` ở 3 bảng fact ngày/sản lượng. P2A không sửa `src/lib/data-schema.ts`.
- `prisma-repo.ts`: P2A chỉ đổi `export const repo` → `coreRepo` + spread, và vài mapper (Task 1). Hàm mới nằm ở `prisma-repo-entry.ts`.
- P3B: kênh/người nhận/bí mật dùng `notify_channel`, `notify_recipient`, `src/lib/secret-box.ts`; gửi các alert `notifySentAt IS NULL`, cập nhật
  `notifyChannel`/`notifySentAt`/`notifyError`/`notifyAttempts`; cần env `NOTIFY_SECRET_KEY`. Không cần migration.

## Tự kiểm của planner (spec coverage)

G-18 → Task 3 · B theo ngày/nhà thầu/ca → Task 4 · sửa ngày cũ có log → Task 4 (lý do + `audit_log.note`) · import Excel + file mẫu → Task 5 ·
T8 CRUD khu vực + công suất → Task 6 · chọn khu vực từ DB → Task 6 · nhập sản lượng → Task 6 · T6 CRUD tháng → Task 7 · tự lấy VCB + test mock + lỗi mạng không vỡ app → Task 7 ·
cách kích hoạt job (cron route + lazy + nút admin) → Task 7 · nhắc thiếu → Task 7 · T11 chạy sau lưu + hằng ngày → Task 8 · ghi hành động/ghi chú khi đóng → Task 8 ·
ca tối + dữ liệu cũ + seed + test → Task 1 · USD/EUR → Task 1 + 7 · nền thông báo P3B (bảng cấu hình, kênh, bật/tắt, người nhận theo mức độ, `notify_channel`/`notify_sent_at`, bí mật mã hoá) → Task 1 + 2 ·
1 migration gộp → Task 1.
