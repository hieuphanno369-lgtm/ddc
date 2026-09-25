KET LUAN BAO MAT: DAT

# Đánh giá bảo mật P3A (Form Tạo/Sửa dự án): `feature/p3a-form-tao-sua` so với `main`

> Security-reviewer (vai chỉ đọc) trả báo cáo; điều phối viên chép vào file này. Ngày 2026-09-25.

**Kết luận: ĐẠT, không có lỗi mức Cao. Không phát hiện nào chặn merge vào `main`.** Có 1 lỗi Trung bình phải xử lý trước go-live (S-1) và 8 lỗi Thấp để sau.

## Đã rà những gì

- **Skill:** `security-review` (bảng kiểm) + `security-audit` chế độ hướng dẫn (rà có trọng tâm). Không pentest app đang chạy.
- **Tài liệu:** `CLAUDE.md`, `.bangiao/ke-hoach.md` (Q1–Q9), `thay-doi.md`, `ket-qua-test.md`, `git diff main...HEAD`.
- **Code:** `actions-project.ts`, `actions.ts`, `actions-entry.ts`, `action-guards.ts`, `authz.ts`, `prisma-repo-form.ts`, `validation.ts`, `project-profile-rules.ts`, `project-code.ts`, `drafts.ts`, `project-draft.ts`, `ProjectForm.tsx`, `ProjectLinksSection.tsx`, `ho-so-du-an/page.tsx`, `middleware.ts`, `next.config.mjs`, `auth.ts`, `session.ts`, migration + rollback.
- **Mã nguồn Next 14.2.35:** `node_modules/next/dist/server/app-render/action-handler.js` và `react-server-dom-webpack-server.node.production.min.js` (để hiểu thật `bodySizeLimit`).
- **DB (`mcp__postgres`, chỉ đọc) `ddc_control_tower`:** 0 dự án trùng `currentAliasCode` (không phân biệt hoa thường); 0 dự án có 2 PIC; 0 CĐT `needsReview`; **không có unique index** trên `dim_project.currentAliasCode` / `dim_project_alias.aliasCode`; `project_stage_weight` có PK `(projectId, stageCode)`; 11 dòng `project_assignments` gán `admin@` làm PIC (seed, xem I-2).

---

## Phát hiện

### S-1 (Trung bình): `bodySizeLimit: '11mb'` không giới hạn bộ nhớ; tầng app không chặn DoS bằng body lớn

**Xử lý:** để sau, **bắt buộc xong trước go-live P6**. Không chặn merge (chưa có production).

**Vị trí:** `next.config.mjs:9`; `node_modules/next/dist/server/app-render/action-handler.js:422-432` (multipart), `:488-495` (không multipart); `src/server/actions.ts:459-467` (`importExcelAction`); `src/server/actions-entry.ts:186-191` (`previewDailyImportAction`); chú thích sai `src/server/validation.ts:228` ("chặn ở action trước khi parse (chống DoS)").

**Sự thật trong Next 14.2.35:**
1. Nhánh JSON (488-495): Next đọc **toàn bộ** body vào RAM rồi mới so `bodySizeLimit` — giới hạn chỉ quyết định có chạy `decodeReply` hay không. Nâng 1MB→11MB làm trần parse của **mọi** action tăng 11 lần.
2. Nhánh multipart (422-432): busboy chỉ đặt `limits: { fieldSize }`; `decodeReplyFromBusboy` gom từng phần file vào mảng RAM **không giới hạn**. File upload qua server action **không bị `bodySizeLimit` chặn** (cả trước lẫn sau P3A); kiểm `file.size` bằng zod chạy **sau khi** file đã nằm trọn trong RAM. Tester mới kiểm ở mức schema zod.
3. Parse body chạy **trước** mọi kiểm auth (auth nằm trong thân action; middleware `middleware.ts:42` không bắt đăng nhập). Người chưa đăng nhập biết action ID (có trong chunk JS công khai) là buộc được server đọc/parse body lớn. Cần kiểm tiếp: `serverModuleMap` có cho gọi mọi action từ `/login` không.
4. Không có rate-limit trên action import (`rateLimit` chỉ ở `app/api/health`, `app/api/export`). Sau zod, `importExcelAction` giữ thêm 1 `Buffer` + ExcelJS (tới 20MB XML) → mỗi request có thể tốn hàng trăm MB.

**Kịch bản:** ~50 kết nối song song POST `/vi/login` với header `Next-Action: <id importExcelAction>`, multipart file 200MB → Next buffer hết trước khi action trả Forbidden → OOM. Hoặc 1 tài khoản data-entry dồn dập file 10MB hợp lệ → vắt RAM/CPU qua ExcelJS.

**Cách sửa (ưu tiên):**
1. Chuyển `importExcelAction`, `previewDailyImportAction` sang **route handler riêng** (`app/api/import/route.ts`, `app/api/daily-import/route.ts`): kiểm `getCurrentUser()` + `requireRole`/`requireWriteProject` **trước khi** đọc body; từ chối nếu thiếu `Content-Length` hoặc > `IMPORT_MAX_BYTES + 64KB`; đọc `req.body` dạng stream, đếm byte, vượt thì `abort()` + 413; `rateLimit('import:' + user.email, 10, 60_000)`.
2. Rồi **trả `bodySizeLimit` về mặc định** (bỏ dòng 9 hoặc `'1mb'`). Không action JSON nào của P3A cần >1MB (`saveEquipmentPlansSchema` ≤300 dòng × ~250B ≈ 75KB; `commitImportSchema`/`commitDailyImportSchema` đã giới hạn số dòng).
3. Reverse proxy P6: `client_max_body_size 1m` cho POST có `Next-Action`; chỉ `/api/import*` 11m; giới hạn kết nối + rate theo IP.
4. Nếu chưa kịp (1): ghi rõ trong tài liệu P6 app **không** tự chặn body lớn; sửa chú thích `validation.ts:228`.
5. Kiểm end-to-end: gửi 12MB rồi 50MB vào `importExcelAction` (dev, data-entry); ghi lại trả `'File vượt quá 10MB'` (đã buffer hết) hay 413, và RSS tăng bao nhiêu.

### S-2 (Thấp): Đổi mã CT / tạo mã lúc tạo dự án có race (TOCTOU), DB không có ràng buộc duy nhất

**Xử lý:** để sau.
**Vị trí:** `src/server/actions-project.ts:92-95` (`isProjectCodeTaken` ngoài transaction rồi mới `changeProjectCode`); `src/server/actions.ts:225-227` (`createProjectAction`, cùng mẫu); `src/server/repo/prisma-repo-form.ts:31-50`, `:52-104` (trong transaction không kiểm lại); DB không có unique index.
**Kịch bản:** 2 data-entry của 2 dự án cùng đổi sang `CT-2026-01` gần như cùng lúc → 2 dự án cùng mã hiện hành, vi phạm Q4. Biến thể: tạo dự án với `currentAliasCode = 'M-00019'` (đúng mã gốc tự sinh của dự án kế tiếp) → dự án sau va mã.
**Cách sửa:** đầu transaction `SELECT pg_advisory_xact_lock(hashtext(lower($code)))` rồi `isProjectCodeTaken` bằng `tx`; hoặc `isolationLevel: 'Serializable'` + bắt xung đột → `code_taken`. Chặn mẫu `^M-\d+$` trong `isValidProjectCode` (trừ `masterCode` của chính dự án). Có thể thêm unique index `lower("currentAliasCode")` (migration mới, bên giữ schema).

### S-3 (Thấp): Nháp `ProjectForm` vẫn ghi giá trị HĐ, phạt, tên dự án vào localStorage; `thay-doi.md` mô tả sai

**Xử lý:** để sau; sửa câu sai trong `thay-doi.md` trước khi archive.
**Vị trí:** `src/components/form/ProjectForm.tsx:117-127`, `:146-165` (ghi đủ `ProjectFormState` vào `ddc_pform_v1_<tag>_<id>`); `src/lib/project-draft.ts:21-25` (gồm `contractValue`, `contractValueOriginal`, `penaltyValue`, `projectName`, `customerId`, `currentAliasCode`); `thay-doi.md:103-104` ("số tài chính và toàn bộ hồ sơ KHÔNG BAO GIỜ vào localStorage" — chỉ đúng với `DataEntryForm`; test F6 `dataEntryState.qa.test.ts` cũng chỉ phủ `DataEntryForm`).
**Đánh giá:** 5 field tài chính gốc F6 (doanh thu, chi phí, công nợ) đã gỡ; nháp hồ sơ ở `ProjectForm` đúng kế hoạch; xoá khi Đăng xuất. Còn kẽ hở: (a) `ownerTag` = FNV-1a email, chỉ tách khoá, không bảo mật (DevTools đọc được); (b) hết phiên 8 giờ / đóng trình duyệt không Đăng xuất → nháp còn; (c) `ProjectForm` không gọi `purgeForeignDrafts` lúc mount (chỉ `DataEntryForm.tsx:121`).
**Kịch bản:** máy dùng chung ở công trường; A sửa giá trị HĐ rồi đóng tab; B mở DevTools → Local Storage đọc `contractValue`, `penaltyValue` của A.
**Cách sửa:** bỏ `contractValue`, `contractValueOriginal`, `penaltyValue` khỏi `PROJECT_FORM_STRING_KEYS` và payload nháp; gọi `purgeForeignDrafts(localStorage, ownerTag)` trong `useEffect` mount của `ProjectForm`; tuỳ chọn xoá nháp `savedAt` > 8 giờ; sửa câu trong `thay-doi.md`.

### S-4 (Thấp): `saveMonthlyData` vẫn sửa được hồ sơ với ngày không kiểm định dạng, lệch "một nguồn luật"

**Xử lý:** để sau.
**Vị trí:** `src/server/validation.ts:27`, `:69-84` (`nullableDate = z.string()` không kiểm ISO; `projectName: z.string()` không `.trim().max(160)`); `src/server/actions.ts:128-153`.
**Kịch bản:** data-entry được gán gọi thẳng `saveMonthlyData(id, '2026-09', { plannedFinishDate: 'abc' })` → `checkDateChain` so chuỗi rác, `new Date('abc')` → Prisma 500 hoặc ngày sai. Q7 nói chỉ còn một chỗ sửa hồ sơ nhưng luồng này vẫn mở.
**Cách sửa:** bỏ field hồ sơ khỏi `saveMonthlyDataSchema`/`saveMonthlyData`; nếu giữ thì dùng lại `PROFILE_SHAPE` (`isoDate.nullable()`, `projectName` ≤160).

### S-5 (Thấp): `replaceEquipmentPlans` có thể nhân đôi kế hoạch thiết bị khi 2 người lưu đồng thời

**Xử lý:** để sau.
**Vị trí:** `src/server/repo/prisma-repo-form.ts:208-228`.
**Kịch bản:** PIC và Backup cùng Lưu; READ COMMITTED → `deleteMany` của T2 không thấy dòng T1 chưa commit → cả 2 bộ dòng tồn tại, trùng `(equipmentId, unitNo)` ngày giao nhau; luật chồng lấn chỉ kiểm payload → Gantt T14 sai. Toàn vẹn dữ liệu giữa người cùng quyền, không leo quyền. `replaceStageWeights` cùng mẫu nhưng PK chặn → P2002 → 500.
**Cách sửa:** đầu transaction `SELECT id FROM dim_project WHERE id = ${projectId} FOR UPDATE` hoặc advisory lock theo `projectId`; bắt P2002 ở `replaceStageWeights` → `conflict`.

### S-6 (Thấp): G-17 "tối đa 1 PIC" chỉ kiểm ở tầng app; audit không cùng transaction

**Xử lý:** để sau.
**Vị trí:** `src/server/actions-project.ts:164-171` (đọc thành viên rồi ghi, không transaction); `src/server/repo/prisma-repo-form.ts:153-175` (ghi `project_assignments` rồi mới `audit()`).
**Kịch bản:** 2 admin cùng gán 2 PIC → dự án có 2 PIC, trái Q3(c). Audit lỗi sau khi cấp quyền → 1 lần cấp quyền không có `audit_log` (còn `activity_log`).
**Đã xác nhận đúng:** cấp quyền chỉ-admin; không IDOR qua `projectId`/email (zod ép `int`, email `toLowerCase`, repo lọc `projectId_userEmail`); `requireProjectRead`/`canWriteProject` đọc assignment từ DB mỗi request → gỡ PIC có hiệu lực ngay.
**Cách sửa:** gộp "kiểm PIC + upsert + audit" vào 1 `prisma.$transaction` có advisory lock theo `projectId`, hoặc partial unique index `ON project_assignments("projectId") WHERE "roleInProject"='PIC'`.

### S-7 (Thấp): Server không ép VIẾT HOA tên dự án; `createProjectAction` không kiểm CĐT/team còn hiệu lực

**Xử lý:** để sau.
**Vị trí:** `src/server/validation.ts` (`PROFILE_SHAPE.projectName`, `createProjectSchema.projectName`); `src/components/form/ProjectForm.tsx` (~dòng 400, `.toUpperCase()` chỉ client); `src/server/actions.ts:225-237`, `actions-project.ts:63-66` (chỉ kiểm factory; không kiểm `customerId`/`teamKdId` tồn tại, `isActive`, chưa `mergedIntoId`).
**Đánh giá:** không phải lỗ hổng (React escape → không XSS; Prisma tham số hoá). Toàn vẹn dữ liệu: gọi action trực tiếp tạo tên chữ thường, trái Q6; gán CĐT đã gộp → báo cáo tách; `customerId` không tồn tại → FK lỗi 500.
**Cách sửa:** `.transform((s) => s.toLocaleUpperCase('vi-VN'))` cho `projectName` ở `PROFILE_SHAPE`, `createProjectSchema` (và `saveMonthlyDataSchema` nếu giữ); kiểm `dims.customers.some(c => c.id === customerId && c.isActive && c.mergedIntoId == null)` tương tự team → `invalid_customer`/`invalid_team`.

### S-8 (Thấp): `createProjectAction` không atomic

**Xử lý:** để sau.
**Vị trí:** `src/server/actions.ts:238-243` (`createProject` → `addAssignment(PIC)` → `replaceStageWeights` → `replaceKeyMilestones`, 4 lệnh rời).
**Kịch bản:** `addAssignment` lỗi thoáng qua → dự án tạo xong nhưng data-entry vừa tạo không có quyền vào (fail-closed, không lộ). Lỗi ở bước trọng số → rơi về mặc định.
**Cách sửa:** gom vào 1 transaction ở repo (vd `createProjectWithSetup`).

### S-9 (Thấp): Rollback migration

**Xử lý:** để sau.
**Vị trí:** `prisma/migrations/20260925100000_p3a_customer_review/migration.sql` (chỉ thêm cột có default — an toàn); `prisma/rollback/20260925100000_p3a_customer_review.down.sql` (xoá 2 cột + dòng `_prisma_migrations`).
**Rủi ro:** rollback khi code P3A đang chạy → select `needsReview` lỗi → danh mục/form 500; mất hàng chờ duyệt (CĐT data-entry tạo thành "đã duyệt" ngầm).
**Cách sửa:** ghi đầu file down "revert code trước, rồi mới chạy file này"; trước rollback xuất `SELECT id, name, "createdBy" FROM dim_customer WHERE "needsReview"`.

---

## Mục đã kiểm và ĐẠT

1. **Phân quyền action mới/sửa** — kiểm ở server trước khi ghi: `updateProjectAction`, `changeProjectCodeAction`, `saveStageWeightsAction`, `removeSapCodeAction`, `saveEquipmentPlansAction` → `requireWriteProject(projectId)`; `setProjectMemberAction`, `removeProjectMemberAction`, `approveCustomerAction` → `requireRoleUser(['admin'])`; `createProjectAction`, `createDimValueAction` → `requireRole(['admin','data-entry'])`; `renameDimAction`/`mergeDimAction` chỉ admin; viewer/bod Forbidden (có test `.qa`); `projectId` chuỗi không qua `includes()` chặt.
2. **BOLA/IDOR:** `removeSapCode` lọc `{ id: sapCodeId, projectId }` (`prisma-repo-form.ts:123`); `saveEquipmentPlansAction` chỉ nhận `workItemId` của đúng dự án; audit trail lọc `recordId` chính xác hoặc tiền tố `${projectId}/` (`1/` không khớp `18/`).
3. **Mass assignment:** `updateProjectSchema.patch` `.strict()`; `createProjectSchema` bỏ key lạ, không chèn `createdBy`/`masterCode`; không field `FINANCE_FIELDS` trong 2 schema mới; chặn data-entry ghi tài chính ở `saveMonthlyData:80` giữ nguyên.
4. **Tài chính fail-closed:** `session.ts:23`, `auth.ts:144` giữ `?? false`; `/ho-so-du-an` hiện `contractValue`/`penaltyValue` cho data-entry đúng hiện trạng (`canViewFinance = role !== 'viewer'`, `auth.ts:36`; viewer/bod bị chặn khỏi trang); Backup viewer chỉ đọc, trang chi tiết che tài chính (`projects/[id]/page.tsx:77`). Ghi chú: `/ho-so-du-an` không tự kiểm `canViewFinance` — nếu sau này tách khỏi role thì phải bổ sung.
5. **Injection:** Prisma tham số hoá, không `$queryRawUnsafe`; mã CT regex `^[A-Za-z0-9][A-Za-z0-9._/-]*$` ≤40; lý do 5–300; ghi chú thiết bị ≤200; tên ≤160.
6. **XSS / i18n:** không `dangerouslySetInnerHTML` trong `src/`; tooltip `projectForm.tip.*`/`HelpTip` là text; `ProjectAuditCard` hiện giá trị qua text + `title`; `t.rich` chỉ ở component cũ, không nhận markup người dùng.
7. **G-5:** `needsReview = field==='customer' && role!=='admin'`; tạo trùng tên trả id cũ, không đổi cờ; duyệt chỉ admin có `audit_log`; gộp bỏ cờ bản nguồn; data-entry không duyệt/gộp/đổi tên được.
8. **`/ho-so-du-an`:** middleware chặn viewer/bod + trang tự kiểm role (`page.tsx:17`); data-entry chỉ dự án được gán, `?project=` ngoài quyền → `notFound()`; `assignableUsers` chỉ cho admin, không chứa `passwordHash`.
9. **Nháp `DataEntryForm`:** chỉ 6 field tiến độ/thiết bị; khôi phục bỏ key lạ; xoá khi đăng xuất và đổi mật khẩu.
10. **Secret:** diff không thêm secret; tài liệu test đã che mật khẩu seed.

## Ghi chú có sẵn từ trước (không do P3A)

- **I-1:** role nằm trong JWT sống 8 giờ (`auth.ts:118,133-139`) — hạ quyền/khoá tài khoản thì phiên cũ giữ role cũ tới hết hạn. `setUserRoleAction` không dọn `project_assignments`: nâng viewer đang là Backup lên data-entry → tự có quyền ghi các dự án đó. Đề xuất phase sau: `jwt` callback đọc lại role/`isActive` định kỳ; khi đổi role cảnh báo hoặc dọn assignment trái Q3(b).
- **I-2:** seed gán `admin@` làm PIC ở 11 dự án (4, 6, 8, 9, 10, 12, 13, 14, 15, 16, 17) → gán PIC data-entry báo `pic_exists`. Không phải lỗ hổng; sửa seed/dữ liệu thật trước khi vận hành G-17.
- **I-3:** dự án QA id=18 do smoke test còn trong DB dev — xoá trước khi demo/merge dữ liệu.

## Tổng hợp

| Mã | Mức | File chính | Xử lý |
|---|---|---|---|
| S-1 | Trung bình | `next.config.mjs:9`, `actions.ts:459-467`, `actions-entry.ts:186-191` | Để sau, **bắt buộc trước go-live P6** |
| S-2 | Thấp | `actions-project.ts:92-95`, `actions.ts:225-227`, `prisma-repo-form.ts:31-104` | Để sau |
| S-3 | Thấp | `ProjectForm.tsx:117-165`, `project-draft.ts:21-25` | Để sau (sửa `thay-doi.md` ngay) |
| S-4 | Thấp | `validation.ts:27,69-84`, `actions.ts:128-153` | Để sau |
| S-5 | Thấp | `prisma-repo-form.ts:208-228` | Để sau |
| S-6 | Thấp | `actions-project.ts:164-171`, `prisma-repo-form.ts:153-175` | Để sau |
| S-7 | Thấp | `validation.ts` (`projectName`), `actions.ts:225-237` | Để sau |
| S-8 | Thấp | `actions.ts:238-243` | Để sau |
| S-9 | Thấp | `prisma/rollback/20260925100000_p3a_customer_review.down.sql` | Để sau |

Không phát hiện nào **chặn merge**. Reviewer nên đưa S-1 vào danh sách bắt buộc của P6 (go-live), và S-2, S-5, S-6 vào nợ xử lý ghi đồng thời.
