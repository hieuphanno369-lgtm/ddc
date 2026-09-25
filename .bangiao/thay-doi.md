# P3A — Form Tạo/Sửa dự án — Tóm tắt thay đổi (cho Tester)

Nhánh `feature/p3a-form-tao-sua`, 14 commit (Task 1–14), không merge/push. `npx tsc --noEmit` sạch,
`npm test` = **139 file / 1588 test xanh** (mốc trước P3A: 119/1378 — không tụt). `npm run check:read` OK.
`npx prisma migrate status` up to date. `npm run build` (với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`) qua —
compile + generate 3 trang tĩnh thành công. `git diff main...HEAD --stat` xác nhận KHÔNG đụng
`PROGRESS.md`, `.serena/`, `app/globals.css`, `notify_*`, `app/[locale]/(app)/admin/page.tsx`,
`queries.ts`, `project-queries.ts`.

## Task 1 — Migration `dim_customer` (G-5 nền)
- `prisma/schema.prisma`, `prisma/migrations/20260925100000_p3a_customer_review/`,
  `prisma/rollback/20260925100000_p3a_customer_review.down.sql`: thêm `needsReview boolean`,
  `createdBy string` vào `dim_customer`.
- `src/server/repo/types.ts` (`Customer`), `src/data/seed/dims.ts`, `src/data/seed/history.ts`
  (`SEED_VERSION` bump), `src/lib/schema-meta/docs.ts` (+ `npm run docs:erd` sinh lại
  `docs/DATA_WAREHOUSE_README.md`), `prisma-repo.ts`/`mock-repo.ts` (`getDims`, `getDimFieldValues`),
  `FieldEditor.tsx` (`DimValueRow.needsReview`).
- Đã kiểm rollback → deploy lại trên DB thật (`ddc_control_tower`), round-trip OK.

## Task 2 — Ghi chú "tối đa 10MB" + `bodySizeLimit: '11mb'`
- `src/lib/import-limits.ts` mới (`IMPORT_MAX_MB=10`, `isImportTooBig`). `validation.ts` re-export
  `IMPORT_MAX_BYTES` từ đây (giá trị không đổi).
- `ImportPanel.tsx`, `DailyImportBlock.tsx`: thêm dòng ghi chú + chặn client trước khi gọi action khi
  file > 10MB.
- **`next.config.mjs`: `experimental.serverActions.bodySizeLimit: '11mb'`** — nới giới hạn body cho
  **MỌI** server action (không chỉ import). **Tester/Security cần soi**: reverse proxy ở P6 cũng phải
  cho phép body ≥ 11MB, nếu không sẽ bị chặn trước khi tới Next.js.

## Task 3 — Luật thuần (chuỗi ngày, quy đổi nguyên tệ, mã CT, luật hồ sơ server)
- `src/lib/project-form.ts` (mới, phần luật): `checkDateChain`, `dateInput`.
- `src/lib/project-code.ts` (mới): `isValidProjectCode`, `planAliasChange`.
- `src/server/project-profile-rules.ts` (mới): `checkProfileRules` — nguồn luật DUY NHẤT dùng chung
  cho `createProjectAction`, `updateProjectAction`, `saveMonthlyData`.
- `src/lib/fx.ts` thêm `findMonthRate`, `toVndBillion`.
- **Lưu ý cho Tester**: kế hoạch ghi ví dụ `toVndBillion(1_000_000, 25400) === 0.0254`, nhưng theo đúng
  công thức trong kế hoạch (`Math.round(original*rate/1e9*1e6)/1e6`) thì `1_000_000 × 25400` phải ra
  **25.4** (tỷ VNĐ) chứ không phải 0.0254 — khớp thực tế nghiệp vụ (seed contractValue 18–1743 tỷ).
  Tôi đã cài **đúng công thức đó** và sửa số trong ví dụ test thành `toVndBillion(1_000, 25400) === 0.0254`
  (rõ ràng là lỗi đánh máy thiếu `_000` trong bản kế hoạch, không phải đổi công thức). Soi kỹ
  `src/lib/fx.ts` + `src/lib/fx.test.ts` + `src/server/project-profile-rules.test.ts` (case USD 1_000).

## Task 4 — Repo lớp form (mock + prisma)
- `src/server/repo/mock-repo-form.ts`, `src/server/repo/prisma-repo-form.ts` (mới): `isProjectCodeTaken`,
  `changeProjectCode`, `replaceStageWeights`, `removeSapCode`, `getProjectMembers`, `setProjectMember`,
  `removeProjectMember`, `approveCustomer`, `readProjectAuditTrail`.
- Sửa tại chỗ: `createProject` (mock + prisma) nhận đủ field hồ sơ mới + `currentAliasCode` tùy chọn
  (chèn dòng alias khi tạo); `addAssignment` (mock) đổi thành upsert khớp prisma; `createDimValue`
  nhận `opts.needsReview/opts.by`; `mergeDimValue` (customer) reset cờ `needsReview` của bản ghi nguồn.
- **`changeProjectCode` chạy trong 1 transaction** (đóng dòng alias cũ, mở dòng mới từ ngày mai, chụp
  `project_history`, ghi audit `dim_project_alias`) — test `prisma-repo-form.test.ts` xác nhận
  `$transaction` + `auditLog.create` được gọi.

## Task 5 — Action hồ sơ dự án
- `src/server/actions-project.ts` (mới): `updateProjectAction`, `changeProjectCodeAction`,
  `saveStageWeightsAction`, `removeSapCodeAction`.
- `validation.ts`: `stageWeightRowsSchema`, `updateProjectSchema` (`.strict()` — key lạ bị chặn),
  `projectCodeSchema`, `removeSapSchema`; `createProjectSchema` đổi **bắt buộc**: `tonnage`,
  `plannedStartDate`, `plannedFinishDate`, `committedHandoverDate` (trước đây tùy chọn). **Đã cập nhật
  2 test cũ trong `validation.test.ts`** phản ánh hành vi mới (không còn cho tạo dự án thiếu 4 trường
  này) — soi kỹ để chắc đây đúng là ý định P3A, không phải hồi quy.
- `actions.ts`: `createProjectAction` chạy qua `checkProfileRules` + hỗ trợ `stageWeights`/
  `currentAliasCode`; `saveMonthlyData` chạy `checkProfileRules` trên `profilePatch` trước khi ghi.

## Task 6 — PIC/Backup (G-17) + duyệt chủ đầu tư (G-5)
- **Authz quan trọng — soi kỹ**: `setProjectMemberAction`/`removeProjectMemberAction`/
  `approveCustomerAction` dùng `requireRoleUser(['admin'])` — **CHỈ admin** được gán/gỡ PIC/Backup hoặc
  duyệt chủ đầu tư, đúng chốt Q3. `setProjectMemberAction` chặn: PIC phải là tài khoản `data-entry`
  đang hoạt động (`role_not_allowed`), Backup là `data-entry`/`viewer`; gán PIC thứ 2 → `pic_exists`.
  `createDimValueAction('customer', …)` gắn `needsReview = (role !== 'admin')`.
- `actions-members.test.ts` (mới) kiểm cả tích hợp: gỡ PIC → mất quyền ghi (`saveKeyMilestonesAction`
  → Forbidden); gán Backup → có quyền ghi/đọc (`requireProjectRead` không `notFound`, `canWriteProject`
  vẫn `false` cho viewer).

## Task 7 — UI dùng chung
- `src/components/ui/Switch.tsx`, `src/components/form/StageWeightEditor.tsx`,
  `src/components/project/ProjectAuditCard.tsx` (mới) — đều có test riêng.

## Task 8 — Trang `/ho-so-du-an` + `ProjectForm` 6 mục
- `app/[locale]/(app)/ho-so-du-an/page.tsx`, `src/components/form/ProjectForm.tsx`,
  `src/components/form/ProjectLinksSection.tsx` (mới, ~600 dòng). `src/lib/project-form.ts` bổ sung
  toàn bộ state/validate/build cho form (19 field đếm, `validateProjectForm`, `fxPreview`,
  `buildCreateInput`, `buildUpdatePatch`).
- Guard trang: admin thấy mọi dự án, data-entry chỉ thấy dự án được gán; `?project=<id>` không thuộc
  quyền → `notFound()`; `assignableUsers` (danh sách để admin gán PIC/Backup) **không** chứa
  `passwordHash` — test `ho-so-du-an-page-guard.test.ts` xác nhận.
- 5 key `projectForm.tip.*` (HelpTip cho 5 ô ngày/phạt) **cố ý để trống ở Task 8**, thêm đúng ở Task 14
  theo đúng ranh giới kế hoạch.

## Task 9 — Gỡ form tạo cũ, nối điều hướng (Q7)
- Xoá `src/components/form/CreateProjectForm.tsx`. `DataEntryForm.tsx`: bước "Hồ sơ" chỉ còn thẻ dẫn
  sang `/ho-so-du-an?project=ID`; bỏ toàn bộ state/luồng lưu mốc chính, luật `committedRequired`, khối
  Lịch sử mã + SAP trong bước "Ảnh hiện trường".
- **Đã dọn thêm ngoài 3 prop kế hoạch nêu tên (`aliases`/`sapCodes`/`keyMilestones`)**: giữ nguyên
  `customers`/`teams`/`currencies`/`factories`/`today` trong `Props` của `DataEntryForm` dù không còn
  dùng trực tiếp trong JSX (kế hoạch không yêu cầu xoá 5 prop này nên tôi giữ nguyên, tránh vượt phạm
  vi) — nếu muốn dọn tiếp thì để phase sau.
- `AppShell.tsx` thêm mục sidebar "Tạo / Sửa dự án"; `middleware.ts` thêm `/ho-so-du-an` vào
  `DENIED.viewer`/`DENIED.bod`. Link "Sửa mốc" ở `/projects/[id]` trỏ sang
  `/ho-so-du-an?project=ID#key-milestones`.

## Task 10 — F6 bản nháp an toàn + xoá khi đăng xuất
- `src/lib/drafts.ts`, `src/lib/project-draft.ts` (mới). `dataEntryState.ts`: `DRAFT_VERSION` 2→3,
  `DRAFT_FIELDS` chỉ còn `pctPlan/ac/equipmentActual/volumeTonnage/stagePct/stageApplicable` —
  **số tài chính và toàn bộ hồ sơ KHÔNG BAO GIỜ vào localStorage nữa**. `draftKey` đổi chữ ký, gắn
  thêm `ownerTag` (băm FNV-1a từ email) vào khoá localStorage.
- `restoreDraft`/`restoreProjectDraft` chỉ áp field khai báo, bỏ key lạ trong JSON (chống dữ liệu cũ/
  bị chỉnh tay chèn field tài chính).
- **Task 10 - Tester soi kỹ**: `SettingsMenu.tsx`/`ChangePasswordModal.tsx` gọi
  `clearDraftsOnLogout(window.localStorage)` (từ `src/lib/drafts.ts`) trước `signOut`. Do Vitest chạy
  env `node` (không DOM, không cài `jsdom`/`react-test-renderer`), tôi **không click được nút thật**
  trong test tự động — `SettingsMenu.test.ts` verify bằng cách soi mã nguồn (đọc file, kiểm thứ tự gọi
  `clearDraftsOnLogout` trước `signOut` trong hàm `logout()`) thay vì giả lập click. Đề nghị Tester bấm
  "Đăng xuất" thật (Playwright/thủ công), kiểm DevTools Application không còn key `ddc_draft_`/
  `ddc_pform_` sau khi đăng xuất, và đăng nhập tài khoản khác không thấy nháp của người trước.
- `ProjectForm.tsx`: banner nháp fresh/stale (không tự áp), nút "Lưu nháp" ghi ngay, lưu thành công thì
  xoá nháp.

## Task 11 — Hàng chờ duyệt chủ đầu tư ở "Sửa danh mục" (G-5)
- `FieldEditor.tsx`: dòng `needsReview` (chỉ field `customer`) hiện đầu danh sách, có chip "Chờ duyệt"
  + nút "Duyệt" (gọi `approveCustomerAction`). Không đổi hành vi Merge.

## Task 12 — Form kế hoạch thiết bị (nguồn Gantt T14)
- `src/lib/equipment-plan.ts` (luật thuần), `src/components/form/EquipmentPlanEditor.tsx` (UI),
  `saveEquipmentPlansAction` (`actions-entry.ts`), `replaceEquipmentPlans` (repo form, transaction).
- Validate: trùng `(equipmentId, unitNo)` có khoảng ngày giao nhau (kể cả chạm mép) → chặn, vì
  `assignUsage` (Gantt) chỉ gán được 1 thanh cho 1 ngày.
- `nhap-lieu/page.tsx`: `EquipmentPlanEditor` đặt CẠNH `ResourceEntryPanel` trong `resourcesPanel`
  (không nằm trong `key={date}` của panel kia) — đã sửa `nhap-lieu-page-guard.test.ts` (2 ca cũ) để đọc
  đúng phần tử đầu tiên trong Fragment mới.

## Task 13 — Bộ trọng số theo loại dự án (G-6, ĐÃ CHỐT)
- `src/lib/stage-weight-presets.ts` (mới), đúng bảng Q1 chủ dự án chốt. `ProjectForm.tsx`: đổi Loại dự
  án lúc **TẠO MỚI** mà chưa tự sửa trọng số tay → tự điền lại bảng; chế độ **SỬA** không tự đổi.

## Task 14 — Tooltip 5 ô ngày/phạt (G-14, ĐÃ CHỐT)
- Thêm `projectForm.tip.*` (5 key, đúng nguyên văn Q2 đã chốt) + gắn `HelpTip` vào 5 ô trong
  `ProjectForm.tsx` mục 3.

## Rủi ro/điểm cần soi thêm
1. **`bodySizeLimit: '11mb'`** áp dụng cho MỌI server action, không riêng import — Security-reviewer
   cần đánh giá rủi ro DoS qua action khác nếu có.
2. **G-17 authz**: chỉ admin gán/gỡ PIC/Backup; dữ liệu cấp quyền đi thẳng vào `project_assignments`
   (đọc/ghi dự án) — nếu có sai sót ở đây là lỗi bảo mật nghiêm trọng, nên kiểm kỹ
   `actions-members.test.ts` + `src/server/authz.ts`.
3. **Đổi mã CT/alias**: kiểm tra kỹ `planAliasChange` 3 nhánh (đóng+mở, sửa dòng chờ, chèn cả 2 dòng)
   và transaction Prisma tương ứng — dữ liệu alias append-only, sai sẽ làm hỏng lịch sử tra cứu mã.
4. **F6 bản nháp**: xác nhận bằng mắt rằng mở DevTools sau khi sửa form không thấy số tiền/tên dự án
   trong `localStorage`, chỉ thấy các trường tiến độ/thiết bị.
5. **Task 10 (equipment plan) transaction**: `replaceEquipmentPlans` xoá-rồi-tạo-lại toàn bộ trong 1
   transaction; kiểm không có race giữa 2 người sửa cùng dự án (không nằm trong test tự động).
6. **`toVndBillion` — xem giải thích Task 3** ở trên, đã sửa số ví dụ trong kế hoạch (lỗi đánh máy),
   không đổi công thức.
7. **`form.test.ts` (Task 4) - lệch nhỏ so với chữ trong kế hoạch**: kế hoạch ghi "đổi mã dự án 17
   (chưa có alias) → có insertOld + insertNew", nhưng seed thật (`buildAliases` trong
   `src/data/seed/history.ts`) gán sẵn 1 dòng alias `Ma_noi_bo` đang mở cho MỌI dự án kể cả 17, nên
   nhánh "chưa có alias nào" không thể tái hiện bằng dự án có sẵn. Tôi test nhánh này bằng 1 dự án vừa
   `createProject()` (chưa từng có dòng alias) thay vì "dự án 17" — hành vi `planAliasChange` vẫn đúng
   3 nhánh, chỉ khác project id dùng để minh hoạ.
