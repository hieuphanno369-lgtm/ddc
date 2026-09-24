# P1A — Dữ liệu đúng — Kế hoạch triển khai

> Người viết: planner (skill `writing-plans`). Coder CHỈ đọc file này. Làm đúng thứ tự Task 1 → Task 11,
> mỗi Task = 1 commit, chạy cổng kiểm trước khi commit. Không làm gì ngoài phạm vi ghi ở đây.

**Mục tiêu:** số nhập vào form/Excel luôn vào đúng DB hoặc báo lỗi rõ; vá 3 lỗ bảo mật; vùng thả ảnh có tiến trình;
1 migration gộp làm nền cho P2A/P2B (ca làm việc, lịch ngày, khu vực SX, nguyên tệ, kế hoạch thiết bị Gantt, index).

**Kỹ thuật:** Next.js 14.2 app router · Prisma 6.19 · PostgreSQL localhost:5433 DB `ddc_control_tower` · next-intl 3.26 ·
Vitest 2.1 (`include: src/**/*.test.ts`, môi trường node — KHÔNG render React, nên logic client phải tách ra hàm thuần để test).

## CÂU HỎI CÒN BỎ NGỎ

Không có câu hỏi nghiệp vụ chặn. Các mặc định đã tự chọn (chủ dự án có thể lật lại ở review, đều nằm gọn trong 1 chỗ):

| # | Mặc định | Lý do | Đổi ở đâu nếu chủ dự án không đồng ý |
|---|---|---|---|
| M1 | Nhân lực cũ (là tổng ngày) được **dồn cả vào ca sáng** (`morning`) khi migrate, KHÔNG chia đôi | Không bịa số; tổng ngày giữ nguyên tuyệt đối; ngày cũ ca chiều = 0 | SQL migration Task 1 bước 2 |
| M2 | Mã ca: `morning` (Ca sáng), `afternoon` (Ca chiều) trong bảng `dim_shift` | Thêm ca = INSERT 1 dòng, không migration | seed `erp.ts` + SQL Task 1 |
| M3 | Seed chia nhân lực mỗi ngày: sáng = `Math.ceil(x/2)`, chiều = `x − sáng` | Tổng ngày giữ đúng 520/486 như test cũ | `splitHeadcount` Task 1 |
| M4 | "Ngày riêng cho chart tuần" = bảng lịch `dim_date` (tuần ISO, bắt đầu Thứ 2), đổ sẵn 2020-01-01…2035-12-31 | Nhóm theo tuần trong DB cho P2B/T1 | SQL Task 1 bước 4 |
| M5 | Khu vực SX của dự án = **1 cột** `dim_project.factoryId` (nullable) — `fact_volume` vẫn cho nhiều nhà máy/tháng | T8 "nhân viên chọn khu vực" = chọn 1 | schema Task 1 |
| M6 | Backfill `factoryId` = nhà máy có tổng `tonnageProcessed` lớn nhất của dự án trong `fact_volume`; không có → NULL | Lấy từ dữ liệu thật đang có, không gán `id % 3` | SQL Task 1 bước 3 |
| M7 | Giá trị nguyên tệ (G-7) = cột `dim_project.contractValueOriginal` (nullable, đơn vị = `currencyCode` của dự án). Chưa backfill, chưa có ô nhập (P3A) | G-7 chỉ yêu cầu "cần migration" | schema Task 1 |
| M8 | Gantt: 1 dòng `project_equipment_plan` = 1 thanh (chiếc thiết bị × hạng mục × khoảng ngày KH). "Chiếc" = (`equipmentId`, `unitNo` ≥1); hạng mục = FK `project_work_item` (nullable). Ngày thực tế KHÔNG có cột mới — P2B lấy từ `fact_daily_equipment_usage` | Đúng mô tả T14 đã chốt | schema Task 1 |
| M9 | Tháng chưa có dòng fact/tài chính: lưu tạo **version 1**, các field không gửi lấy từ **tháng gần nhất trước đó** của dự án (không có → 0/null) | %TT, luỹ kế là số cộng dồn; về 0 sẽ làm sai trend | Task 3 |
| M10 | Data-entry lưu form: client **không gửi** số tài chính (bước Tài chính chỉ xem); server vẫn giữ luật chặn Forbidden như cũ | Giữ nguyên test bảo mật đang có | Task 6 |
| M11 | `/api/export` chỉ cho `admin` + `bod` (giống `/api/report/export`); chưa đăng nhập → 401 | Route chưa được UI nào gọi; file chứa EVM + giá trị HĐ | Task 7 |
| M12 | Bản nháp: KHÔNG bao giờ tự áp; chỉ hiện thanh "Khôi phục / Bỏ". Nháp của dự án khác cùng id (seed lại) bị xoá im lặng | Đúng yêu cầu T2 | Task 5–6 |

## Ràng buộc chung (áp cho mọi Task)

- Cổng kiểm mỗi Task: `npx tsc --noEmit` sạch + `npm test` xanh (hiện 712 test). Task có DB: thêm bước DB ghi trong Task.
- **File nóng P1A phải giữ khoá** (ghi vào mục "Đang giữ" của `D:\_project\DDC_dieu-phoi\phien-A.md` TRƯỚC Task 1, kiểm `phien-B.md` không giữ):
  `prisma/schema.prisma`, `prisma/migrations/`, `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`,
  `src/i18n/messages/vi.json`, `src/i18n/messages/en.json`. KHÔNG đụng `app/globals.css`, `src/server/queries.ts`,
  `src/server/project-queries.ts` (không cần — tổng nhân lực ngày được cộng ca ngay trong repo).
- File KHÔNG nóng nhưng B (P1B) cũng sửa: `app/[locale]/(app)/projects/[id]/page.tsx` — P1A chỉ sửa **đúng 1 dòng 64**, không đụng chỗ khác.
- i18n: mọi key mới nằm trong **1 nhóm mới `"dataGuard"`** thêm ở **cuối** `vi.json` và `en.json` (sau nhóm cuối cùng hiện có). Không sửa key cũ. `src/i18n/messages.test.ts` kiểm vi/en khớp key.
- Style: không thêm CSS vào `globals.css`; dùng class có sẵn (`inp`, `btn`, `sumbar bad|good`, `hintline`, `chip`) + Tailwind + inline style với biến CSS có sẵn (`--sep-2`, `--accent`, `--accent-tint`, `--fill`, `--danger`, `--r-md`).
- Comment trong file `migration.sql` viết **không dấu** (theo `prisma/migrations/20260922220000_erp_model_v2/migration.sql`).
- Không sửa `PROGRESS.md`, `.serena/memories/`. Sau mỗi commit cập nhật `phien-A.md` (commit cuối, bước kế).
- Commit message: kiểu `feat(p1a): ...` / `fix(p1a): ...` / `chore(p1a): ...`, không dấu (theo `git log`).

## Bản đồ file

| File | Task | Việc |
|---|---|---|
| `prisma/schema.prisma` 🔥 | 1 | model mới `Shift`, `CalendarDate`, `ProjectEquipmentPlan`; cột mới ở `Project`, `FactDailyManpower`; index |
| `prisma/migrations/20260924090000_p1a_data_foundation/migration.sql` 🔥 (mới) | 1 | migration gộp |
| `prisma/rollback/20260924090000_p1a_data_foundation.down.sql` (mới) | 1 | SQL hồi phục |
| `src/server/repo/types.ts` | 1,2 | type `Shift`, `FactDailyManpowerShift`, `ProjectEquipmentPlan`; `Project` +2 field |
| `src/lib/shifts.ts` + `.test.ts` (mới) | 1 | `DEFAULT_SHIFT_CODE`, `sumManpowerShifts`, `splitHeadcount` |
| `src/data/seed/erp.ts`, `src/data/seed/history.ts`, `src/data/seed/history.test.ts` | 1,2 | seed ca, factoryId, Gantt |
| `prisma/seed.ts` | 1,2 | ghi shift, manpower theo ca, plan Gantt |
| `src/server/repo/prisma-repo.ts` 🔥 | 1,3,4 | đọc manpower cộng ca; mapProject; lưu fact/tài chính khi chưa có dòng; import trả lỗi từng dòng |
| `src/server/repo/mock-repo.ts` | 1,2,3,4 | giữ đồng nhất với prisma-repo |
| `src/server/repo/prisma-repo-save.test.ts` (mới) | 3 | test prisma-repo bằng mock `@/server/db` |
| `src/server/actions.ts` 🔥 | 3,4,9 | trả lỗi rõ; import trả `failed[]`; addPhotoAction gọi service |
| `src/components/form/ImportPanel.tsx`, `src/server/actions-import.test.ts` (mới) | 4 | hiện dòng lỗi; test import |
| `src/components/form/dataEntryState.ts` + `.test.ts` (mới) | 5 | state form, diff patch, bản nháp, map lỗi |
| `src/components/form/DataEntryForm.tsx` | 6,10 | dùng dataEntryState; banner nháp; tài chính chỉ xem; hiện lỗi; dropzone |
| `app/[locale]/(app)/nhap-lieu/page.tsx` | 6 | truyền `canEditFinance` |
| `src/lib/excel-safe.ts` + `.test.ts` (mới) | 7 | `safeCell` chống chèn công thức |
| `app/api/export/route.ts`, `app/api/report/export/route.ts` | 7 | auth + safeCell |
| `src/server/export-route.test.ts` (mới) | 7 | test route |
| `src/lib/env.ts` + `.test.ts` (mới), `src/lib/auth.ts`, `middleware.ts`, `vitest.config.ts`, `.env.example`, `app/[locale]/(app)/projects/[id]/page.tsx` (dòng 64) | 8 | fail-closed |
| `src/server/authz.ts` | 9 | `canWriteProject` |
| `src/lib/same-origin.ts` + `.test.ts` (mới) | 9 | chặn CSRF cho route POST |
| `src/server/photo-service.ts` (mới), `app/api/photo-upload/route.ts` (mới), `src/server/photo-upload-route.test.ts` (mới) | 9 | upload qua route để có tiến trình |
| `src/lib/photo-upload.ts` + `.test.ts` (mới), `src/components/form/PhotoDropzone.tsx` (mới), `src/components/icons/index.tsx` | 10 | UI kéo-thả + tiến trình |
| `src/i18n/messages/vi.json`, `en.json` 🔥 | 4,6,10 | nhóm `dataGuard` |

🔥 = file nóng.

---

## Task 1 — Migration gộp + đọc nhân lực cộng ca + seed ca/khu vực

**Commit:** `feat(p1a): migration gop - ca lam viec, dim_date, khu vuc SX, nguyen te, ke hoach thiet bi, index`

### 1.1 `prisma/schema.prisma` — thêm/sửa đúng như sau (giữ mọi thứ khác)

```prisma
/** Ca làm việc - bảng mở rộng được (thêm ca = INSERT, không migration). */
model Shift {
  code      String  @id
  nameVi    String
  nameEn    String
  sortOrder Int
  isActive  Boolean @default(true)

  manpower FactDailyManpower[]

  @@map("dim_shift")
}

/** Lịch ngày cho nhóm theo tuần ISO (Thứ 2 đầu tuần). Đổ sẵn trong migration, không seed. */
model CalendarDate {
  date      DateTime @id @db.Date
  yearMonth String
  isoYear   Int
  isoWeek   Int
  weekStart DateTime @db.Date
  dayOfWeek Int      // 1 = Thứ 2 ... 7 = Chủ nhật (ISO)

  @@index([weekStart])
  @@index([yearMonth])
  @@map("dim_date")
}

/** Kế hoạch dùng từng chiếc thiết bị cho Gantt T14. 1 dòng = 1 thanh. Ngày thực tế lấy từ fact_daily_equipment_usage. */
model ProjectEquipmentPlan {
  id            Int      @id @default(autoincrement())
  projectId     Int
  equipmentId   Int
  unitNo        Int
  workItemId    Int?
  plannedStart  DateTime @db.Date
  plannedFinish DateTime @db.Date
  note          String   @default("")
  updatedAt     DateTime @updatedAt
  updatedBy     String   @default("system")

  project   Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  equipment Equipment        @relation(fields: [equipmentId], references: [id], onDelete: Restrict)
  workItem  ProjectWorkItem? @relation(fields: [workItemId], references: [id], onDelete: SetNull)

  @@index([projectId, equipmentId, unitNo])
  @@index([projectId, plannedStart])
  @@map("project_equipment_plan")
}
```

Sửa model có sẵn:
- `Project`: thêm `factoryId Int?`, `contractValueOriginal Float?`, relation `factory Factory? @relation(fields: [factoryId], references: [id], onDelete: Restrict)`, back-relation `equipmentPlans ProjectEquipmentPlan[]`, `@@index([factoryId])`.
- `Factory`: thêm `projects Project[]`.
- `Equipment`: thêm `plans ProjectEquipmentPlan[]`.
- `ProjectWorkItem`: thêm `equipmentPlans ProjectEquipmentPlan[]`.
- `FactDailyManpower`: thêm `shiftCode String` + `shift Shift @relation(fields: [shiftCode], references: [code], onDelete: Restrict)`; đổi `@@id([projectId, contractorId, workDate, shiftCode])`; giữ `@@index([projectId, workDate])`, thêm `@@index([workDate])`. Cập nhật doc comment: "Nhân lực theo NGÀY × nhà thầu × CA. Tổng ngày = cộng các ca (app tự cộng)".
- `AuditLog`: thêm `@@index([changedAt])`, `@@index([tableName, recordId])`.
- `AlertLog`: thêm `@@index([openedAt])`.

### 1.2 Migration `prisma/migrations/20260924090000_p1a_data_foundation/migration.sql`

Sinh khung (PowerShell, cách đã dùng ở `20260922220000_erp_model_v2/migration.sql` dòng 2):
`npx prisma migrate diff --from-url "$env:DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > <file>`
(nếu `$env:DATABASE_URL` trống thì lấy giá trị từ `.env`). Rồi **sửa tay** để file cuối cùng có đúng thứ tự:

1. `CREATE TABLE "dim_shift"` + `INSERT INTO "dim_shift" ("code","nameVi","nameEn","sortOrder","isActive") VALUES ('morning','Ca sáng','Morning',1,true),('afternoon','Ca chiều','Afternoon',2,true);`
2. `fact_daily_manpower` (KHÔNG để Prisma `ADD COLUMN ... NOT NULL` không default — sẽ lỗi trên dòng có sẵn):
   ```sql
   ALTER TABLE "fact_daily_manpower" ADD COLUMN "shiftCode" TEXT NOT NULL DEFAULT 'morning';
   ALTER TABLE "fact_daily_manpower" DROP CONSTRAINT "fact_daily_manpower_pkey";
   ALTER TABLE "fact_daily_manpower" ADD CONSTRAINT "fact_daily_manpower_pkey" PRIMARY KEY ("projectId","contractorId","workDate","shiftCode");
   ALTER TABLE "fact_daily_manpower" ALTER COLUMN "shiftCode" DROP DEFAULT;
   ALTER TABLE "fact_daily_manpower" ADD CONSTRAINT "fact_daily_manpower_shiftCode_fkey" FOREIGN KEY ("shiftCode") REFERENCES "dim_shift"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
   CREATE INDEX "fact_daily_manpower_workDate_idx" ON "fact_daily_manpower"("workDate");
   ```
   Comment SQL ghi rõ mặc định M1 (du lieu cu la tong ngay -> don vao ca sang).
3. `dim_project`: `ADD COLUMN "factoryId" INTEGER`, `ADD COLUMN "contractValueOriginal" DOUBLE PRECISION`; backfill:
   ```sql
   UPDATE "dim_project" p SET "factoryId" = (
     SELECT v."factoryId" FROM "fact_volume" v WHERE v."projectId" = p."id"
     GROUP BY v."factoryId" ORDER BY SUM(v."tonnageProcessed") DESC, v."factoryId" ASC LIMIT 1);
   ```
   rồi FK `dim_project_factoryId_fkey` (ON DELETE RESTRICT ON UPDATE CASCADE) + index `dim_project_factoryId_idx`.
4. `CREATE TABLE "dim_date"` + index, rồi đổ dữ liệu:
   ```sql
   INSERT INTO "dim_date" ("date","yearMonth","isoYear","isoWeek","weekStart","dayOfWeek")
   SELECT d::date, to_char(d,'YYYY-MM'), EXTRACT(ISOYEAR FROM d)::int, EXTRACT(WEEK FROM d)::int,
          date_trunc('week', d)::date, EXTRACT(ISODOW FROM d)::int
   FROM generate_series('2020-01-01'::date, '2035-12-31'::date, interval '1 day') AS d;
   ```
5. `CREATE TABLE "project_equipment_plan"` + 3 FK + 2 index do Prisma sinh, thêm tay:
   `ALTER TABLE "project_equipment_plan" ADD CONSTRAINT "project_equipment_plan_unitNo_check" CHECK ("unitNo" >= 1);`
   `ALTER TABLE "project_equipment_plan" ADD CONSTRAINT "project_equipment_plan_dates_check" CHECK ("plannedFinish" >= "plannedStart");`
6. Index `audit_log` (2), `alert_log` (1) do Prisma sinh.
7. **XOÁ** mọi dòng `DROP INDEX "ux_fact_progress_latest"` / `"ux_fact_financial_latest"` nếu diff sinh ra (index partial viết tay, xem cảnh báo dòng 13-16 file erp_model_v2).

Áp: `npx prisma migrate deploy` rồi `npx prisma generate`.

### 1.3 Rollback `prisma/rollback/20260924090000_p1a_data_foundation.down.sql` (không nằm trong `migrations/` để Prisma không chạy)

Trong `BEGIN; ... COMMIT;`, thứ tự:
1. `DROP TABLE "project_equipment_plan";` `DROP TABLE "dim_date";`
2. Gộp ca về ngày, giữ tổng:
   ```sql
   CREATE TEMP TABLE _mp AS SELECT "projectId","contractorId","workDate",
     SUM("plannedHeadcount")::int AS p, SUM("actualHeadcount")::int AS a
     FROM "fact_daily_manpower" GROUP BY 1,2,3;
   ALTER TABLE "fact_daily_manpower" DROP CONSTRAINT "fact_daily_manpower_shiftCode_fkey";
   DELETE FROM "fact_daily_manpower";
   ALTER TABLE "fact_daily_manpower" DROP CONSTRAINT "fact_daily_manpower_pkey";
   DROP INDEX "fact_daily_manpower_workDate_idx";
   ALTER TABLE "fact_daily_manpower" DROP COLUMN "shiftCode";
   ALTER TABLE "fact_daily_manpower" ADD CONSTRAINT "fact_daily_manpower_pkey" PRIMARY KEY ("projectId","contractorId","workDate");
   INSERT INTO "fact_daily_manpower" ("projectId","contractorId","workDate","plannedHeadcount","actualHeadcount") SELECT "projectId","contractorId","workDate",p,a FROM _mp;
   DROP TABLE "dim_shift";
   ```
3. `dim_project`: drop FK, index, 2 cột. Drop 3 index audit_log/alert_log.
4. `DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260924090000_p1a_data_foundation';`
Chạy bằng: `npx prisma db execute --file prisma/rollback/20260924090000_p1a_data_foundation.down.sql --schema prisma/schema.prisma`.

### 1.4 Types — `src/server/repo/types.ts`

```ts
export interface Shift { code: string; nameVi: string; nameEn: string; sortOrder: number; isActive: boolean }
/** Dòng DB: nhân lực theo ngày × nhà thầu × ca. FactDailyManpower (có sẵn) = tổng NGÀY, giữ nguyên cho mọi chỗ đọc. */
export interface FactDailyManpowerShift {
  projectId: number; contractorId: number; workDate: string; shiftCode: string;
  plannedHeadcount: number; actualHeadcount: number;
}
export interface ProjectEquipmentPlan {
  id: number; projectId: number; equipmentId: number; unitNo: number; workItemId: number | null;
  plannedStart: string; plannedFinish: string; // 'YYYY-MM-DD'
  note: string; updatedAt: string; updatedBy: string;
}
```
`Project` thêm: `factoryId: number | null; // khu vực/nhà máy SX chính` và `contractValueOriginal: number | null; // G-7: giá trị HĐ theo currencyCode`.
`FactDailyManpower` giữ nguyên (không có shiftCode).

### 1.5 `src/lib/shifts.ts` (mới)

```ts
import type { FactDailyManpower, FactDailyManpowerShift } from '@/server/repo/types';
export const DEFAULT_SHIFT_CODE = 'morning';
/** Cộng các ca thành tổng ngày theo (projectId, contractorId, workDate). Sắp workDate asc, rồi contractorId asc. */
export function sumManpowerShifts(rows: FactDailyManpowerShift[]): FactDailyManpower[];
/** Chia 1 số nguyên ≥0 thành [ca sáng, ca chiều]: sáng = ceil(x/2), chiều = x - sáng. */
export function splitHeadcount(total: number): [number, number];
```

### 1.6 Repo đọc

- `prisma-repo.ts` `getDailyManpower`: `findMany` như cũ (select thêm `shiftCode`), map `workDate: day(...)`, trả `sumManpowerShifts(rows)`. Chữ ký không đổi.
- `prisma-repo.ts` `mapProject`: thêm tham số + map `factoryId`, `contractValueOriginal`.
- `mock-repo.ts`: `getDailyManpower` lọc `getData().dailyManpowerShifts` rồi `sumManpowerShifts`; `createProject` thêm `factoryId: null, contractValueOriginal: null`; `resetAllData` gán `d.dailyManpowerShifts = []` (thay `d.dailyManpower`).

### 1.7 Seed

- `src/data/seed/erp.ts`: thêm `export const shifts: Shift[]` (2 dòng như M2).
- `src/data/seed/history.ts`:
  - `SEED_VERSION = '2026-09-24-p1a'` (để `.data/ddc-mock.json` cũ bị bỏ qua).
  - `RepoData`: thay `dailyManpower: FactDailyManpower[]` bằng `dailyManpowerShifts: FactDailyManpowerShift[]`; thêm `shifts: Shift[]`.
  - `buildDailyResources`: mỗi (contractor, ngày) đẩy 2 dòng: `morning` = `splitHeadcount(total)[0]`, `afternoon` = `[1]` cho cả planned lẫn actual (total = `Math.round(row.x * f)` như cũ).
  - `toProject`: `factoryId: (p.id % factories.length) + 1`, `contractValueOriginal: null`. Vòng `volumes.push` dùng `factoryId` của project đó (không tự tính lại `% length`).
- `prisma/seed.ts`: sau khối equipment thêm `shift.deleteMany()` + `shift.createMany({ data: data.shifts })`; khối manpower ghi `data.dailyManpowerShifts` (kèm `shiftCode`). Projects map giữ `factoryId`, `contractValueOriginal`. KHÔNG seed `dim_date`.
- `src/data/seed/history.test.ts`: test "6 nhà thầu..." đổi sang: `rows = sumManpowerShifts(data.dailyManpowerShifts.filter(m => m.workDate === lastDay))` → length 6, tổng 520/486; thêm assert ngày cuối có đúng 12 dòng ca và mỗi (contractor, ngày) có đủ 2 mã `morning`/`afternoon`. Test "đúng 7 ngày" dùng `dailyManpowerShifts`.

### 1.8 Test mới `src/lib/shifts.test.ts`

- `sumManpowerShifts`: 2 ca cùng (p,c,ngày) → 1 dòng tổng; khác nhà thầu giữ riêng; thứ tự ngày/nhà thầu đúng; mảng rỗng → `[]`; 1 ca duy nhất (dữ liệu cũ dồn vào `morning`) → tổng = chính nó.
- `splitHeadcount`: 0→[0,0], 1→[1,0], 7→[4,3], 120→[60,60]; tổng luôn = đầu vào.

### 1.9 Nghiệm thu Task 1

- `npx prisma migrate deploy` xanh trên DB `ddc_control_tower` (đang có seed 17 dự án).
- Trước khi deploy ghi lại, sau deploy so khớp (dùng `npx tsx -e` với `PrismaClient.$queryRaw`): `SELECT SUM("plannedHeadcount"), SUM("actualHeadcount") FROM fact_daily_manpower` bằng nhau; `SELECT COUNT(*) FROM dim_project WHERE "factoryId" IS NULL` = số dự án không có `fact_volume`.
- Chạy lại lệnh `migrate diff --from-url ... --to-schema-datamodel ... --script` → chỉ còn (tối đa) 2 dòng DROP INDEX `ux_fact_*_latest` (dương tính giả đã biết), không gì khác.
- Thử hồi phục 1 vòng: rollback file → tổng nhân lực không đổi → `migrate deploy` lại → `npx prisma db seed` xanh.
- App dev (cổng 3000): trang chi tiết dự án 1 — thẻ/biểu đồ nhân lực ngày cuối vẫn KH 520 / TT 486.
- `tsc` + `npm test` xanh.

---

## Task 2 — Seed kế hoạch thiết bị (Gantt)

**Commit:** `feat(p1a): seed ke hoach thiet bi cho Gantt T14`

- `src/data/seed/erp.ts`: `export const equipmentPlanSeed` — dự án `ERP_DETAIL_PROJECT_ID`, đúng 6 dòng:

| id | equipmentId | unitNo | workItemId | plannedStart | plannedFinish |
|---|---|---|---|---|---|
| 1 | 1 | 1 | 1 | 2026-08-03 | 2026-08-30 |
| 2 | 1 | 1 | 4 | 2026-08-31 | 2026-10-11 |
| 3 | 1 | 2 | 2 | 2026-08-10 | 2026-09-27 |
| 4 | 1 | 3 | 3 | 2026-09-07 | 2026-10-18 |
| 5 | 2 | 1 | 5 | 2026-08-17 | 2026-09-20 |
| 6 | 2 | 2 | 6 | 2026-09-14 | 2026-10-25 |

  `note: ''`, `updatedBy: 'system'`, `updatedAt: '2026-09-02T00:00:00Z'`.
- `history.ts`: `RepoData.equipmentPlans: ProjectEquipmentPlan[]` = `equipmentPlanSeed`. `mock-repo.resetAllData` gán `d.equipmentPlans = []`.
- `prisma/seed.ts`: `projectEquipmentPlan.deleteMany()` + `createMany` (đổi 2 ngày sang `new Date('YYYY-MM-DDT00:00:00Z')`, `updatedAt` sang Date); thêm `'project_equipment_plan'` vào mảng `syncSequences`.
- KHÔNG thêm hàm repo đọc plan (P2B làm).
- Test thêm vào `history.test.ts`: 6 dòng; mọi `plannedFinish >= plannedStart`; mọi `unitNo >= 1`; mọi `workItemId` tồn tại trong `data.workItems` của dự án 1; equipment 1 có đúng 3 chiếc (unitNo 1..3).
- Nghiệm thu: `npx prisma db seed` xanh; `tsc` + `npm test` xanh.

---

## Task 3 — Lỗi (a): lưu được số liệu tháng/tài chính khi dự án chưa có dòng fact

**Commit:** `fix(p1a): luu fact thang va tai chinh khi chua co dong - khong mat du lieu am tham`

### Chữ ký mới (prisma-repo + mock-repo giống nhau, mock đồng bộ)

```ts
export type SaveFactResult = 'created' | 'updated' | 'not_found';   // đặt trong src/server/repo/types.ts
saveMonthlyFact(projectId, yearMonth, patch, changedBy?): Promise<SaveFactResult>   // mock: trả SaveFactResult (sync)
saveFinancial(projectId, yearMonth, patch, changedBy?): Promise<SaveFactResult>
```

### Hành vi

- Không có project (`findUnique` null) → `'not_found'`, không ghi gì.
- Có dòng `isLatest` của tháng → như cũ, trả `'updated'`.
- Chưa có → dựng "baseline" = bản `isLatest` của **tháng gần nhất < yearMonth** cùng dự án
  (prisma: `findFirst({ where: { projectId, isLatest: true, yearMonth: { lt: yearMonth } }, orderBy: { yearMonth: 'desc' } })`), không có → baseline rỗng.
  - Fact: field không có trong patch lấy từ baseline: `pctPlan, pctActual, ac, bottleneckStage, manpowerPlanned, manpowerActual, equipmentPlanned, equipmentActual, actualStartDate, actualFinishDate`; baseline rỗng → số = 0, `bottleneckStage` = null, 2 ngày = `project.actualStartDate/actualFinishDate`. `version: 1`, `snapshotLockedAt: null`, `lockedBy: null`. PV/EV/SPI/CPI/BAC tính y như nhánh update. `changeNote` bắt đầu bằng `'create; '` rồi phần `field: cũ → mới` (cũ = giá trị baseline). Trả `'created'`.
  - Tài chính: field ngoài patch lấy từ baseline, rỗng → 0. `revenuePeriod = revenueCumulative − (baseline?.revenueCumulative ?? 0)`, `costActualPeriod` tương tự, `backlog = baseline?.backlog ?? 0`; `arOutstanding`, `grossProfit`, `grossMarginPct` tính như nhánh update. `version: 1`. Trả `'created'`.
  - Ghi trong cùng `$transaction` như nhánh update (updateMany hạ cờ là no-op vẫn giữ). `logAudit` như cũ.
- Tháng đã khoá: repo KHÔNG tự kiểm; `saveMonthlyData` đã chặn `locked` trước khi gọi repo — giữ nguyên.

### `src/server/actions.ts` — `saveMonthlyData`

- Ngay sau guard tài chính: `if (!(await repo.getProject(projectId))) return { ok: false, error: 'Not found' };`
- Kết quả `saveMonthlyFact`/`saveFinancial` = `'not_found'` → `return { ok: false, error: 'Not found' }`.

### Test

- `src/server/repo/dim.test.ts` (mock-repo, thêm): dự án mới `createProject` → `saveMonthlyFact(id,'2026-09',{ pctPlan: 0.2, ac: 5 })` trả `'created'`, `getLatestFact` có `version 1`, `pctActual 0`; gọi lần 2 trả `'updated'`, version 2. `saveFinancial` dự án mới trả `'created'`, `revenuePeriod === revenueCumulative`. Dự án có sẵn, tháng `'2026-10'` (chưa có dòng): `saveMonthlyFact(p.id,'2026-10',{ ac: 1 })` → `pctActual` bằng `pctActual` của `'2026-09'`. Project id không tồn tại → `'not_found'`.
- `src/server/actions.test.ts` (thêm): admin `saveMonthlyData(newId, '2026-09', { pctPlan: 0.1, revenueCumulative: 3 })` → `{ ok: true }` và có cả fact lẫn financial; `saveMonthlyData(999999, ...)` admin → `{ ok: false, error: 'Not found' }`.
- `src/server/repo/prisma-repo-save.test.ts` (mới, mock `@/server/db` theo mẫu `prisma-repo-reset.test.ts`): khi `factProgressMonthly.findFirst` trả null cho tháng hiện tại và 1 dòng cho tháng trước → `create` được gọi với `version: 1` và `pctActual` = của tháng trước; `project.findUnique` null → trả `'not_found'`, không gọi `$transaction`.
- Nghiệm thu: `tsc` + `npm test` xanh.

---

## Task 4 — Lỗi (c): import Excel báo lỗi rõ từng dòng

**Commit:** `fix(p1a): import Excel luu duoc du an chua co fact va bao loi tung dong`

### Chữ ký

```ts
// actions.ts
export type ImportRowReason = 'no_sap' | 'no_pct' | 'bad_pct' | 'not_assigned';
export interface ImportRow {
  rowNo: number;                       // số dòng Excel (header = dòng 1)
  sapCode: string; projectName: string; pctActual: number | null;
  status: 'mapped' | 'queued' | 'invalid';
  reason: ImportRowReason | null;      // chỉ khác null khi status = 'invalid'
  projectId: number | null;
}
// importExcelAction trả thêm `invalid: number`
// commitImportAction trả: { ok: true, imported: number, failed: { projectId: number; reason: 'not_assigned' | 'not_found' }[] }
// repo (prisma + mock):
importMonthlyFacts(yearMonth, rows, changedBy?): Promise<{ imported: number; failed: { projectId: number; reason: 'not_found' }[] }>
```

### Hành vi

- `importExcelAction`: `rowNo = ((r as { __rowNum__?: number }).__rowNum__ ?? i + 1) + 1` (SheetJS gắn `__rowNum__` 0-based). Thay mọi `continue` im lặng:
  - không có mã SAP → `invalid`/`no_sap` (projectId null);
  - map được nhưng data-entry không được gán → `invalid`/`not_assigned`, `projectId: null` (không lộ id);
  - map được, ô % trống → `invalid`/`no_pct`; có chữ nhưng `normPct` trả null → `invalid`/`bad_pct`.
  - Dòng hoàn toàn trống (mọi ô rỗng) vẫn bỏ qua, không tính.
- `repo.importMonthlyFacts`: bỏ nhánh `if (!exists) continue`; gọi `saveMonthlyFact` (Task 3 đã tự tạo dòng); kết quả `'not_found'` → đẩy vào `failed`.
- `commitImportAction`: dòng không thuộc assignment → `failed` với `not_assigned` (thay cho `skipped`); gộp `failed` của repo.
- `ImportPanel.tsx`: badge thêm `t('dataGuard.import.invalid')`: `{result.invalid}`; cột trạng thái dòng `invalid` hiện Badge tone `danger` + `t('dataGuard.import.reason.<reason>')`; thêm cột đầu `t('dataGuard.import.rowNo')` hiện `rowNo`. Sau commit: nếu `failed.length > 0` hiện `<p className="sumbar bad">` `t('dataGuard.import.failed', { n })` + danh sách `projectId · lý do`. Cập nhật type `ImportResult` và state `committed` theo shape mới (bỏ `skipped`). (`Badge` có tone `danger` — `src/components/ui/Badge.tsx`.)

### i18n (`dataGuard.import`)

| key | vi | en |
|---|---|---|
| `invalid` | Lỗi | Errors |
| `rowNo` | Dòng | Row |
| `failed` | {n} dòng không lưu được | {n} rows not saved |
| `reason.no_sap` | Thiếu mã SAP | Missing SAP code |
| `reason.no_pct` | Thiếu % hoàn thành | Missing % complete |
| `reason.bad_pct` | % hoàn thành không đọc được | Unreadable % complete |
| `reason.not_assigned` | Bạn không được gán dự án này | You are not assigned to this project |
| `reason.not_found` | Không tìm thấy dự án | Project not found |

### Test

- `src/server/repo/valuechain.test.ts:108-115`: sửa `n` → `.imported`. Thêm: dự án mới chưa có fact → `importMonthlyFacts` trả `imported: 1`, `getLatestFact` có `pctActual` đúng.
- `src/server/actions-import.test.ts` (mới, chép phần `vi.mock` + `login()` đầu file `src/server/actions-security.test.ts`): `importExcelAction` với file tạo bằng `XLSX.utils.json_to_sheet` + `XLSX.write(..., { type: 'buffer', bookType: 'xlsx' })` gồm 4 dòng: SAP hợp lệ + %, thiếu SAP, SAP hợp lệ + `abc`, SAP hợp lệ + % trống → preview đúng `status/reason/rowNo` (2,3,4,5), `invalid === 3`. data-entry với SAP của dự án không được gán → `not_assigned`, `projectId === null`. `commitImportAction` data-entry gửi projectId không được gán → `failed[0].reason === 'not_assigned'`.
- Test `commitImportAction` tháng khoá hiện có (actions-valuechain.test.ts:163, 242) phải vẫn xanh.
- Nghiệm thu: `tsc` + `npm test` xanh; import thử 1 file ở `/vi/import` trên dev, thấy dòng lỗi có số dòng + lý do.

---

## Task 5 — Hàm thuần cho form nhập liệu (bản nháp, ngày, diff patch)

**Commit:** `feat(p1a): dataEntryState - ban nhap co dau phien ban, ngay yyyy-MM-dd, patch chi field doi`

File mới `src/components/form/dataEntryState.ts` (KHÔNG `'use client'`, không import React). Chuyển `interface FormState` từ `DataEntryForm.tsx` sang đây (export) nguyên field.

```ts
import type { saveMonthlyData } from '@/server/actions';
export type SaveMonthlyPatch = NonNullable<Parameters<typeof saveMonthlyData>[2]>;
export interface FormState { /* chuyển nguyên từ DataEntryForm.tsx dòng 70-98 */ }

/** ISO/Date-string → 'YYYY-MM-DD' cho <input type="date">. Lấy 10 ký tự đầu nếu khớp /^\d{4}-\d{2}-\d{2}/, còn lại ''. */
export function toDateInput(v: string | null | undefined): string;

/** Thay phần `base` của loadDraft cũ (DataEntryForm.tsx dòng 808-843), 6 ô ngày đi qua toDateInput. */
export function buildBaseForm(project: Project, fact: FactProgressMonthly | undefined,
  financial: FactFinancial | undefined, chain: ValueChainProgress[]): FormState;

/** 7 giai đoạn từ form (giống stageInputs hiện tại dòng 173-177). */
export function stageInputsOf(form: FormState): { stageCode: StageCode; pctComplete: number; applicable: boolean }[];

export function formsEqual(a: FormState, b: FormState): boolean; // so từng field, stagePct/stageApplicable so từng giai đoạn

/** Chỉ gửi field khác base. */
export function buildSavePatch(base: FormState, form: FormState, opts: { canEditFinance: boolean }): SaveMonthlyPatch;

export const DRAFT_VERSION = 2;
export interface DraftStamp { projectCreatedAt: string; projectUpdatedAt: string; factVersion: number | null; financialVersion: number | null }
export interface StoredDraft { v: 2; savedAt: string; stamp: DraftStamp; form: FormState }
export function draftKey(projectId: number, month: string): string;       // `ddc_draft_v2_${projectId}_${month}`
export function legacyDraftKey(projectId: number, month: string): string; // `ddc_draft_${projectId}_${month}` (bản cũ - chỉ để xoá)
export function makeStamp(project: Pick<Project, 'createdAt' | 'updatedAt'>, fact?: { version: number }, financial?: { version: number }): DraftStamp;
export type DraftCheck = { kind: 'none' } | { kind: 'fresh'; draft: StoredDraft } | { kind: 'stale'; draft: StoredDraft } | { kind: 'foreign' };
export function checkDraft(raw: string | null, current: DraftStamp): DraftCheck;
export function restoreDraft(base: FormState, draft: StoredDraft): FormState; // { ...base, ...draft.form }, stagePct/stageApplicable merge theo giai đoạn

export type SaveErrorKind = 'forbidden' | 'locked' | 'notFound' | 'generic';
export function saveErrorKind(error: string | undefined): SaveErrorKind; // 'Forbidden'→forbidden, 'locked'→locked, 'Not found'→notFound, khác→generic
```

Quy tắc `buildSavePatch` (so `form[k] !== base[k]`):
- `projectName`: đổi và `trim()` khác rỗng → gửi. `customerId`, `teamKdId`: đổi và khác rỗng → `Number`. `marketCode`, `projectType`, `priority`, `currencyCode`: đổi và khác rỗng → gửi nguyên.
- `contractValue`, `tonnage`: đổi và khác rỗng → `Number`; đổi thành rỗng → KHÔNG gửi.
- `penaltyValue`: đổi → rỗng thì `null`, còn lại `Number`. `penalized`: đổi → gửi boolean.
- 6 ô ngày: đổi → `value || null`.
- `pctPlan`, `ac`, `equipmentActual`: đổi và khác rỗng → `Number`.
- `chain`: chỉ khi có ít nhất 1 giai đoạn khác base ở `stagePct` hoặc `stageApplicable` → `chain: stageInputsOf(form)` (thay cho cờ `chainDirty`).
- 4 ô tài chính (`revenueCumulative`, `costActualCumulative`, `arCollected`, `arOverdue`): chỉ khi `opts.canEditFinance` VÀ đổi VÀ khác rỗng → `Number`. `arOutstanding` KHÔNG bao giờ gửi.

Quy tắc `checkDraft`:
- `raw` null / JSON hỏng / `v !== 2` / thiếu `form` hoặc `stamp` → `none`.
- `stamp.projectCreatedAt !== current.projectCreatedAt` → `foreign` (dự án khác trùng id sau seed lại).
- 4 trường stamp bằng nhau → `fresh`; khác bất kỳ → `stale`.

### Test `src/components/form/dataEntryState.test.ts`

- `toDateInput`: `'2026-01-15T00:00:00.000Z'`→`'2026-01-15'`; `'2026-01-15'`→giữ; `null`/`undefined`/`''`/`'abc'`→`''`.
- `buildBaseForm`: dự án có ngày ISO → 6 ô dạng `YYYY-MM-DD`; dự án tạo mới qua `repo.createProject` (mock-repo) không ngày → 6 ô `''`; mọi field tạo mới (tên, KH, team, thị trường, loại, ưu tiên, giá trị, tấn, tiền tệ) khớp `String(input)`.
- `buildSavePatch`: form = base → `{}`; đổi đúng tên → `{ projectName }`; đổi 1 giai đoạn → có `chain` đủ 7 phần tử; không đổi giai đoạn → không có `chain`; đổi doanh thu với `canEditFinance: false` → không có key tài chính; `true` → có; xoá `penaltyValue` → `null`; xoá `contractValue` → không có key; xoá 1 ngày → `null`.
- `checkDraft`: 5 nhánh `none` (null, JSON hỏng, v=1), `foreign`, `fresh`, `stale` (khác `projectUpdatedAt`; khác `factVersion`).
- `restoreDraft`: draft thiếu field mới (vd không có `stageApplicable`) vẫn trả đủ field từ base.
- `saveErrorKind`: 4 nhánh.
- Nghiệm thu: `tsc` + `npm test` xanh (chưa đổi UI ở Task này — `DataEntryForm` import `FormState` từ file mới để không trùng type).

---

## Task 6 — Lỗi (b) + T2: nối `DataEntryForm` với dataEntryState

**Commit:** `fix(p1a): ban nhap khong de DB, ngay hien dung, data-entry luu duoc va bao loi ro`

### `app/[locale]/(app)/nhap-lieu/page.tsx`
Truyền `canEditFinance={user?.role === 'admin' || user?.role === 'bod'}` (khớp `FINANCE_FIELDS` guard ở `actions.ts:72`).

### `src/components/form/DataEntryForm.tsx`
- Props thêm `canEditFinance: boolean`.
- `base = useMemo(() => buildBaseForm(project, fact, financial, chain), [project, fact, financial, chain])`; `stamp = useMemo(() => makeStamp(project, fact, financial), ...)`.
- `useState<FormState>(() => base)` — KHÔNG đọc localStorage khi khởi tạo (xoá hàm `loadDraft` dòng 800-855).
- `useEffect` chạy 1 lần khi mount: `localStorage.removeItem(legacyDraftKey(...))`; `check = checkDraft(localStorage.getItem(draftKey(...)), stamp)`; `foreign` → removeItem; `fresh`/`stale` → `setPendingDraft(check)`.
- Autosave (thay effect dòng 149-157): debounce 800ms như cũ; bỏ qua khi `pendingDraft` còn; `formsEqual(form, base)` → `removeItem`; khác → `setItem(draftKey, JSON.stringify({ v: 2, savedAt: new Date().toISOString(), stamp, form }))`.
- Banner (ngay trên dải bước, chỉ khi `pendingDraft`): `<div className="sumbar">` nội dung `t('dataGuard.draft.found', { time: formatDateTime(draft.savedAt) })`; `stale` thêm dòng `t('dataGuard.draft.stale')`; 2 nút `btn` `t('dataGuard.draft.restore')` → `setForm(restoreDraft(base, draft))` + đóng banner; `btn ghost` `t('dataGuard.draft.discard')` → removeItem + đóng banner. (Dùng `formatDateTime` ở `src/lib/format.ts`.)
- Xoá state `chainDirty` và 2 chỗ `setChainDirty(true)`.
- `submit()`: `patch = buildSavePatch(base, form, { canEditFinance })`. Nếu `Object.keys(patch).length === 0 && !msDirty` → hiện `t('dataGuard.save.noChange')` (chip thường), không gọi server. Nếu patch rỗng mà `msDirty` → chỉ gọi `saveKeyMilestonesAction`. Còn lại gọi `saveMonthlyData(projectId, month, patch)`.
  - `res.ok` → removeItem(draftKey) + như cũ.
  - `!res.ok` → `setSaveErr(res.error)`; hiển thị `<p className="sumbar bad">` trong `stickybar` với `t('dataGuard.save.' + kind)` (kind từ `saveErrorKind`; `generic` truyền `{ msg: res.error }`; `locked` truyền `{ month }`). Mọi lần sửa field (`set`) xoá `saveErr`.
- Bước Tài chính khi `!canEditFinance`: 4 input `disabled`, class `inp ro`; trên lưới hiện `<p className="hintline">{t('dataGuard.save.financeReadonly')}</p>`.
- `validate()` giữ nguyên.

### i18n (`dataGuard.draft`, `dataGuard.save`)

| key | vi | en |
|---|---|---|
| `draft.found` | Có bản nháp chưa lưu lúc {time}. | Unsaved draft from {time}. |
| `draft.stale` | Dữ liệu đã được lưu sau thời điểm nháp — khôi phục sẽ thay các ô bằng bản nháp. | Data was saved after this draft — restoring replaces fields with the draft. |
| `draft.restore` | Khôi phục bản nháp | Restore draft |
| `draft.discard` | Bỏ bản nháp | Discard draft |
| `save.noChange` | Không có thay đổi để lưu | Nothing to save |
| `save.forbidden` | Bạn không có quyền lưu dự án này. | You are not allowed to save this project. |
| `save.locked` | Tháng {month} đã khoá số liệu — không lưu được. | Month {month} is locked — cannot save. |
| `save.notFound` | Không tìm thấy dự án. | Project not found. |
| `save.generic` | Lưu thất bại: {msg} | Save failed: {msg} |
| `save.financeReadonly` | Chỉ Admin/BOD được sửa số tài chính — các ô dưới đây chỉ để xem. | Only Admin/BOD can edit financials — fields below are read-only. |

### Test
- Hành vi đã phủ bằng test Task 5. Thêm `src/server/actions-security.test.ts`: data-entry PIC gọi `saveMonthlyData` với patch chỉ gồm `pctPlan` + `projectName` (đúng thứ `buildSavePatch` sinh khi `canEditFinance:false`) → `{ ok: true }`; test Forbidden hiện có (dòng 39-46) giữ nguyên xanh.
- Nghiệm thu thủ công trên dev (cổng 3000), đăng nhập `pm@daidung.com.vn` / `Pm@12345`:
  1. Mở `/vi/nhap-lieu` dự án có ngày → 6 ô ngày hiện đúng ngày.
  2. Sửa tên, không lưu, F5 → thấy banner nháp, form vẫn là dữ liệu DB; bấm Khôi phục → tên nháp hiện; Bỏ → banner mất, F5 không còn.
  3. Sửa % KH rồi Lưu → "Đã lưu hồ sơ", không Forbidden; bước Tài chính là ô xám chỉ xem.
  4. Tạo dự án mới ở mục 1 → form Hồ sơ hiện đúng tên/KH/team/..., 6 ô ngày trống.
  5. Admin khoá tháng rồi PM lưu → thấy thông báo khoá (nút Lưu đang disabled khi `locked` thì bỏ qua bước này).
- `tsc` + `npm test` xanh.

---

## Task 7 — Bảo mật: `/api/export` bắt đăng nhập + chống chèn công thức

**Commit:** `fix(p1a): /api/export bat dang nhap admin/bod va chong chen cong thuc Excel`

- `src/lib/excel-safe.ts` (mới):
  ```ts
  /** Chuỗi bắt đầu bằng = + - @ \t \r → thêm tiền tố "'" để Excel/CSV coi là chữ. Số/boolean/null trả nguyên. */
  export function safeCell<T>(v: T): T | string;
  ```
- `app/api/export/route.ts`: đầu `GET`: `const user = await getCurrentUser()`; null → `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`; role ∉ `['admin','bod']` → 403 `{ error: 'Forbidden' }`; rồi mới tới rate limit như cũ. Mọi ô chuỗi (`code`, `name`, `customer`, `team`, `type`, `market`, `status`, `priority`) bọc `safeCell`. Xoá 2 comment TODO.
- `app/api/report/export/route.ts`: bọc `safeCell` cho `code`, `name`, `priority`, `penalty` ở 2 sheet P0-Red/DanhSachDuAn.
- Test `src/lib/excel-safe.test.ts`: `'=1+1'`→`"'=1+1"`; `'+x'`, `'-x'`, `'@x'`, `'\tx'`, `'\rx'` đều có tiền tố; `'abc'` giữ; `-5` (number) giữ; `null` giữ.
- Test `src/server/export-route.test.ts` (mới, mẫu `report-export-route.test.ts`; `vi.mock('@/lib/session')`, `vi.mock('@/server/queries', () => ({ exportProjects: vi.fn() }))` trả 1 dòng có `projectName: '=HYPERLINK("http://x")'`): chưa đăng nhập → 401; viewer → 403; data-entry → 403; admin → 200 và ô B2 = `'\'=HYPERLINK("http://x")'`; bod → 200.
- Test `report-export-route.test.ts` hiện có phải vẫn xanh.
- Nghiệm thu: `tsc` + `npm test` xanh.

---

## Task 8 — Bảo mật: fail-closed quyền tài chính + bỏ secret dự phòng

**Commit:** `fix(p1a): canViewFinance fail-closed va bat buoc NEXTAUTH_SECRET`

- `src/lib/env.ts` (mới, thuần — middleware edge import được):
  ```ts
  /** Trả NEXTAUTH_SECRET đã trim; thiếu/rỗng → throw Error('NEXTAUTH_SECRET chưa được cấu hình - đặt biến môi trường trước khi chạy app'). */
  export function requireAuthSecret(): string;
  ```
- `src/lib/auth.ts`: thay `secret: process.env.NEXTAUTH_SECRET ?? 'ddc-local-dev-secret'` bằng getter `get secret() { return requireAuthSecret(); },` (lỗi nổ lúc dùng, không nổ lúc import). Dòng 142 `?? true` → `?? false`. Xoá 2 comment TODO tương ứng (dòng 87, 141).
- `middleware.ts`: bỏ `if (process.env.NEXTAUTH_SECRET)`; trong `try` gọi `requireAuthSecret()` trước `getToken`. Nếu secret thiếu (bắt lỗi từ `requireAuthSecret`) → `return new NextResponse('Server misconfigured: NEXTAUTH_SECRET', { status: 500 })`. Lỗi `getToken` khác → `role = null` như cũ.
- `app/[locale]/(app)/projects/[id]/page.tsx` dòng 64: `?? true` → `?? false`. KHÔNG sửa dòng nào khác của file này (B đang sửa file này ở P1B).
- `src/lib/session.ts` dòng 23: xoá comment TODO đã lỗi thời (code đã là `?? false`).
- `vitest.config.ts`: `env` thêm `NEXTAUTH_SECRET: 'test-secret'`.
- `.env.example`: dòng `NEXTAUTH_SECRET=` thêm comment ngay trên: `# BAT BUOC - thieu thi app tra loi 500 (openssl rand -base64 32)`.
- Test `src/lib/env.test.ts`: `vi.stubEnv('NEXTAUTH_SECRET', '')` → throw khớp `/NEXTAUTH_SECRET/`; `'   '` → throw; `'abc'` → `'abc'`. `afterEach(vi.unstubAllEnvs)`.
- Test `src/lib/auth-session.test.ts` (mới; `vi.mock('@/server/db', () => ({ prisma: {} }))`, `vi.mock('@/lib/activity')`): `authOptions.callbacks!.session!({ session: { user: { email: 'a@b' } }, token: {} } as never)` → `user.canViewFinance === false`; stub env rỗng → truy cập `authOptions.secret` throw.
- Test `src/server/middleware-secret.test.ts` (mới): stub env rỗng, gọi `middleware(new NextRequest('http://localhost/vi/overview'))` → status 500. Nếu `next-intl/middleware` không chạy được trong vitest thì `vi.mock('next-intl/middleware', () => ({ default: () => () => NextResponse.next() }))`.
- Nghiệm thu: `tsc` + `npm test` xanh; dev (có `.env`) đăng nhập bình thường; `grep "ddc-local-dev-secret" src app middleware.ts` = 0 kết quả.

---

## Task 9 — T3 phần server: route upload ảnh (để client đo được tiến trình)

**Commit:** `feat(p1a): route POST /api/photo-upload dung chung logic voi addPhotoAction`

Server action không báo tiến trình byte → client dùng `XMLHttpRequest` gọi route mới.

- `src/server/authz.ts` thêm:
  ```ts
  /** Quyền GHI 1 dự án - cùng luật requireProject trong actions.ts: admin, hoặc data-entry có trong project_assignments. */
  export async function canWriteProject(user: CurrentUser | null, projectId: number): Promise<boolean>;
  ```
- `src/server/photo-service.ts` (mới, KHÔNG `'use server'`):
  ```ts
  export type AddPhotoResult = { ok: true; id: number } | { ok: false; error: string; status: 400 | 403 };
  /** Chuyển nguyên thân addPhotoAction (actions.ts dòng 366-385) sang đây: parse formData, canWriteProject (sai → 403 'Forbidden'),
   *  addPhotoSchema/photoFileSchema (sai → 400, giữ nguyên message zod), 'No file' → 400, savePhotoFile, repo.addPhoto,
   *  logActivity(user,'add_photo',...), revalidateTag(profileTag). Thứ tự kiểm giữ như cũ (quyền trước validate). */
  export async function addPhotoForUser(user: CurrentUser, formData: FormData): Promise<AddPhotoResult>;
  ```
- `src/server/actions.ts` `addPhotoAction`: `const user = await getCurrentUser(); if (!user) return { ok: false, error: 'Forbidden' }; const r = await addPhotoForUser(user, formData); return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };`.
- `src/lib/same-origin.ts` (mới):
  ```ts
  /** true khi header Origin có host trùng x-forwarded-host ?? host. Thiếu Origin → false. */
  export function isSameOrigin(headers: Headers): boolean;
  ```
- `app/api/photo-upload/route.ts` (mới): `export const dynamic = 'force-dynamic'`; `POST(req: NextRequest)`: `!isSameOrigin(req.headers)` → 403 `{ ok:false, error:'Forbidden' }`; `getCurrentUser()` null → 401 `{ ok:false, error:'Unauthorized' }`; `addPhotoForUser(user, await req.formData())` → ok 200 `{ ok:true, id }`, lỗi → `r.status` `{ ok:false, error }`.
- Test `src/lib/same-origin.test.ts`: cùng host → true; khác host → false; thiếu Origin → false; có `x-forwarded-host` thì so với nó.
- Test `src/server/photo-upload-route.test.ts` (mẫu `photo-route.test.ts` + mock repo → mock-repo, mock `next/cache` như `actions.test.ts`): Origin khác → 403; chưa đăng nhập → 401; data-entry không được gán → 403; PDF → 400; PNG hợp lệ của PIC → 200 và `repo.getPhotos(PID)` tăng 1. Dọn thư mục upload trong `afterAll` như `photo-route.test.ts`.
- Toàn bộ test `addPhotoAction` trong `actions.test.ts` (dòng 63-139) phải vẫn xanh.
- Nghiệm thu: `tsc` + `npm test` xanh.

---

## Task 10 — T3 phần UI: vùng kéo-thả + icon cloud + thanh tiến trình

**Commit:** `feat(p1a): vung keo-tha anh co icon cloud va thanh tien trinh`

- `src/components/icons/index.tsx`: thêm sau `IconUpload`, đúng style IconBase:
  ```tsx
  export const IconCloudUpload = (p: IconProps) => (
    <IconBase {...p}>
      <path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 9.5a4 4 0 0 1-1 7.9" />
      <path d="M12 12v8M9 15l3-3 3 3" />
    </IconBase>
  );
  ```
- `src/lib/photo-upload.ts` (mới, thuần):
  ```ts
  export interface FileMeta { name: string; type: string; size: number }
  export type RejectReason = 'not_image' | 'too_big';
  /** Lọc trước khi gửi: type không bắt đầu 'image/' → not_image; size > maxBytes hoặc = 0 → too_big. Giữ thứ tự. */
  export function precheckPhotos<T extends FileMeta>(files: T[], maxBytes: number): { accepted: T[]; rejected: { name: string; reason: RejectReason }[] };
  /** % tổng (0..100, số nguyên, không vượt 100). totalBytes = 0 → 0. */
  export function overallPercent(doneBytes: number, currentLoaded: number, totalBytes: number): number;
  ```
- `src/components/form/PhotoDropzone.tsx` (mới, `'use client'`):
  ```ts
  export function PhotoDropzone(props: { projectId: number; yearMonth: string; disabled?: boolean; onUploaded: () => void }): JSX.Element;
  ```
  - Vùng `<div role="button" tabIndex={0}>` viền `1px dashed var(--sep-2)`, bo `var(--r-md)`, căn giữa: `IconCloudUpload size={32}` + `t('dataGuard.photo.dropTitle')` + hintline `t('dataGuard.photo.dropHint', { mb: PHOTO_MAX_BYTES / 1024 / 1024 })` (import `PHOTO_MAX_BYTES` từ `@/server/validation`). Khi đang kéo vào: viền `var(--accent)`, nền `var(--accent-tint)`.
  - Sự kiện: `onDragEnter`/`onDragOver` (preventDefault, bật active), `onDragLeave` (tắt), `onDrop` (preventDefault, lấy `e.dataTransfer.files`), click/Enter/Space → `inputRef.current?.click()`; `<input type="file" accept="image/*" multiple className="hidden">`. `disabled` hoặc đang tải → bỏ qua mọi sự kiện, `aria-disabled`.
  - Luồng: `precheckPhotos` → mỗi file bị loại hiện 1 dòng lỗi (`dataGuard.photo.notImage` / `tooBig` với `{ name, mb }`). Tải tuần tự các file `accepted` bằng XHR `POST /api/photo-upload` (FormData: `projectId`, `yearMonth`, `caption: ''`, `file`), `xhr.upload.onprogress` cập nhật %. Lỗi 1 file (status ≠ 200 hoặc `ok:false`) → ghi dòng `dataGuard.photo.failed` `{ name, msg: error ?? statusText }` rồi **tiếp tục file sau**. Xong hết → nếu có ≥1 file thành công gọi `onUploaded()`.
  - Tiến trình khi đang tải: chữ `t('dataGuard.photo.uploading', { i, n, pct })` + thanh `<div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>` cao 6px nền `var(--fill)`, lõi `var(--accent)` rộng `pct%`, `transition: width .2s`.
  - Lỗi hiển thị `<p className="hintline" style={{ color: 'var(--danger)' }}>`.
- `DataEntryForm.tsx`: thay khối `<label>` dòng 646-662 + state `photoBusy`/`photoErr` + hàm `uploadPhotos` bằng `<PhotoDropzone projectId={projectId} yearMonth={month} disabled={locked} onUploaded={() => router.refresh()} />`. Bỏ import `addPhotoAction` nếu không còn dùng. Lưới ảnh + nút xoá giữ nguyên.

### i18n (`dataGuard.photo`)

| key | vi | en |
|---|---|---|
| `dropTitle` | Kéo thả ảnh vào đây hoặc bấm để chọn | Drag photos here or click to choose |
| `dropHint` | Ảnh JPG/PNG/WebP, tối đa {mb}MB mỗi ảnh, chọn được nhiều ảnh | JPG/PNG/WebP, up to {mb}MB each, multiple allowed |
| `uploading` | Đang tải {i}/{n} · {pct}% | Uploading {i}/{n} · {pct}% |
| `notImage` | {name}: không phải file ảnh | {name}: not an image |
| `tooBig` | {name}: rỗng hoặc vượt quá {mb}MB | {name}: empty or larger than {mb}MB |
| `failed` | {name}: {msg} | {name}: {msg} |

- Test `src/lib/photo-upload.test.ts`: precheck — pdf → `not_image`, 0 byte → `too_big`, `max+1` → `too_big`, đúng `max` → accepted, thứ tự giữ; `overallPercent(0,0,0)=0`, `(50,0,100)=50`, `(50,25,100)=75`, `(100,10,100)=100`, làm tròn xuống.
- Nghiệm thu thủ công dev: bước "Mã SAP & Ảnh" — kéo 2 ảnh + 1 PDF vào vùng: viền đổi màu khi kéo; PDF báo lỗi tên file; thanh tiến trình chạy tới 100%; 2 ảnh hiện trong lưới. Tab tới vùng, Enter mở hộp chọn file. `tsc` + `npm test` xanh.

---

## Task 11 — Cổng kiểm cuối phase

**Commit:** chỉ khi có sửa (vd `chore(p1a): ...`), không thì không commit.

1. `npx tsc --noEmit`; `npm test` (ghi số test).
2. Build kiểm compile: `$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES = "D:\_project\DDC_dieu-phoi\tools\font-mock.js"; npm run build` → xanh.
3. `npx prisma migrate status` → "Database schema is up to date".
4. Dev 3000: đi lại nghiệm thu thủ công Task 6, 10; trang Tổng quan + Chi tiết dự án 1 hiển thị như trước (nhân lực 520/486).
5. Bỏ khoá file nóng khỏi `phien-A.md`, ghi "P1A xong — chờ tester". KHÔNG merge `main` (việc của bước merge sau reviewer CHỐT).

---

## Trường hợp biên bắt buộc (checklist cho tester)

- Migration trên DB có dữ liệu: tổng nhân lực trước = sau; mọi dòng cũ có `shiftCode = 'morning'`; dự án không có `fact_volume` → `factoryId` NULL.
- Thêm ca thứ 3 bằng `INSERT INTO dim_shift` → `getDailyManpower` tự cộng 3 ca, không sửa code.
- Plan Gantt `plannedFinish < plannedStart` hoặc `unitNo = 0` → DB từ chối (CHECK).
- Xoá `project_work_item` đang được plan dùng → plan còn, `workItemId` = NULL. Xoá dự án → plan bị xoá theo.
- Lưu tháng chưa có fact: dự án hoàn toàn mới (không tháng nào) và dự án có tháng trước (carry-forward). Lưu 2 lần liên tiếp → version 1 rồi 2, chỉ 1 dòng `isLatest`.
- Tháng đã khoá: saveMonthlyData/commitImport vẫn trả `locked`, không tạo dòng mới.
- Import: dòng trống bỏ qua; dòng thiếu SAP / thiếu % / % chữ / không được gán → `invalid` có số dòng; data-entry không thấy `projectId` của dự án không được gán.
- Bản nháp: nháp v1 cũ bị xoá không áp; nháp của dự án khác trùng id bị xoá; nháp cũ hơn DB → cảnh báo stale, chỉ áp khi bấm; lưu thành công xoá nháp; không sửa gì → không tạo nháp.
- Ngày: giá trị ISO có giờ vẫn hiện đúng ngày; dự án mới 6 ô ngày trống; không sửa ngày → không gửi ngày lên server.
- Data-entry: không bao giờ gửi field tài chính; lỗi server luôn hiện chữ, không im lặng.
- `/api/export`: không cookie → 401; viewer/data-entry → 403; tên dự án bắt đầu `=`/`+`/`-`/`@` → ô có tiền tố `'`.
- Thiếu `NEXTAUTH_SECRET` → trang trả 500 rõ lý do, không chạy RBAC ngầm; token thiếu `canViewFinance` → false.
- Upload: POST khác Origin → 403; không đăng nhập → 401; file 0 byte / >5MB / không phải ảnh → báo lỗi từng file, file khác vẫn tải; lỗi mạng 1 file không dừng cả loạt.
