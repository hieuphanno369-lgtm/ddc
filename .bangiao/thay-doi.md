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
  **DataEntryForm: nháp chỉ còn 6 field tiến độ, không hồ sơ, không số tài chính**. `ProjectForm`:
  nháp vẫn là hồ sơ (Task 8) nhưng **trừ 3 trường tài chính** `contractValue`/`contractValueOriginal`/
  `penaltyValue` (`toProjectDraftForm()` ở `project-draft.ts`, vòng sửa 1 mục 3/S-3). `draftKey` đổi
  chữ ký, gắn thêm `ownerTag` (băm FNV-1a từ email) vào khoá localStorage.
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

---

# Vòng sửa 1 (reviewer vòng 1, `.bangiao/danh-gia.md` mục "CẦN SỬA TRƯỚC KHI CHỐT")

Quyết định chủ dự án làm nền cho vòng sửa này (ghi ở `danh-gia.md` đầu file):
- **QĐ-10**: data-entry được xem/sửa Giá trị HĐ, nguyên tệ, giá trị phạt ở `/ho-so-du-an` **kể cả khi
  không có `canViewFinance`** — 3 trường này KHÔNG thuộc nhóm tài chính bị che theo `canViewFinance`.
  `createProjectAction`/`updateProjectAction`/`/ho-so-du-an` không chặn theo `canViewFinance`. Mục 3
  (F6 nháp) vẫn sửa vì rủi ro là máy dùng chung, không phải rủi ro thiếu quyền xem.
- **QĐ-11**: migration S-2 (mã CT không trùng) + S-6 (tối đa 1 PIC/dự án) làm ngay trong P3A (mục 6, 7
  dưới đây), chuyển từ "Để sau" trong bản đánh giá lần 1 sang bắt buộc vòng sửa này.

| Mục | Nội dung | Commit |
|---|---|---|
| 1 | Alias tạo dự án dùng `todayIso()` thay vì giờ thật (`new Date()`) — tránh mất lịch sử khi có `DDC_FAKE_TODAY` | `e1f747a` |
| 2 | `validateAliasChange` chặn client TRƯỚC khi gọi action (đổi mã CT thiếu lý do ≥5 ký tự / mã trống) | `531b3a0` |
| 3 | (S-3) Nháp `ProjectForm` bỏ 3 trường tài chính (`contractValue`/`contractValueOriginal`/`penaltyValue`) qua `toProjectDraftForm()`; dọn nháp của người khác lúc mount | `c4771ef` |
| 4 | (S-7) Server ép VIẾT HOA tên dự án (2 schema); `createProjectAction`/`updateProjectAction` kiểm `customerId`/`teamKdId` còn hiệu lực → `invalid_customer`/`invalid_team` | `9c2611f` |
| 5 | (S-4) `saveMonthlyDataSchema`: `nullableDate` dùng `isoDate` (chặn `'abc'`), `projectName` giới hạn độ dài + ép hoa | `a3b09f8` |
| 6 | (S-2, QĐ-11) Migration unique mã CT (`lower(currentAliasCode)`) + khoá advisory + bắt `P2002` | `481deb7` |
| 7 | (S-6, QĐ-11) Partial unique index tối đa 1 PIC/dự án + audit cùng transaction | `a2cc2ea` |

Chi tiết mục 1–5 xem 5 commit tương ứng (đã ghi thông điệp commit đầy đủ); dưới đây là chi tiết mục 6–7.

## Mục 4 — chi tiết bổ sung (server ép VIẾT HOA + invalid_customer/invalid_team)
`src/server/validation.ts`: `PROFILE_SHAPE.projectName` và `createProjectSchema.projectName` thêm
`.transform((s) => s.toUpperCase())` (khớp client). `src/server/actions.ts` (`createProjectAction`) và
`src/server/actions-project.ts` (`updateProjectAction`) gọi `repo.getDims()`, kiểm `customerId`/`teamKdId`
còn `isActive` và chưa bị gộp (`mergedIntoId == null`) trước khi lưu → `invalid_customer`/`invalid_team`.
Thêm 2 key i18n cùng tên (vi/en). Ca QA `actions-project.qa.test.ts:69-74` đã lật kỳ vọng: gửi tên chữ
thường → lưu ra chữ hoa.

## Mục 5 — chi tiết bổ sung (saveMonthlyData ngày ISO + tên giới hạn)
`nullableDate` đổi từ `z.string()...` lỏng sang `isoDate.nullable().optional()` (dùng chung
`isValidIsoDate`, chặn `'abc'` thay vì để lọt xuống `new Date()` ở Prisma). `projectName` trong
`saveMonthlyDataSchema` thêm `.trim().min(1).max(PROJECT_NAME_MAX).transform(toUpperCase())`. KHÔNG gỡ
field hồ sơ khỏi schema (tránh vỡ test cũ). **Phát hiện thêm ngoài phạm vi mục 5**: `saveMonthlyData`
(`actions.ts`) trước đây destructure field hồ sơ từ **input thô** (`patch.projectName`...) thay vì từ
`parsed.data.patch` đã qua Zod — nghĩa là ép hoa/validate ở schema không có tác dụng thật với đường ghi
này. Đã đổi sang đọc từ `parsed.data.patch` để ép hoa/validate thật sự áp dụng.

## Mục 6 (S-2, QĐ-11) — Migration unique mã CT + khoá + bắt xung đột
- **Migration**: `prisma/migrations/20260925110000_p3a_unique_code_pic/migration.sql` — `DO $$...$$`
  kiểm không có `currentAliasCode` trùng nhau (không phân biệt hoa thường) trước khi
  `CREATE UNIQUE INDEX "dim_project_currentAliasCode_lower_key" ON "dim_project" (lower("currentAliasCode"))`.
  Rollback: `prisma/rollback/20260925110000_p3a_unique_code_pic.down.sql` (`DROP INDEX IF EXISTS` +
  xoá dòng `_prisma_migrations`).
- **`schema.prisma`**: chú thích `/// index lower(currentAliasCode) UNIQUE tạo tay ở migration
  20260925110000` trên field `currentAliasCode` (Prisma 6 không biểu diễn được index biểu thức).
- **`prisma-repo-form.ts`**: tách thân `isProjectCodeTaken` thành `isProjectCodeTakenWith(client, code,
  exceptProjectId)` (export) để gọi lại bằng `tx` bên trong transaction. `changeProjectCode`: đầu
  transaction khoá `pg_advisory_xact_lock(hashtext(lower(newCode)))`, kiểm lại trùng bằng `tx` (chống
  race — index chỉ phủ `currentAliasCode`, không phủ `masterCode`/alias cũ) → trả `'taken'`; bắt
  `Prisma.PrismaClientKnownRequestError` `code === 'P2002'` → `'taken'`.
- **`prisma-repo.ts`**: `createProject` bọc toàn bộ (tạo dự án tạm → khoá + kiểm trùng nếu có
  `currentAliasCode` → gán mã thật → tạo dòng alias) trong 1 `$transaction`; trùng hoặc `P2002` → ném
  `ProjectCodeTakenError` (lớp lỗi mới ở `project-code.ts`, dùng chung mock/prisma).
- **`mock-repo.ts`/`mock-repo-form.ts`**: `isProjectCodeTakenIn(d, code, exceptProjectId)` (export, dùng
  chung); `changeProjectCode` (mock) trả `'taken'` khi trùng; `createProject` (mock) ném
  `ProjectCodeTakenError` khi `currentAliasCode` trùng.
- **`project-code.ts`**: thêm `isReservedProjectCode(code, ownMasterCode?)` — chặn mẫu tự sinh
  `^M-\d+$` (không phân biệt hoa thường) khi ĐỔI mã, **trừ khi** đó chính là `masterCode` của dự án
  đang sửa (cho phép quay lại mã gốc). `changeProjectCodeAction` gọi hàm này TRƯỚC khi kiểm trùng, trả
  `code_reserved` nếu vi phạm; kiểm ở tầng action (không sửa lại `isValidProjectCode`/schema hiện có,
  đúng chỉ dẫn "schema giữ regex cũ").
- **`actions.ts`**: `createProjectAction` bọc `repo.createProject(...)` trong `try/catch`, bắt
  `ProjectCodeTakenError` → `{ ok: false, error: 'code_taken' }` (fallback chống race, phía trên vẫn
  giữ `isProjectCodeTaken` fast-path).
- **i18n**: `projectForm.err.code_reserved` (vi/en), đặt cạnh `code_taken`.
- **`docs.ts`**: `currentAliasCode` — "duy nhất, không phân biệt hoa thường (index lower() tạo tay ở
  migration 20260925110000)".
- **QĐ-kỹ-thuật (tự quyết, không phải nghiệp vụ)**: bản kế hoạch cho 2 lựa chọn ở mục "(d)" cho
  `createProject`: trả `{ error: 'code_taken' }` HOẶC ném lỗi riêng để action bắt. Tôi chọn **ném lỗi
  riêng** (`ProjectCodeTakenError`) để giữ nguyên chữ ký trả về `Project` của `createProject` (12+ file
  test/seed đang gọi trực tiếp và đọc `.id`) — tránh refactor diện rộng ngoài phạm vi vòng sửa. Ngược
  lại `changeProjectCode` vẫn dùng kiểu trả `'taken'` như bản kế hoạch mô tả (không throw), vì hàm này
  vốn đã trả union string.

## Mục 7 (S-6, QĐ-11) — Partial unique index tối đa 1 PIC/dự án
- **Migration (bổ sung vào CÙNG file mục 6)**: `DO $$...$$` kiểm không có dự án nào có > 1 PIC, rồi
  `CREATE UNIQUE INDEX "project_assignments_one_pic_key" ON "project_assignments" ("projectId") WHERE
  "roleInProject" = 'PIC'`. Rollback thêm `DROP INDEX IF EXISTS "project_assignments_one_pic_key"`.
- **Chu trình đã chạy thật trên `ddc_control_tower` (chứng minh rollback/redeploy)**:
  1. `npx prisma migrate deploy` — áp phần mã CT (mục 6), index `dim_project_currentAliasCode_lower_key`
     có mặt (xác nhận qua `pg_indexes`).
  2. `npx prisma db execute --file prisma/rollback/20260925110000_p3a_unique_code_pic.down.sql` — drop
     index + xoá dòng `_prisma_migrations`; xác nhận index biến mất, dòng migration biến mất.
  3. Sửa `migration.sql` + `.down.sql` thêm phần PIC (mục 7).
  4. `npx prisma migrate deploy` lại — áp CẢ 2 phần (mã CT + PIC) trong 1 lần chạy.
  5. `npx prisma migrate status` → **"Database schema is up to date!"**.
  6. Query `pg_indexes`: **cả 2 index đều có mặt** —
     `dim_project_currentAliasCode_lower_key` (btree, `lower("currentAliasCode")`) và
     `project_assignments_one_pic_key` (btree, `("projectId")` `WHERE roleInProject = 'PIC'`).
- **`migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma
  --shadow-database-url <db tạm ddc_shadow_p3a>`**: chạy 2 lần (sau mục 6 một mình, và sau khi có đủ cả
  2 index) — cả 2 lần đều ra **"No difference detected."** Nghĩa là Prisma **không đề xuất `DROP INDEX`**
  cho các index tạo tay này khi so `migrations/` với `schema.prisma` (index biểu thức/partial không
  được model hoá trong Prisma datamodel nên không bị coi là "thừa"). Không cần thêm cảnh báo
  "đừng chạy `migrate dev`" vì không có đề xuất xoá nào xuất hiện — nhưng vẫn khuyến nghị chỉ dùng
  `migrate deploy` cho migration này (không chạy `migrate dev` để tránh Prisma tự sinh migration mới
  cố "đồng bộ" theo cách hiểu riêng của nó trong tương lai nếu hành vi này đổi ở version khác).
- **`prisma-repo-form.ts`**: `setProjectMember`/`removeProjectMember` bọc trong `$transaction` cùng
  `audit(tx, ...)`. `setProjectMember` gán PIC thì kiểm lại trong `tx` đã có PIC khác chưa (
  `tx.projectAssignment.findFirst`) → `'pic_exists'`; bắt `P2002` → `'pic_exists'`.
- **`mock-repo-form.ts`**: `setProjectMember` tự kiểm PIC trùng tương tự (đồng bộ hành vi mock/prisma),
  trả `'pic_exists'`.
- **`actions-project.ts`**: `setProjectMemberAction` giữ nguyên kiểm nhanh (fast-path, lỗi thân thiện)
  ở trên; bắt thêm kết quả `'pic_exists'` từ `repo.setProjectMember` làm fallback chống race (2 request
  gán PIC gần như đồng thời).
- **`docs.ts`**: `project_assignments.roleInProject` — "tối đa 1 PIC mỗi dự án (partial unique index
  tạo tay ở migration 20260925110000)".
- **Seed I-2** (`admin@` làm PIC 11 dự án): mỗi dự án vẫn chỉ 1 PIC → migration deploy không vướng
  (đã xác nhận qua bước 1/4 ở trên chạy thành công trên DB dev thật, không raise exception trùng PIC).
  Không sửa seed.
- **`form.test.ts` — đổi ý định có chủ đích (QĐ-11)**: ca `'pic trung khong bi chan o tang repo (luat
  pic_exists nam o action)'` trước đây khẳng định **mock KHÔNG chặn** PIC trùng (luật chỉ nằm ở tầng
  action) và kỳ vọng `'added'`. Sau QĐ-11 (partial unique index ở DB), mock cũng tự kiểm để đồng bộ hành
  vi với Prisma thật — ca này đổi tên + kỳ vọng thành `'pic_exists'`. Đây là thay đổi Ý ĐỊNH kiểm thử có
  chủ đích theo yêu cầu vòng sửa, không phải sửa lỗi.

## Cổng sau vòng sửa 1 (cả 7 mục)
- `npx tsc --noEmit` = 0 lỗi (chạy lại sau mỗi commit).
- `npm test` = **149 file / 1676 test xanh** (mốc trước vòng sửa: 149 file / 1667 test — không tụt,
  +9 test ở mục 6, +4 test ở mục 7 = +13; chênh với môc coder/tester gốc 139→149 file là do Tester đã
  thêm 10 file `*.qa.test.ts` trước vòng sửa này).
- `npm run check:read` = OK (17/17 hàm đọc khớp mock/Prisma trên `ddc_control_tower`).
- `npx prisma migrate status` = up to date; 2 index mới đã xác nhận có mặt qua `pg_indexes`.
- Không đụng file cấm (`PROGRESS.md`, `.serena/`, `app/globals.css`, `queries.ts`,
  `project-queries.ts`, `admin/page.tsx`, `notify_*`, `read-mock.ts`, `read-prisma.ts`).
- Câu `thay-doi.md:103-104` (mục 3 yêu cầu sửa nếu còn sai): đã đúng từ commit mục 3 (`c4771ef`) —
  "DataEntryForm: nháp chỉ còn 6 field tiến độ... ProjectForm: nháp vẫn là hồ sơ (Task 8) nhưng trừ 3
  trường tài chính..." — không còn câu sai cần sửa thêm ở vòng này.

## Rủi ro Tester/Security nên soi kỹ thêm ở vòng sửa 1
1. **Race điều kiện thật** (2 tab/2 người cùng đổi mã CT hoặc cùng gán PIC gần như đồng thời): logic
   khoá `pg_advisory_xact_lock` + kiểm lại trong `tx` chỉ được test bằng mock Vitest (giả lập tuần tự),
   CHƯA có test tích hợp 2 kết nối Postgres thật chạy song song (race thật). Khuyến nghị security-reviewer
   rà lại theo đúng ghi chú ở `danh-gia.md` ("sau vòng sửa gửi lại security-reviewer rà S-2/S-6").
2. **`ProjectCodeTakenError` là lớp lỗi mới** dùng `throw`/`catch` xuyên qua ranh giới repo → action —
   khác với các hàm khác trong cùng file vẫn trả union string. Soi kỹ không có chỗ nào gọi
   `repo.createProject()` mà thiếu `try/catch` (sẽ làm lộ lỗi 500 thay vì thông báo `code_taken`) —
   đã kiểm `actions.ts` là nơi DUY NHẤT gọi `repo.createProject()` trong code nguồn (ngoài test/seed).
3. **`migrate diff` "No difference detected"** cho 2 index tạo tay: đây là hành vi hiện tại của Prisma
   6.19.3 (không model hoá index biểu thức/partial nên không so sánh) — không đảm bảo hành vi này giữ
   nguyên ở version Prisma sau. Nếu nâng Prisma (xem `lenh-cho-A-2026-09-26.md` Phần 3, nâng Next kèm
   khả năng nâng Prisma), chạy lại `migrate diff` để chắc chắn không có đề xuất `DROP INDEX` bất ngờ.
4. **`isReservedProjectCode`** chỉ chặn ở `changeProjectCodeAction`, KHÔNG áp cho `currentAliasCode` lúc
   TẠO mới dự án (`createProjectAction`) — nếu muốn chặn luôn ở tạo mới thì cần thêm ở `mục để sau`,
   ngoài phạm vi vòng sửa 1 (bản kế hoạch chỉ yêu cầu ở `changeProjectCodeAction`).

## Vòng sửa 1, vòng 2 (vá F-1 + N-1 theo `danh-gia-bao-mat.md`) - 2026-09-26

- **F-1 (a)** `src/server/actions.ts` `createProjectAction`: nhập `currentAliasCode` theo mẫu `M-\d+` (không phân biệt hoa thường, bỏ khoảng trắng 2 đầu) → trả `code_reserved`, không tạo dự án.
- **F-1 (c)** `src/server/repo/prisma-repo.ts` `createProject`: nhánh không nhập mã (dùng mã tự sinh `M-<id>`) nay cũng khoá advisory + `isProjectCodeTakenWith(tx, ...)`, trùng thì ném `ProjectCodeTakenError`.
  Mock-repo đồng bộ: kiểm trùng cả mã tự sinh.
- **N-1** `src/server/repo/prisma-repo-form.ts`: thêm `isP2002On(e, targets)` so nguyên mảng `meta.target`.
  Dạng thật đã xác nhận trên DB `ddc_control_tower` (transaction tự rollback): mã CT `['lower(currentAliasCode)']`, `['masterCode']`; 1 PIC `['projectId']`; khoá chính thành viên `['projectId','userEmail']`.
  `createProject` và `changeProjectCode` chỉ map khi target là index mã CT; `setProjectMember` chỉ map `pic_exists` khi target là `['projectId']`, còn lại ném nguyên lỗi gốc.
- Test mới: `actions-key-milestones.test.ts` (4 ca F-1), `prisma-repo-create-project-vong-sua-1-r2.test.ts` (7 ca F-1 (c) + N-1), `prisma-repo-form-p2002.test.ts` (3 ca), thêm 1 ca khoá chính trong `prisma-repo-form.test.ts`.
  3 test cũ giả lập P2002 không có `meta.target` được thêm target thật; chú thích test ranh giới trong `form-vong-sua-1.qa.test.ts` cập nhật (repo vẫn không chặn, action chặn).
- Cổng: `tsc` sạch, `npm test` 156 file / 1731 test xanh, `check:read` OK.
