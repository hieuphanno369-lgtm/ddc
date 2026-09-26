PHAN QUYET: CHOT

# Đánh giá cuối P3A: Form Tạo/Sửa dự án (`feature/p3a-form-tao-sua`, so với `main`) — vòng 1

> Reviewer chỉ đọc, ngày 2026-09-25; điều phối viên chép vào file này. Skill: `code-review`.
> Phạm vi: `git diff main...HEAD` (cfc1945..e6a9807, 19 commit, 93 file, +7607/-654), `ke-hoach.md` (ĐÃ CHỐT Q1–Q9 + 11mb),
> `thay-doi.md`, `ket-qua-test.md` (XANH), `danh-gia-bao-mat.md` (ĐẠT), `CLAUDE.md`, `phien-B.md`.

## Quyết định mới của chủ dự án (2026-09-25, chủ dự án xác nhận trực tiếp với điều phối viên)

- **QĐ-10:** data-entry được xem và sửa Giá trị HĐ, nguyên tệ, giá trị phạt ở `/ho-so-du-an` **kể cả khi không có `canViewFinance`**. `/ho-so-du-an`, `createProjectAction`, `updateProjectAction` KHÔNG chặn theo `canViewFinance`. Nhóm tài chính bị che (doanh thu/chi phí/công nợ) không gồm 3 trường này. Báo B qua `phien-A.md`. Mục 3 (S-3) VẪN sửa: rủi ro là máy dùng chung, F6 đã chốt nháp không chứa số tiền.
- **QĐ-11:** migration S-2 (mã CT không trùng) + S-6 (tối đa 1 PIC/dự án) **làm ngay trong P3A** → mục 6, 7 dưới đây (chuyển khỏi "Để sau").

## Cổng kiểm reviewer tự chạy lại

- PowerShell `D:\_project\DDC_Control_Tower`: `npx tsc --noEmit` = 0; `npm test` = **149 file / 1652 test pass** (khớp Tester).
- Không đụng file cấm: `PROGRESS.md`, `.serena/`, `app/globals.css`, `queries.ts`, `project-queries.ts`, `admin/page.tsx`, `notify_*`, `read-mock.ts`, `read-prisma.ts`.
- `main` đã tới `d50db4c` (P2B T1). Tập file nhánh này và main sửa từ `cfc1945` **không trùng** → merge không xung đột file.

## 1. Code khớp kế hoạch?

Khớp phần lớn: Q1 (đúng từng số, 9 loại), Q2 (nguyên văn), Q3 (chỉ admin; PIC data-entry, Backup data-entry/viewer; `pic_exists`),
Q4 (đóng hôm nay/mở ngày mai; đổi lần 2 sửa dòng chờ; so không phân biệt hoa thường), Q5 (`needsReview`, duyệt, gộp bỏ cờ),
Q7 (một chỗ sửa hồ sơ, đã xoá `CreateProjectForm`), Q8 (không tính lại tháng đã lưu, có test thật), Q9 (không làm), 11mb.
Repo mock/prisma cùng tên hàm + tham số, gộp spread. Bảng cấu hình thay trong 1 transaction có audit; đổi mã chụp `project_history`.
Authz đúng mọi action mới, trang tự kiểm role. i18n nhóm riêng cuối file, vi/en đủ. Migration + rollback + `docs.ts` + ERD cập nhật.

Lệch: **Q6 chưa trọn** (server không ép VIẾT HOA — mục 4); **clock ảo** — dòng alias tạo cùng dự án dùng giờ thật (mục 1).

## 2. Test có giá trị thật?

Có: 5 ca quyền cho action; authz tích hợp (gỡ PIC mất quyền ghi); chống IDOR SAP/`workItemId`; `"1/"` vs `"11/"`; Q8 so `pctActual`;
không mất dữ liệu khi payload thiết bị sai; biên 10MB zod; smoke Playwright + đọc DB thật.
Yếu: `SettingsMenu.test.ts` chỉ đọc mã nguồn; không có test "tạo dự án có mã CT rồi đổi mã" dưới clock ảo (chính là lỗi mục 1);
luồng lưu SỬA nhiều phần trên UI chỉ kiểm bằng mắt.

## 3. Bảo mật, hiệu năng, đúng đắn

Không lỗ hổng mức Cao. S-1 (Trung bình) là hạ tầng, không chặn merge nhưng **bắt buộc ở P6**. 2 lỗi đúng đắn reviewer tự tìm (mục 1, 2).
Trong lỗi Thấp, **S-3, S-4, S-7 vá ngay vòng này** (dễ, gọn trong file P3A, đóng F6/Q6/Q7). Hiệu năng: không vấn đề mới.

---

## CẦN SỬA TRƯỚC KHI CHỐT

### 1. Dòng alias tạo cùng dự án dùng giờ thật, không dùng `todayIso()`

- **Vị trí:** `src/server/repo/mock-repo.ts:891` (`effectiveFrom: now`, `now = new Date().toISOString()`); `src/server/repo/prisma-repo.ts:1072` (`effectiveFrom: p.createdAt`).
- **Vấn đề:** vi phạm Global Constraint 4 (Task 4 ghi `effectiveFrom: todayIso()`). Khi có `DDC_FAKE_TODAY`, ngày thật > hôm nay ảo →
  `planAliasChange` (`src/lib/project-code.ts:106`) coi dòng mã-lúc-tạo là "dòng chờ", đi nhánh retype → mã CT lúc tạo bị **ghi đè**
  thay vì đóng, mất lịch sử (trái append-only). Mock còn lưu timestamp trong khi dòng khác là `YYYY-MM-DD`.
- **Cách sửa:** mock `effectiveFrom: todayIso()` (import `@/lib/clock`); prisma `effectiveFrom: new Date(\`${todayIso()}T00:00:00Z\`)`.
  Thêm ca vào `src/server/repo/form.test.ts`: tạo dự án `currentAliasCode: 'CT-TAO-1'` → `changeProjectCode(id, 'CT-TAO-2', …, todayIso())`
  → 2 dòng: `CT-TAO-1` `effectiveFrom === '2026-09-16'` và `effectiveTo === '2026-09-16'`; `CT-TAO-2` `effectiveFrom === '2026-09-17'`.
- **Xong khi:** ca mới xanh; `prisma-repo-form.test.ts` / `form.test.ts` vẫn xanh.

### 2. ProjectForm (SỬA) không chặn client khi đổi mã CT thiếu lý do / xoá trống mã → lưu dở

- **Vị trí:** `src/components/form/ProjectForm.tsx:227-257` (`handleSaveEdit`), `:389-393` (ô lý do); `src/lib/project-form.ts:177-230` (`validateProjectForm` không biết lý do đổi mã).
- **Vấn đề:** Task 8 ghi lý do "bắt buộc ≥ 5" nhưng client không kiểm. Sửa tên + đổi mã + bỏ trống lý do (hoặc xoá trống Mã CT) → Lưu →
  `updateProjectAction` **đã ghi hồ sơ**, rồi `changeProjectCodeAction` mới trả `Invalid input`. UI hiện `err.partial` + chuỗi thô "Invalid input" (thiếu key).
- **Cách sửa:** thêm hàm thuần `validateAliasChange(base: ProjectFormState, f: ProjectFormState, reason: string): 'required' | 'reason_short' | 'code_invalid' | null`
  vào `src/lib/project-form.ts` (mã đổi mà trim rỗng → `required`; mã không hợp lệ → `code_invalid`; `reason.trim().length < 5` → `reason_short`;
  mã không đổi → `null`). Gọi trong `handleSaveEdit` **trước mọi action**; lỗi thì hiện `err.invalid`, tô đỏ, cuộn tới `data-field="aliasReason"` /
  `data-field="currentAliasCode"`, không gọi action nào. Thêm key `projectForm.err.reason_short` vi/en trong nhóm `projectForm.err`
  (dùng văn bản `field.aliasReasonHint`). Map lỗi `'Invalid input'` sang `projectForm.err.invalid` ở cả 4 nhánh `err.partial`.
- **Xong khi:** `project-form.test.ts` có 4 ca `validateAliasChange` (không đổi, rỗng, lý do 4 ký tự, hợp lệ); `messages.test.ts` xanh.

### 3. (S-3) Nháp `ProjectForm` còn lưu số tài chính và không dọn nháp của người khác

- **Vị trí:** `src/lib/project-draft.ts:21-25` (`PROJECT_FORM_STRING_KEYS` có `contractValue`, `contractValueOriginal`, `penaltyValue`);
  `src/components/form/ProjectForm.tsx:117-127`, `:146-165` (ghi nguyên `form`), `:132-140` (không gọi `purgeForeignDrafts`);
  `.bangiao/thay-doi.md:103-104` (câu sai với ProjectForm).
- **Vấn đề:** F6 yêu cầu nháp không chứa số tài chính; giá trị HĐ/phạt thuộc nhóm che theo `canViewFinance`; máy dùng chung đọc được qua DevTools.
- **Cách sửa:** thêm `export function toProjectDraftForm(f: ProjectFormState): Omit<ProjectFormState, 'contractValue' | 'contractValueOriginal' | 'penaltyValue'>`
  vào `project-draft.ts`; đổi `ProjectDraft.form` sang kiểu đó, dùng ở cả 2 chỗ ghi nháp; bỏ 3 key khỏi `PROJECT_FORM_STRING_KEYS`
  (để `restoreProjectDraft` giữ giá trị `base`); trong `useEffect` mount (`ProjectForm.tsx:132`) gọi `purgeForeignDrafts(localStorage, ownerTag)`
  trước `checkProjectDraft`, bọc `try/catch`; sửa `thay-doi.md:103-104` thành "DataEntryForm: chỉ 6 field tiến độ; ProjectForm: hồ sơ trừ giá trị HĐ/nguyên tệ/phạt".
- **Xong khi:** `project-draft.test.ts` có ca `JSON.stringify(toProjectDraftForm(form))` không chứa `contractValue`/`penaltyValue`/`contractValueOriginal`;
  có ca `restoreProjectDraft` với JSON chèn `contractValue: '999'` vẫn giữ giá trị base.

### 4. (S-7) Server chưa ép VIẾT HOA tên (Q6), chưa kiểm CĐT/team còn hiệu lực

- **Vị trí:** `src/server/validation.ts:110` (`PROFILE_SHAPE.projectName`), `:158` (`createProjectSchema.projectName`);
  `src/server/actions.ts:222-235` (`createProjectAction`); `src/server/actions-project.ts:62-65` (`updateProjectAction`);
  test cần lật `src/server/actions-project.qa.test.ts:69-74`.
- **Vấn đề:** gọi action trực tiếp lưu được tên chữ thường (trái Q6); `customerId`/`teamKdId` không tồn tại → FK 500; CĐT đã gộp vẫn gán được.
- **Cách sửa:** (a) `projectName` ở 2 schema → `z.string().trim().min(1).max(PROJECT_NAME_MAX).transform((s) => s.toUpperCase())`
  (cùng `toUpperCase()` như client; `checkProfileRules` giữ nguyên). (b) Trong 2 action lấy `getDims()` (gộp với lần kiểm factory đã có);
  `customerId` có trong input/patch mà không thoả `dims.customers.some(c => c.id === id && c.isActive && c.mergedIntoId == null)` → `invalid_customer`;
  tương tự team → `invalid_team`; thêm key `projectForm.err.invalid_customer` / `invalid_team` vi/en. Lật test QA `actions-project.qa.test.ts:69-74`
  thành: gửi `'ten du an chu thuong qa'` → lưu `'TEN DU AN CHU THUONG QA'`.
- **Xong khi:** test đã lật xanh; ca `updateProjectAction(1, { customerId: 999999 })` → `invalid_customer`; ca `createProjectAction` với CĐT đã gộp → `invalid_customer`.

### 5. (S-4) `saveMonthlyData` vẫn nhận ngày sai định dạng và tên không giới hạn

- **Vị trí:** `src/server/validation.ts:27` (`nullableDate = z.string()…`), `:69` (`projectName: z.string().optional()`), `:78-83`.
- **Vấn đề:** gọi action trực tiếp vẫn sửa hồ sơ; `'abc'` tới `new Date()` → Prisma 500 hoặc ngày sai; lệch "một bộ luật" của Q7.
- **Cách sửa:** `nullableDate` → `isoDate.nullable().optional()`; `projectName` trong `saveMonthlyDataSchema` →
  `z.string().trim().min(1).max(PROJECT_NAME_MAX).transform((s) => s.toUpperCase()).optional()`. KHÔNG gỡ field hồ sơ khỏi schema (tránh vỡ test cũ).
- **Xong khi:** ca `saveMonthlyData(1, '2026-09', { plannedFinishDate: 'abc' })` → `ok: false`, dự án không đổi; `actions.test.ts` / `actions-security.test.ts` vẫn xanh.

### 6. (S-2, QĐ-11) Mã CT không trùng: migration + khoá + bắt xung đột

- **Vị trí:** migration mới `prisma/migrations/20260925110000_p3a_unique_code_pic/migration.sql` + rollback
  `prisma/rollback/20260925110000_p3a_unique_code_pic.down.sql` (A giữ schema/migrations — ghi "Đang giữ" phien-A.md);
  `src/server/repo/prisma-repo-form.ts:31-104` (`isProjectCodeTaken`, `changeProjectCode`); `src/server/repo/prisma-repo.ts:1029-1080`
  (`createProject`); `src/server/actions-project.ts:92-95`; `src/server/actions.ts:225-227`.
- **Cách sửa:**
  (a) Migration (comment không dấu, `BEGIN/COMMIT`): đầu file `DO $$ … RAISE EXCEPTION` nếu
  `SELECT lower("currentAliasCode") FROM "dim_project" GROUP BY 1 HAVING count(*) > 1` có dòng (hiện 0);
  `CREATE UNIQUE INDEX "dim_project_currentAliasCode_lower_key" ON "dim_project" (lower("currentAliasCode"));`
  (b) Prisma 6 không biểu diễn index biểu thức: ghi comment `/// index lower(currentAliasCode) UNIQUE tao bang SQL tay o migration 20260925110000`
  trên field trong `schema.prisma`; chạy `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <db tam>`,
  ghi vào `thay-doi.md` diff có đề xuất DROP index không; nếu có thì ghi cảnh báo "không chạy `migrate dev` tự sinh, chỉ `migrate deploy`" ở `thay-doi.md` + đầu file migration.
  (c) Index chỉ phủ `currentAliasCode`; còn chống trùng `masterCode` + alias cũ: trong `changeProjectCode` (prisma) đầu `$transaction`
  `await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(lower(${newCode})))\``, rồi kiểm lại trùng **bằng `tx`** (tách thân
  `isProjectCodeTaken` thành helper nhận `client`); trùng → trả `'taken'` (kiểu trả `'changed' | 'unchanged' | 'not_found' | 'taken'` ở mock, prisma, types).
  `createProject` có `currentAliasCode` → cùng khoá + kiểm lại trong 1 `$transaction` (gom `project.create` + `update` + `projectAlias.create`).
  (d) Bắt `Prisma.PrismaClientKnownRequestError` `code === 'P2002'` ở `changeProjectCode`/`createProject` → `'taken'`; action map `'taken'` → `code_taken`;
  `createProject` báo lỗi đồng bộ mock/prisma (vd `{ error: 'code_taken' }` hoặc lỗi riêng action bắt).
  (e) Chặn mẫu `^M-\d+$` trong `isValidProjectCode` (`src/lib/project-code.ts:75`) — trừ khi trùng `masterCode` của chính dự án; kiểm ở
  `changeProjectCodeAction` (schema giữ regex cũ); thêm key `projectForm.err.code_reserved` vi/en.
  (f) Mock `changeProjectCode`/`createProject` tự kiểm trùng như trên, trả `'taken'`.
  (g) Rollback: dòng đầu "revert code truoc"; `DROP INDEX IF EXISTS "dim_project_currentAliasCode_lower_key";` + xoá dòng `_prisma_migrations` (khuôn file down P3A đầu).
  (h) `src/lib/schema-meta/docs.ts`: `currentAliasCode` "duy nhất, không phân biệt hoa thường"; `npm run docs:erd` nếu ERD đổi.
- **Xong khi:** `npx prisma migrate deploy` chạy được trên `ddc_control_tower`; rollback rồi deploy lại vẫn được (ghi `thay-doi.md`); `migrate status` up to date.
  `prisma-repo-form.test.ts`: `changeProjectCode` gọi `$executeRaw` (khoá) trong transaction; `tx` kiểm trùng true → `'taken'`, không gọi `projectAlias.create`;
  P2002 giả lập → `'taken'`. `form.test.ts` (mock) ca trùng → `'taken'`. `actions-project.test.ts`: `changeProjectCodeAction(1, 'M-00099', …)` → `code_reserved`.

### 7. (S-6, QĐ-11) Tối đa 1 PIC/dự án: partial unique index + audit cùng transaction

- **Vị trí:** cùng migration mục 6; `src/server/repo/prisma-repo-form.ts:153-175` (`setProjectMember`, `removeProjectMember`);
  `src/server/actions-project.ts:164-171`; `src/server/repo/mock-repo-form.ts` (`setProjectMember`).
- **Cách sửa:**
  (a) Migration: `DO $$ … RAISE EXCEPTION` nếu `SELECT "projectId" FROM "project_assignments" WHERE "roleInProject"='PIC' GROUP BY 1 HAVING count(*)>1`
  có dòng (hiện 0); `CREATE UNIQUE INDEX "project_assignments_one_pic_key" ON "project_assignments" ("projectId") WHERE "roleInProject" = 'PIC';`
  rollback thêm `DROP INDEX IF EXISTS "project_assignments_one_pic_key";`; comment tương tự 6(b) ở model `ProjectAssignment`.
  (b) Prisma `setProjectMember`: gói `findUnique` + `update`/`create` + `audit(tx, …)` vào 1 `prisma.$transaction`; `roleInProject === 'PIC'` thì kiểm
  trong `tx` đã có PIC khác chưa; bắt P2002 → `'pic_exists'` (kiểu trả `'added' | 'changed' | 'unchanged' | 'pic_exists'` ở mock, prisma, mọi chỗ gọi). Mock kiểm tương tự.
  (c) `removeProjectMember` (prisma): `delete` + `audit(tx, …)` 1 transaction.
  (d) `setProjectMemberAction` giữ kiểm trước (lỗi thân thiện), map `'pic_exists'` từ repo → `{ ok: false, error: 'pic_exists' }`.
  (e) Seed I-2 (admin@ PIC 11 dự án) mỗi dự án 1 PIC → không vi phạm; không sửa seed.
  (f) `docs.ts`: `project_assignments.roleInProject` "tối đa 1 PIC mỗi dự án - partial unique index".
- **Xong khi:** `prisma-repo-form.test.ts`: `setProjectMember` chạy trong `$transaction`, gọi `auditLog.create`; P2002 giả lập → `'pic_exists'`.
  `form.test.ts`: đổi ca `'pic trung khong bi chan o tang repo'` (`form.test.ts:393-397`) thành kỳ vọng `'pic_exists'`, vẫn 1 PIC — ghi trong
  `thay-doi.md` là **đổi ý định có chủ đích** theo QĐ-11. `actions-members.test.ts` / `.qa.test.ts` vẫn xanh. Kiểm `mcp__postgres`: 2 index có mặt.

**Cổng chung sau vòng sửa:** `npx tsc --noEmit` = 0; `npm test` ≥ 149 file / 1652 test + test mới, toàn bộ xanh; `npm run check:read` OK;
`npx prisma migrate status` up to date; build kiểm compile (font mock); cập nhật `thay-doi.md` mục "Vòng sửa 1" (ghi QĐ-10, QĐ-11); không đụng
file cấm; trước khi sửa `vi.json`/`en.json`/`actions.ts`/`prisma-repo.ts`/`schema.prisma`/`migrations` đọc `phien-B.md` rồi ghi "Đang giữ" `phien-A.md`.
Có migration mới → ghi trong `phien-A.md`: **B phải `npx prisma migrate deploy` sau khi merge main**. Mục 6, 7 đụng dữ liệu + đồng thời →
sau vòng sửa **gửi lại security-reviewer** rà S-2/S-6 trước khi reviewer CHỐT.

---

## Để sau (không chặn merge)

- **S-1 (Trung bình): BẮT BUỘC trong danh sách go-live P6.** Chuyển `importExcelAction`/`previewDailyImportAction` sang route handler
  (kiểm auth trước khi đọc body, đếm byte theo stream, 413, rate-limit); rồi trả `bodySizeLimit` về mặc định; reverse proxy
  `client_max_body_size 1m` cho `Next-Action`, chỉ `/api/import*` 11m; sửa chú thích sai `validation.ts:228`; kiểm end-to-end file 12MB, 50MB.
- **S-5:** ghi đồng thời kế hoạch thiết bị — advisory lock/`FOR UPDATE` theo `projectId` ở `replaceEquipmentPlans`; bắt P2002 ở `replaceStageWeights`. (S-2, S-6 đã chuyển lên mục 6, 7 theo QĐ-11.)
- **S-8:** `createProjectAction` chưa atomic — mục 6 chỉ gom tạo dự án + alias; phần gán PIC/trọng số/mốc gom `createProjectWithSetup` sau.
- **S-9:** dòng đầu file down migration "revert code trước, rồi mới chạy file này"; xuất danh sách CĐT `needsReview` trước rollback.
- **Nhãn Giá trị HĐ khi đang quy đổi:** ô chỉ-đọc hiện số tính lại theo tỷ giá hiện tại, có thể lệch số đã chốt nếu admin sửa tỷ giá tháng đó;
  nên hiện `project.contractValue` khi không đụng các trường G-7.
- **Khôi phục nháp:** `stageWeights`/`keyMilestones` của nháp chưa kiểm kiểu (server validate lại nên không nguy hiểm).
- **`/ho-so-du-an?project=`** (rỗng) ra 404 thay vì chế độ tạo mới — lỗi nhỏ.
- **`DataEntryForm`** còn 5 prop không dùng (`customers`/`teams`/`currencies`/`factories`/`today`) — dọn phase sau.
- **`SettingsMenu.test.ts`** chỉ đọc mã nguồn — thay bằng e2e bấm Đăng xuất khi có Playwright ở CI.
- **Dữ liệu dev:** I-2 seed gán `admin@` làm PIC 11 dự án (gán PIC data-entry báo `pic_exists`); I-3 xoá dự án QA id=18 trong `ddc_control_tower` trước demo.
- **Quy trình merge (CLAUDE.md mục 4, 5):** chuyển `.bangiao/*.md` + `anh-test/` vào `.bangiao/archive/p3a-form-tao-sua-2026-09-25/`;
  `git merge main` (main đã tới `d50db4c`, không trùng file), chạy lại `tsc` + `npm test`; chỉ cập nhật `PROGRESS.md`/`.serena` trong lượt merge.

## Câu hỏi cho chủ dự án

Hai câu ở bản trước đã được chủ dự án trả lời (QĐ-10, QĐ-11). Không còn câu hỏi bỏ ngỏ chặn vòng sửa này.

---
Kết luận: mục 1–5 nhỏ, gọn trong file P3A; mục 6–7 (QĐ-11) có migration mới, cần security-reviewer rà lại. Cổng xanh + security ĐẠT thì CHỐT được.

## Vòng 2 (sau vòng sửa 1) - 2026-09-26

> Reviewer chỉ đọc, 2026-09-26, skill `ddc-tower:code-review`; điều phối viên chép vào file này.
> Phạm vi: `git diff 4e00517..HEAD` (vòng sửa 1 `e1f747a`..`a2cc2ea`, vá bảo mật `e1fcbd1`, `5a13fc3`).

**Kết luận: CHỐT**

- Cổng reviewer tự chạy: `tsc` exit 0; `npm test` 156 file / 1731 test; `check:read` 18/18 OK; `migrate status` up to date (8 migration); `pg_indexes` có đủ `dim_project_currentAliasCode_lower_key` và `project_assignments_one_pic_key`.
- Đọc code cả 7 mục CẦN SỬA: 1 alias `todayIso()`, 2 `validateAliasChange`, 3 nháp bỏ số tài chính, 4 VIẾT HOA + `invalid_customer/invalid_team`, 5 `saveMonthlyData` đọc `parsed.data.patch` (vá thêm lỗi thật: trước đây destructure từ input thô), 6 mã CT không trùng (khoá advisory chung, kiểm lại bằng `tx`, `code_reserved` ở cả tạo và đổi), 7 tối đa 1 PIC (partial index, transaction + audit): **cả 7 ĐÓNG**.
- F-1, N-1, I-1, I-2 đúng. Test có giá trị thật; còn yếu: chưa có test tích hợp race thật 2 kết nối Postgres (không chặn).
- Bắt buộc ở bước merge: `main` = `2034548` (P3B); `git merge-tree` báo xung đột ở `vi.json`, `en.json`, `mock-repo.ts`; `main` không có migration mới. Sau merge chạy lại `tsc`, `npm test`, `check:read`. Báo B `migrate deploy` migration `20260925110000_p3a_unique_code_pic`.

### Để sau (không chặn)

- **I-1 ngữ nghĩa:** 2 admin cùng thêm 1 người với vai khác nhau thì bên thua nhận `'unchanged'` sai. → **ĐÃ SỬA** sau vòng 2: đọc lại dòng, chỉ `'unchanged'` khi cùng vai, khác vai ném lỗi gốc.
- **N-2:** nháp cũ v1 còn 3 trường tài chính. → **ĐÃ SỬA** sau vòng 2: `PROJECT_DRAFT_VERSION` = 2, nháp v1 bị bỏ.
- `handleSaveNew` (`ProjectForm.tsx:215-241`) chỉ có `try/finally`, lỗi khác mã CT không có thông báo; tạo mới với mã `M-\d+` chỉ báo lỗi chung, không tô đỏ ô Mã CT: để P3C-A.
- Nâng Prisma: chạy lại `migrate diff` để chắc không có đề xuất `DROP INDEX` cho 2 index tạo tay.
- Các mục "Để sau" của vòng 1 giữ nguyên, **S-1 bắt buộc ở P6**, cùng S-5, S-8, S-9, dữ liệu dev I-2/I-3.
