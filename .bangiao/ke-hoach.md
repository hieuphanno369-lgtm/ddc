# P3C-A: form Tạo/Sửa đều ô (T3) + DB và form kế hoạch thiết bị theo đợt (T4) + kế hoạch nhân lực tháng (T5)

> Planner dùng skill `ddc-tower:writing-plans`.
> Coder làm tuần tự Task 0 → Task 10, mỗi Task 1 commit (riêng Task 6 + 7 chung 1 commit), test đỏ trước rồi mới code.
> Mỗi commit phải để `npx tsc --noEmit` và `npm test` xanh.
> **Task 11 (Bước 11) đang CHỜ, coder KHÔNG làm trong lượt này.**

**Mục tiêu:** làm đúng hợp đồng dữ liệu P3C phần A (bảng, cột, kiểu, 4 hàm đọc) để B vẽ chart, kèm form nhập cho người dùng.

**Kiến trúc:** 1 migration cho cả T4 + T5; logic thuần ở `src/lib/` (có unit test); hàm repo đặt ở `prisma-repo-form.ts` / `mock-repo-form.ts` (tự gộp vào `repo` qua spread có sẵn, KHÔNG sửa `prisma-repo.ts`, `mock-repo.ts`); action ở `src/server/actions-entry.ts`; form ở `src/components/form/`, gắn vào bước "Nhân lực & Thiết bị" của `/nhap-lieu`.

**Tech:** Next.js 14 app router, Prisma 6, PostgreSQL localhost:5433 DB `ddc_control_tower`, next-intl vi/en, Vitest, zod.

**Nguồn yêu cầu:**
- `D:\_project\DDC_dieu-phoi\hop-dong-du-lieu-P3C.md` (hợp đồng A-B, bảng quyết định T3/T4/T5).
- `D:\_project\DDC_dieu-phoi\lenh-cho-A-2026-09-26.md` Phần 3.
- `D:\_project\DDC_dieu-phoi\lenh-cho-A-2026-09-27.md` Phần 2 (Bước 11).
- `.bangiao/archive/p3a-form-tao-sua-2026-09-26/danh-gia.md` mục "Vòng 2" > "Để sau" (điểm tồn `handleSaveNew`).

---

## CÂU HỎI CÒN BỎ NGỎ (điều phối hỏi chủ dự án trước khi coder tới Task 3; Task 0, 1, 2 không phụ thuộc)

**Q1 (nghiệp vụ). Mỗi đợt thiết bị có giữ "Hạng mục" và "Ghi chú" như form P3A không?**
Hợp đồng chỉ ghi 3 trường cho mỗi đợt: từ ngày, đến ngày, SL dùng; chart mới cũng bỏ legend hạng mục.
Form mới lưu theo kiểu "thay toàn bộ kế hoạch của dự án", nên dòng cũ có hạng mục/ghi chú sẽ mất 2 thông tin này khi người dùng bấm lưu lại (số chiếc No.1, No.2 của dòng cũ cũng mất, việc này là hệ quả của hợp đồng).
- (a) **Đề xuất:** bỏ cả Hạng mục và Ghi chú khỏi form; cột DB `workItemId`, `note` giữ nguyên, đợt mới lưu `workItemId = null`, `note = ''`. Đúng hợp đồng, form gọn.
- (b) Giữ ô Ghi chú (tuỳ chọn, tối đa 200 ký tự), bỏ Hạng mục.
- (c) Giữ cả hai như P3A.

Kế hoạch dưới đây viết theo (a).
Nếu chủ dự án chọn (b) hoặc (c): planner sửa Task 3, Task 6, Task 7 trước khi coder làm các Task đó (thêm trường vào `EquipmentSegmentInput`, zod, audit text, cột bảng).

**Không còn câu hỏi nghiệp vụ nào khác.**
Các lựa chọn kỹ thuật đã tự quyết ghi ở mục "Quyết định kỹ thuật" ngay dưới.

---

## Quyết định kỹ thuật (planner tự chọn, có lý do)

| # | Quyết định | Lý do |
|---|---|---|
| K1 | **Chỗ đặt 2 form: trang `/nhap-lieu`, bước "Nhân lực & Thiết bị" (`resourcesPanel`)**, form thiết bị THAY `EquipmentPlanEditor` cũ tại chỗ, form nhân lực đặt ngay dưới. | Người dùng P3A đã quen tìm kế hoạch thiết bị ở đây; trang đã nạp sẵn thiết bị, ca, quyền PIC; `ProjectForm` đã 6 mục và có chế độ Tạo mới (chưa có `projectId`). Ghi vào mục "Thay đổi hợp đồng" (Task 10). |
| K2 | Giữ tên file/hàm P3A (`EquipmentPlanEditor.tsx`, `src/lib/equipment-plan.ts`, `saveEquipmentPlansAction`, `replaceEquipmentPlans`), đổi nội dung và chữ ký. Xoá kiểu `EquipmentPlanInput`. | Ít xáo trộn import, `messages.test.ts` đã có sẵn `EquipmentPlanEditor` trong `CHANGED_SOURCES`. |
| K3 | 1 migration duy nhất `20260926100000_p3c_a_plan_tables` cho T4 + T5, có file rollback. | Cùng 1 lần giữ khoá schema, 1 vòng deploy/rollback/deploy. |
| K4 | Lưu kế hoạch thiết bị = thay toàn bộ quota + đợt của dự án trong 1 transaction (như P3A). Lưu kế hoạch nhân lực = chỉ ghi lại các tháng có đổi. | Thiết bị: đợt không có khoá tự nhiên. Nhân lực: có khoá (tháng, ca), ghi theo tháng đổi giữ đúng `updatedBy` và audit từng tháng như nhập liệu hằng ngày. |
| K5 | Giới hạn: `EQUIP_QTY_MAX = 999` (Tổng SL và SL đợt), `EQUIP_GROUP_MAX = 100` loại/dự án, `EQUIP_PLAN_MAX_ROWS = 300` đợt/dự án (giữ số P3A); `MANPOWER_PLAN_MAX_MONTHS = 60`, `MANPOWER_PLAN_MAX_CELL = 99999`. | Chặn payload lớn; 999 đủ cho nhóm đếm theo bộ (máy hàn, giàn giáo). |
| K6 | Ca dùng cho KH nhân lực = `dim_shift` có `isActive = true`, xếp `sortOrder`. Không có dòng tỷ lệ → ca thứ 1 = 0.6, ca thứ 2 = 0.4, ca thứ 3 trở đi = 0; chỉ 1 ca → 1. | Hợp đồng chỉ định 2 ca đầu; ca thêm sau này mặc định 0 để tổng vẫn = 1. |
| K7 | Tỷ lệ nhập dạng % (tối đa 1 số lẻ), tổng phải = 100 (±0.1); lưu `pct = %/100`, server kiểm tổng = 1 (±0.001). | Người dùng quen nhập %; hợp đồng lưu 0..1. |
| K8 | Tổng tháng nhỏ hơn tổng các ô đã sửa tay → báo lỗi dòng, chặn lưu (KHÔNG xoá cờ sửa tay). Mọi ô ca của tháng đều sửa tay → ô Tổng khoá, gợi ý bấm "Tính lại theo tỷ lệ". | Hợp đồng: ô sửa tay không bị ghi đè khi đổi tổng/tỷ lệ. |
| K9 | Quá độ đến Bước 11: Gantt cũ (`src/lib/equipment-gantt.ts`) coi `unitNo = null` là "không đánh số" (key 0, nhãn = tên thiết bị). | Trang Chi tiết vẫn chạy Gantt cũ cho tới Bước 11; không để vỡ khi có đợt mới. |
| K10 | T3 áp luôn cho mục 3 "Mốc thời gian" (dấu `?` cùng dòng nhãn, ô cùng chiều cao). | Cùng một lỗi markup; để mục 3 lệch là không nhất quán (luật chung: thấy lệch thì sửa). |
| K11 | Lỗi ném ngoài dự kiến khi lưu (`handleSaveNew`, `handleSaveEdit`) → thông báo cố định, không in `e.message`. | Server action production che lỗi; không lộ chi tiết nội bộ. |

---

## Ràng buộc chung (mọi Task ngầm tuân)

- Viết tiếng Việt; KHÔNG dùng dấu gạch dài (em dash, en dash) ở code, comment, i18n, commit, tài liệu.
- Commit: `feat(p3c-a): ...`, `fix(p3c-a): ...`, `test(p3c-a): ...`, `docs(p3c-a): ...`, mô tả tiếng Việt KHÔNG dấu, giữ dòng `Co-Authored-By` của agent. Không push.
- Tên test: tiếng Việt không dấu (vd `'tong 450 ty le 60/40 -> 270/180'`). Chú thích code: tiếng Việt.
- File SQL, file rollback: comment KHÔNG dấu (khuôn `prisma/rollback/20260925110000_p3a_unique_code_pic.down.sql`).
- Chạy lệnh qua PowerShell, ổ `D:` viết hoa: `npx tsc --noEmit`, `npm test`, `npm run check:read`, `npx prisma migrate status`.
- **File nóng** (CLAUDE.md mục 3): trước khi sửa phải đọc `D:\_project\DDC_dieu-phoi\phien-B.md`; B đang giữ file nào thì KHÔNG sửa, ghi chú và làm Task khác. Ghi vào mục "Đang giữ" của `phien-A.md` trước khi sửa, bỏ ra sau commit:
  - `prisma/schema.prisma` + `prisma/migrations/` (A đang giữ sẵn cho P3C-A, giữ tới khi merge).
  - `app/globals.css` (Task 1).
  - `src/i18n/messages/vi.json`, `en.json` (Task 1, 7, 9).
  - KHÔNG sửa: `prisma-repo.ts`, `mock-repo.ts`, `actions.ts`, `queries.ts`, `project-queries.ts`, `PROGRESS.md`, `.serena/memories/`.
- Sau MỖI commit: cập nhật `D:\_project\DDC_dieu-phoi\phien-A.md` (task, commit cuối, bước kế, file đang giữ, giờ).
- Key i18n: nhóm mới đặt CUỐI file vi.json và en.json; key thêm vào nhóm có sẵn thì nối CUỐI nhóm đó, không chèn giữa. vi và en phải đủ cặp (`src/i18n/messages.test.ts`).
- Mọi `logActivity(user, '<action>', ...)` mới cần key `activity.<action>` ở vi + en (test `messages.test.ts` quét `src/server/`).
- Tên ca luôn đọc từ `dim_shift` (`nameVi`/`nameEn` theo locale). Mã ca hiện tại là `morning` và `evening` (P2A đã đổi `afternoon` → `evening` = ca tối); không ghi cứng mã hay tên ca trong code UI/logic.
- "Hôm nay" chỉ lấy từ `src/lib/clock.ts` (`todayIso()`), truyền xuống component qua prop.
- Quyền ghi: `requireWriteProject(projectId)` (`src/server/action-guards.ts`), giống `saveEquipmentPlansAction` hiện tại. Không kiểm khoá tháng, không chạy alert engine.
- Mốc test đầu phase (main `bb5d95d`): 177 file / 1958 test. Cuối phase không được tụt số file/test trừ test bị xoá có chủ đích (ghi rõ ở `thay-doi.md`).

## Quy ước copy từ file có sẵn

| Việc | Copy khuôn từ |
|---|---|
| Migration SQL (BEGIN/COMMIT, DO $$ kiểm dữ liệu, comment không dấu) | `prisma/migrations/20260925110000_p3a_unique_code_pic/migration.sql`, `prisma/migrations/20260924150000_p2a_entry_foundation/migration.sql` |
| File rollback | `prisma/rollback/20260925110000_p3a_unique_code_pic.down.sql` |
| Hàm repo Prisma + audit trong `$transaction` | `src/server/repo/prisma-repo-form.ts` (`replaceStageWeights`, `replaceEquipmentPlans`), `audit()` ở `prisma-repo-entry.ts` |
| Hàm repo mock | `src/server/repo/mock-repo-form.ts` (`replaceEquipmentPlans`), `audit` từ `mock-repo-entry.ts` |
| Test repo Prisma (mock `prisma`) | `src/server/repo/prisma-repo-form.test.ts` khối `replaceEquipmentPlans` |
| Test action (mock session + mock repo) | `src/server/actions-equipment-plan.test.ts` |
| zod schema | `src/server/validation.ts` (`saveEquipmentPlansSchema`, hằng `yearMonth`, `isoDate`) |
| Component bảng nhập + test render tĩnh | `src/components/form/EquipmentPlanEditor.tsx` + `.test.ts` (`renderToStaticMarkup`, mock `next-intl`) |
| State thuần của form tách khỏi component | `src/components/form/resourceEntryState.ts` + `.test.ts` |
| Mô tả bảng/cột cho ERD | `src/lib/schema-meta/docs.ts` (`TABLE_DOCS`, `ERD_LAYOUT`) |
| Kiểm đối chiếu đọc Prisma vs mock | `scripts/check-read-parity.ts` |

---

## Bản đồ file

| File | Task | Việc |
|---|---|---|
| `src/components/form/ProjectForm.tsx` | 1 | T3 markup + bắt lỗi lưu + tô đỏ ô Mã CT |
| `src/components/form/ProjectForm.test.ts` (mới) | 1 | test markup T3 |
| `src/lib/project-form.ts`, `src/lib/project-form.test.ts` | 1 | `code_reserved` lúc tạo, `createErrorField` |
| `app/globals.css` (NÓNG) | 1 | lớp `.feven` |
| `vi.json`, `en.json` (NÓNG) | 1, 7, 9 | `projectForm.err.unexpected`; nhóm `equipmentPlan` viết lại; `activity.save_manpower_plan`; `projectForm.audit.tbl.*`; nhóm mới `manpowerPlan` |
| `prisma/schema.prisma` (NÓNG) | 2 | 3 model mới, sửa `ProjectEquipmentPlan` |
| `prisma/migrations/20260926100000_p3c_a_plan_tables/migration.sql` (mới) | 2 | migration |
| `prisma/rollback/20260926100000_p3c_a_plan_tables.down.sql` (mới) | 2 | rollback |
| `src/server/repo/types.ts` | 2 | kiểu mới + 4 kiểu hợp đồng |
| `src/lib/schema-meta/docs.ts` + file ERD sinh bởi `npm run docs:erd` | 2 | mô tả bảng/cột mới |
| `src/server/repo/read-prisma.ts`, `read-mock.ts` (+ 2 test) | 2 | `readEquipmentPlans` trả `qty`, `unitNo` null |
| `src/lib/equipment-gantt.ts` | 2 | quá độ `unitNo` null (K9) |
| `src/lib/equipment-plan.ts` + `.test.ts` | 3 | viết lại: nhóm theo loại, kiểm chồng ngày |
| `src/lib/manpower-plan.ts` + `.test.ts` (mới) | 4 | chia ca, tỷ lệ, kiểm hợp lệ |
| `src/server/repo/prisma-repo-form.ts`, `mock-repo-form.ts` (+ test) | 5, 6, 8 | 4 hàm đọc + 2 hàm ghi |
| `src/data/seed/erp.ts`, `src/data/seed/history.ts`, `prisma/seed.ts`, `src/data/seed/history.test.ts` | 5 | seed T4 + T5 |
| test Gantt cũ: `src/lib/equipment-gantt.test.ts`, `src/components/project/EquipmentGantt.test.ts`, `src/server/equipment-gantt-queries.test.ts` | 5 | dùng fixture cũ / cập nhật số hàng |
| `scripts/check-read-parity.ts` | 5 | đối chiếu 4 hàm đọc mới |
| `src/server/validation.ts` | 6, 8 | 2 schema |
| `src/server/actions-entry.ts` | 6, 8 | 2 action |
| `src/server/actions-equipment-plan.test.ts`, `.qa.test.ts` | 6 | viết lại |
| `src/server/actions-manpower-plan.test.ts` (mới) | 8 | test action |
| `src/components/form/EquipmentPlanEditor.tsx` + `.test.ts` | 7 | viết lại form |
| `src/components/form/manpowerPlanState.ts` + `.test.ts` (mới) | 9 | state thuần form nhân lực |
| `src/components/form/ManpowerPlanEditor.tsx` + `.test.ts` (mới) | 9 | form nhân lực |
| `app/[locale]/(app)/nhap-lieu/page.tsx` | 7, 9 | nạp dữ liệu, gắn 2 form |
| `app/[locale]/(app)/ho-so-du-an/page.tsx` | 8 | nhãn bảng audit mới |
| `src/i18n/messages.test.ts` | 9 | thêm `ManpowerPlanEditor` vào `CHANGED_SOURCES` |
| `.bangiao/thay-doi.md`, `D:\_project\DDC_dieu-phoi\hop-dong-du-lieu-P3C.md` (mục "Thay đổi hợp đồng") | 10 | tổng kết |

---

### Task 0: Chuẩn bị

- [ ] `git status` sạch, nhánh `feature/p3c-a-form-ke-hoach`. Chạy `npx tsc --noEmit` + `npm test`, ghi mốc (số file/test) vào đầu `.bangiao/thay-doi.md` mục "Mốc đầu phase" (tạo file).
- [ ] Đọc `phien-B.md`: B không giữ `globals.css`, `vi.json`, `en.json` thì ghi `app/globals.css`, `vi.json`, `en.json` vào "Đang giữ" của `phien-A.md` khi tới Task 1.
- [ ] **Chụp ảnh TRƯỚC khi sửa** `/vi/ho-so-du-an?mode=new` và `/vi/ho-so-du-an?project=1` (đăng nhập `admin@daidung.com.vn` / `Admin@123`, dev cổng 3000) ở 1440px và 390px, phần mục 1, 2, 3; lưu `.bangiao/anh-test/t3-truoc-{1440,390}-{moi,sua}.png`.
- Không commit riêng (gộp vào commit Task 1).

---

### Task 1: T3 form Tạo/Sửa đều ô + điểm tồn P3A

**Files:** Modify `src/components/form/ProjectForm.tsx`, `src/lib/project-form.ts`, `src/lib/project-form.test.ts`, `app/globals.css`, `vi.json`, `en.json`. Create `src/components/form/ProjectForm.test.ts`.

**Gốc lỗi:** trong `.field` (flex dọc), `<HelpTip>` đang là anh em của `<span className="lb">` nên chiếm 1 dòng riêng, đẩy ô xuống (Mã CT hiện hành, Khách hàng, Loại hình, Giá trị HĐ, Khối lượng, Độ ưu tiên, và mục 3). Component `Field` (dòng 68-76) cũng đặt `HelpTip` ngoài `.lb`.

**Produces:**
```ts
// src/lib/project-form.ts
export type ProjectFieldError = 'required' | 'positive' | 'too_long' | 'code_invalid' | 'date_order' | 'fx' | 'code_reserved';
/** Map mã lỗi server của createProjectAction về ô cần tô đỏ; null = lỗi chung không gắn ô. */
export function createErrorField(error: string): { field: 'currentAliasCode'; code: 'code_taken' | 'code_reserved' } | null;
```

**Việc làm:**
1. `validateProjectForm`: thêm, ngay sau dòng kiểm `code_invalid` (dòng 215): `mode === 'new'`, mã không rỗng, hợp lệ, và `isReservedProjectCode(f.currentAliasCode, null)` (`src/lib/project-code.ts`) → `errors.currentAliasCode = 'code_reserved'`. Chế độ `edit` không đổi (đã có `validateAliasChange` + server).
2. `createErrorField`: `'code_taken'` | `'code_reserved'` → `{ field: 'currentAliasCode', code }`; khác → `null`.
3. `ProjectForm.tsx`:
   - `Field`: đưa `HelpTip` vào trong `<span className="lb">{label}{hint && <HelpTip .../>}</span>`; thêm prop `alignRight?: boolean` truyền cho `HelpTip`.
   - Mọi chỗ `<span className="lb">...</span><HelpTip .../>` trong mục 1, 2, 3 → `<span className="lb">...<HelpTip .../></span>` (giữ nguyên `alignRight` đang có).
   - 5 thẻ `<div className="f4">` của mục 1, 2, 3 → `<div className="f4 feven">`.
   - Ô "Giá trị nguyên tệ": giữ `<div className="inline">` gồm `select` + `input`; bỏ `style={{ width: 96 }}` của select (CSS `.feven` lo bề rộng). Input giữ nguyên mọi thuộc tính hiện có (không đổi hành vi nhập), chỉ đổi bố cục.
   - State mới `const [serverErr, setServerErr] = useState<{ currentAliasCode?: 'code_taken' | 'code_reserved' }>({});`. Trong `set()`: nếu `key === 'currentAliasCode'` thì `setServerErr({})`.
   - Ô Mã CT: `const aliasErr = errors.currentAliasCode ?? serverErr.currentAliasCode;` dùng cho class `bad` và dòng lỗi `t(\`projectForm.err.${aliasErr}\`)`.
   - `handleSaveNew`: nhánh `!res.ok` → `const f = createErrorField(res.error)`; có `f` → `setServerErr({ [f.field]: f.code })`, `setMsg({ tone: 'bad', text: t(\`projectForm.err.${f.code}\`) })`, cuộn tới `[data-field="currentAliasCode"]` (như `scrollToFirstError`); không có → giữ thông báo như cũ. Thêm `catch { setMsg({ tone: 'bad', text: t('projectForm.err.unexpected') }); }` trước `finally`.
   - `handleSaveEdit`: thêm cùng `catch` như trên (K11).
4. `app/globals.css`: chèn ngay sau dòng `.inline{display:flex;align-items:center;gap:9px}` (dòng 390):
```css
  /* P3C-A T3: form ho so - nhan 1 dong co dinh (dau ? cung dong), o cung chieu cao,
     dong goi y/loi nam duoi o khong day o ben canh. */
  .feven{align-items:start}
  .feven>.field>.lb{min-height:18px}
  .feven>.field>.inp,.feven>.field>.relative>.inp,.feven>.field>.inline>.inp,.feven>.field>.inline{height:38px}
  .feven>.field>.inline>select.inp{flex:0 0 88px;width:88px}
  .feven>.field>.inline>input.inp{flex:1 1 auto;min-width:0}
```
   (Combobox render `<div class="relative"><input class="inp">`, nên có selector `.relative>.inp`.)
5. i18n: nối cuối nhóm `projectForm.err` (sau `"generic"`): vi `"unexpected": "Lưu thất bại do lỗi hệ thống hoặc mất kết nối. Thử lại, nếu vẫn lỗi hãy báo quản trị."`, en `"unexpected": "Save failed due to a system or connection error. Try again, and contact an administrator if it persists."`.

**Test (viết trước, thấy đỏ):**
- `project-form.test.ts`: `validateProjectForm` mode `new`, mã `'M-00001'` → `errors.currentAliasCode === 'code_reserved'`; mode `new`, mã `'m-12'` → `code_reserved`; mode `new`, mã `'CT-01'` → không lỗi mã; mode `edit` với base mã `'M-00001'` giữ nguyên → không lỗi mã. `createErrorField('code_taken')`, `('code_reserved')` → đúng object; `('invalid_team')` → `null`.
- `ProjectForm.test.ts` (mock `next-intl`: `useTranslations` trả hàm có `t.has = () => true`, `useLocale: () => 'vi'`; mock `next/navigation` `useRouter: () => ({ push() {}, replace() {}, refresh() {} })`; mock `@/server/actions` và `@/server/actions-project` bằng `vi.fn()`; props tối thiểu mode `'new'`, mảng rỗng, `today: '2026-09-16'`, `ownerEmail: 'a@x'`, `currencies: [{ code: 'VND', name: 'VND' }, { code: 'USD', name: 'USD' }]`):
  - markup KHÔNG khớp `/<\/span><button type="button" class="help/` (không còn `?` nằm ngoài nhãn);
  - số lần xuất hiện `class="f4 feven"` = 5;
  - khối `data-field="contractValueOriginal"` chứa `<div class="inline"><select` và `<input`.

**Kiểm trình duyệt (bắt buộc):** `/vi/ho-so-du-an?mode=new` và `?project=1` ở 1440px và 390px, dùng `getBoundingClientRect()` xác nhận: trong cùng 1 hàng lưới, `top` của mọi ô nhập bằng nhau (±1px) và `height` = 38; nút `?` cùng `top` với chữ nhãn; hàng có dòng gợi ý/lỗi không làm ô bên cạnh lệch; nguyên tệ: select + ô số cùng 1 dòng. Gõ mã `M-1` ở chế độ Tạo → ô Mã CT tô đỏ + dòng lỗi `code_reserved`. Ảnh sau: `.bangiao/anh-test/t3-sau-{1440,390}-{moi,sua}.png`.

- [ ] Test đỏ → code → xanh → `tsc` + `npm test` → commit `feat(p3c-a): T3 form ho so deu o, dau ? cung dong nhan, bat loi luu va to do o Ma CT` → nhả `globals.css`, `vi.json`, `en.json` trong `phien-A.md`.

---

### Task 2: Migration + schema + kiểu + mô tả ERD

**Files:** Modify `prisma/schema.prisma`, `src/server/repo/types.ts`, `src/lib/schema-meta/docs.ts`, `src/server/repo/read-prisma.ts`, `src/server/repo/read-mock.ts`, `src/server/repo/read-prisma.test.ts`, `src/server/repo/read-mock.test.ts`, `src/lib/equipment-gantt.ts`. Create migration + rollback. Chạy `npm run docs:erd` (commit file nó sinh).

**schema.prisma:**
```prisma
// ProjectEquipmentPlan: sửa
  unitNo        Int?     // P3A: số chiếc; P3C-A: null với đợt nhập theo SL
  qty           Int      @default(1) // SL dùng trong đợt (>= 1)
// (giữ @@index([projectId, equipmentId, unitNo]), @@index([projectId, plannedStart]))
// sửa chú thích model: "Kế hoạch dùng thiết bị theo đợt (P3C-A): 1 dòng = 1 đợt, qty = SL dùng. Dòng cũ P3A theo từng chiếc có unitNo, qty = 1."

/** Tổng SL mỗi loại thiết bị của dự án (P3C-A, T4). */
model ProjectEquipmentQuota {
  projectId   Int
  equipmentId Int
  totalQty    Int
  updatedAt   DateTime @default(now()) @updatedAt
  updatedBy   String   @default("system")

  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  equipment Equipment @relation(fields: [equipmentId], references: [id], onDelete: Restrict)

  @@id([projectId, equipmentId])
  @@map("project_equipment_quota")
}

/** KH nhân lực theo tháng × ca (P3C-A, T5). Tổng tháng = cộng các ca, KHÔNG lưu riêng. */
model ProjectManpowerPlanMonth {
  projectId Int
  yearMonth String
  shiftCode String
  planned   Int
  isManual  Boolean  @default(false)
  updatedAt DateTime @default(now()) @updatedAt
  updatedBy String   @default("system")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shift   Shift   @relation(fields: [shiftCode], references: [code], onDelete: Restrict)

  @@id([projectId, yearMonth, shiftCode])
  @@map("project_manpower_plan_month")
}

/** Tỷ lệ chia ca theo dự án (P3C-A, T5). Không có dòng = mặc định DEFAULT_SHIFT_RATIO. */
model ProjectShiftRatio {
  projectId Int
  shiftCode String
  pct       Float

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shift   Shift   @relation(fields: [shiftCode], references: [code], onDelete: Restrict)

  @@id([projectId, shiftCode])
  @@map("project_shift_ratio")
}
```
Thêm quan hệ ngược: `Project` → `equipmentQuotas ProjectEquipmentQuota[]`, `manpowerPlanMonths ProjectManpowerPlanMonth[]`, `shiftRatios ProjectShiftRatio[]`; `Equipment` → `quotas ProjectEquipmentQuota[]`; `Shift` → `manpowerPlans ProjectManpowerPlanMonth[]`, `shiftRatios ProjectShiftRatio[]`.

**migration.sql** (sinh khung bằng `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <url shadow> --script`, rồi sắp tay theo thứ tự dưới, bọc `BEGIN; ... COMMIT;`):
1. `project_equipment_plan`: `ADD COLUMN "qty" INTEGER NOT NULL DEFAULT 1`; `ADD CONSTRAINT "project_equipment_plan_qty_check" CHECK ("qty" >= 1)`; `ALTER COLUMN "unitNo" DROP NOT NULL` (CHECK `unitNo >= 1` cũ giữ, NULL vẫn qua).
2. `CREATE TABLE "project_equipment_quota"` đúng model + PK + `CHECK ("totalQty" >= 1)` + FK `projectId` → `dim_project` ON DELETE CASCADE ON UPDATE CASCADE, `equipmentId` → `dim_equipment` ON DELETE RESTRICT ON UPDATE CASCADE.
3. Chuyển dữ liệu cũ:
```sql
INSERT INTO "project_equipment_quota" ("projectId", "equipmentId", "totalQty", "updatedAt", "updatedBy")
SELECT "projectId", "equipmentId", GREATEST(COUNT(DISTINCT "unitNo"), 1)::int, CURRENT_TIMESTAMP, 'migration'
FROM "project_equipment_plan" GROUP BY "projectId", "equipmentId";
```
4. `CREATE TABLE "project_manpower_plan_month"` + PK + `CHECK ("planned" >= 0)` + `CHECK ("yearMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')` + FK `projectId` CASCADE, `shiftCode` → `dim_shift("code")` ON DELETE RESTRICT ON UPDATE CASCADE.
5. `CREATE TABLE "project_shift_ratio"` (`"pct" DOUBLE PRECISION NOT NULL`) + PK + `CHECK ("pct" >= 0 AND "pct" <= 1)` + 2 FK như bước 4.

**rollback** `prisma/rollback/20260926100000_p3c_a_plan_tables.down.sql` (dòng đầu: `-- Revert code truoc, roi moi chay file nay.`, dòng chạy `npx prisma db execute --file ... --schema prisma/schema.prisma`):
```sql
BEGIN;
DROP TABLE IF EXISTS "project_shift_ratio";
DROP TABLE IF EXISTS "project_manpower_plan_month";
DROP TABLE IF EXISTS "project_equipment_quota";
-- Dot khong danh so (unitNo NULL, qty = n) -> tach thanh n dong chiec 1..n de cot unitNo ve NOT NULL.
INSERT INTO "project_equipment_plan" ("projectId","equipmentId","unitNo","workItemId","plannedStart","plannedFinish","note","updatedAt","updatedBy","qty")
SELECT p."projectId", p."equipmentId", g.k, p."workItemId", p."plannedStart", p."plannedFinish", p."note", p."updatedAt", p."updatedBy", 1
FROM "project_equipment_plan" p CROSS JOIN LATERAL generate_series(2, p."qty") AS g(k)
WHERE p."unitNo" IS NULL AND p."qty" >= 2;
UPDATE "project_equipment_plan" SET "unitNo" = 1 WHERE "unitNo" IS NULL;
ALTER TABLE "project_equipment_plan" ALTER COLUMN "unitNo" SET NOT NULL;
ALTER TABLE "project_equipment_plan" DROP CONSTRAINT IF EXISTS "project_equipment_plan_qty_check";
ALTER TABLE "project_equipment_plan" DROP COLUMN "qty";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260926100000_p3c_a_plan_tables';
COMMIT;
```

**types.ts** (sửa + thêm, đặt khối hợp đồng ngay sau `EquipmentPlanInput` cũ rồi xoá `EquipmentPlanInput`):
```ts
export interface ProjectEquipmentPlan {
  id: number; projectId: number; equipmentId: number;
  unitNo: number | null; // P3A: số chiếc; P3C-A: null với đợt nhập theo SL
  qty: number;           // SL dùng trong đợt (>= 1), dòng cũ = 1
  workItemId: number | null; plannedStart: string; plannedFinish: string; note: string; updatedAt: string; updatedBy: string;
}
/** Dòng DB project_equipment_quota. */
export interface ProjectEquipmentQuota { projectId: number; equipmentId: number; totalQty: number; updatedAt: string; updatedBy: string }
/** Dòng DB project_manpower_plan_month. */
export interface ProjectManpowerPlanMonth { projectId: number; yearMonth: string; shiftCode: string; planned: number; isManual: boolean; updatedAt: string; updatedBy: string }
/** Dòng DB project_shift_ratio. */
export interface ProjectShiftRatio { projectId: number; shiftCode: string; pct: number }

// ---- Hợp đồng dữ liệu P3C (A cung cấp, B chỉ import) - chép nguyên văn hop-dong-du-lieu-P3C.md ----
export interface EquipmentPlanSegment {
  id: number; equipmentId: number; equipmentName: string; // tên từ dim_equipment
  from: string; to: string;   // 'YYYY-MM-DD'
  qty: number;                // SL dùng trong đợt
}
export interface EquipmentQuota { equipmentId: number; equipmentName: string; totalQty: number }
export interface ManpowerPlanMonthRow { yearMonth: string; shiftCode: string; planned: number; isManual: boolean }
export interface ShiftRatio { shiftCode: string; pct: number }

/** P3C-A (T4): 1 đợt gửi lên khi lưu. */
export interface EquipmentSegmentInput { from: string; to: string; qty: number }
/** P3C-A (T4): 1 loại thiết bị gửi lên khi lưu - lưu = thay toàn bộ quota + đợt của dự án. */
export interface EquipmentPlanGroupInput { equipmentId: number; totalQty: number; segments: EquipmentSegmentInput[] }
/** P3C-A (T5): 1 ô ca của 1 tháng gửi lên khi lưu. */
export interface ManpowerPlanCellInput { shiftCode: string; planned: number; isManual: boolean }
export interface ManpowerPlanMonthInput { yearMonth: string; cells: ManpowerPlanCellInput[] }
export interface ManpowerPlanInput { ratios: ShiftRatio[]; months: ManpowerPlanMonthInput[] }
```
**Bắt buộc:** 4 interface hợp đồng KHÔNG có chú thích `/** */` bên trong ngoặc nhọn, chỉ `//` (test `p3c-contract.test.ts` của B so khớp chữ từng trường).
Trong Task này GIỮ NGUYÊN `EquipmentPlanInput` (form P3A còn chạy tới Task 7); chỉ sửa tối thiểu cho `tsc` xanh sau khi `ProjectEquipmentPlan` đổi: `mock-repo-form.ts` `replaceEquipmentPlans` thêm `qty: 1` khi tạo dòng; `prisma-repo-form.ts` khi dựng `beforeText` dùng `unitNo: p.unitNo ?? 0`; `src/lib/equipment-plan.ts` `toEquipmentPlanDraft` dùng `String(p.unitNo ?? '')`. `EquipmentPlanInput` bị xoá ở commit Task 6 + 7.

**read-prisma.ts / read-mock.ts** `readEquipmentPlans`: trả thêm `qty`, `unitNo` có thể null. Mock sort `unitNo` tăng, null cuối (khớp PostgreSQL ASC NULLS LAST):
```ts
const nullLast = (a: number | null, b: number | null) => (a === b ? 0 : a == null ? 1 : b == null ? -1 : a - b);
```
**equipment-gantt.ts** (K9): trong `assignUsage` và `buildGantt` dùng `const unit = p.unitNo ?? 0` thay mọi `p.unitNo`; nhãn: `unit === 0 ? name : (chiecCount > 1 || unit !== 1 ? \`${name} No.${unit}\` : name)`; `GanttRow.unitNo` nhận `unit`.

**docs.ts:** `TABLE_DOCS.project_equipment_plan`: sửa `desc` ("Kế hoạch dùng thiết bị theo đợt: 1 dòng = 1 đợt, qty = SL dùng trong đợt. Dòng cũ P3A theo từng chiếc có unitNo, qty = 1. Ngày thực tế lấy từ fact_daily_equipment_usage."), `unitNo: 'số thứ tự chiếc (dòng cũ P3A); null = đợt nhập theo SL'`, thêm `qty: 'SL thiết bị dùng trong đợt (>= 1)'`. Thêm 3 mục `kind: 'support'`:
- `project_equipment_quota`: desc "Tổng SL mỗi loại thiết bị của dự án - các đợt chồng ngày không được vượt số này."; fields `projectId` 'khoá ghép - FK tới dim_project.id', `equipmentId` 'khoá ghép - FK tới dim_equipment.id', `totalQty` 'tổng số lượng thiết bị của loại này (>= 1)', `updatedAt`, `updatedBy`.
- `project_manpower_plan_month`: desc "Kế hoạch nhân lực theo tháng × ca. Tổng tháng = cộng các ca, không lưu riêng."; fields `projectId`, `yearMonth` "khoá ghép - 'YYYY-MM'", `shiftCode` 'khoá ghép - FK tới dim_shift.code', `planned` 'số người kế hoạch của ca trong tháng (>= 0)', `isManual` 'true = ô sửa tay, không bị tính lại khi đổi tổng/tỷ lệ', `updatedAt`, `updatedBy`.
- `project_shift_ratio`: desc "Tỷ lệ chia ca của dự án. Không có dòng = mặc định ca 1 = 0.6, ca 2 = 0.4."; fields `projectId`, `shiftCode`, `pct` 'tỷ lệ 0..1, tổng các ca = 1'.
`ERD_LAYOUT`: `project_equipment_quota: { col: 2, row: 6 }`, `project_manpower_plan_month: { col: 2, row: 7 }`, `project_shift_ratio: { col: 1, row: 7 }`.

**Chạy DB (trên `ddc_control_tower`, dữ liệu seed hiện tại):**
1. `npx prisma migrate deploy` → kiểm bằng `npx tsx -e` (PrismaClient `$queryRaw`): `project_equipment_quota` dự án 1 = `{equipmentId 1: totalQty 3, equipmentId 2: totalQty 2}`; mọi dòng `project_equipment_plan` có `qty = 1`.
2. Chèn 1 dòng thử `unitNo NULL, qty 3` → chạy rollback → kiểm dòng đó thành 3 dòng `unitNo` 1, 2, 3; 3 bảng mới không còn; `_prisma_migrations` không còn dòng.
3. `npx prisma migrate deploy` lại → `npx prisma migrate status` = up to date → `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` KHÔNG đề xuất gì ngoài 2 index tạo tay của P3A (ghi output vào `thay-doi.md`).
4. `node node_modules/prisma/build/index.js generate` nếu client chưa cập nhật.

**Test:** `docs.test.ts`, `erd-doc.test.ts` xanh sau `npm run docs:erd`; `read-prisma.test.ts` test `readEquipmentPlans` thêm `qty` vào dòng giả và kết quả; `read-mock.test.ts` thêm ca: 2 dòng cùng thiết bị, 1 dòng `unitNo: null` → nằm sau dòng `unitNo: 1`; `equipment-gantt.test.ts` thêm ca: plan `unitNo: null` → 1 hàng key `'<eq>-0'`, nhãn = tên thiết bị.

- [ ] Test đỏ → code → migrate deploy/rollback/deploy → `tsc` + `npm test` → commit `feat(p3c-a): migration project_equipment_quota, project_manpower_plan_month, project_shift_ratio + qty tren project_equipment_plan, co rollback`.

---

### Task 3: Logic thuần kế hoạch thiết bị theo đợt (viết lại `src/lib/equipment-plan.ts`)

**Files:** Modify `src/lib/equipment-plan.ts`, `src/lib/equipment-plan.test.ts` (viết lại toàn bộ).

**Consumes:** `EquipmentPlanGroupInput`, `EquipmentSegmentInput`, `EquipmentQuota`, `EquipmentPlanSegment` (Task 2); `isValidIsoDate`, `addDaysIso` (`src/lib/clock.ts`).

**Produces (THÊM vào file; export cũ `nextUnitNo`, `EQUIP_UNIT_MAX`, `EQUIP_NOTE_MAX`, `EquipmentPlanDraft`, `EquipPlanField`, `EquipPlanErrors`, `validateEquipmentPlans`, `toEquipmentPlanDraft`, `normalizeEquipmentPlans`, `equipPlanAuditText` GIỮ tạm, ghi chú `// P3A cu - xoa o commit Task 6 + 7`, và bị xoá cùng test cũ của chúng ở commit Task 6 + 7):**
```ts
export const EQUIP_PLAN_MAX_ROWS = 300;  // tổng số đợt mỗi dự án
export const EQUIP_QTY_MAX = 999;        // Tổng SL và SL đợt
export const EQUIP_GROUP_MAX = 100;      // số loại thiết bị mỗi dự án

export interface EquipmentSegmentDraft { from: string; to: string; qty: string }
export interface EquipmentGroupDraft { equipmentId: string; totalQty: string; segments: EquipmentSegmentDraft[] }

export type EquipGroupField = 'equipmentId' | 'totalQty';
export type EquipSegField = 'from' | 'to' | 'qty';
export interface EquipOverload { groupIndex: number; equipmentId: number; from: string; to: string; used: number; total: number }
export interface EquipPlanCheck {
  ok: boolean;
  groupErrors: Record<number, EquipGroupField[]>;   // khoá = chỉ số nhóm
  segmentErrors: Record<string, EquipSegField[]>;   // khoá = `${gi}:${si}`
  overloads: EquipOverload[];
  tooManySegments: boolean;
}

/** Dữ liệu đọc → nháp form: 1 nhóm/quota (giữ thứ tự quotas), đợt gắn theo equipmentId (giữ thứ tự segments).
 *  Đợt của thiết bị không có quota → thêm nhóm cuối với totalQty = '' (buộc người dùng nhập). */
export function toEquipmentGroupDrafts(quotas: EquipmentQuota[], segments: EquipmentPlanSegment[]): EquipmentGroupDraft[];
/** Nháp → input: Number(), trim; chuỗi rỗng → NaN (để validate báo lỗi). */
export function normalizeEquipmentGroups(drafts: EquipmentGroupDraft[]): EquipmentPlanGroupInput[];
/** Các khoảng ngày mà tổng qty các đợt phủ ngày đó > total. Gộp ngày liên tiếp cùng vượt thành 1 khoảng; used = SL lớn nhất trong khoảng. Sắp from tăng. Chỉ xét đợt có ngày hợp lệ, to >= from, qty nguyên >= 1. */
export function findOverloads(total: number, segments: EquipmentSegmentInput[]): { from: string; to: string; used: number }[];
export function validateEquipmentPlan(groups: EquipmentPlanGroupInput[], ctx: { equipmentIds: Set<number> }): EquipPlanCheck;
/** Audit: "1 tong 3: 2026-07-06..2026-08-30 x1, 2026-08-31..2026-10-25 x3; 2 tong 2: -", cắt 2000 ký tự. */
export function equipGroupsAuditText(groups: EquipmentPlanGroupInput[]): string;
```
**Luật `validateEquipmentPlan`:**
- `equipmentId` không thuộc `ctx.equipmentIds` → `groupErrors[gi]` có `'equipmentId'`; `equipmentId` trùng nhóm trước → nhóm sau có `'equipmentId'`.
- `totalQty` không nguyên, < 1, > `EQUIP_QTY_MAX` → `'totalQty'`.
- Đợt: `from` sai ISO → `'from'`; `to` sai ISO hoặc `to < from` → `'to'`; `qty` không nguyên, < 1, > `EQUIP_QTY_MAX` → `'qty'`.
- Tổng số đợt mọi nhóm > `EQUIP_PLAN_MAX_ROWS` hoặc số nhóm > `EQUIP_GROUP_MAX` → `tooManySegments = true`.
- `totalQty` hợp lệ → `findOverloads(totalQty, đợt hợp lệ)`; mỗi khoảng → 1 `EquipOverload`; mọi đợt giao với khoảng vượt được thêm `'qty'` vào `segmentErrors`.
- `ok` = không lỗi nhóm, không lỗi đợt, không overload, `!tooManySegments`.
- Nhóm 0 đợt là HỢP LỆ (Gantt của B hiện hàng trống `0/tổng`).

**Thuật toán `findOverloads`:** quét sự kiện: `from` cộng `qty`, `addDaysIso(to, 1)` trừ `qty`; sắp ngày tăng, cộng dồn các sự kiện cùng ngày trước khi so; đoạn `[ngày_i, ngày_{i+1} - 1]` có tổng > `total` thì mở/nối khoảng vượt.

**Test (tên không dấu):**
- 2 đợt không chồng, mỗi đợt qty = total → ok.
- `total 3`: `09-01..09-10 x2` + `09-05..09-15 x2` → 1 overload `{from:'2026-09-05', to:'2026-09-10', used:4}`, cả 2 đợt có `'qty'`.
- 3 đợt: `x2 09-01..09-10`, `x2 09-05..09-20`, `x1 09-08..09-09`, total 3 → 1 khoảng `09-05..09-10`, `used 5`.
- đợt kết thúc đúng ngày đợt kia bắt đầu (`..09-10` và `09-10..`) → tính chồng 1 ngày `09-10`.
- đợt qty > total một mình → overload đúng khoảng đợt đó.
- `to < from` → `'to'`, không đưa vào quét; ngày `'2026-02-30'` → `'from'`.
- equipmentId trùng → nhóm thứ 2 có `'equipmentId'`; equipmentId lạ → `'equipmentId'`.
- totalQty `0`, `1.5`, `1000` → `'totalQty'`.
- 301 đợt → `tooManySegments`.
- nhóm 0 đợt → ok.
- `toEquipmentGroupDrafts`: quota không đợt → nhóm `segments: []`; đợt không có quota → nhóm cuối `totalQty: ''`.
- `equipGroupsAuditText` đúng chuỗi mẫu trên; dài > 2000 → cắt đúng 2000.
- Test mới viết thành khối `describe` mới trong `equipment-plan.test.ts`; khối test cũ giữ tới commit Task 6 + 7.

- [ ] Test đỏ → code → xanh → `tsc` + `npm test` → commit `feat(p3c-a): logic thuan ke hoach thiet bi theo dot, chan dot chong ngay vuot Tong SL`.

---

### Task 4: Logic thuần kế hoạch nhân lực tháng (`src/lib/manpower-plan.ts`, mới)

**Files:** Create `src/lib/manpower-plan.ts`, `src/lib/manpower-plan.test.ts`.

**Produces:**
```ts
import type { ManpowerPlanInput, ShiftRatio } from '@/server/repo/types';

/** Mặc định chia ca theo dim_shift.sortOrder khi dự án chưa có dòng project_shift_ratio (hợp đồng P3C). */
export const DEFAULT_SHIFT_RATIO: readonly number[] = [0.6, 0.4];
export const MANPOWER_PLAN_MAX_MONTHS = 60;
export const MANPOWER_PLAN_MAX_CELL = 99_999;
export const RATIO_SUM_TOLERANCE = 0.001;

export interface PlanCell { planned: number; isManual: boolean }

/** n = 0 → []; n = 1 → [1]; n >= 2 → DEFAULT_SHIFT_RATIO rồi 0 cho ca thứ 3 trở đi. */
export function defaultShiftRatios(shiftCodes: string[]): ShiftRatio[];
/** stored rỗng → defaultShiftRatios(shiftCodes); ngược lại mỗi ca trong shiftCodes lấy pct đã lưu, thiếu → 0. Bỏ dòng lưu của ca không có trong shiftCodes. Giữ thứ tự shiftCodes. */
export function resolveShiftRatios(shiftCodes: string[], stored: { shiftCode: string; pct: number }[]): ShiftRatio[];
export function isRatioSumValid(pcts: number[]): boolean;          // |Σ - 1| <= RATIO_SUM_TOLERANCE
/** Chia total (nguyên >= 0) theo pcts: ca i < cuối = min(còn lại, Math.round(total * pct_i)), ca cuối = phần còn lại. Tổng luôn = total, không ô âm. */
export function splitTotal(total: number, pcts: number[]): number[];
export function monthTotal(cells: PlanCell[]): number;
/** Giữ ô isManual, chia (total - Σ manual) cho ô còn lại theo pct của chúng (chuẩn hoá tổng pct các ô đó = 1; tổng pct các ô đó = 0 → dồn hết vào ô không-manual cuối). */
export function recomputeMonth(total: number, cells: PlanCell[], pcts: number[]):
  | { ok: true; cells: PlanCell[] }
  | { ok: false; reason: 'below_manual' | 'all_manual' };
/** Bỏ mọi cờ sửa tay, chia lại theo tỷ lệ. */
export function resetMonthToRatio(total: number, pcts: number[]): PlanCell[];

export interface ManpowerPlanErrors {
  ratio?: 'shifts' | 'range' | 'sum';
  tooManyMonths?: true;
  months: Record<number, ('yearMonth' | 'duplicate' | 'cells')[]>;
}
/** Kiểm server + client. activeShiftCodes = ca isActive theo sortOrder. */
export function validateManpowerPlan(input: ManpowerPlanInput, activeShiftCodes: string[]): { ok: boolean; errors: ManpowerPlanErrors };
/** Audit 1 tháng: "morning:270,evening:180(m)" - (m) = sửa tay; theo thứ tự cells truyền vào. */
export function manpowerMonthAuditText(cells: { shiftCode: string; planned: number; isManual: boolean }[]): string;
/** Audit tỷ lệ: "morning:0.6,evening:0.4" (pct làm tròn 4 số lẻ, Number(pct.toFixed(4))). */
export function ratioAuditText(ratios: ShiftRatio[]): string;
```
**Luật `validateManpowerPlan`:**
- `ratios`: tập `shiftCode` phải đúng bằng `activeShiftCodes` (không thiếu, không thừa, không trùng) → sai `'shifts'`; pct không hữu hạn hoặc ngoài [0, 1] → `'range'`; tổng lệch → `'sum'`.
- `months.length > MANPOWER_PLAN_MAX_MONTHS` → `tooManyMonths`.
- Mỗi tháng: `isValidYearMonth` sai → `'yearMonth'`; trùng tháng trước → `'duplicate'`; `cells` phải có đúng 1 ô cho mỗi ca trong `activeShiftCodes` (không thừa, không trùng), `planned` nguyên trong [0, `MANPOWER_PLAN_MAX_CELL`] → sai `'cells'`.
- Không bắt buộc tháng liên tục; tháng toàn 0 hợp lệ.

**Test (tên không dấu):**
- `splitTotal(450,[0.6,0.4])` → `[270,180]`; 700 → `[420,280]`; 800 → `[480,320]`; 900 → `[540,360]`; 650 → `[390,260]`; 400 → `[240,160]`; `(7,[0.6,0.4])` → `[4,3]`; `(5,[0.5,0.5])` → `[3,2]`; `(1,[0.5,0.5,0])` → `[1,0,0]`; `(0,[0.6,0.4])` → `[0,0]`; `(10,[1])` → `[10]`; tổng luôn = total với 50 bộ ngẫu nhiên có seed cố định.
- `recomputeMonth(1000,[{300,true},{0,false}],[0.6,0.4])` → `[{300,true},{700,false}]`; `(1000,[{0,false},{0,false}],…)` → `[600,400]`; `(200,[{300,true},{0,false}],…)` → `below_manual`; `(500,[{300,true},{200,true}],…)` → ok giữ nguyên; `(600,[{300,true},{200,true}],…)` → `all_manual`; 3 ca `[0.6,0.4,0]`, ô 1 manual → phần còn lại chia cho ô 2, 3 theo 0.4/0 → ô 2 nhận hết.
- `defaultShiftRatios(['morning','evening'])` → 0.6/0.4; 3 ca → 0.6/0.4/0; 1 ca → 1; 0 ca → [].
- `resolveShiftRatios`: rỗng → mặc định; có `{morning:0.7}` → morning 0.7, evening 0; bỏ dòng ca lạ.
- `validateManpowerPlan`: ratio thiếu ca → `'shifts'`; 0.6 + 0.5 → `'sum'`; 0.6 + 0.4005 → ok; tháng `'2026-13'` → `'yearMonth'`; trùng tháng; ô thiếu ca → `'cells'`; planned `-1`, `1.5`, `100000` → `'cells'`; 61 tháng → `tooManyMonths`.
- `manpowerMonthAuditText`, `ratioAuditText` đúng chuỗi mẫu.

- [ ] Test đỏ → code → xanh → `tsc` + `npm test` → commit `feat(p3c-a): logic thuan ke hoach nhan luc thang, chia ca theo ty le, o sua tay`.

---

### Task 5: 4 hàm đọc theo hợp đồng + seed + đối chiếu `check:read`

**Files:** Modify `src/server/repo/prisma-repo-form.ts`, `src/server/repo/mock-repo-form.ts`, `src/server/repo/prisma-repo-form.test.ts`, `src/server/repo/form.test.ts` (test mock form, thêm khối mới), `src/data/seed/erp.ts`, `src/data/seed/history.ts`, `src/data/seed/history.test.ts`, `prisma/seed.ts`, `scripts/check-read-parity.ts`, `src/lib/equipment-gantt.test.ts`, `src/components/project/EquipmentGantt.test.ts`, `src/server/equipment-gantt-queries.test.ts`, `src/server/repo/read-mock.test.ts`.

**Produces (đúng tên + kiểu hợp đồng; cả `formPrismaRepo` và `makeFormMockRepo` đều `async`):**
```ts
readEquipmentPlanSegments(projectId: number): Promise<EquipmentPlanSegment[]> // mọi dòng project_equipment_plan của dự án; from = plannedStart, to = plannedFinish; equipmentName từ dim_equipment; sort equipmentId, from, id
readEquipmentQuotas(projectId: number): Promise<EquipmentQuota[]>             // sort equipmentId
readManpowerPlanMonths(projectId: number): Promise<ManpowerPlanMonthRow[]>    // sort yearMonth, dim_shift.sortOrder (ca không tìm thấy xếp cuối), rồi shiftCode
readShiftRatios(projectId: number): Promise<ShiftRatio[]>                     // = resolveShiftRatios(mã ca isActive theo sortOrder, dòng đã lưu)
```
- Prisma: `projectEquipmentPlan.findMany({ where: { projectId }, include: { equipment: { select: { name: true } } }, orderBy: [{ equipmentId: 'asc' }, { plannedStart: 'asc' }, { id: 'asc' }] })`; quota tương tự `orderBy: { equipmentId: 'asc' }`; tháng: `findMany` + `include: { shift: { select: { sortOrder: true } } }` rồi sort trong JS như mock; tỷ lệ: `shift.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })` + `projectShiftRatio.findMany({ where: { projectId } })` → `resolveShiftRatios`.
- Mock: tên thiết bị từ `d.equipments` (không thấy → `` `#${id}` ``); `sortOrder` từ `d.shifts`; ca active = `d.shifts.filter(s => s.isActive)` sort `sortOrder`.
- Ngày Prisma → `'YYYY-MM-DD'` bằng hàm `day()` có sẵn trong file.

**RepoData (`src/data/seed/history.ts`):** thêm `equipmentQuotas: ProjectEquipmentQuota[]`, `manpowerPlanMonths: ProjectManpowerPlanMonth[]`, `shiftRatios: ProjectShiftRatio[]` vào interface và `buildRepoData()`; `SEED_VERSION = '2026-09-26-p3c-a'`.

**Seed (`src/data/seed/erp.ts`), dự án `ERP_DETAIL_PROJECT_ID`:**
- Đổi tên mảng 6 dòng cũ thành `legacyEquipmentPlanFixture` (thêm `qty: 1` mỗi dòng, chú thích "chỉ cho test Gantt cũ, xoá ở Bước 11"). Test Gantt cũ (`equipment-gantt.test.ts`, `EquipmentGantt.test.ts`) import tên mới, không đổi assert.
- `equipmentPlanSeed` mới (7 đợt, `unitNo: null`, `workItemId: null`, `note: ''`, `updatedAt: '2026-09-02T00:00:00Z'`, `updatedBy: 'system'`, id 1..7):

| id | equipmentId | from | to | qty |
|---|---|---|---|---|
| 1 | 1 | 2026-07-06 | 2026-08-30 | 1 |
| 2 | 1 | 2026-08-31 | 2026-10-25 | 3 |
| 3 | 1 | 2026-10-26 | 2026-11-29 | 2 |
| 4 | 2 | 2026-08-17 | 2026-09-20 | 2 |
| 5 | 2 | 2026-09-21 | 2026-10-25 | 1 |
| 6 | 3 | 2026-09-01 | 2026-09-30 | 3 |
| 7 | 3 | 2026-09-15 | 2026-10-31 | 1 |

- `equipmentQuotaSeed`: `{1: 3}`, `{2: 2}`, `{3: 4}` (đợt 6 + 7 chồng 09-15..09-30 = 4, vừa đủ). Thiết bị 1 kéo dài 07-06..11-29 (> 3 tháng, B thấy trục tháng).
- `manpowerPlanSeed`: 7 tháng `2026-06` .. `2026-12`, tổng 450, 700, 800, 900, 800, 650, 400; `morning` = 270, 420, 480, 540, 480, 390, 240; `evening` = 180, 280, 320, 360, 320, 260, 160; `isManual: false`.
- `shiftRatioSeed`: `morning 0.6`, `evening 0.4`.
- Mảng seed ghi số cứng (seed không import `src/lib/clock.ts`).

**`prisma/seed.ts`:** sau khối `projectEquipmentPlan`, thêm `deleteMany` + `createMany` cho `projectEquipmentQuota`, `projectManpowerPlanMonth`, `projectShiftRatio` (đổi `updatedAt` chuỗi → `Date`). Không thêm bảng mới vào `syncSequences` (không có cột `id`).

**`scripts/check-read-parity.ts`:** thêm
```ts
import { formPrismaRepo } from '@/server/repo/prisma-repo-form';
import { makeFormMockRepo } from '@/server/repo/mock-repo-form';
// trong main():
const seedData = buildRepoData();
const formMock = makeFormMockRepo({ getData: () => seedData, persist: () => {} });
for (const id of projectIds) {
  check(`readEquipmentPlanSegments(${id})`, await formPrismaRepo.readEquipmentPlanSegments(id), await formMock.readEquipmentPlanSegments(id));
  check(`readEquipmentQuotas(${id})`, await formPrismaRepo.readEquipmentQuotas(id), await formMock.readEquipmentQuotas(id));
  check(`readManpowerPlanMonths(${id})`, await formPrismaRepo.readManpowerPlanMonths(id), await formMock.readManpowerPlanMonths(id));
  check(`readShiftRatios(${id})`, await formPrismaRepo.readShiftRatios(id), await formMock.readShiftRatios(id));
}
```

**Test:**
- `form.test.ts` (mock): dự án 1 → segments 7 dòng đúng thứ tự bảng trên, `equipmentName` 'Cẩu bánh xích' cho id 1; quotas 3 dòng; months 14 dòng, dòng đầu `{yearMonth:'2026-06', shiftCode:'morning', planned:270, isManual:false}`, dòng 2 `evening 180`; ratios `[{morning,0.6},{evening,0.4}]`. Dự án 17 → segments `[]`, quotas `[]`, months `[]`, ratios = mặc định 0.6/0.4.
- `prisma-repo-form.test.ts`: 4 hàm gọi đúng `findMany` (where, orderBy, include) và map đúng kiểu (dòng giả Date → 'YYYY-MM-DD'); ratios không có dòng → mặc định.
- `history.test.ts`: `equipmentPlans` 7 dòng, mọi dòng `qty >= 1`, `unitNo === null`; mỗi loại thiết bị ≥ 2 đợt với ≥ 2 giá trị qty khác nhau; có 1 thiết bị khoảng `max(to) - min(from) > 92` ngày; mọi loại có đợt đều có quota và `findOverloads(totalQty, đợt) = []`; tổng mỗi tháng KH nhân lực = [450, 700, 800, 900, 800, 650, 400].
- `read-mock.test.ts` `readEquipmentPlans(1)` → 7 dòng; `equipment-gantt-queries.test.ts` "du an 1" → 3 hàng (mỗi thiết bị 1 hàng, K9).

**Chạy:** `npx prisma db seed` trên `ddc_control_tower` (xoá dữ liệu dev, như các phase trước) → `npm run check:read` = OK toàn bộ.

- [ ] Test đỏ → code → seed → `check:read` → `tsc` + `npm test` → commit `feat(p3c-a): 4 ham doc hop dong P3C (segments, quotas, KH nhan luc thang, ty le ca) + seed du an 1 + check:read`.

---

### Task 6: Ghi kế hoạch thiết bị (repo + action + zod)

**Files:** Modify `src/server/repo/prisma-repo-form.ts`, `src/server/repo/mock-repo-form.ts`, `src/server/repo/prisma-repo-form.test.ts`, `src/server/repo/form.test.ts`, `src/server/validation.ts`, `src/server/actions-entry.ts`, `src/server/actions-equipment-plan.test.ts`, `src/server/actions-equipment-plan.qa.test.ts` (viết lại theo chữ ký mới), `src/server/repo/types.ts` (xoá hẳn `EquipmentPlanInput`).

**Produces:**
```ts
// prisma-repo-form.ts (async) và mock-repo-form.ts (sync như các hàm ghi mock khác)
/** Thay TOÀN BỘ quota + đợt thiết bị của dự án trong 1 transaction; 1 dòng audit. */
replaceEquipmentPlans(projectId: number, groups: EquipmentPlanGroupInput[], by: string): Promise<void>;

// actions-entry.ts
export async function saveEquipmentPlansAction(projectId: number, groups: EquipmentPlanGroupInput[]): Promise<
  | { ok: true; groups: number; segments: number }
  | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' | 'invalid_plan'; check?: EquipPlanCheck }
>;

// validation.ts (thay schema cũ)
export const saveEquipmentPlansSchema: z.ZodType<{ projectId: number; groups: EquipmentPlanGroupInput[] }>;
```
**Repo (Prisma), trong `prisma.$transaction`:**
1. Đọc `projectEquipmentQuota` + `projectEquipmentPlan` của dự án → dựng nhóm "trước" (theo equipmentId: `totalQty` từ quota, thiếu → 0; đợt = `{from, to, qty}` sort `from`) → `beforeText = equipGroupsAuditText(...)`.
2. `deleteMany` plan rồi quota của dự án.
3. `createMany` quota `{ projectId, equipmentId, totalQty, updatedBy: by }`; `createMany` plan `{ projectId, equipmentId, unitNo: null, qty, workItemId: null, plannedStart: dayStart(from), plannedFinish: dayStart(to), note: '', updatedBy: by }` (theo Q1 phương án a).
4. `audit(tx, 'project_equipment_plan', String(projectId), 'replace', beforeText, equipGroupsAuditText(groups), by)`.
Mock: cùng ngữ nghĩa trên `d.equipmentQuotas`, `d.equipmentPlans` (id plan mới = max id + 1 tăng dần), rồi `persist()`.

**zod:** `projectId` int dương; `groups` mảng tối đa `EQUIP_GROUP_MAX`, phần tử `{ equipmentId: int dương, totalQty: int 1..EQUIP_QTY_MAX, segments: mảng tối đa EQUIP_PLAN_MAX_ROWS của { from: isoDate, to: isoDate, qty: int 1..EQUIP_QTY_MAX } }`; `.refine` tổng số đợt ≤ `EQUIP_PLAN_MAX_ROWS`.

**Action (thứ tự):** `requireWriteProject` → sai `Forbidden`; `safeParse` → sai `Invalid input`; `repo.getProject` → không có `Not found`; `equipmentIds` = `repo.getEquipments()` ∪ equipmentId của `repo.readEquipmentQuotas(projectId)` (vẫn lưu lại loại đã ngừng dùng); `validateEquipmentPlan` → sai `{ ok:false, error:'invalid_plan', check }`; `repo.replaceEquipmentPlans(projectId, groups, user.email)`; `logActivity(user, 'save_equipment_plans', \`project ${projectId} · ${groups.length} loai · ${n} dot\`)` (key activity đã có); trả `{ ok:true, groups, segments }`.

**Test:**
- action quyền: admin ok; pm@ (PIC dự án 1) ok; pm@ dự án 16 Forbidden; viewer, bod Forbidden (khuôn file cũ).
- luật: `equipmentId 999` → `invalid_plan`, `check.groupErrors[0]` có `'equipmentId'`; 2 đợt chồng vượt → `invalid_plan`, `check.overloads[0]` đúng `from/to/used/total`, DỮ LIỆU CŨ còn nguyên (`readEquipmentPlanSegments(1)` không đổi); payload 1 nhóm `totalQty: 0` → `Invalid input` (zod).
- lưu hợp lệ 2 nhóm (1 nhóm 0 đợt) → `{ok:true, groups:2, segments:n}`; `readEquipmentQuotas(1)` đúng 2 dòng; `readEquipmentPlanSegments(1)` đúng đợt; audit có `tableName 'project_equipment_plan'`, `field 'replace'`, `newValue` chứa `tong`.
- lưu mảng rỗng → xoá hết quota + đợt của dự án, dự án khác không đổi.
- `prisma-repo-form.test.ts`: `replaceEquipmentPlans` gọi `deleteMany` 2 bảng, `createMany` quota + plan với `unitNo: null`, audit đúng tham số.

- [ ] Test đỏ → code → xanh. **KHÔNG commit riêng:** đổi chữ ký action làm `EquipmentPlanEditor` cũ đỏ `tsc`, nên Task 6 và Task 7 chung 1 commit (cuối Task 7).

---

### Task 7: Form kế hoạch thiết bị (viết lại `EquipmentPlanEditor`) + gắn `/nhap-lieu`

**Files:** Modify `src/components/form/EquipmentPlanEditor.tsx`, `src/components/form/EquipmentPlanEditor.test.ts`, `app/[locale]/(app)/nhap-lieu/page.tsx`, `vi.json`, `en.json` (giữ khoá i18n).

**Props:**
```ts
export function EquipmentPlanEditor(p: {
  projectId: number;
  quotas: EquipmentQuota[];
  segments: EquipmentPlanSegment[];
  equipments: Equipment[]; // thiết bị đang dùng (repo.getEquipments())
}): JSX.Element
```
**Hành vi:**
- State `groups: EquipmentGroupDraft[]` = `toEquipmentGroupDrafts(quotas, segments)`; `check: EquipPlanCheck | null`; `saving`; `msg`.
- Danh sách chọn thiết bị = `equipments` ∪ thiết bị có trong `quotas` mà không có trong `equipments` (tên lấy `quota.equipmentName`, thêm hậu tố `t('equipmentPlan.inactive')`).
- Mỗi nhóm: hàng đầu `select` thiết bị (chỉ hiện thiết bị chưa dùng ở nhóm khác + chính nó) · ô `Tổng SL` (`type="number" min=1 max=EQUIP_QTY_MAX`) · nút `t('equipmentPlan.removeGroup')`. Dưới là `table.tbl` các đợt: `#` · `Từ ngày` (`type="date"`) · `Đến ngày` · `SL dùng` (`type="number" min=1`) · nút `t('equipmentPlan.removeSegment')`. Nút `t('equipmentPlan.addSegment')`: đợt mới `from` = ngày sau `to` của đợt cuối (hợp lệ) hoặc `''`, `to` = `''`, `qty` = `'1'`. Nhóm 0 đợt hiện `t('equipmentPlan.noSegment')`.
- Cuối form: `t('equipmentPlan.addGroup')` (nhóm mới lấy thiết bị đầu tiên chưa dùng; tắt khi hết thiết bị hoặc đủ `EQUIP_GROUP_MAX`), `t('equipmentPlan.save')`, dòng đếm `t('equipmentPlan.count', { groups, segments })`, `t('equipmentPlan.limit', { n: EQUIP_PLAN_MAX_ROWS })` khi chạm trần.
- Bấm lưu: `normalizeEquipmentGroups` → `validateEquipmentPlan` với `equipmentIds` = id trong danh sách chọn → lỗi: tô đỏ (`inp bad`) đúng ô theo `groupErrors`/`segmentErrors`, `sumbar bad` gồm `t('equipmentPlan.err.invalid')` và mỗi overload 1 dòng `t('equipmentPlan.err.overload', { name, from: formatDate(from, locale), to: formatDate(to, locale), used, total })` (`formatDate` từ `@/lib/format`, `locale` từ `useLocale()`), `tooManySegments` → `t('equipmentPlan.limit', …)`. Hợp lệ → gọi action; `ok` → `t('equipmentPlan.saved', { groups, segments })` + `router.refresh()`; `invalid_plan` → hiện `res.check` như trên; `Forbidden` → `t('equipmentPlan.err.forbidden')`; lỗi khác → `t('equipmentPlan.err.generic', { msg: res.error })`; ném lỗi → `t('equipmentPlan.err.generic', { msg: '' })` trong `catch`.
- Lỗi chỉ cập nhật khi bấm lưu (như form P3A).
- `equipments` rỗng và `quotas` rỗng → chỉ hiện tiêu đề + `t('equipmentPlan.noEquipment')`.

**`nhap-lieu/page.tsx`:** thay `readEquipmentPlans` + `getWorkItems` bằng
```ts
const [equipmentQuotas, equipmentSegments] = project
  ? await Promise.all([repo.readEquipmentQuotas(project.id), repo.readEquipmentPlanSegments(project.id)])
  : [[], []];
```
và `<EquipmentPlanEditor projectId={project.id} quotas={equipmentQuotas} segments={equipmentSegments} equipments={equipments} />`. Bỏ biến `workItems` nếu không còn chỗ dùng; sửa chú thích "Task 12 (P3A, T14)" thành "P3C-A (T4)".

**i18n: viết lại nhóm `equipmentPlan` TẠI CHỖ (nhóm của A, form cũ bị thay; xoá key cũ không còn dùng: `colEquipment`, `colUnit`, `colWorkItem`, `colStart`, `colFinish`, `colNote`, `add`, `remove`, `err.overlap`):**

| key | vi | en |
|---|---|---|
| `title` | Kế hoạch sử dụng thiết bị (nguồn cho Gantt) | Equipment usage plan (Gantt source) |
| `help` | Mỗi loại thiết bị nhập Tổng SL và các đợt sử dụng. Các đợt chồng ngày cộng lại không được vượt Tổng SL. | For each equipment type, enter the total quantity and its usage periods. Overlapping periods must not exceed the total. |
| `colEquipment` | Thiết bị | Equipment |
| `colTotal` | Tổng SL | Total qty |
| `colFrom` | Từ ngày | From |
| `colTo` | Đến ngày | To |
| `colQty` | SL dùng | Qty used |
| `addGroup` | + Thêm loại thiết bị | + Add equipment type |
| `removeGroup` | Xoá loại | Remove type |
| `addSegment` | + Thêm đợt | + Add period |
| `removeSegment` | Xoá đợt | Remove period |
| `noSegment` | Chưa có đợt nào | No periods yet |
| `inactive` | (ngừng dùng) | (inactive) |
| `save` | Lưu kế hoạch thiết bị | Save equipment plan |
| `saved` | Đã lưu {groups} loại thiết bị, {segments} đợt | Saved {groups} equipment types, {segments} periods |
| `count` | {groups} loại · {segments} đợt | {groups} types · {segments} periods |
| `noEquipment` | Chưa có thiết bị trong danh mục | No equipment in the catalog |
| `limit` | Tối đa {n} đợt | Up to {n} periods |
| `err.invalid` | Có ô chưa hợp lệ, xem các ô tô đỏ | Some fields are invalid, see the red fields |
| `err.overload` | {name}: từ {from} đến {to} dùng {used}, vượt Tổng SL {total} | {name}: from {from} to {to} uses {used}, exceeding the total of {total} |
| `err.forbidden` | Bạn không có quyền sửa dự án này. | You do not have permission to edit this project. |
| `err.generic` | Lưu thất bại: {msg} | Save failed: {msg} |

**Test `EquipmentPlanEditor.test.ts`** (mock `next-intl` gồm `useTranslations` + `useLocale: () => 'vi'`, `next/navigation`, `@/server/actions-entry`):
- 1 quota + 2 đợt → có `<select`, 2 ô `type="date"` mỗi đợt, `equipmentPlan.count` với `groups:1` `segments:2`.
- quota không đợt → `equipmentPlan.noSegment`.
- `equipments` rỗng + `quotas` rỗng → `equipmentPlan.noEquipment`.
- quota của thiết bị không có trong `equipments` → markup chứa `quota.equipmentName` và `equipmentPlan.inactive`.

**Kiểm trình duyệt:** `/vi/nhap-lieu?project=1&step=resources` (admin, rồi pm@) 1440px + 390px: thấy 3 loại thiết bị seed; tạo chồng ngày vượt → báo đúng dòng "Cẩu bánh xích: từ … đến … dùng 4, vượt Tổng SL 3" + ô tô đỏ, không lưu; sửa hợp lệ → lưu, tải lại trang giữ đúng; `/vi/ho-so-du-an?project=1` thẻ nhật ký có dòng "Kế hoạch thiết bị". 390px: bảng cuộn ngang trong khung, không tràn trang. Ảnh `.bangiao/anh-test/t4-*.png`.

- [ ] Xoá export cũ P3A trong `src/lib/equipment-plan.ts` (danh sách ở Task 3) + khối test cũ của chúng, xoá `EquipmentPlanInput` trong `types.ts`; `grep` không còn chỗ dùng.
- [ ] Test đỏ → code → xanh → `tsc` + `npm test` → trình duyệt → commit chung Task 6 + 7 `feat(p3c-a): luu va form ke hoach thiet bi theo loai (Tong SL + dot), chan chong ngay vuot, thay form theo tung chiec o /nhap-lieu`.

---

### Task 8: Ghi kế hoạch nhân lực tháng (repo + action + zod) + nhật ký dự án

**Files:** Modify `src/server/repo/prisma-repo-form.ts`, `src/server/repo/mock-repo-form.ts` (+ 2 test), `src/server/validation.ts`, `src/server/actions-entry.ts`, `app/[locale]/(app)/ho-so-du-an/page.tsx`, `vi.json`, `en.json`. Create `src/server/actions-manpower-plan.test.ts`.

**Produces:**
```ts
// repo form (Prisma async / mock sync)
replaceManpowerPlan(projectId: number, input: ManpowerPlanInput, by: string): Promise<{ changedMonths: number; ratioChanged: boolean }>;

// actions-entry.ts
export async function saveManpowerPlanAction(projectId: number, input: ManpowerPlanInput): Promise<
  | { ok: true; changedMonths: number; ratioChanged: boolean }
  | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' | 'invalid_plan'; errors?: ManpowerPlanErrors }
>;

// validation.ts
export const saveManpowerPlanSchema: z.ZodType<{ projectId: number; input: ManpowerPlanInput }>;
```
**Repo (Prisma), trong `prisma.$transaction`:**
1. Đọc dòng tháng của dự án, dòng tỷ lệ của dự án, ca active (`shift.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })`).
2. Map "trước" theo `yearMonth` → `manpowerMonthAuditText` (ô sắp theo `sortOrder` ca, ca lạ cuối); map "sau" từ `input.months` (ô theo thứ tự `input`).
3. Tháng đổi = tháng có chuỗi trước ≠ chuỗi sau (gồm tháng mới và tháng bị bỏ). Với mỗi tháng đổi: `audit(tx, 'project_manpower_plan_month', \`${projectId}/${ym}\`, 'planned', before ?? '', after ?? '', by)`.
4. `deleteMany({ where: { projectId, yearMonth: { in: changed } } })`; `createMany` các ô của tháng đổi còn trong input (`updatedBy: by`).
5. Tỷ lệ: `before = resolveShiftRatios(mã ca active, dòng cũ)`; `ratioAuditText(before) !== ratioAuditText(input.ratios)` → `audit(tx, 'project_shift_ratio', String(projectId), 'pct', (dòng cũ rỗng ? 'default ' : '') + ratioAuditText(before), ratioAuditText(input.ratios), by)`, rồi `deleteMany` + `createMany` tỷ lệ; bằng nhau → không ghi gì.
6. Trả `{ changedMonths: changed.length, ratioChanged }`. Không đổi gì → không ghi DB, không audit.
Mock: cùng ngữ nghĩa trên `d.manpowerPlanMonths`, `d.shiftRatios`, ca active từ `d.shifts`, rồi `persist()` (chỉ khi có đổi).

**zod:** `projectId` int dương; `input.ratios` mảng tối đa 10 của `{ shiftCode: string trim 1..20, pct: number finite 0..1 }`; `input.months` mảng tối đa `MANPOWER_PLAN_MAX_MONTHS` của `{ yearMonth, cells: mảng tối đa 10 của { shiftCode: string trim 1..20, planned: int 0..MANPOWER_PLAN_MAX_CELL, isManual: boolean } }` (dùng hằng `yearMonth` có sẵn trong `validation.ts`).

**Action:** `requireWriteProject` → `Forbidden`; `safeParse({ projectId, input })` → `Invalid input`; `repo.getProject` → `Not found`; `activeCodes = (await repo.getShifts()).map(s => s.code)`; `validateManpowerPlan` → `{ ok:false, error:'invalid_plan', errors }`; `repo.replaceManpowerPlan(projectId, input, user.email)`; có đổi → `logActivity(user, 'save_manpower_plan', \`project ${projectId} · ${changedMonths} thang\`)`; trả kết quả.

**Nhật ký dự án (`/ho-so-du-an`):** trong `readProjectAuditTrail` của cả 2 repo form: thêm `'project_shift_ratio'` vào `exact`, `'project_manpower_plan_month'` vào `prefixed`. Trang `ho-so-du-an/page.tsx` `tableLabels` thêm 2 key.

**i18n (nối cuối nhóm có sẵn):**
- `activity` (cuối nhóm): `save_manpower_plan`: vi "Lưu kế hoạch nhân lực tháng", en "Save monthly manpower plan".
- `projectForm.audit.tbl` (cuối nhóm): `project_manpower_plan_month`: vi "KH nhân lực tháng", en "Monthly manpower plan"; `project_shift_ratio`: vi "Tỷ lệ ca", en "Shift ratio".

**Test `actions-manpower-plan.test.ts`** (khuôn `actions-equipment-plan.test.ts`, dự án 1 có seed 7 tháng):
- quyền: admin ok, pm@ dự án 1 ok, pm@ dự án 16 Forbidden, viewer/bod Forbidden.
- gửi lại đúng dữ liệu đang có → `{ok:true, changedMonths:0, ratioChanged:false}`, không thêm dòng audit.
- đổi tháng `2026-09` thành `morning 600 (isManual true), evening 300` → `changedMonths 1`; `readManpowerPlanMonths(1)` có `{2026-09, morning, 600, true}`; audit `project_manpower_plan_month`, recordId `'1/2026-09'`, old `'morning:540,evening:360'`, new `'morning:600(m),evening:300'`.
- bỏ tháng `2026-12` → audit new `''`, không còn dòng tháng đó.
- đổi tỷ lệ 0.7/0.3 → `ratioChanged true`, audit `project_shift_ratio` old `'morning:0.6,evening:0.4'` new `'morning:0.7,evening:0.3'`.
- dự án 17 (chưa có tỷ lệ) lưu 0.6/0.4 + 1 tháng → audit tỷ lệ KHÔNG ghi (bằng mặc định), tháng ghi 1 dòng audit với old `''`.
- tổng tỷ lệ 1.1 → `invalid_plan`, `errors.ratio === 'sum'`, dữ liệu không đổi; ca `'afternoon'` trong cells → `invalid_plan`, `errors.months[0]` có `'cells'`; `planned: -1` → `Invalid input`.
- `readProjectAuditTrail(1, 50)` trả được dòng `project_manpower_plan_month` và `project_shift_ratio`.

- [ ] Test đỏ → code → xanh → `tsc` + `npm test` → commit `feat(p3c-a): luu ke hoach nhan luc thang theo ca + ty le ca, audit tung thang`.

---

### Task 9: Form kế hoạch nhân lực tháng + gắn `/nhap-lieu`

**Files:** Create `src/components/form/manpowerPlanState.ts` + `.test.ts`, `src/components/form/ManpowerPlanEditor.tsx` + `.test.ts`. Modify `app/[locale]/(app)/nhap-lieu/page.tsx`, `src/i18n/messages.test.ts` (thêm `'ManpowerPlanEditor': 'src/components/form/ManpowerPlanEditor.tsx'` vào `CHANGED_SOURCES`), `vi.json`, `en.json`.

**State thuần (`manpowerPlanState.ts`):**
```ts
import type { ManpowerPlanInput, ManpowerPlanMonthRow, Shift, ShiftRatio } from '@/server/repo/types';
import type { PlanCell } from '@/lib/manpower-plan';

export type RowError = 'below_manual' | 'all_manual' | null;
export interface PlanRowState { yearMonth: string; cells: PlanCell[]; totalInput: string; error: RowError } // cells cùng thứ tự shifts
export interface PlanState { shiftCodes: string[]; pctInputs: string[]; rows: PlanRowState[] }

export function initPlanState(shifts: Shift[], months: ManpowerPlanMonthRow[], ratios: ShiftRatio[]): PlanState;
  // shifts = ca active theo sortOrder; mỗi yearMonth khác nhau 1 dòng (sort tăng); ô thiếu → {0,false}; bỏ dòng của ca không active;
  // pctInputs = String(Math.round(pct * 1000) / 10) theo thứ tự shifts (ratios thiếu ca → '0'); totalInput = String(Σ)
/** % hợp lệ (mỗi ô số hữu hạn 0..100, tối đa 1 số lẻ, tổng 100 ±0.1) → pct 0..1; không hợp lệ → null. */
export function parsePcts(pctInputs: string[]): number[] | null;
/** Gõ Tổng: chuỗi không phải số nguyên 0..MAX*số ca → chỉ đổi totalInput; hợp lệ → recomputeMonth; lỗi → error, cells giữ nguyên. parsePcts null → chỉ đổi totalInput. */
export function setTotal(s: PlanState, row: number, input: string): PlanState;
/** Gõ ô ca: nguyên 0..MANPOWER_PLAN_MAX_CELL → planned mới, isManual = true, totalInput = String(Σ), error = null; không hợp lệ → trả s nguyên vẹn. */
export function setCell(s: PlanState, row: number, shift: number, input: string): PlanState;
/** Gõ %: cập nhật pctInputs; parsePcts ok → mọi dòng recomputeMonth(Σ hiện tại, cells, pcts) (tổng tháng giữ nguyên). */
export function setPct(s: PlanState, shift: number, input: string): PlanState;
/** "Tính lại theo tỷ lệ" 1 dòng: tổng = số trong totalInput nếu hợp lệ, không thì Σ; resetMonthToRatio; error = null. parsePcts null → trả s. */
export function resetRow(s: PlanState, row: number): PlanState;
/** Thêm tháng (ô 0, không sửa tay), chèn đúng thứ tự tăng. */
export function addMonth(s: PlanState, yearMonth: string): PlanState | 'duplicate' | 'invalid' | 'too_many';
export function removeMonth(s: PlanState, row: number): PlanState;
/** null khi còn lỗi (dòng có error, totalInput khác Σ, parsePcts null). */
export function toPlanInput(s: PlanState): ManpowerPlanInput | null;
```
**Component `ManpowerPlanEditor`:**
```ts
export function ManpowerPlanEditor(p: {
  projectId: number;
  shifts: Shift[];               // repo.getShifts(): ca active theo sortOrder
  months: ManpowerPlanMonthRow[];
  ratios: ShiftRatio[];
  today: IsoDate;                // gợi ý tháng thêm mới
}): JSX.Element
```
- Tiêu đề `<div className="sect"><b>{t('manpowerPlan.title')}</b><i /></div>` + `hintline` `t('manpowerPlan.help')`.
- `table.tbl` trong `div.scroll`: đầu bảng `Tháng` · mỗi ca 1 cột (tên `locale === 'vi' ? nameVi : nameEn`, `useLocale()`) · `Tổng` · cột thao tác. Hàng đầu thân bảng = "Tỷ lệ %": ô `%` mỗi ca (`type="number" step="0.1" min=0 max=100`), ô Tổng hiện tổng % (tô đỏ khi `parsePcts` null, kèm dòng `t('manpowerPlan.err.ratioSum')`).
- Mỗi tháng: nhãn `MM/YYYY`; ô ca `type="number" min=0`; ô đã sửa tay có `data-manual="1"`, `title={t('manpowerPlan.manualHint')}`, `style={{ borderColor: 'var(--accent)', fontWeight: 650 }}`; ô Tổng `type="number" min=0`, `readOnly` khi mọi ô ca đều sửa tay, class `inp bad` khi `error`; nút `t('manpowerPlan.recalc')` chỉ hiện khi dòng có ô sửa tay (gọi `resetRow`); nút `t('manpowerPlan.removeMonth')`. Dòng lỗi dưới hàng: `below_manual` → `t('manpowerPlan.err.belowManual', { manual })` (manual = Σ ô sửa tay), `all_manual` → `t('manpowerPlan.err.allManual')`. Ô Tổng `onBlur`: nếu đang lỗi hoặc không hợp lệ thì đặt lại `totalInput = String(Σ)` và xoá lỗi.
- Chân form: `<input type="month">` (mặc định = tháng sau tháng cuối, bảng rỗng → `today.slice(0,7)`) + nút `t('manpowerPlan.addMonth')` (báo `t('manpowerPlan.err.duplicate')` / `err.tooMany` khi `addMonth` trả lỗi); nút `t('manpowerPlan.save')` (tắt khi `toPlanInput` = null hoặc đang lưu); chú thích `t('manpowerPlan.legend')`.
- Lưu: gọi `saveManpowerPlanAction(projectId, input)`; ok → `changedMonths === 0 && !ratioChanged` ? `t('manpowerPlan.noChange')` : `t('manpowerPlan.saved', { n: changedMonths })`, `router.refresh()`; `invalid_plan` → `t('manpowerPlan.err.invalid')`; `Forbidden` → `t('manpowerPlan.err.forbidden')`; khác → `t('manpowerPlan.err.generic', { msg: res.error })`; ném lỗi → `catch` như trên với `msg: ''`.
- `shifts` rỗng → chỉ tiêu đề + `t('manpowerPlan.noShift')`.

**`nhap-lieu/page.tsx`:**
```ts
const [manpowerMonths, shiftRatios] = project
  ? await Promise.all([repo.readManpowerPlanMonths(project.id), repo.readShiftRatios(project.id)])
  : [[], []];
```
Trong `resourcesPanel`, ngay sau `<EquipmentPlanEditor …/>`: `<ManpowerPlanEditor projectId={project.id} shifts={shifts} months={manpowerMonths} ratios={shiftRatios} today={today} />` (`shifts` = `repo.getShifts()` đã có trên trang).

**i18n: nhóm MỚI `manpowerPlan` đặt CUỐI vi.json và en.json:**

| key | vi | en |
|---|---|---|
| `title` | Kế hoạch nhân lực theo tháng | Monthly manpower plan |
| `help` | Nhập Tổng tháng để tự chia các ca theo tỷ lệ. Sửa tay 1 ô ca thì ô đó được giữ nguyên khi đổi Tổng hoặc tỷ lệ. | Enter the monthly total to split it across shifts by ratio. A shift cell edited by hand is kept when the total or ratio changes. |
| `colMonth` | Tháng | Month |
| `colTotal` | Tổng | Total |
| `ratioRow` | Tỷ lệ % | Ratio % |
| `manualHint` | Ô đã sửa tay, không tự tính lại | Edited by hand, not recalculated |
| `legend` | Ô viền xanh = đã sửa tay | Blue-bordered cell = edited by hand |
| `recalc` | Tính lại theo tỷ lệ | Recalculate by ratio |
| `removeMonth` | Xoá tháng | Remove month |
| `addMonth` | + Thêm tháng | + Add month |
| `save` | Lưu kế hoạch nhân lực | Save manpower plan |
| `saved` | Đã lưu {n} tháng thay đổi | Saved {n} changed months |
| `noChange` | Không có thay đổi | No changes |
| `noShift` | Chưa có ca làm việc đang dùng | No active shifts |
| `err.ratioSum` | Tổng tỷ lệ các ca phải bằng 100% | Shift ratios must add up to 100% |
| `err.belowManual` | Tổng nhỏ hơn tổng các ô đã sửa tay ({manual}) | Total is less than the hand-edited cells ({manual}) |
| `err.allManual` | Mọi ca đều đã sửa tay, bấm "Tính lại theo tỷ lệ" để nhập Tổng | All shifts are hand-edited, press "Recalculate by ratio" to enter a total |
| `err.duplicate` | Tháng này đã có trong bảng | This month is already in the table |
| `err.tooMany` | Tối đa 60 tháng | Up to 60 months |
| `err.invalid` | Kế hoạch chưa hợp lệ, kiểm tra lại tỷ lệ và các ô | The plan is invalid, check the ratios and cells |
| `err.forbidden` | Bạn không có quyền sửa dự án này. | You do not have permission to edit this project. |
| `err.generic` | Lưu thất bại: {msg} | Save failed: {msg} |

**Test `manpowerPlanState.test.ts`** (2 ca `morning`/`evening`, tên lấy từ fixture `Shift`):
- `initPlanState` từ seed 7 tháng → 7 dòng, `pctInputs ['60','40']`, dòng 1 `totalInput '450'`.
- `setTotal(row0,'1000')` → cells 600/400, không manual.
- `setCell(row0, 0, '300')` → ô 0 manual 300, ô 1 giữ 180, `totalInput '480'`; tiếp `setTotal(row0,'1000')` → ô 0 vẫn 300, ô 1 = 700; tiếp `setTotal(row0,'200')` → `error 'below_manual'`, cells không đổi, `toPlanInput` = null.
- `setPct(0,'70')` → `parsePcts` null (tổng 110), cells không đổi; `setPct(1,'30')` → mọi dòng không-manual chia lại 70/30, tổng mỗi tháng giữ nguyên; ô manual giữ.
- `resetRow` → hết manual, chia theo tỷ lệ.
- `addMonth('2026-06')` trên seed → `'duplicate'`; `addMonth('2027-01')` → thêm cuối; `addMonth('2026-05')` → chèn đầu; `addMonth('2026-13')` → `'invalid'`; 60 dòng → `'too_many'`.
- `setCell(row0,0,'-1')` và `'1.5'` → state không đổi.
- `toPlanInput` hợp lệ → `ratios` pct 0.6/0.4, `months[0].cells` đúng thứ tự ca.

**Test `ManpowerPlanEditor.test.ts`** (render tĩnh, mock như Task 7 + `@/server/actions-entry` `saveManpowerPlanAction: vi.fn()`): seed 7 tháng → có 7 nhãn tháng (`06/2026` … `12/2026`), tên ca lấy từ prop `shifts` (dùng tên giả `'Ca A'`, `'Ca B'` để chắc không ghi cứng), ô tỷ lệ `value="60"`; 1 ô `isManual` → markup có `data-manual="1"` và `manpowerPlan.recalc`; `shifts` rỗng → `manpowerPlan.noShift`.

**Kiểm trình duyệt:** `/vi/nhap-lieu?project=1&step=resources` 1440px + 390px (admin và pm@): bảng 7 tháng 60/40 đúng số seed; nhập Tổng → tự chia; sửa 1 ô → viền xanh, đổi Tổng/tỷ lệ ô đó không đổi; "Tính lại theo tỷ lệ" bỏ viền; tỷ lệ 70 + 40 → báo lỗi, nút lưu tắt; lưu → tải lại giữ đúng; `/vi/ho-so-du-an?project=1` nhật ký có "KH nhân lực tháng", "Tỷ lệ ca". 390px: bảng cuộn ngang trong khung. Ảnh `.bangiao/anh-test/t5-*.png`.

- [ ] Test đỏ → code → xanh → `tsc` + `npm test` → trình duyệt → commit `feat(p3c-a): form ke hoach nhan luc thang (thang x ca, ty le %, o sua tay, tinh lai) o /nhap-lieu`.

---

### Task 10: Cổng cuối + tổng kết cho Tester

- [ ] `npx tsc --noEmit` sạch; `npm test` xanh, số file/test ≥ mốc Task 0 (trừ test xoá có chủ đích, liệt kê); `npm run check:read` OK; `npx prisma migrate status` up to date.
- [ ] `npm run build` với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` trỏ `D:\_project\DDC_dieu-phoi\tools\font-mock.js` (chỉ kiểm compile).
- [ ] E2E: chỉ chạy nếu đổi biến `E2E_*` sang DB `ddc_control_tower` + cổng 3000 (mặc định chốt DB B/cổng 3001): `npm run test:e2e -- e2e/04-data-entry.spec.ts e2e/05-import.spec.ts`. Không chạy được thì ghi "bỏ qua, lý do" trong `thay-doi.md`.
- [ ] `git diff main...HEAD --stat` KHÔNG có `prisma-repo.ts`, `mock-repo.ts`, `actions.ts`, `queries.ts`, `project-queries.ts`, `PROGRESS.md`, `.serena/`.
- [ ] `.bangiao/thay-doi.md`: mốc test đầu/cuối, commit theo Task, output migrate deploy/rollback/deploy + `migrate diff`, kết quả `check:read`, danh sách ảnh trước/sau, test bị xoá/viết lại (form P3A theo từng chiếc), quyết định Q1 đã áp, nợ để sau (mục dưới), rủi ro cho Tester/Security (payload lớn, replace-all thiết bị, audit).
- [ ] Nối vào mục "Thay đổi hợp đồng" của `D:\_project\DDC_dieu-phoi\hop-dong-du-lieu-P3C.md` 1 dòng: `2026-09-26 · A · Form KH thiết bị (T4) và KH nhân lực tháng (T5) đặt ở /nhap-lieu, bước "Nhân lực & Thiết bị". readShiftRatios chỉ trả ca dim_shift isActive; ca thứ 3 trở đi mặc định 0. Đợt thiết bị mới lưu unitNo = null, workItemId = null (Q1).` (sửa câu cuối theo đáp án Q1).
- [ ] Commit `docs(p3c-a): thay-doi cho tester, ghi thay doi hop dong P3C` → cập nhật `phien-A.md` (ghi rõ: Bước 11 CHỜ B merge P3C-B).

**Nợ để sau (ghi vào `thay-doi.md`, không làm):** key i18n Gantt cũ (`equipmentGantt.*`, `manpowerCharts.shift*`) xoá ở Bước 11; `scripts/perf/seed-perf.ts` chưa tạo quota/KH tháng cho dữ liệu hiệu năng; `.serena/memories/core.md` còn ghi mã ca `afternoon` (sửa ở lượt merge `main`).

---

### Task 11: Bước 11, gắn chart của B vào trang Chi tiết: **CHỜ, CODER KHÔNG LÀM TRONG LƯỢT NÀY**

**Điều kiện mở (đủ cả 3):** (a) B đã merge P3C-B vào `main` (`phien-B.md` ghi rõ, `git log main` có commit merge); (b) P3C-A (Task 0-10) đã CHỐT; (c) A không đang nâng Next.
Khi mở: điều phối gọi lại planner để viết Task 11 chi tiết trên nền code thật sau `git merge main`.

**Nguồn hướng dẫn chi tiết:** mục "Bước 11" (11.1 → 11.6) trong kế hoạch P3C-B: trên `main` sau khi B merge là `.bangiao/archive/p3c-b-chart-<ngày>/ke-hoach.md`; trước đó chỉ ĐỌC `D:\_project\DDC_Control_Tower-B\.bangiao\ke-hoach.md` (không sửa gì trong thư mục B).

**Tóm tắt phạm vi (để ước lượng, không phải chỉ dẫn code):**
1. `git merge main` (xung đột dự kiến ở CUỐI `vi.json`/`en.json`: giữ đủ nhóm của A `manpowerPlan` và của B `equipmentPlanGantt`, `manpowerMonthChart`, `topPriority`…), `npx prisma migrate deploy`, `npm test`. Chạy `src/lib/p3c-contract.test.ts` TRƯỚC khi xoá: phải xanh (4 kiểu trong `types.ts` khớp kiểu B đã dùng).
2. Đổi mọi `from '@/lib/p3c-contract'` → `from '@/server/repo/types'`; xoá `src/lib/p3c-contract.ts` + `p3c-contract.test.ts`.
3. Query: `getEquipmentPlanGantt(projectId, today)` (file mới `src/server/equipment-plan-gantt-queries.ts`), `getManpowerMonthChartData(projectId, locale)` (trong `src/server/manpower-queries.ts`).
4. Trang `app/[locale]/(app)/projects/[id]/page.tsx`: card `#res-shift` dùng `ManpowerMonthChart`, card `#eq-gantt` dùng `EquipmentPlanGantt` (nạp `dynamic`, `ssr: false`), giữ id card.
5. Xoá chart cũ: `ShiftManpowerChart`, `EquipmentGantt`, `src/lib/equipment-gantt.ts`, `src/server/equipment-gantt-queries.ts`, `getShiftChartData`, các hàm `manpower-charts.ts` không còn dùng, `readEquipmentPlans` + `readEquipmentUsageDays` nếu không còn chỗ dùng, `legacyEquipmentPlanFixture` (Task 5), key i18n cũ.
6. Test theo 11.6 của B, gồm e2e `03-project-detail` và kiểm trình duyệt 1440px + 390px.

---

## Trường hợp biên bắt buộc (tổng hợp)

- **T3:** nhãn dài xuống 2 dòng ở 390px không được đẩy `?` sang dòng riêng; ô có dòng gợi ý và ô có dòng lỗi cùng hàng vẫn thẳng đỉnh ô nhập; ô chỉ đọc (Mã master, Giá trị HĐ khi quy đổi) cùng chiều cao; tạo mới mã `M-\d+` (không phân biệt hoa thường) tô đỏ ngay ở client và cả khi server trả `code_reserved`/`code_taken`; gõ lại ô Mã CT xoá lỗi server; action ném lỗi → thông báo `unexpected`, nút lưu mở lại.
- **Migration:** dự án có kế hoạch cũ nhiều chiếc → `totalQty` = số `unitNo` khác nhau; dự án không có kế hoạch → không tạo quota; rollback tách đợt `qty = n` thành n dòng chiếc 1..n; `migrate diff` sau cùng không đề xuất thay đổi (trừ 2 index tạo tay P3A).
- **T4:** đợt kết thúc đúng ngày đợt kia bắt đầu tính chồng 1 ngày; 1 đợt qty > Tổng SL bị báo vượt; nhiều khoảng vượt rời nhau báo từng khoảng; loại có Tổng SL nhưng 0 đợt lưu được; trùng loại thiết bị bị chặn; loại đã ngừng dùng vẫn lưu lại được; lưu lỗi không làm mất dữ liệu cũ (transaction); lưu mảng rỗng xoá sạch kế hoạch của dự án đó thôi; 300 đợt là trần.
- **T5:** tổng 0 → mọi ca 0; tổng lẻ (7 với 60/40 → 4/3) tổng các ca luôn = Tổng; ô sửa tay giữ khi đổi Tổng hoặc %; Tổng < Σ ô sửa tay → lỗi, chặn lưu; mọi ô sửa tay → ô Tổng khoá; % tổng ≠ 100 → không tính lại, chặn lưu; dự án chưa có dòng tỷ lệ → 60/40, lưu giữ 60/40 không ghi audit tỷ lệ; lưu không đổi gì → không ghi DB, không audit; tháng trùng/không hợp lệ bị chặn; tối đa 60 tháng; ca `afternoon` hay mã ca lạ bị server từ chối; tên ca luôn lấy từ `dim_shift`; 390px bảng cuộn ngang.
- **Quyền:** chỉ admin và data-entry được gán dự án (`canWriteProject`); viewer/bod và data-entry dự án khác → `Forbidden` ở cả 2 action.

## TRẢ LỜI CỦA CHỦ DỰ ÁN (2026-09-26)

- **Q1:** chọn **(a)**: bỏ cả "Hạng mục" và "Ghi chú" khỏi form đợt thiết bị, cột DB vẫn giữ. Kế hoạch giữ nguyên như đang viết.
- **Seed:** chủ dự án cho phép chạy `npx prisma db seed` trên `ddc_control_tower` (xoá và nạp lại dữ liệu dev) ở Task 5.
