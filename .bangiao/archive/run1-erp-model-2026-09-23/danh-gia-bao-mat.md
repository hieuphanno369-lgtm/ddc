PHAN QUYET BAO MAT: LO HONG

# Rà soát bảo mật — Run 1 (ERP data model v2, Task 0→8, nhánh feature/erp-model-v2)

Skill đã dùng: `ddc-tower:security-review`, `ddc-tower:security-audit` (chế độ guidance —
rà soát có phạm vi trên diff `main...HEAD`, không chạy full 6 pha). Run 1 không thêm
endpoint/auth mới nên không gọi `api-security-testing`. DB dev soi read-only qua `mcp__postgres`.
Phạm vi: 6 commit `4b48c1d..1507e2d`, 58 file. Không sửa bất kỳ file code nào.

Tổng kết: **1 lỗi CAO (mất dữ liệu), 2 lỗi TRUNG, 3 lỗi THẤP.** Không có SQL injection,
không có XSS, không lộ secret, không có endpoint mới thiếu auth.

---

## CAO-1 — Migration không tái lập được; cách "chữa" duy nhất được ghi lại là 2 lệnh xoá dữ liệu nằm NGOÀI migration

**File:** `prisma/migrations/20260922220000_erp_model_v2/migration.sql` (thiếu khối
data-remediation trước dòng 252 và 258). Bằng chứng đối chiếu: `.bangiao/thay-doi.md` Task 7 mục 1-2.

**Mức độ: CAO** (toàn vẹn + sẵn sàng dữ liệu).

**Cách phát sinh sự cố (đã xảy ra thật trên DB dev, không phải giả định):**
`migration.sql:252` thêm FK `fact_progress_monthly.bottleneckStage -> dim_stage(code)` và
`:258` thêm FK `fact_value_chain_progress.stageCode -> dim_stage(code)`. Nhưng migration
**không hề INSERT dòng nào vào `dim_stage`** — bảng này được tạo rỗng ở `:69-77` và chỉ
được đổ dữ liệu bởi `prisma/seed.ts:37` (script seed, không chạy ở production).
Hệ quả: `prisma migrate deploy` trên bất kỳ DB nào đã có dữ liệu trong
`fact_progress_monthly` / `fact_value_chain_progress` sẽ **fail ở bước AddForeignKey**.

Coder đã vượt qua bằng 2 câu SQL chạy tay qua `prisma db execute`:

    UPDATE fact_progress_monthly SET "bottleneckStage" = NULL;   -- không có WHERE
    DELETE FROM fact_value_chain_progress;                       -- không có WHERE

Hai lệnh này **không nằm trong migration.sql**, không nằm trong repo, chỉ được ghi lại
trong một file bàn giao. Người vận hành gặp đúng lỗi FK này ở staging/prod sẽ đọc
`thay-doi.md` và lặp lại y nguyên, tức **xoá sạch toàn bộ lịch sử %HT 7 giai đoạn của mọi
dự án** (DB dev hiện có 119 dòng) — chính là nguồn dữ liệu sinh ra %TT. Không backup,
không audit_log, không revert được (bảng này không append-only, không có version).

Điểm nhẹ duy nhất: Postgres chạy DDL trong transaction nên lần deploy fail sẽ rollback,
chưa mất dữ liệu ngay. Rủi ro nằm ở bước "chữa cháy" thủ công sau đó.

**Cách vá — chèn vào migration.sql, TRƯỚC khối AddForeignKey đầu tiên (dòng 221):**

    -- 1) dim_stage phải có dữ liệu TRƯỚC khi gắn FK trỏ vào nó (gốc của lỗi deploy).
    INSERT INTO "dim_stage" ("code","nameVi","nameEn","sortOrder","calcMode") VALUES
      ('design','Thiết kế','Design',1,'manual'),
      ('shop','Shop Drawing','Shop Drawing',2,'volume'),
      ('procurement','Vật tư','Materials',3,'volume'),
      ('fabrication','Gia công','Fabrication',4,'volume'),
      ('transport','Vận chuyển','Transport',5,'volume'),
      ('erection','Lắp dựng','Erection',6,'volume'),
      ('handover','Nghiệm thu & Bàn giao','Handover',7,'manual')
    ON CONFLICT ("code") DO NOTHING;

    -- 2) Chỉ dọn phần THẬT SỰ mồ côi — có WHERE, không xoá mù.
    UPDATE "fact_progress_monthly" SET "bottleneckStage" = NULL
     WHERE "bottleneckStage" IS NOT NULL
       AND "bottleneckStage" NOT IN (SELECT "code" FROM "dim_stage");

    DELETE FROM "fact_value_chain_progress"
     WHERE "stageCode" NOT IN (SELECT "code" FROM "dim_stage");

Sau khi sửa: dựng lại DB từ dump của môi trường có dữ liệu thật rồi chạy
`prisma migrate deploy` một lần để chứng minh migration tự chạy sạch, không cần thao tác tay.
7 dòng `dim_stage` lấy đúng từ `src/data/seed/erp.ts:5-14`.

---

## TRUNG-1 — `?month=` không validate, RSC ném RangeError không bắt (500) trên đúng đường code mới của Task 8

**File / dòng:**
- `app/[locale]/(app)/projects/[id]/page.tsx:44` — lấy `searchParams.month` thô, chỉ loại `'all'`.
- `app/[locale]/(app)/projects/[id]/page.tsx:64` — `getResourceSnapshot(id, month)` (MỚI, Task 8).
- `src/server/project-queries.ts:19` — `endOfMonth(yearMonth)`.
- `src/lib/clock.ts:70` — `d.toISOString()` trên `Invalid Date`.

**Mức độ: TRUNG-THẤP.** Cần session hợp lệ (layout `(app)/layout.tsx:13-14` redirect user
chưa đăng nhập) và chỉ tự làm hỏng trang của chính mình, nên không vượt biên tin cậy. Tác
động thật: 500 không kiểm soát, và ở dev/preview Next.js trả full stack trace.

**Repro — đã chạy thật bằng node với đúng thân hàm `addMonths` + `endOfMonth`:**

    endOfMonth('2026-09')  => 2026-09-30
    endOfMonth('abc')      => THROW RangeError: Invalid time value
    endOfMonth('all2')     => THROW RangeError: Invalid time value
    endOfMonth('0000-00')  => -000001-12   (không throw nhưng sai hoàn toàn)
    endOfMonth('12345-99') => 1233-03-31   (không throw nhưng sai hoàn toàn)

Tức `GET /vi/projects/1?month=abc` (đã đăng nhập) = 500. Đây là đường MỚI: trước Run 1,
`month` chỉ đi vào điều kiện `where { yearMonth }` nên giá trị rác chỉ trả kết quả rỗng,
không có hàm nào parse nó thành `Date`.

**Lỗi anh em cùng gốc, cần vá chung:** `src/server/validation.ts:9`
`const yearMonth = z.string().regex(/^\d{4}-\d{2}$/)` chấp nhận `2026-00` và `2026-99`.
Giá trị này đi tiếp vào `src/server/repo/prisma-repo.ts:755 endOfMonth(yearMonth)`:
`2026-00` cho mốc `2025-12-31`, `calcPv` tính PV theo tháng sai, rồi **INSERT một dòng fact
có `yearMonth` vô nghĩa** vào bảng append-only (theo thiết kế thì không xoá được). Cần
quyền PIC/admin nên mức thấp, nhưng làm bẩn vĩnh viễn bảng fact.

**Cách vá:**
1. `src/lib/clock.ts:16` đã có sẵn `isValidYearMonth()` — dùng nó ở `page.tsx:44`:
   `const month = typeof searchParams.month === 'string' && isValidYearMonth(searchParams.month) ? searchParams.month : currentMonth();`
2. Không tin caller: trong `resourceWindow()` (`project-queries.ts:18`) thêm
   `const ym = isValidYearMonth(yearMonth) ? yearMonth : currentMonth();`
3. Siết regex ở `validation.ts:9` thành `/^\d{4}-(0[1-9]|1[0-2])$/` (đúng `YM_RE` ở `clock.ts:13`).

---

## TRUNG-2 — `.env.example` bật sẵn `DDC_FAKE_TODAY`; đồng hồ ứng dụng ghim được qua env, không chặn production

**File / dòng:** `.env.example:19-22` (dòng `DDC_FAKE_TODAY=2026-09-16` **không** comment);
`src/lib/clock.ts:28` (đọc `process.env.DDC_FAKE_TODAY` ở mọi môi trường).

**Mức độ: TRUNG** — kiểm soát theo thời gian hỏng âm thầm (fail-silent).

**Hậu quả:** thao tác phổ biến `cp .env.example .env` ở môi trường mới sẽ ghim `today()`
đứng yên tại 16/09/2026. Mọi kiểm soát dựa trên `today()` sai im lặng, không log, không cảnh báo:
- `penaltyState()` qua `src/server/queries.ts:67 today: today()` — cảnh báo **nguy cơ phạt
  hợp đồng** và "còn <=30 ngày đến mốc bàn giao" sẽ không bao giờ bắn thêm.
- `calcDurationPctComplete(..., today())` (`queries.ts:69`) — %KH theo thời gian đóng băng,
  `onTrack`/`deriveStatus` luôn báo đúng tiến độ.
- `historyMonths()` (`clock.ts:74`) — cửa sổ 12 tháng và toàn bộ `revalidateTag` bám theo.

**Cách vá:**
1. `.env.example`: comment dòng đó (`# DDC_FAKE_TODAY=2026-09-16`) để không ai copy nhầm.
2. `src/lib/clock.ts:28`: chỉ đọc override ngoài production —
   `const override = process.env.NODE_ENV !== 'production' ? process.env.DDC_FAKE_TODAY?.trim() : undefined;`
   kèm `console.warn` một lần khi override có hiệu lực, để môi trường bị ghim luôn để lại dấu vết.

---

## THẤP-1 — Chuyển sang FK cascade làm `sap_queue` không còn được dọn khi xoá dự án / reset dữ liệu

**File / dòng:** `src/server/repo/prisma-repo.ts:961-971` (`removeProject`) và `:973-980`
(`resetAllData`); FK tương ứng ở `migration.sql:279` là `ON DELETE SET NULL`.

**Thoái lui so với trước Run 1** (`git show main:src/server/repo/prisma-repo.ts`): cả hai
hàm cũ đều gọi `prisma.sapQueue.deleteMany(...)` tường minh. Bản mới bỏ hẳn vì "cascade tự
dọn" — nhưng riêng `sap_queue` là SET NULL chứ không phải CASCADE.

**Hậu quả:** xoá một dự án thì dòng `sap_queue` còn nguyên `sapCode` và `projectNameHint`
(chính là tên dự án vừa xoá) với `projectId = NULL`; và `resetAllData()` — hàm đứng sau nút
"Xoá toàn bộ dữ liệu" của admin (`actions.ts:219-222`) — **không còn xoá sap_queue**. Dữ
liệu tồn dư sau khi người dùng đã yêu cầu xoá; tên dự án đã xoá vẫn hiển thị ở màn hình SAP
queue. Mức thấp vì chỉ admin thực hiện được và dữ liệu không nhạy cảm cao.

**Cách vá:** thêm lại `prisma.sapQueue.deleteMany({ where: { projectId: id } })` vào
`removeProject` (trước `prisma.project.delete`), và `prisma.sapQueue.deleteMany()` vào
mảng `$transaction` của `resetAllData`.

---

## THẤP-2 — `saveMonthlyFact` / `saveFinancial` đọc `prev` ngoài transaction: 500 thay vì thông báo xung đột

**File / dòng:** `src/server/repo/prisma-repo.ts:743` (`getLatestFact` gọi ngoài
`$transaction` bắt đầu ở `:762`) và `:831-834` (`saveFinancial`).

**Phân tích:** hai request đồng thời cùng `(projectId, yearMonth)` cùng đọc `version = N`
rồi cùng INSERT `version = N+1`. Đã verify trên DB dev: PK
`fact_progress_monthly_pkey (projectId, yearMonth, version)` và partial unique index
`ux_fact_progress_latest ... WHERE "isLatest"` đều tồn tại thật, nên **không mất dữ liệu và
không thể có 2 dòng isLatest**. Bất biến append-only đứng vững.

**Vấn đề còn lại:** lỗi Prisma P2002 không được bắt ở `src/server/actions.ts:141-152`,
server action ném ra ngoài, người dùng nhận 500 thay vì "có người vừa lưu, tải lại".

**Cách vá:** bọc `try/catch` quanh `repo.saveMonthlyFact` / `repo.saveFinancial` trong
`saveMonthlyData`, trả `{ ok: false, error: 'conflict' }`; hoặc đưa `getLatestFact` vào
trong `$transaction` với `isolationLevel: 'Serializable'`.

---

## THẤP-3 — Cascade toàn cục trên 2 bảng dimension dùng chung (`dim_contractor`, `dim_equipment`)

**File / dòng:** `prisma/migrations/20260922220000_erp_model_v2/migration.sql:321`
(`fact_daily_manpower.contractorId`), `:327` (`fact_daily_equipment_usage.contractorId`),
`:330` (`fact_daily_equipment_usage.equipmentId`) — cả ba đều `ON DELETE CASCADE`.

**Phân tích:** khác với các FK còn lại (đều là con trỏ về `dim_project`, cascade đúng hướng,
không mở đường chéo dự án), ba FK này trỏ tới bảng dimension **dùng chung cho mọi dự án**.
Xoá 1 nhà thầu = xoá sạch dữ liệu nhân lực/thiết bị theo ngày của **tất cả** dự án, không
giới hạn theo dự án mà người thao tác có quyền.

**Hiện chưa khai thác được:** grep toàn repo không có đường ghi/xoá `contractor` /
`equipment` nào từ HTTP — chỉ `prisma/seed.ts:40,43` (`deleteMany` trong script seed).
Nhưng đây là mìn đặt sẵn: run sau thêm nút "xoá nhà thầu" trong admin là nổ ngay, và người
review PR đó sẽ không nhìn thấy hậu quả vì nó nằm trong migration của Run 1.

**Cách vá:** đổi 3 FK này sang `ON DELETE RESTRICT` (đúng pattern `fact_volume.factoryId` ở
`:267`), dùng `isActive = false` để xoá mềm — cờ này đã có sẵn trên cả `dim_contractor:143`
lẫn `dim_equipment:162`, và `getContractors`/`getEquipments` (`prisma-repo.ts:274-283`) đã
lọc theo nó.

---

## Trả lời trực tiếp 5 câu hỏi trọng tâm

**1) Migration SQL viết tay có gây injection không? — KHÔNG.**
Toàn bộ 342 dòng là DDL tĩnh, không nội suy chuỗi, không nhận tham số từ ứng dụng.
`ALTER COLUMN ... TYPE ... USING (x::text::enum)` (dòng 40, 43-45, 61, 65) là cách đúng:
giữ nguyên dữ liệu và giữ nguyên index qua lần đổi kiểu — ghi chú ở `:211-213` về việc bỏ 2
`CREATE INDEX` thừa là chính xác. Case `sap_queue.status` (DROP DEFAULT, đổi kiểu, SET
DEFAULT lại — dòng 64-66) cũng đúng thứ tự.
Chỗ duy nhất dùng SQL động trong toàn repo là `prisma/seed.ts:194 $executeRawUnsafe`, nhưng
tên bảng lấy từ mảng hardcode `:175-191` nên không injectable. Mọi truy vấn khác
(prisma-repo, project-queries) đều đi qua query builder Prisma, tham số hoá.

**2) Migration có gây mất dữ liệu không? — CÓ, nhưng không ở chỗ coder nghĩ.**
Phần `ALTER COLUMN ... USING` đã sửa đúng, không mất dữ liệu. Rủi ro nằm ở bước
data-remediation bị bỏ ra ngoài migration — xem **CAO-1**.

**3) FK cascade trên 11 bảng mới có mở lỗ hổng xoá/leak chéo dự án không? — Về cơ bản KHÔNG.**
Đã đọc hết 32 FK. Mọi bảng con đều `projectId -> dim_project ON DELETE CASCADE`, đúng hướng,
không FK nào cho phép đọc hay xoá sang dự án khác. Hai ngoại lệ cần siết đã nêu: **THẤP-3**
(dim dùng chung) và **THẤP-1** (`sap_queue` SET NULL). `dim_customer` / `dim_team_kd` /
`dim_currency` đều `RESTRICT` — đúng, chặn xoá dim khi còn dự án tham chiếu.
Toàn bộ read mới (`getDailyManpower`, `getDailyEquipment`, `getStageMilestones`,
`getKeyMilestones`, `getWorkItems`, `getWorkItemFacts`, `getContractors`) đều lọc
`where { projectId }` ở cả `prisma-repo.ts:239-299` lẫn `mock-repo.ts:160-218` — không có
đường rò dữ liệu dự án khác.

**4) `calcChainPctActual` / `calcDurationPctComplete` / `calcDayVariance` có nhận input
client không kiểm soát không? — KHÔNG. Cả ba ĐẠT.**
- `calcChainPctActual` **có** nhận input client (`chain` trong `saveMonthlyData`), nhưng đã
  qua `saveMonthlyDataSchema` (`validation.ts:35-41`) TRƯỚC mọi write (`actions.ts:76-77`):
  đúng 7 phần tử, `stageCode` là enum 7 giá trị, `pctComplete` là `z.number().min(0).max(1.5)`,
  không trùng stageCode. Không NaN/Infinity/chuỗi nào lọt được. Mẫu số 0 trả `0` chứ không
  NaN (`stages.ts:85`). Kết quả bị chặn trên ở 1.5 nên `ev = pctActual x bac` không thổi phồng được.
- `calcDurationPctComplete`: chỉ nhận `project.plannedStartDate/plannedFinishDate` từ DB và
  `today()`. `toDate()` trả `null` cho rác, `totalMs < 0` trả `null`, kết quả kẹp `[0, 1]`.
  Không có đường từ request.
- `calcDayVariance`: chỉ nhận 2 cột `fact_stage_milestone` từ DB, null-safe, không có đường từ request.

**5) `getStageWeights` truyền vào `calcChainPctActual` có bị thao túng qua request không? — KHÔNG.**
`prisma-repo.ts:226-237` chỉ đọc `where { projectId }`; `projectId` đã qua `requireProject()`
(`actions.ts:27-33`, gọi ở `:68`) nên data-entry chỉ chạm được dự án mình là PIC. Grep toàn
repo: **không tồn tại bất kỳ đường ghi `project_stage_weight` nào từ HTTP** — chỉ
`prisma/seed.ts:75`. Fallback về `DEFAULT_STAGE_WEIGHTS` khi bảng rỗng là an toàn (tổng đúng 100).
*Cảnh báo cho run sau:* `calcChainPctActual` **không** gọi `validateStageWeights()`
(`stages.ts:111`) dù hàm này đã có sẵn. Ngay khi có UI sửa trọng số, phải validate ở server
trước khi ghi — nếu không, bộ trọng số tổng khác 100 hoặc âm sẽ bóp méo %TT một cách âm
thầm, mà %TT là đầu vào của EV, SPI, rồi cảnh báo trễ tiến độ.

---

## Đã kiểm, KHÔNG có vấn đề

- **Secret:** quét toàn bộ dòng thêm mới — không có API key / token / password hardcode. Chỉ
  có email seed và `.env.example` (đã nằm trong `.gitignore`).
- **XSS:** `dangerouslySetInnerHTML` duy nhất là script theme tĩnh ở `app/[locale]/layout.tsx:31`
  (chuỗi hằng, không nội suy, pre-existing). 9 key i18n mới của Task 8 là chuỗi tĩnh,
  `{date}` đi qua `formatDate` chứ không phải HTML. `ManpowerDailyChart.tsx` chỉ render số qua recharts.
- **Endpoint mới:** Run 1 **không** thêm route API nào. `app/api/report/export/route.ts`
  (file có sửa trong Run 1) vẫn giữ nguyên guard `admin|bod` ở `:10-13`.
- **Bất biến append-only:** verify trên DB dev — `ux_fact_progress_latest` và
  `ux_fact_financial_latest` (partial unique WHERE "isLatest") tồn tại thật;
  204/204 `fact_progress_monthly` đúng 1 dòng isLatest mỗi (projectId, yearMonth);
  0 dòng `fact_value_chain_progress` mồ côi; 0 `bottleneckStage` mồ côi.
- **Mass assignment:** `saveMonthlyData` (`actions.ts:107-124`) gán tường minh từng field vào
  `profilePatch`, không spread `patch` thô, nên không mass-assign được `isActive`,
  `masterCode`, `createdBy`...

---

## Nợ bảo mật đã biết — KHÔNG thuộc Run 1, chỉ ghi phần liên quan trực tiếp

- `/api/export` thiếu auth (`app/api/export/route.ts:10`, TODO còn nguyên) — ngoài phạm vi.
- **BOLA `/projects/[id]` — liên quan trực tiếp:** Task 8 vừa thêm dữ liệu **nhân lực và
  thiết bị theo ngày** vào đúng trang đang dính BOLA (`page.tsx:64-65`, `:131-148`, `:374-380`).
  Run 1 không tạo ra lỗ hổng này nhưng **mở rộng đáng kể lượng dữ liệu rò qua nó** (trước chỉ
  có EVM/tài chính tổng hợp, giờ thêm biên chế nhân sự theo ngày của từng nhà thầu). Đề nghị
  nâng ưu tiên vá BOLA lên trước go-live.
- `app/[locale]/(app)/projects/[id]/page.tsx:48` — `canViewFinance = user?.canViewFinance ?? true`
  là fail-open cục bộ. **Không khai thác được** (layout `:13-14` đã chặn user null và
  `src/lib/session.ts:24` đã fail-closed `?? false`), nhưng nên đổi thành `?? false` cho nhất
  quán, tránh bẫy khi ai đó tái dùng component ngoài layout.
- `middleware.ts:27` — RBAC route bị bỏ qua hoàn toàn khi thiếu `NEXTAUTH_SECRET`; pre-existing.
- Thiếu flow reset mật khẩu, rate-limit login, giới hạn upload — ngoài phạm vi.

---

## Kết luận

Không có lỗ hổng nào cho phép **vượt biên tin cậy** (không leo thang quyền, không đọc/ghi
chéo dự án, không injection, không lộ secret) phát sinh từ Run 1. Lớp tính toán mới và lớp
repo mới đều sạch về kiểm soát truy cập lẫn validate input.

Vấn đề chặn là **CAO-1 — toàn vẹn dữ liệu**: migration của Run 1 chưa chạy được một cách tự
lập trên DB có dữ liệu, và "hướng dẫn chữa cháy" ngầm hiện tại là một lệnh `DELETE` không có
`WHERE` trên bảng lịch sử chuỗi giá trị. Phải vá trước khi migration này chạm bất kỳ môi
trường nào ngoài DB dev.

---

# Rà soát lại sau CAN SUA #1

Skill đã dùng: `security-review` (load lỗi — hook `git diff origin/HEAD...` fail vì repo không có
`origin/HEAD`; đã bỏ qua và soi tay), `ddc-tower:security-audit` (guidance mode, phạm vi đúng 5
điểm A-1→A-5, không chạy 6 pha). DB dev soi read-only qua `mcp__postgres`. Không sửa file code nào.
Phạm vi: commit `987c2e1` (5 file, +48/-6).

**Kết luận ngắn: CAO-1 ĐÃ ĐÓNG ở mức source. Không có lỗ hổng MỚI do 5 bản vá tạo ra.
Nhưng 3 điểm vá là vá triệu chứng chứ chưa vá gốc — TRUNG-1 vẫn tái hiện được bằng input khác,
và bản thân cách vá A-1 tạo ra 1 rủi ro vận hành mới (checksum migration lệch).**

---

## A-1 — ĐẠT về nội dung SQL. Đã đóng CAO-1.

Đối chiếu `prisma/migrations/20260922220000_erp_model_v2/migration.sql:221-240`:

- **Vị trí đúng.** INSERT nằm sau `CREATE TABLE "dim_stage"` (`:69-77`) và sau
  `CREATE INDEX dim_stage_sortOrder_idx` (`:191`), trước FK đầu tiên trỏ vào `dim_stage`
  (`:272` bottleneckStage, `:278` stageCode, `:305`, `:314`, `:323`). Không có lệnh nào
  giữa chừng cần `dim_stage` rỗng.
- **Đủ 7 dòng, đúng schema.** 5 cột `(code, nameVi, nameEn, sortOrder, calcMode)` khớp chính
  xác định nghĩa bảng — không thiếu cột NOT NULL nào. Giá trị `'manual'/'volume'` hợp lệ với
  enum `StageCalcMode` (`:37`). Đã đối chiếu từng dòng với `src/data/seed/erp.ts:5-13` và với
  `STAGE_CALC_MODE` ở `src/lib/stages.ts:54-62` (design=manual, shop/procurement/fabrication/
  transport/erection=volume, handover=manual): **khớp 7/7**. Đối chiếu tiếp với dữ liệu thật
  đang có trong DB dev (`SELECT * FROM dim_stage`): khớp tuyệt đối cả tiếng Việt có dấu.
- **WHERE của 2 lệnh dọn — logic ĐÚNG, không xoá tràn lan, không bỏ sót.**
  - `UPDATE fact_progress_monthly ... WHERE "bottleneckStage" IS NOT NULL AND ... NOT IN (...)`:
    `bottleneckStage` là `String?` (`schema.prisma:259`), FK `ON DELETE SET NULL`. Mệnh đề
    `IS NOT NULL` chặn đúng cái bẫy `NULL NOT IN (...)` → `NULL` → không update. Chỉ đụng dòng
    thật sự mồ côi.
  - `DELETE FROM fact_value_chain_progress WHERE "stageCode" NOT IN (...)`: `stageCode` là
    `String` NOT NULL và nằm trong PK `@@id([projectId, stageCode, yearMonth])`
    (`schema.prisma:281,289`) → không có case NULL. `dim_stage.code` là PK nên subquery không
    bao giờ trả NULL → `NOT IN` không bị nhiễm three-valued logic.
  - Bẫy còn lại đã kiểm: `NOT IN (tập rỗng)` = TRUE (xoá sạch). **Không xảy ra**, vì INSERT 7
    dòng chạy vô điều kiện ngay phía trên trên một bảng vừa được `CREATE TABLE` trong cùng
    migration, và Prisma bọc cả file trong một transaction.
- So với 2 lệnh chạy tay cũ (`UPDATE ... SET bottleneckStage = NULL` và
  `DELETE FROM fact_value_chain_progress` — đều không WHERE): **đã hết đường để người vận hành
  lặp lại lệnh xoá mù từ `thay-doi.md`.** Lỗ hổng CAO-1 đóng.

### A-1-a (MỚI, mức TRUNG, vận hành/toàn vẹn) — sửa file migration SAU KHI đã apply ⇒ checksum lệch

**File:** `prisma/migrations/20260922220000_erp_model_v2/migration.sql` (toàn file).
**Bằng chứng đo thật, không suy đoán:**

    sha256 file hiện tại          : 1acf260db75a0c1e6efe929671b7fad8ce61cd2d3b5734206ecfdedf3fffbd1e
    _prisma_migrations.checksum   : a6fa616ff0b75768b0530ef6f30503b8ed05f33d2eecdc96403ff8d7c6e65c35
    (dòng applied thành công: finished_at = 2026-09-22 22:25:24, applied_steps_count = 1)

Migration này đã apply lên DB dev **trước** khi coder sửa nó. Prisma coi migration là bất biến
sau khi apply; sửa nội dung làm lệch checksum → `prisma migrate dev` trên DB này sẽ báo
"migration ... was modified after it was applied" và đòi `migrate resolve` hoặc `migrate reset`.
(`npx prisma migrate status` với Prisma 6.19.3 **không** kiểm checksum nên vẫn báo
"Database schema is up to date!" — đừng lấy lệnh này làm bằng chứng migration còn lành.)

Hệ quả trực tiếp cho vòng này: **bản vá A-1 chưa từng được thi hành một lần nào trên DB thật.**
Trên DB dev nó sẽ không bao giờ chạy (migration đã ghi applied), còn kịch bản kiểm chứng mà
`thay-doi.md` đề nghị ("chạy lại `migrate deploy`") sẽ chết vì checksum chứ không vì FK. Tester
chỉ chạy `vitest` (335/335) — vitest không đụng migration. Nói cách khác: CAO-1 đóng **trên giấy
tờ source**, chưa có bằng chứng thực thi.

Ghi chú làm nhẹ: `_prisma_migrations` còn 4 dòng thất bại của chính migration này
(21:36, 21:37, 22:20, 22:24) nhưng **cả 4 đều có `rolled_back_at`**, nên chúng không chặn
`migrate deploy`. Chỉ còn đúng vấn đề checksum.

**Cách vá (chọn 1):**
1. *Khuyến nghị* — dựng DB sạch từ đầu (`dropdb`/tạo DB mới, đổi `DATABASE_URL` trỏ vào đó) rồi
   `npx prisma migrate deploy` + `npx prisma db seed` một lượt. Đây đồng thời là bài kiểm chứng
   A-1 mà reviewer yêu cầu. Muốn kiểm đúng lỗi gốc thì trước khi deploy hãy nạp một ít dòng
   `fact_value_chain_progress`/`bottleneckStage` (kể cả 1 dòng mã rác như `'erection_old'`) để
   chứng minh WHERE dọn đúng phần mồ côi và giữ nguyên phần hợp lệ.
2. Nếu bắt buộc giữ DB dev: `npx prisma migrate resolve --applied 20260922220000_erp_model_v2`
   để Prisma ghi lại checksum mới. Cách này **không** chứng minh được SQL mới chạy đúng — chỉ
   làm im cảnh báo, phải kèm cách 1 ở một DB khác.
3. Quy tắc từ nay: migration đã apply là bất biến. Sửa data-remediation phải nằm ở migration
   MỚI (vd `20260923xxxxxx_seed_dim_stage`), không sửa file cũ.

### A-1-b (THẤP, ghi nhận) — DELETE mồ côi không để lại dấu vết

`DELETE FROM fact_value_chain_progress WHERE stageCode NOT IN (...)` xoá vĩnh viễn, không log,
không audit_log, không bảng cách ly. Trên DB dev hiện tại là 0 dòng (7 mã đã phủ hết dữ liệu
thật), nhưng ở một môi trường có mã giai đoạn cũ khác 7 mã thì đây là mất dữ liệu im lặng.
**Cách vá (tuỳ chọn, chi phí thấp):** thêm trước lệnh DELETE một câu
`CREATE TABLE IF NOT EXISTS "_quarantine_value_chain_orphan" AS SELECT * FROM
"fact_value_chain_progress" WHERE "stageCode" NOT IN (SELECT "code" FROM "dim_stage");`
để giữ lại bản sao trước khi xoá. Áp dụng ở migration MỚI theo A-1-a.

---

## A-2 — vá đúng nhưng CHƯA hết gốc. Không tạo lỗ hổng mới.

`src/server/queries.ts:194-208`: nhánh `yearMonth === 'all'` trả `delta` 6 số 0 và bỏ hẳn lượt
query `prev`. Đọc kỹ: `cur` vẫn tính đủ với `filters`, `...cur` giữ nguyên 6 chỉ số, không đổi
chữ ký, không đổi `PortfolioKpis` (6 key delta khớp interface `:167-174`). **Không có lỗ hổng
mới, không bỏ qua guard nào** — `getPortfolioKpis` không phải chốt phân quyền.

**Nhưng lỗi cũ vẫn tái hiện bằng input khác (TRUNG-1-b, mức THẤP — sai lệch số liệu, không vượt
biên tin cậy):** `app/[locale]/(app)/overview/page.tsx:51`

    const month = p(searchParams, 'month') === 'all' ? 'all' : p(searchParams, 'month') || currentMonth();

Trang overview **không validate format** `month`. Với `?month=abc` (hoặc `?month=ALL` — so sánh
`=== 'all'` phân biệt hoa thường), `month = 'abc'` ≠ `'all'` → rơi xuống `prevMonth('abc')` →
`addMonths`: `Number('abc'.slice(0,4))` = `NaN` → chuỗi `'0NaN-NaN'` → `kpisForMonth` trả toàn 0
→ `delta = cur - 0`, tức **đúng con số bịa mà A-2 định xoá**, chỉ đổi đường vào.

**Cách vá:** dùng cùng một guard như A-3 ngay tại `overview/page.tsx:51`:

    const raw = p(searchParams, 'month');
    const month = raw === 'all' ? 'all' : (isValidYearMonth(raw) ? raw : currentMonth());

hoặc tốt hơn, chốt ở chính `getPortfolioKpis`: `if (yearMonth === 'all' || !isValidYearMonth(yearMonth))`
→ trả delta 0. Đặt guard ở hàm thì mọi call site tương lai được bảo vệ, không phụ thuộc từng trang.

---

## A-3 — vá ĐÚNG hướng nhưng CHƯA đóng hết TRUNG-1. Không tạo lỗ hổng mới.

`app/[locale]/(app)/projects/[id]/page.tsx:46` dùng
`isValidYearMonth(searchParams.month) ? ... : currentMonth()`.

**Kiểm "fallback có bị lợi dụng để bypass check khác không" — KHÔNG.** Đã truy toàn bộ điểm dùng
`month` trên trang (`:55` `getProjectSummary`, `:59` `getValueChain`, `:66` `getResourceSnapshot`,
`:67` `getManpowerDaily`): tất cả là đường ĐỌC, `month` chỉ là tham số lọc dữ liệu, không tham
gia bất kỳ quyết định phân quyền, khoá tháng (`isMonthLocked`) hay ghi nào. Rơi về `currentMonth()`
không mở thêm quyền đọc so với một tháng bất kỳ khác. Mảng (`?month=a&month=b`) bị chặn sẵn bởi
`typeof === 'string'`. Guard này chặt hơn hẳn điều kiện cũ (`!== 'all'`).

### TRUNG-1-a (CHƯA ĐÓNG, mức TRUNG-THẤP) — `?month=9999-12` vẫn ném RangeError ⇒ 500

`isValidYearMonth` dùng `YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/` (`src/lib/clock.ts:13`) — validate
**format**, không validate **miền giá trị**. `'9999-12'` khớp regex hoàn toàn.

**Repro đã chạy thật bằng node với đúng thân hàm `addMonths`/`endOfMonth` copy từ `clock.ts:48-70`:**

    endOfMonth('2026-09') => 2026-09-30        (ok)
    endOfMonth('0001-01') => 0001-01-31        (ok)
    endOfMonth('0000-01') => 0000-01-31, from = '-000001-08'   (không throw, chuỗi méo, query rỗng)
    endOfMonth('9999-12') => THROW RangeError: Invalid time value

Lý do: `addMonths('9999-12', 1)` = `'10000-01'` → `new Date('10000-01-01T00:00:00Z')` là
`Invalid Date` → `d.toISOString()` ném `RangeError`.

**Đường khai thác (cần session hợp lệ, không vượt biên tin cậy):**
`GET /vi/projects/1?month=9999-12` → `page.tsx:66 getResourceSnapshot` →
`src/server/project-queries.ts:19 resourceWindow` → `endOfMonth` → RangeError không bắt → 500.
Ở dev/preview Next.js trả full stack trace. Đây **đúng là lỗi TRUNG-1 cũ**, chỉ khác payload:
bản vá chặn `'abc'` và `'2026-99'` nhưng không chặn `'9999-12'`.

Bộ test của tester (`src/server/projects-detail-page-month-guard.test.ts`) phủ `'abc'`,
`'2026-99'`, `undefined`, `'2026-07'` — **không có case biên trên `'9999-12'`**, nên 335/335 xanh
không chứng minh TRUNG-1 đã đóng.

**Cách vá (đúng như khuyến nghị #2 của vòng trước, giờ đã có repro):**
1. Không tin caller — vá tại nguồn `src/server/project-queries.ts:18`:
   `export function resourceWindow(yearMonth: string) { const ym = isValidYearMonth(yearMonth) ? yearMonth : currentMonth(); const monthEnd = endOfMonth(ym); ... }`
2. Hoặc/và làm `endOfMonth` an toàn tại `src/lib/clock.ts:66-70`: kiểm
   `Number.isNaN(d.getTime())` và trả về `endOfMonth(currentMonth())` (hoặc ném lỗi có kiểm
   soát mà tầng trên bắt được) thay vì để `toISOString()` ném RangeError trần.
3. Siết thêm miền năm nếu muốn triệt để: `/^(19|20)\d{2}-(0[1-9]|1[0-2])$/`.
4. Thêm case `'9999-12'` và `'0000-01'` vào `projects-detail-page-month-guard.test.ts`.

### TRUNG-1-c (CHƯA ĐÓNG, mức THẤP) — `validation.ts` vẫn nhận `2026-00`/`2026-99` vào bảng append-only

`src/server/validation.ts:9` vẫn là `/^\d{4}-\d{2}$/`. Coder khai báo rõ là ngoài phạm vi 5 điểm.
Vẫn đúng như mô tả vòng trước: PIC/admin ghi được một dòng `fact` với `yearMonth` vô nghĩa vào
bảng append-only (không xoá được theo thiết kế). Không phải lỗi mới, giữ nguyên trong sổ nợ.
**Cách vá:** đổi thành `/^\d{4}-(0[1-9]|1[0-2])$/` cho khớp `YM_RE`.

---

## A-4 — ĐẠT ở phần được giao. TRUNG-2 đóng một nửa.

`.env.example:20-24`: dòng `DDC_FAKE_TODAY=2026-09-16` đã được comment, kèm cảnh báo rõ ràng
đúng trọng tâm rủi ro (đồng hồ đứng ⇒ cảnh báo phạt hợp đồng im lặng). Thao tác
`cp .env.example .env` ở máy mới không còn tự ghim đồng hồ → **phần footgun đã đóng**.
Đã kiểm thêm: `.env` thật ở máy này **không** chứa `DDC_FAKE_TODAY` (chỉ có `DATABASE_URL`,
`DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`ALLOWED_EMAIL_DOMAINS`, `ROLE_SEED`), và `.env` không được git theo dõi (`.gitignore:4`).
Không có secret nào lộ trong commit `987c2e1`.

**Phần chưa đóng (THẤP, nợ đã biết):** `src/lib/clock.ts:28` vẫn đọc `process.env.DDC_FAKE_TODAY`
ở **mọi** môi trường kể cả production, không log, không cảnh báo. Ai chạm được biến môi trường
production vẫn ghim được đồng hồ toàn hệ thống một cách im lặng. Mức thấp vì cần quyền deploy/env.
**Cách vá:** như vòng trước — chỉ đọc override khi `process.env.NODE_ENV !== 'production'`, kèm
một `console.warn` khi override có hiệu lực để môi trường bị ghim luôn để lại dấu vết.

---

## A-5 — ĐẠT. Không phá ràng buộc nào.

`src/server/repo/prisma-repo.ts:976-983`:

    await prisma.$transaction([
      prisma.project.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.sapQueue.deleteMany(),
    ]);

Đã kiểm 3 điểm có thể vỡ:
1. **Thứ tự FK.** `$transaction([...])` của Prisma chạy tuần tự đúng thứ tự mảng.
   `project.deleteMany()` chạy trước → FK `sap_queue_projectId_fkey` là `ON DELETE SET NULL`
   (`migration.sql:299`) nên các dòng `sap_queue` chỉ bị set `projectId = NULL`, không bị chặn;
   sau đó `sapQueue.deleteMany()` dọn nốt. Không có deadlock/vi phạm ràng buộc.
2. **Có bảng nào trỏ vào `sap_queue` không?** Grep toàn bộ migration: `sap_queue` chỉ xuất hiện
   ở `:64-66` (đổi kiểu `status`) và `:299` (FK đi RA `dim_project`). **Không FK nào trỏ VÀO
   `sap_queue`** → xoá nó không làm mồ côi bảng khác.
3. **Khớp mock-repo.** `mock-repo.ts:573` đã có `d.sapQueue = []`. Hai repo giờ đồng hành vi —
   trước đó là lệch, tức test dùng mock sẽ không bắt được lỗi trên đường prisma.

**Phần THẤP-1 còn hở (nợ đã biết, coder khai báo ngoài phạm vi):** `removeProject`
(`prisma-repo.ts:961-971`) **vẫn không** dọn `sap_queue`. Xoá một dự án đơn lẻ vẫn để lại dòng
SAP queue mồ côi `projectId = NULL` còn nguyên `sapCode` và `projectNameHint` (chính là tên dự án
vừa xoá) — dữ liệu tồn dư sau khi người dùng đã yêu cầu xoá, hiện ra ở màn `/import`.
**Cách vá:** thêm `await prisma.sapQueue.deleteMany({ where: { projectId: id } });` ngay TRƯỚC
`prisma.project.delete({ where: { id } })` trong `removeProject`.

---

## Bảng trạng thái so với vòng trước

| Mã | Vòng trước | Sau CAN SUA #1 | Ghi chú |
|---|---|---|---|
| CAO-1 (migration FK `dim_stage` rỗng + lệnh xoá mù) | LỖ HỔNG | **ĐÓNG (source)** | SQL đúng; chưa có bằng chứng thi hành — xem A-1-a |
| TRUNG-1 (`?month=` → RangeError 500) | LỖ HỔNG | **CÒN HỞ** | `?month=9999-12` vẫn 500 (A-3 / TRUNG-1-a) |
| TRUNG-1 nhánh `validation.ts` | LỖ HỔNG | CÒN HỞ | ngoài phạm vi, nợ (TRUNG-1-c) |
| TRUNG-2 (`.env.example` ghim đồng hồ) | LỖ HỔNG | **ĐÓNG một nửa** | footgun copy-paste đã hết; `clock.ts` chưa chặn prod |
| THẤP-1 (`sap_queue` mồ côi) | LỖ HỔNG | **ĐÓNG ở `resetAllData`** | `removeProject` vẫn hở |
| THẤP-2 (race `saveMonthlyFact` → 500) | nợ | không đụng | đúng phạm vi |
| THẤP-3 (cascade dim dùng chung) | nợ | không đụng | đúng phạm vi |
| BOLA `/projects/[id]` | nợ | không đụng | vẫn là rủi ro lớn nhất trước go-live |
| **A-1-a checksum migration** | — | **MỚI (TRUNG)** | phát sinh từ chính cách vá A-1 |
| **A-2 `?month=abc` trên /overview** | — | MỚI phát hiện (THẤP) | cùng gốc với A-2, khác đường vào |

---

## Kết luận vòng rà soát lại

Lỗ hổng CAO duy nhất của Run 1 (**CAO-1**) đã được đóng đúng cách ở mức mã nguồn: INSERT
`dim_stage` đủ 7 dòng đúng schema, đặt đúng vị trí, và 2 lệnh dọn đã có `WHERE` chính xác — không
xoá tràn lan, không bỏ sót, không dính bẫy `NULL NOT IN` hay `NOT IN (tập rỗng)`.

Bốn bản vá còn lại **không tạo ra lỗ hổng bảo mật mới**: không lộ secret, không thêm injection,
không mở quyền, không bypass guard nào, không phá ràng buộc FK nào.

Ba việc phải làm trước khi coi Run 1 là xong:
1. **A-1-a** — dựng DB sạch (hoặc `migrate resolve`) để migration chạy lại được và chứng minh
   A-1 thực sự hoạt động. Hiện checksum đã lệch, chưa ai chạy thử bản SQL mới.
2. **TRUNG-1-a** — `?month=9999-12` vẫn 500. Vá ở `resourceWindow`/`endOfMonth`, thêm test biên.
3. **A-2 nhánh overview** — thêm `isValidYearMonth` cho `overview/page.tsx:51` (hoặc ngay trong
   `getPortfolioKpis`) để delta không còn bịa với `?month=abc`.
