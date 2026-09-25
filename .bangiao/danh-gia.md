PHAN QUYET: CAN SUA

# Đánh giá cuối P3A: Form Tạo/Sửa dự án (`feature/p3a-form-tao-sua`, so với `main`) — vòng 1

> Reviewer chỉ đọc, ngày 2026-09-25; điều phối viên chép vào file này. Skill: `code-review`.
> Phạm vi: `git diff main...HEAD` (cfc1945..e6a9807, 19 commit, 93 file, +7607/-654), `ke-hoach.md` (ĐÃ CHỐT Q1–Q9 + 11mb),
> `thay-doi.md`, `ket-qua-test.md` (XANH), `danh-gia-bao-mat.md` (ĐẠT), `CLAUDE.md`, `phien-B.md`.

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

**Cổng chung sau vòng sửa:** `npx tsc --noEmit` = 0; `npm test` ≥ 149 file / 1652 test + test mới, toàn bộ xanh; cập nhật `thay-doi.md`
mục "Vòng sửa 1"; không đụng file cấm; trước khi sửa `vi.json`/`en.json`/`actions.ts` đọc `phien-B.md` (hiện B không giữ file nóng).

---

## Để sau (không chặn merge)

- **S-1 (Trung bình): BẮT BUỘC trong danh sách go-live P6.** Chuyển `importExcelAction`/`previewDailyImportAction` sang route handler
  (kiểm auth trước khi đọc body, đếm byte theo stream, 413, rate-limit); rồi trả `bodySizeLimit` về mặc định; reverse proxy
  `client_max_body_size 1m` cho `Next-Action`, chỉ `/api/import*` 11m; sửa chú thích sai `validation.ts:228`; kiểm end-to-end file 12MB, 50MB.
- **S-2:** race đổi/tạo mã CT — advisory lock trong transaction, cân nhắc unique index `lower("currentAliasCode")`, chặn mẫu `^M-\d+$`.
- **S-5 / S-6:** ghi đồng thời — `FOR UPDATE`/advisory lock theo `projectId` ở `replaceEquipmentPlans`/`replaceStageWeights`/`setProjectMember`;
  partial unique index 1 PIC; audit cùng transaction.
- **S-8:** `createProjectAction` chưa atomic — gom `createProjectWithSetup` 1 transaction.
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

1. **Tài chính trên `/ho-so-du-an`.** Theo `phien-B.md`, P3B đang tạm ép data-entry luôn có `canViewFinance=true`, sẽ gỡ khi A chặn màn nhập liệu
   theo `canViewFinance`. Trang `/ho-so-du-an` luôn hiện Giá trị HĐ, nguyên tệ, giá trị phạt cho data-entry. Khi B gỡ ràng buộc đó, data-entry
   không có quyền tài chính có được xem/sửa 3 ô này không? Nếu không, cần 1 task (P3B hoặc phase kế): ẩn/khoá 3 ô + chặn ở server trong
   `updateProjectAction`/`createProjectAction`.
2. **S-2/S-6 cần migration mới** (unique index mã CT, partial unique 1 PIC). Làm ở phase nào? Bên giữ `schema.prisma` mới được tạo migration.

---
Kết luận: nền tảng P3A tốt, đúng quyết định đã chốt, test có giá trị. Còn 5 mục trên, nhỏ và gọn trong file P3A. Coder sửa xong, cổng xanh thì CHỐT được.
