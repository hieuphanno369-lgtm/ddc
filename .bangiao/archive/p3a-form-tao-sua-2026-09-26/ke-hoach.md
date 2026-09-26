# P3A — Form Tạo/Sửa dự án (G-1…G-20 trừ G-18) + F6 bản nháp + Task 10 kế hoạch thiết bị + ghi chú 10MB · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans`. Bước dùng checkbox `- [ ]`. Planner đã dùng skill `writing-plans`; đã tra Context7 (`/vercel/next.js/v14.3.0-canary.87`) để xác nhận `experimental.serverActions.bodySizeLimit` mặc định 1MB.

**Goal:** Một trang "Tạo / Sửa dự án" 6 mục như mock-up (`mockup-apple-glass.html` dòng 866-1123), có luồng ghi thật cho mã CT/alias, trọng số, SAP, PIC/Backup, quy đổi nguyên tệ, cùng bản nháp an toàn, form kế hoạch thiết bị cho Gantt và ghi chú giới hạn 10MB ở mọi màn hình import.

**Architecture:** Luật thuần ở `src/lib/*` (có unit test). Luật hồ sơ phía server gom ở `src/server/project-profile-rules.ts`, dùng chung cho `createProjectAction`, `saveMonthlyData` và action mới `updateProjectAction`. Hàm repo mới đặt ở cặp file `mock-repo-form.ts` / `prisma-repo-form.ts`, gộp vào `repo` bằng spread (khuôn P2A `mock-repo-entry.ts` / `prisma-repo-entry.ts`), để giảm sửa file nóng. UI mới: trang `/ho-so-du-an` + `ProjectForm` (client). Bước "Hồ sơ" của `DataEntryForm` đổi thành thẻ dẫn sang trang mới.

**Tech Stack:** Next.js 14.2.35 App Router · React 18 · TS · next-intl · Zod 4 · Prisma 6.19 · PostgreSQL localhost:5433 db `ddc_control_tower` · Vitest (env `node`, `DDC_FAKE_TODAY=2026-09-16`).

**Spec:** bảng G-1…G-20 ở `.bangiao/archive/apple-glass-mock-parity-2026-09-23/ke-hoach.md` dòng 47-66. Mock-up: `mockup-apple-glass.html` (mọi "dòng N" trong plan là số dòng của file này). F6: `.bangiao/archive/p1a-du-lieu-dung-2026-09-24/danh-gia.md` dòng 48. Nhánh: `feature/p3a-form-tao-sua` (tài khoản A).

---

## ĐÃ CHỐT (chủ dự án, 2026-09-25) — không còn câu hỏi bỏ ngỏ

**Chủ dự án đã chọn phương án đề xuất/MẶC ĐỊNH cho TẤT CẢ Q1–Q9 và đồng ý nâng `bodySizeLimit` lên `'11mb'` (Task 2).**
Q1 = bảng trọng số theo loại dưới đây, áp đúng như mô tả. Q2 = dùng nguyên văn tooltip vi/en dưới đây. Q3–Q9 = đúng
MẶC ĐỊNH ghi trong từng câu (Q6: giữ ép VIẾT HOA + giới hạn 160 ký tự). Task 13, 14 KHÔNG còn chờ — coder làm đủ Task 1–15.

**Q1 — G-6: Bộ trọng số mặc định theo loại dự án (Task 13, ĐÃ CHỐT).** Đề xuất bảng dưới (điểm %, mỗi hàng cộng đúng 100). Cột theo `STAGE_ORDER`: Thiết kế · Shop · Vật tư · Gia công · Vận chuyển · Lắp dựng · Nghiệm thu.

| Loại (`ProjectType`) | design | shop | procurement | fabrication | transport | erection | handover | Lý do |
|---|---|---|---|---|---|---|---|---|
| EPC | 8 | 10 | 15 | 32 | 5 | 27 | 3 | Có phần thiết kế và mua sắm riêng |
| San_bay | 4 | 8 | 8 | 42 | 5 | 30 | 3 | Mock-up: "nặng gia công & lắp dựng" |
| San_van_dong | 5 | 10 | 8 | 38 | 6 | 30 | 3 | Kết cấu nhịp lớn, nặng lắp dựng |
| Nha_xuong | 3 | 7 | 20 | 38 | 5 | 24 | 3 | Mock-up: "nặng phần vật tư" |
| Cau_cang | 5 | 10 | 10 | 38 | 10 | 24 | 3 | Vận chuyển cấu kiện lớn ra cảng |
| Cao_tang | 5 | 12 | 10 | 35 | 5 | 30 | 3 | Nhiều shop drawing, lắp dựng theo tầng |
| Dong_tau | 8 | 12 | 15 | 45 | 2 | 15 | 3 | Gia công block chiếm phần lớn |
| Cau_giao_thong | 6 | 10 | 10 | 37 | 8 | 26 | 3 | Vận chuyển dầm, lắp dựng tại chỗ |
| Khac | 5 | 10 | 10 | 40 | 5 | 27 | 3 | = `DEFAULT_STAGE_WEIGHTS` hiện tại |

Cách áp dụng đề xuất: (a) Khi TẠO dự án, bảng trọng số ở mục 5 điền sẵn theo loại. Đổi loại thì điền lại, trừ khi người dùng đã tự sửa bảng. (b) Khi SỬA: không tự đổi. Có nút "Áp bộ mặc định theo loại dự án" để điền lại bảng; bảng chỉ ghi khi bấm Lưu. (c) Dự án cũ chưa có dòng `project_stage_weight` vẫn dùng `DEFAULT_STAGE_WEIGHTS` như hiện nay, không chuyển sang bộ theo loại. Nếu chốt số khác, chỉ sửa `src/lib/stage-weight-presets.ts`.

**Q2 — G-14: Tooltip 5 ô ngày/phạt (Task 14, ĐÃ CHỐT).** Đề xuất nguyên văn dưới đây. Mỗi câu đều đã đối chiếu với code thật: `calcDurationPctComplete` (`src/server/queries.ts:73`), `COUNTDOWN_HOUR` 17:00 (`src/lib/countdown.ts`), `penaltyState` + luật `penalty_risk` (`src/lib/evm.ts:130-144`, `src/lib/alert-rules.ts:76-100`), `deriveStatus` (`src/lib/evm.ts:109-120`). `penaltyValue` hiện không được dùng trong phép tính nào (chỉ lưu và hiện ở form).

| Ô | vi | en |
|---|---|---|
| Ngày HT kế hoạch | Mốc nội bộ để chạy tiến độ. % Kế hoạch = số ngày đã trôi từ Ngày BĐ kế hoạch ÷ tổng số ngày từ BĐ đến HT kế hoạch. Đồng hồ đếm ngược ở Chi tiết dự án đếm tới 17:00 ngày này. Không nhầm với Bàn giao cam kết. | Internal target used to run the schedule. % Plan = days elapsed since Planned start ÷ total days from Planned start to Planned finish. The countdown on Project detail counts to 17:00 on this date. Not the same as Committed handover. |
| Bàn giao cam kết | Mốc ghi trong hợp đồng. Khi còn 30 ngày trở xuống tới mốc này mà % Thực tế chưa đạt 100%, dự án được tính là Nguy cơ phạt HĐ và hệ thống tự mở cảnh báo Đỏ. | Handover date stated in the contract. When 30 days or fewer remain and % Actual is below 100%, the project counts as Penalty risk and a Red alert is opened automatically. |
| Ngày BĐ thực tế | Để trống nếu chưa khởi công, dự án ở trạng thái Chuẩn bị. Có ngày này thì trạng thái chuyển sang Đang triển khai. | Leave empty if work has not started; the project stays in Preparation. Once this date is set, the status becomes In progress. |
| Ngày HT thực tế | Chỉ điền khi đã nghiệm thu bàn giao. Trạng thái Hoàn thành chỉ bật khi có ngày này và % Thực tế đạt 100%. | Fill in only after handover acceptance. The Completed status requires both this date and % Actual at 100%. |
| Giá trị phạt ước tính | Số tiền phạt ước tính (tỷ VNĐ), nhập được cả khi chưa bị phạt. Hiện chỉ lưu trong hồ sơ, chưa dùng để tính EAC, VAC, cảnh báo hay báo cáo. | Estimated penalty amount (bn VND); can be entered before any penalty is applied. Currently stored in the profile only; not used for EAC, VAC, alerts or reports. |

Câu của mock-up KHÔNG dùng vì app không làm thế: "Bàn giao cam kết là mốc tính đồng hồ đếm ngược" (đồng hồ đang đếm tới HT kế hoạch, Q1 Đợt 2); "Không trừ vào EAC cho tới khi bật công tắc" (app không bao giờ trừ).

**Q3 — G-17: Ai được gán/gỡ PIC/Backup, gán cho ai.** Gán vào `project_assignments` là CẤP QUYỀN: data-entry được gán thì sửa được dự án, viewer được gán thì xem được dự án (`src/server/authz.ts:21-35`).
→ **MẶC ĐỊNH:** (a) chỉ **admin** được gán, đổi vai trò và gỡ. Data-entry thấy danh sách nhưng không sửa được. (b) PIC phải là tài khoản `data-entry` đang hoạt động. Backup là `data-entry` hoặc `viewer` đang hoạt động. Không gán `admin`/`bod` vì họ vốn thấy mọi dự án. (c) Mỗi dự án tối đa 1 PIC: gán PIC thứ hai → lỗi `pic_exists`. Gỡ PIC cuối cùng vẫn được, UI hiện chip "Dự án chưa có PIC". (d) Mọi thay đổi ghi `audit_log` + `activity_log`. (e) Cảnh báo tự sinh về sau giao cho PIC mới. Cảnh báo đang mở giữ owner cũ. Nếu cho PIC tự thêm Backup: sửa `setProjectMemberAction` ở Task 6 thành `requireWriteProject` + chặn data-entry đổi/gỡ PIC.

**Q4 — G-3: Quy tắc đổi mã CT.**
→ **MẶC ĐỊNH:** Mã mới phải hợp lệ: 1-40 ký tự, chỉ gồm chữ, số và `. _ - /`, không khoảng trắng. Mã mới không được trùng `masterCode`, `currentAliasCode` hay bất kỳ alias nào của dự án KHÁC (so không phân biệt hoa thường). Dùng lại mã cũ của chính dự án thì được. Bắt buộc có lý do ≥ 5 ký tự. Quyền như sửa hồ sơ (admin + data-entry được gán). `currentAliasCode` đổi NGAY. Dòng alias đang mở đóng `effectiveTo = hôm nay`, dòng mới mở `effectiveFrom = ngày mai`, đúng câu chữ mock-up dòng 900-901. Đổi lần hai trong cùng ngày (dòng mới chưa có hiệu lực) thì sửa mã của chính dòng chờ đó, không đẻ thêm dòng. Lúc TẠO dự án, ô Mã CT **không bắt buộc**: bỏ trống thì mã CT = mã gốc như hiện nay.

**Q5 — G-5: "Hàng chờ duyệt gộp" chủ đầu tư.**
→ **MẶC ĐỊNH:** Chủ đầu tư mới do **data-entry** tạo từ form: dùng được ngay, nhưng được đánh dấu `needsReview = true` (cột mới, migration Task 1). Chủ đầu tư do admin tạo thì không đánh dấu. Ở `/admin` › "Sửa danh mục", dòng chờ duyệt hiện chip "Chờ duyệt" và đứng đầu danh sách. Admin bấm "Duyệt" để giữ, hoặc dùng nút Merge có sẵn để gộp (gộp cũng bỏ cờ). Không áp cho Team KD.

**Q6 — G-4: Tên dự án VIẾT HOA hay viết thường?** Mock-up viết thường, tối đa 160 ký tự. App hiện ép VIẾT HOA, có hint "Viết hoa toàn bộ" (`vi.json` `form.hintLabel.projectName`).
→ **MẶC ĐỊNH:** giữ ép VIẾT HOA như quy ước đang chạy, chỉ thêm giới hạn 160 ký tự (client `maxLength` + server Zod). Đổi ý thì bỏ `.toUpperCase()` ở `ProjectForm` và sửa hint.

**Q7 — G-1: Đặt form ở đâu, bỏ gì.**
→ **MẶC ĐỊNH:** trang mới `/ho-so-du-an` (mục sidebar "Tạo / Sửa dự án", chỉ admin + data-entry), có nút gạt Tạo mới / Cập nhật. Bỏ `CreateProjectForm` khỏi `/nhap-lieu`, thay bằng nút dẫn sang trang mới. Bước "Hồ sơ dự án" của `DataEntryForm` thành thẻ dẫn sang `/ho-so-du-an?project=ID`. Bước "Mã SAP & Ảnh" chỉ còn Ảnh: SAP chuyển sang mục 6, Lịch sử mã vẫn xem ở Chi tiết dự án. Hệ quả: chỉ còn MỘT chỗ sửa hồ sơ, không có hai bộ luật validate lệch nhau.

**Q8 — Đổi trọng số có tính lại %TT tháng đã lưu không?** `pctActual` được tính và lưu lúc `saveMonthlyData` (`src/server/actions.ts:153-158`).
→ **MẶC ĐỊNH:** KHÔNG tính lại. Trọng số mới áp dụng từ lần lưu tiến độ kế tiếp. Hint dưới bảng trọng số ghi rõ câu này (key `projectForm.weights.nextSave`). Trong khoảng đó, dòng chân "Chuỗi giá trị" ở Chi tiết dự án (tính theo trọng số hiện tại) có thể lệch KPI %TT.

**Q9 — Nợ P3A khác trong `danh-gia.md` P1A dòng 49-53** (P2002 hai người lưu cùng lúc, `formsEqual` so chuỗi thô, text `financeReadonly`, `precheckPhotos`, `mockRestore`).
→ **MẶC ĐỊNH:** KHÔNG làm trong P3A, vì yêu cầu chỉ giao F6. Chủ dự án muốn gộp thì báo để planner thêm Task.

**Thông báo (không phải câu hỏi):** Để giới hạn "tối đa 10MB" là thật, Task 2 phải nâng `experimental.serverActions.bodySizeLimit` lên `'11mb'`. Mặc định Next 14 là 1MB, nên hiện tại tệp import 1-10MB bị framework chặn trước khi tới validate. Việc này nới giới hạn body cho MỌI server action. Security-reviewer cần xem, và reverse proxy ở P6 cũng phải cho body ≥ 11MB.

---

## Global Constraints (áp cho MỌI Task)

1. **Hai tài khoản** (`CLAUDE.md` mục 3): trước khi sửa file nóng `src/i18n/messages/vi.json`, `en.json`, `src/server/actions.ts`, `src/server/repo/prisma-repo.ts` phải đọc `D:\_project\DDC_dieu-phoi\phien-B.md`. Nếu B không giữ file đó thì ghi file vào mục "Đang giữ" của `phien-A.md`, và bỏ ra sau khi commit. `schema.prisma` + `prisma/migrations/` A đang giữ. KHÔNG cần sửa `app/globals.css`, `queries.ts`, `project-queries.ts`: mọi class dùng tới (`.fsec .f4 .seg .switch .tagbox .stickybar .sumbar .help .msdetail`) đã có ở `app/globals.css:86-403`. Sau MỖI commit, cập nhật `phien-A.md`.
2. **KHÔNG sửa** `PROGRESS.md`, `.serena/memories/`, phần thông báo (`notify_channel`, `notify_recipient`, P3B), trang `/admin/page.tsx` (P3B của B đang có thể sửa; G-5 chỉ sửa `FieldEditor.tsx`).
3. **Repo:** tầng trên chỉ import `repo` từ `@/server/repo`. Hàm mới phải có ở CẢ mock (sync) lẫn prisma (async), cùng tên, cùng tham số. Hàm P3A đặt ở `src/server/repo/mock-repo-form.ts` và `src/server/repo/prisma-repo-form.ts`, gộp bằng spread như `mock-repo.ts:948` và `prisma-repo.ts:1146`. Kiểu dữ liệu mới khai ở `src/server/repo/types.ts`. Không đụng `read-mock.ts` / `read-prisma.ts` (script `check:read` so parity hai file đó).
4. **Clock:** "hôm nay" = `todayIso()` (`src/lib/clock.ts`), cộng ngày bằng `addDaysIso`, trừ ngày bằng `daysBetween`. Không dùng `new Date()` trong logic nghiệp vụ. `new Date().toISOString()` chỉ được dùng cho timestamp ghi DB, như code hiện có.
5. **Append-only:** không UPDATE fact. Bảng cấu hình (`project_stage_weight`, `project_equipment_plan`, `project_key_milestone`) được thay toàn bộ trong 1 transaction, kèm 1 dòng audit trước→sau (khuôn `replaceKeyMilestones`, `prisma-repo.ts:1075-1094`). Mọi ghi hồ sơ đi qua `repo.saveProjectProfile`, hàm này tự chụp `project_history`.
6. **Authz:** mọi action ghi dự án dùng `requireWriteProject(projectId)` (`src/server/action-guards.ts:13`), trừ khi Task ghi khác. Action chỉ-admin dùng `requireRoleUser(['admin'])`. Page tự kiểm role phía server, không phó mặc middleware (mẫu `app/[locale]/(app)/nhap-lieu/page.tsx:18-23`). Không bao giờ truyền `passwordHash` ra client.
7. **Mọi action mới** trả `{ ok: true, ... } | { ok: false, error: '<mã>' }`, không throw ra UI. Action ảnh hưởng ngày/tiến độ phải gọi `await runAlertEngineSafe(projectId).catch(() => {})`. Mỗi action gọi `logActivity(user, '<action>', detail)`. Mỗi `<action>` mới PHẢI có key `activity.<action>` ở cả vi và en, thêm vào CUỐI object `"activity"` có sẵn. Test `src/i18n/messages.test.ts` quét mọi literal `logActivity` dưới `src/server/`.
8. **i18n:** key mới nằm trong nhóm riêng, thêm ở CUỐI file JSON, sau `"alertClose"`: `projectForm`, `importLimit`, `customerReview`, `equipmentPlan`. Nội dung đầy đủ ở **Phụ lục A**. Có 2 ngoại lệ bắt buộc: `activity.*` (mục 7) và đổi GIÁ TRỊ (không đổi key) ở Task 9. Chuỗi mới KHÔNG dùng em-dash "—", dùng "-". File mới có `t('…')` với key literal phải thêm vào `CHANGED_SOURCES` trong `src/i18n/messages.test.ts:37-57`.
9. **Style:** trong `.tsx` cấm mã màu hex, cấm `dark:`, cấm palette Tailwind cũ. Màu luôn là `var(--token)` (test `src/ui/legacy-style-guard.test.ts`). Chữ đứng cạnh phần tử trong ô không phải flex phải có `{' '}` tường minh.
10. **Test:** Vitest chỉ chạy `src/**/*.test.ts`, env `node`, không DOM. Test component: `React.createElement` + `renderToStaticMarkup`, shim `(globalThis as any).React = React`, mock `next-intl` theo `src/components/admin/ActivityViewer.test.ts:26-29`. Test action: mock `next/cache`, `@/server/repo` → mock-repo, `@/lib/session` theo `src/server/actions-entry.test.ts:1-31`. Test prisma-repo: mock `@/server/db` theo `src/server/repo/prisma-repo-key-milestones.test.ts`. Test page guard theo `src/server/nhap-lieu-page-guard.test.ts`.
11. **Lệnh (PowerShell, ổ `D:` viết hoa; Git Bash cho lỗi giả "No test suite found"):** `Set-Location D:\_project\DDC_Control_Tower; npx vitest run <file>` · `npx tsc --noEmit` · `npm test`. Mốc trước P3A: **119 file / 1378 test xanh**, không được tụt.
12. **Commit** mỗi Task 1 lần: `feat(p3a): <mô tả tiếng Việt KHÔNG dấu>`. Cuối Task ghi vào `.bangiao/thay-doi.md`.
13. **Không bịa số:** thiếu dữ liệu thì hiện "-" hoặc trạng thái trống. Chia cho 0 trả `null`.

---

## File Structure

**Tạo mới**
| File | Trách nhiệm | Task |
|---|---|---|
| `prisma/migrations/20260925100000_p3a_customer_review/migration.sql` | 2 cột `dim_customer` (G-5) | 1 |
| `prisma/rollback/20260925100000_p3a_customer_review.down.sql` | Hoàn tác migration | 1 |
| `src/lib/import-limits.ts` (+test) | `IMPORT_MAX_BYTES`, `IMPORT_MAX_MB`, `isImportTooBig` | 2 |
| `src/components/form/import-limit-note.test.ts` | Ghi chú 10MB có ở 2 màn import | 2 |
| `src/lib/project-form.ts` (+test) | State form, chuỗi ngày, đếm trường, validate, dựng input/patch | 3, 8 |
| `src/lib/project-code.ts` (+test) | Luật mã CT + kế hoạch đổi alias | 3 |
| `src/server/project-profile-rules.ts` (+test) | Luật hồ sơ phía server (G-4/7/8/11/12) | 3 |
| `src/server/repo/mock-repo-form.ts`, `prisma-repo-form.ts` | Hàm repo P3A | 4, 12 |
| `src/server/repo/form.test.ts`, `prisma-repo-form.test.ts` | Test repo | 4, 12 |
| `src/server/actions-project.ts` | Action hồ sơ/mã/trọng số/SAP/PIC/duyệt CĐT | 5, 6 |
| `src/server/actions-project.test.ts`, `actions-members.test.ts` | Test action | 5, 6 |
| `src/components/ui/Switch.tsx` (+test) | Công tắc `.switch` | 7 |
| `src/components/form/StageWeightEditor.tsx` (+test) | Bảng trọng số 7 giai đoạn | 7 |
| `src/components/project/ProjectAuditCard.tsx` (+test) | Thẻ dấu vết thay đổi (server-safe) | 7 |
| `app/[locale]/(app)/ho-so-du-an/page.tsx` | Trang Tạo / Sửa | 8 |
| `src/server/ho-so-du-an-page-guard.test.ts` | Guard trang | 8 |
| `src/components/form/ProjectForm.tsx` | Form 6 mục + thanh dính | 8 |
| `src/components/form/ProjectLinksSection.tsx` | Mục 6: SAP, PIC/Backup, nhà thầu | 8 |
| `src/lib/drafts.ts` (+test) | Chủ bản nháp, xoá nháp khi logout | 10 |
| `src/lib/project-draft.ts` (+test) | Bản nháp ProjectForm | 10 |
| `src/lib/equipment-plan.ts` (+test) | Validate kế hoạch thiết bị | 12 |
| `src/components/form/EquipmentPlanEditor.tsx` (+test) | Bảng nhập kế hoạch thiết bị | 12 |
| `src/server/actions-equipment-plan.test.ts` | Test action Task 10 | 12 |
| `src/lib/stage-weight-presets.ts` (+test) | Bộ trọng số theo loại (ĐÃ CHỐT Q1) | 13 |

**Sửa:** `prisma/schema.prisma` (1) · `src/server/repo/types.ts` (1, 4, 12) · `src/data/seed/dims.ts`, `src/data/seed/history.ts` (1) · `src/lib/schema-meta/docs.ts` + file do `npm run docs:erd` sinh (1) · `src/server/validation.ts` (2, 5, 6, 12) · `src/components/form/ImportPanel.tsx`, `DailyImportBlock.tsx` (2) · `next.config.mjs` (2) · `src/lib/fx.ts` (+test, 3) · `src/server/repo/mock-repo.ts`, `prisma-repo.ts` (1, 4) · `src/server/actions.ts` (5, 6) · `src/server/actions-entry.ts` (12) · `src/server/actions-key-milestones.test.ts` (5) · `src/components/form/DataEntryForm.tsx`, `dataEntryState.ts` (+test) (9, 10) · `app/[locale]/(app)/nhap-lieu/page.tsx` (9, 10, 12) · `app/[locale]/(app)/projects/[id]/page.tsx` + `src/server/projects-detail-page-render.test.ts` (9) · `src/components/layout/AppShell.tsx`, `middleware.ts` (9) · `src/server/nhap-lieu-page-guard.test.ts` (9) · `src/components/layout/SettingsMenu.tsx`, `ChangePasswordModal.tsx` (+test) (10) · `src/components/admin/FieldEditor.tsx` (11) · `vi.json`, `en.json`, `src/i18n/messages.test.ts` (2, 5-14). **Xoá:** `src/components/form/CreateProjectForm.tsx` (9).

---

### Task 1: Migration G-5 + kiểu dữ liệu nền

**Files:** `prisma/schema.prisma` (model `Customer`, dòng 67-80) · migration + rollback mới · `src/server/repo/types.ts` (`Customer`, dòng 33-40) · `src/data/seed/dims.ts` · `src/data/seed/history.ts` (`SEED_VERSION`) · `src/lib/schema-meta/docs.ts` (`TABLE_DOCS.dim_customer.fields`) · `prisma-repo.ts` (`getDims` dòng 466-469, `getDimFieldValues` dòng 566-578) · `mock-repo.ts` (`getDimFieldValues` dòng 393-402) · `src/components/admin/FieldEditor.tsx` (`DimValueRow`).

**Interfaces — Produces:** `Customer.needsReview: boolean`, `Customer.createdBy: string`. `getDimFieldValues()` trả thêm `needsReview: boolean` (team luôn `false`). `DimValueRow.needsReview: boolean`.

- [ ] Schema: thêm vào `model Customer`:
  `needsReview Boolean @default(false)` và `createdBy String @default("system")`.
- [ ] `migration.sql` (comment không dấu, khuôn `20260924150000_p2a_entry_foundation/migration.sql`):
```sql
-- P3A: G-5 chu dau tu moi tao tu form vao hang cho duyet gop.
BEGIN;
ALTER TABLE "dim_customer" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT 'system';
COMMIT;
```
- [ ] `prisma/rollback/20260925100000_p3a_customer_review.down.sql` (khuôn `20260924150000_p2a_entry_foundation.down.sql`): trong `BEGIN/COMMIT`, `DROP COLUMN "createdBy"`, `DROP COLUMN "needsReview"`, rồi `DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260925100000_p3a_customer_review';`. Dòng 2 ghi lệnh chạy như file mẫu.
- [ ] Seed: `dims.ts` bọc mảng `customers` bằng `.map((c) => ({ ...c, needsReview: false, createdBy: 'system' }))`, hoặc thêm trực tiếp 2 field. Tăng `SEED_VERSION` để file `.data/ddc-mock.json` cũ bị bỏ.
- [ ] `docs.ts`: `needsReview: 'true = chủ đầu tư do data-entry tạo từ form, chờ admin duyệt hoặc gộp (G-5)'`, `createdBy: 'email người tạo; system = seed/import'`. Chạy `npm run docs:erd`. Không có bảng mới nên `ERD_LAYOUT` giữ nguyên.
- [ ] Map 2 field mới ở `getDims` (prisma). Thêm `needsReview` vào kết quả `getDimFieldValues` ở cả hai repo.
- [ ] Chạy `npx prisma migrate deploy` → `npx prisma generate` (client rỗng thì dùng `node node_modules/prisma/build/index.js generate`) → `npx prisma db seed` → `npx prisma migrate status` (up to date).
- **Test:** `src/lib/schema-meta/docs.test.ts`, `erd-doc.test.ts` xanh. `npx tsc --noEmit` sạch.
- **Xong khi:** migrate deploy chạy được trên `ddc_control_tower`. Chạy file rollback trên DB tạm rồi deploy lại vẫn được (ghi kết quả vào `thay-doi.md`). `npm test` xanh.
- Commit: `feat(p3a): migration dim_customer needsReview + createdBy (G-5)`.

### Task 2: Ghi chú "tối đa 10MB" ở mọi màn import

**Files:** tạo `src/lib/import-limits.ts` (+test) · sửa `src/server/validation.ts:156-157` · `ImportPanel.tsx:91-107` · `DailyImportBlock.tsx:87-95` · `next.config.mjs` · vi/en (`importLimit`) · `messages.test.ts`.

**Interfaces — Produces:**
```ts
// src/lib/import-limits.ts
export const IMPORT_MAX_MB = 10;
export const IMPORT_MAX_BYTES = IMPORT_MAX_MB * 1024 * 1024;
export function isImportTooBig(size: number): boolean; // size > IMPORT_MAX_BYTES
```
- [ ] `validation.ts`: xoá dòng khai báo, thêm `import { IMPORT_MAX_BYTES } from '@/lib/import-limits';` và `export { IMPORT_MAX_BYTES };`. Giá trị giữ 10MB. Test `actions-security.test.ts:93-101` phải vẫn xanh.
- [ ] Hai màn import (`/import` → `ImportPanel`, `/nhap-lieu` bước Nhân lực & Thiết bị → `DailyImportBlock`) đều thêm dòng `<p className="hintline">{t('importLimit.note', { mb: IMPORT_MAX_MB })}</p>` ngay dưới ô chọn tệp. Trước khi gọi action: `if (isImportTooBig(file.size))` thì hiện `t('importLimit.tooBig', { name: file.name, mb: IMPORT_MAX_MB })` (ImportPanel dùng `<p className="sumbar bad">`, DailyImportBlock dùng khối `err` riêng), và KHÔNG gọi action.
- [ ] `next.config.mjs`: `const nextConfig = { reactStrictMode: true, experimental: { serverActions: { bodySizeLimit: '11mb' } } };`. Thêm comment: "tệp import 10MB (IMPORT_MAX_BYTES) + phần đầu multipart; mặc định Next 14 là 1MB".
- [ ] Trần giải nén 20MB / 200 entry trong `src/server/daily-import.ts` GIỮ NGUYÊN, không sửa.
- **Test:** `import-limits.test.ts`: đúng 10MB → `false`; 10MB + 1 → `true`. `import-limit-note.test.ts`: render `ImportPanel` (props rỗng) và `DailyImportBlock` (`disabled: false`), mock `next/navigation` (`useRouter` → `{ refresh(){} }`) + `next-intl`, assert markup chứa `importLimit.note`. Thêm `ImportPanel`, `DailyImportBlock` vào `CHANGED_SOURCES`.
- **Xong khi:** test xanh. Chạy `npm run dev`, import tệp .xlsx khoảng 5MB ở `/vi/import`: request tới được action, không lỗi 413 "Body exceeded".
- Commit: `feat(p3a): ghi chu toi da 10MB o man import + nang bodySizeLimit server action`.

### Task 3: Luật thuần — chuỗi ngày, quy đổi nguyên tệ, mã CT, luật hồ sơ server

**Files:** tạo `src/lib/project-form.ts` (phần luật; phần state làm ở Task 8), `src/lib/project-code.ts`, `src/server/project-profile-rules.ts` (đều kèm test) · sửa `src/lib/fx.ts` (+ `fx.test.ts`).

**Interfaces — Produces:**
```ts
// src/lib/project-form.ts (phần Task 3)
export const PROJECT_NAME_MAX = 160;
export const REQUIRED_DATE_FIELDS = ['plannedStartDate', 'plannedFinishDate', 'committedHandoverDate'] as const;
export type DateIssueCode = 'plan_order' | 'handover_before_finish' | 'contract_after_start' | 'actual_order';
export interface DateChainInput { contractDate: string; plannedStartDate: string; plannedFinishDate: string;
  committedHandoverDate: string; actualStartDate: string; actualFinishDate: string } // '' = trống; nhận cả ISO đầy đủ (lấy 10 ký tự)
export interface DateChainResult { hard: DateIssueCode[]; startDelayDays: number | null; totalPlanDays: number | null }
export function checkDateChain(i: DateChainInput): DateChainResult;
export function dateInput(v: string | null | undefined): string; // như toDateInput ở dataEntryState.ts:41-44

// src/lib/fx.ts (thêm)
export function findMonthRate(rates: ExchangeRate[], currency: CurrencyCode, ym: YearMonth): number | null; // 'VND' → 1
export function toVndBillion(original: number, rateToVnd: number): number; // Math.round(original*rate/1e9*1e6)/1e6

// src/lib/project-code.ts
export const PROJECT_CODE_MAX = 40;
export const PROJECT_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/;
export function normalizeProjectCode(s: string): string; // trim
export function isValidProjectCode(s: string): boolean;  // sau trim: 1..40 ký tự và khớp RE
export interface AliasChangePlan {
  closeId: number | null; closeTo: IsoDate | null;          // đóng dòng đang mở
  retypeId: number | null;                                   // đổi lần 2 trong ngày: sửa mã dòng chờ
  insertOld: Omit<ProjectAlias, 'id'> | null;                // dự án chưa có dòng alias nào đang mở
  insertNew: Omit<ProjectAlias, 'id'> | null;
}
export function planAliasChange(a: { projectId: number; aliases: ProjectAlias[]; oldCode: string; newCode: string;
  today: IsoDate; reason: string; by: string; projectCreatedAt: string }): AliasChangePlan;

// src/server/project-profile-rules.ts (KHÔNG 'use server')
export type ProfileRuleError = 'name_too_long' | 'tonnage_required' | 'date_required' | 'date_plan_order'
  | 'date_handover_before_finish' | 'date_contract_after_start' | 'date_actual_order'
  | 'fx_contract_date_required' | 'fx_rate_missing';
export type ProfileFields = Pick<Project, 'projectName' | 'tonnage' | 'currencyCode' | 'contractValue'
  | 'contractValueOriginal' | 'contractDate' | 'plannedStartDate' | 'plannedFinishDate'
  | 'committedHandoverDate' | 'actualStartDate' | 'actualFinishDate'>;
export function checkProfileRules<P extends Partial<ProfileFields>>(before: ProfileFields | null, patch: P, rates: ExchangeRate[])
  : { ok: true; patch: P } | { ok: false; error: ProfileRuleError };
```
**Luật `checkDateChain`** (ngày không hợp lệ theo `isValidIsoDate` coi như trống; so chuỗi `YYYY-MM-DD`):
- `plan_order`: có cả BĐ và HT KH, và BĐ ≥ HT.
- `handover_before_finish`: có cả Bàn giao và HT KH, và Bàn giao < HT KH.
- `contract_after_start`: có cả Ký và BĐ KH, và Ký > BĐ KH.
- `actual_order`: có cả BĐ TT và HT TT, và HT TT < BĐ TT.
- `startDelayDays` = `daysBetween(BĐ KH, BĐ TT)` khi có cả hai, ngược lại `null`. Đây chỉ là cảnh báo, không chặn.
- `totalPlanDays` = `daysBetween(BĐ, HT)` khi có cả hai và BĐ < HT, ngược lại `null`.

**Luật `planAliasChange`** (`tomorrow = addDaysIso(today, 1)`; `open` = dòng `effectiveTo == null`):
1. `open` tồn tại và `open.effectiveFrom.slice(0,10) > today` → `retypeId = open.id`, các trường khác null.
2. `open` tồn tại → `closeId = open.id`, `closeTo = today`, `insertNew = { projectId, aliasCode: newCode, aliasType: 'Ma_CT', effectiveFrom: tomorrow, effectiveTo: null, reason, approvedBy: by }`.
3. Không có `open` → `insertOld = { aliasCode: oldCode, aliasType: 'Ma_CT', effectiveFrom: min(projectCreatedAt.slice(0,10), today), effectiveTo: today, reason: 'Mã trước khi đổi', approvedBy: by }` + `insertNew` như (2).

**Luật `checkProfileRules`** (`before === null` = TẠO; `merged = { ...before, ...patch }`, ngày lấy 10 ký tự):
1. `patch.projectName !== undefined` và độ dài sau trim > 160 → `name_too_long`.
2. Tạo mới: `!(merged.tonnage > 0)` → `tonnage_required`. Sửa: `patch.tonnage !== undefined && !(patch.tonnage > 0)` → `tonnage_required`.
3. Tạo mới: thiếu 1 trong `REQUIRED_DATE_FIELDS` → `date_required`. Sửa: patch đặt 1 trong 3 field đó = `null` → `date_required`.
4. Chuỗi ngày trên `merged`. Một luật chỉ được xét khi đang TẠO, hoặc khi ít nhất 1 trong 2 ngày của luật có mặt trong `patch`. Lý do: dữ liệu cũ đang lệch không được chặn các lần lưu không đụng tới nó. Map mã lỗi: `plan_order` → `date_plan_order`, và tương tự cho 3 luật còn lại.
5. G-7, chỉ xét khi TẠO hoặc patch có `contractValueOriginal` / `currencyCode` / `contractDate`:
   - `merged.currencyCode === 'VND'`: nếu `merged.contractValueOriginal != null` thì `patch.contractValueOriginal = null`.
   - Ngoại tệ và `merged.contractValueOriginal != null`: không có `merged.contractDate` → `fx_contract_date_required`. `rate = findMonthRate(rates, cur, contractDate.slice(0,7))` là `null` → `fx_rate_missing`. Có rate → `patch.contractValue = toVndBillion(original, rate)`, ghi đè số client gửi.
   - Ngoại tệ nhưng không có nguyên tệ → giữ `contractValue` nhập tay, như dữ liệu cũ.
   - Sau khi đã lưu, không bao giờ tính lại khi tỷ giá đổi ("chốt cứng", mock-up dòng 950-951).

- **Test** (viết trước, chạy đỏ, rồi làm): mỗi luật có 1 ca đúng + 1 ca sai. Các ca bắt buộc phải có:
  - `checkDateChain` nhận `'2026-01-01T00:00:00.000Z'`.
  - `startDelayDays` âm khi khởi công sớm.
  - `toVndBillion(1_000_000, 25400) === 0.0254`.
  - `findMonthRate` của VND trả 1, tháng không có rate trả `null`.
  - `planAliasChange` đủ 3 nhánh.
  - `isValidProjectCode`: `'DDC-2026-0147'` và `'TSN/T3.KC_1'` đúng; `' '`, `'A B'`, chuỗi 41 ký tự, `'-ABC'` sai.
  - `checkProfileRules`: dự án seed có ngày lệch vẫn lưu được khi patch chỉ có `projectName`. USD + nguyên tệ + ngày ký 2026-09-xx (seed có rate 25400) → `contractValue` bị ghi đè. Ngày ký 2025-01-15 → `fx_rate_missing`. VND → `contractValueOriginal` về `null`.
- **Xong khi:** 3 file test + `fx.test.ts` xanh, tsc sạch.
- Commit: `feat(p3a): luat thuan chuoi ngay, quy doi nguyen te, ma CT, luat ho so server`.

### Task 4: Repo lớp form (mock + prisma)

**Files:** tạo `mock-repo-form.ts`, `prisma-repo-form.ts`, `form.test.ts`, `prisma-repo-form.test.ts` · sửa `mock-repo.ts` (spread + `createProject` dòng 842-897 + `addAssignment` dòng 899-907 + `createDimValue` dòng 351-365 + `mergeDimValue` dòng 375-391) · `prisma-repo.ts` (spread dòng 1146 + `createProject` dòng 1026-1065 + `createDimValue` dòng 513-524 + `mergeDimValue` dòng 540-553) · `types.ts`.

**Interfaces — Produces** (mock sync, prisma `Promise<…>`, cùng tên):
```ts
// types.ts
export interface StageWeightInput { stageCode: StageCode; weightPct: number; applicable: boolean }
export interface ProjectMember { userEmail: string; name: string; role: Role | null; // null = không còn tài khoản
  roleInProject: 'PIC' | 'Backup'; assignedBy: string; assignedAt: string }
export interface CreateProjectInput { projectName: string; customerId: number; teamKdId: number; marketCode: Market;
  projectType: ProjectType; priority: Priority; contractValue: number; tonnage?: number; currencyCode?: CurrencyCode;
  contractDate?: string | null; plannedStartDate?: string | null; plannedFinishDate?: string | null;
  committedHandoverDate?: string | null; penaltyValue?: number | null;
  actualStartDate?: string | null; actualFinishDate?: string | null; penalized?: boolean;
  factoryId?: number | null; contractValueOriginal?: number | null; currentAliasCode?: string }

// repo (mock-repo-form.ts: export function makeFormMockRepo({ getData, persist }: EntryMockDeps) ; prisma-repo-form.ts: export const formPrismaRepo)
createProject(input: CreateProjectInput, changedBy?: string): Project   // SỬA hàm có sẵn, nhận field mới
isProjectCodeTaken(code: string, exceptProjectId: number | null): boolean
changeProjectCode(projectId: number, newCode: string, reason: string, by: string, today: IsoDate): 'changed' | 'unchanged' | 'not_found'
replaceStageWeights(projectId: number, rows: StageWeightInput[], by: string): void
removeSapCode(projectId: number, sapCodeId: number, by: string): 'removed' | 'not_found'
getProjectMembers(projectId: number): ProjectMember[]              // PIC trước, rồi email tăng dần
setProjectMember(projectId: number, email: string, roleInProject: 'PIC' | 'Backup', by: string): 'added' | 'changed' | 'unchanged'
removeProjectMember(projectId: number, email: string, by: string): 'removed' | 'not_member'
approveCustomer(id: number, by: string): 'approved' | 'not_found' | 'not_pending'
readProjectAuditTrail(projectId: number, limit: number): AuditLogEntry[]  // changedAt giảm dần
createDimValue(field: 'customer' | 'team', name: string, opts?: { needsReview?: boolean; by?: string }): number // SỬA
```
**Hành vi:**
- `createProject`: lưu thêm các field mới (thiếu → `null`/`false`). Nếu có `currentAliasCode`: dùng nó thay mã `M-xxxxx` cho `currentAliasCode` (`masterCode` vẫn `M-xxxxx`), và chèn 1 dòng alias `{ aliasType: 'Ma_CT', effectiveFrom: todayIso(), effectiveTo: null, reason: 'Mã CT khi tạo dự án', approvedBy: changedBy }`.
- `isProjectCodeTaken`: so `trim().toLowerCase()` với `masterCode`, `currentAliasCode` của MỌI dự án khác `exceptProjectId`, và với `aliasCode` của alias thuộc dự án khác. Prisma dùng `mode: 'insensitive'`.
- `changeProjectCode`: không có dự án → `'not_found'`. `newCode === currentAliasCode` → `'unchanged'`. Ngược lại, trong 1 transaction: áp `planAliasChange` (ngày alias lưu `new Date(\`${d}T00:00:00Z\`)`), chụp `project_history` (`note: 'currentAliasCode: A → B'`), cập nhật `currentAliasCode`, `updatedAt`, `updatedBy`, và audit `('dim_project_alias', String(projectId), 'aliasCode', old, new, by, reason)`. Prisma dùng `audit(tx, …)` export từ `prisma-repo-entry.ts:19`. Mock dùng `audit` export từ `mock-repo-entry.ts:337`.
- `replaceStageWeights`: xoá rồi tạo đúng 7 dòng trong 1 transaction. Audit `('project_stage_weight', String(projectId), 'replace', before, after, by)`. Chuỗi mô tả dạng `design:5,shop:10,…`, giai đoạn không áp dụng thêm `(x)`. `before` lấy từ `getStageWeights`; dự án chưa có dòng riêng thì thêm tiền tố `default `.
- `removeSapCode`: chỉ xoá khi dòng tồn tại VÀ `row.projectId === projectId`, ngược lại `'not_found'`. Audit `('project_sap_codes', String(projectId), 'remove', sapCode, '', by)`.
- `setProjectMember`: upsert khoá `(projectId, email)`, `assignedBy = by`, `assignedAt = now`. Audit `('project_assignments', \`${projectId}/${email}\`, 'roleInProject', cũ ?? '', mới, by)`. Cùng vai trò → `'unchanged'`, không ghi audit.
- `removeProjectMember`: audit `(…, 'roleInProject', cũ, '', by)`.
- `addAssignment` ở mock: sửa thành upsert, cho khớp prisma (`prisma-repo.ts:1067-1073`).
- `approveCustomer`: có cờ → set `needsReview = false`, audit `('dim_customer', String(id), 'needsReview', 'true', 'false', by)`.
- `createDimValue`: với `customer`, bản ghi MỚI nhận `needsReview: opts?.needsReview ?? false`, `createdBy: opts?.by ?? 'system'`. Trùng tên/alias thì trả id cũ, không đổi cờ.
- `mergeDimValue` (customer): bản ghi nguồn thêm `needsReview = false`.
- `readProjectAuditTrail`: dòng có (`tableName` ∈ `['dim_project','dim_project_alias','project_key_milestone','project_sap_codes','project_stage_weight','project_equipment_plan']` và `recordId === String(id)`) HOẶC (`tableName` ∈ `['project_contractor','project_assignments']` và `recordId` bắt đầu bằng `${id}/`), `take: limit`.
- **Test** `form.test.ts` (mock-repo, `repo.reset()` trong `beforeEach`), mỗi hàm tối thiểu 2 ca, trong đó bắt buộc:
  - Đổi mã dự án 1 → dòng alias đang mở bị đóng tới `2026-09-16`, dòng mới từ `2026-09-17`.
  - Đổi lần 2 trong cùng ngày → số dòng alias không tăng.
  - Đổi mã dự án 17 (chưa có alias) → có `insertOld` + `insertNew`.
  - `isProjectCodeTaken` với mã của dự án khác → `true`; với mã cũ của chính nó → `false`.
  - `removeSapCode` với id SAP của dự án khác → `'not_found'`, và mã vẫn còn.
  - PIC trùng không được chặn ở tầng repo (luật `pic_exists` nằm ở action).
  - `readProjectAuditTrail` không trả dòng của dự án `11` khi hỏi dự án `1` (đề phòng `startsWith('1/')` khớp nhầm `'11/'`: phải so tiền tố `${id}/` đầy đủ).
- **Test** `prisma-repo-form.test.ts`: mock `@/server/db`, xác minh `changeProjectCode`, `replaceStageWeights`, `replaceEquipmentPlans` (Task 12) đều chạy trong `$transaction` và gọi `auditLog.create`.
- **Xong khi:** test xanh, tsc sạch. `npm run check:read` vẫn OK (không đụng read repo).
- Commit: `feat(p3a): repo form - ma CT/alias, trong so, go SAP, PIC/Backup, duyet CDT, dau vet`.

### Task 5: Action hồ sơ (G-2/3/4/7/8/10/11/12/15/16 phía server)

**Files:** tạo `src/server/actions-project.ts` (`'use server'`), `actions-project.test.ts` · sửa `validation.ts`, `actions.ts` (`createProjectAction` dòng 212-246, `saveMonthlyData` dòng 85-148), `actions-key-milestones.test.ts:69-72` · vi/en (`activity.*`).

**Interfaces — Consumes:** Task 3, Task 4. **Produces:**
```ts
// validation.ts
export const stageWeightRowsSchema;   // array 7 phần tử {stageCode: enum STAGE_CODES, weightPct: number 0..100, applicable: boolean}, refine 7 mã khác nhau
export const updateProjectSchema;     // z.object({ projectId: int>0, patch: z.object(PROFILE_SHAPE).partial().strict() })
export const projectCodeSchema;       // { projectId, code: string trim 1..40 refine isValidProjectCode, reason: string trim 5..300 }
export const removeSapSchema;         // { projectId, sapCodeId: int>0 }
// createProjectSchema SỬA: tonnage z.number().positive() BẮT BUỘC; plannedStartDate/plannedFinishDate/committedHandoverDate = isoDate BẮT BUỘC;
//   contractDate/actualStartDate/actualFinishDate = isoDate.nullable().optional(); thêm penalized, factoryId (int>0 nullable), contractValueOriginal
//   (number>0 nullable), currentAliasCode (optional, refine isValidProjectCode), stageWeights (optional, stageWeightRowsSchema); projectName max 160.
// PROFILE_SHAPE (const nội bộ): projectName (trim 1..160), customerId, teamKdId, marketCode, projectType, priority, contractValue (>0),
//   tonnage (>=0), currencyCode, contractValueOriginal (>0 nullable), 6 ngày isoDate.nullable(), penaltyValue (>=0 nullable), penalized, factoryId (int>0 nullable)

// actions-project.ts
export type UpdateProjectPatch = Partial<Pick<Project, 'projectName'|'customerId'|'teamKdId'|'marketCode'|'projectType'|'priority'
  |'contractValue'|'tonnage'|'currencyCode'|'contractValueOriginal'|'contractDate'|'plannedStartDate'|'plannedFinishDate'
  |'committedHandoverDate'|'actualStartDate'|'actualFinishDate'|'penaltyValue'|'penalized'|'factoryId'>>;
export async function updateProjectAction(projectId: number, patch: UpdateProjectPatch):
  Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' | 'invalid_factory' | ProfileRuleError }>;
export async function changeProjectCodeAction(projectId: number, code: string, reason: string):
  Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' | 'code_taken' | 'unchanged' }>;
export async function saveStageWeightsAction(projectId: number, rows: StageWeightInput[]):
  Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' | 'weights_invalid' }>;
export async function removeSapCodeAction(projectId: number, sapCodeId: number):
  Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' }>;
// actions.ts: createProjectAction(input: CreateProjectInput & { keyMilestones?: KeyMilestoneInput[]; stageWeights?: StageWeightInput[] })
//   → { ok: true; id } | { ok: false; error: 'Forbidden' | string(ProfileRuleError | 'code_taken' | 'weights_invalid' | 'invalid_factory' | Zod message) }
```
**Chuỗi xử lý:**
- `updateProjectAction`: `requireWriteProject` → parse → `getProject` (không có → Not found) → `factoryId` khác null thì phải là khu vực active (khuôn `actions.ts:119-122`, lỗi `invalid_factory`) → `checkProfileRules(project, patch, await repo.getExchangeRates())` → patch rỗng thì trả `{ ok: true }`, không ghi → `repo.saveProjectProfile(id, rules.patch, email)` → `runAlertEngineSafe` → `logActivity(user, 'update_project', \`project ${id}\`)` → `revalidateTag(profileTag)`, `trendTag`, và `overviewTag(m)` + `listTag(m)` cho mọi `historyMonths()` (khuôn `actions.ts:239-244`).
- `changeProjectCodeAction`: `requireWriteProject` → parse → dự án tồn tại → `isProjectCodeTaken(code, id)` → `code_taken` → `repo.changeProjectCode(id, code, reason, email, todayIso())` → `'unchanged'` thì trả lỗi `unchanged` → `logActivity 'change_project_code'` → revalidate như trên.
- `saveStageWeightsAction`: `requireWriteProject` → parse → dự án tồn tại → `validateStageWeights(rows)` không ok → `weights_invalid` → `replaceStageWeights` → `logActivity 'save_stage_weights'` → revalidate `listTag`/`overviewTag`. KHÔNG tính lại fact (Q8).
- `removeSapCodeAction`: `requireWriteProject` → parse → `repo.removeSapCode` (`'not_found'` → Not found) → `logActivity 'remove_sap'`.
- `createProjectAction`: sau parse, gọi `checkProfileRules(null, input, rates)`. Có `currentAliasCode` mà `isProjectCodeTaken(code, null)` → `code_taken`. `stageWeights` không qua `validateStageWeights` → `weights_invalid`. Factory kiểm như trên. Sau `repo.createProject(rules.patch-đã-gộp, email)`: data-entry tự làm PIC (giữ như cũ) → có `stageWeights` thì `replaceStageWeights` → `keyMilestones` (giữ như cũ) → `runAlertEngineSafe(p.id)`.
- `saveMonthlyData`: ngay sau khi dựng `profilePatch` (dòng 126-144), gọi `checkProfileRules(project, profilePatch, rates)`. Lỗi → `return { ok: false, error }`. Thành công → dùng `rules.patch` thay `profilePatch`. Tính rates CHỈ khi `profileChanged`.
- Thêm vào cuối `activity` (vi/en): `update_project` Sửa hồ sơ dự án / Update project profile · `change_project_code` Đổi mã CT / Change contract code · `save_stage_weights` Lưu trọng số giai đoạn / Save stage weights · `remove_sap` Gỡ mã SAP / Remove SAP code.
- **Test** `actions-project.test.ts` (khuôn `actions-entry.test.ts:1-31`). Mỗi action có 5 ca quyền: admin ok · `pm@daidung.com.vn` (PIC dự án 1) ok · pm với dự án 16 → Forbidden · viewer → Forbidden · bod → Forbidden. Thêm các ca:
  - `updateProjectAction(1, { plannedStartDate: null })` → `date_required`.
  - Ngày lệch → `date_plan_order`.
  - `{ tonnage: 0 }` → `tonnage_required`.
  - Tên 161 ký tự → Invalid input.
  - USD + nguyên tệ + ngày ký tháng 2026-09 → `repo.getProject(1).contractValue` = số quy đổi.
  - Ngày ký 2025-01 → `fx_rate_missing`.
  - Patch có key lạ `{ masterCode: 'X' }` → Invalid input (`.strict()`).
  - `changeProjectCodeAction` với mã của dự án 2 → `code_taken`. Lý do 3 ký tự → Invalid input. Thành công → `getAliases(1)` có dòng mới từ `2026-09-17`.
  - `saveStageWeightsAction` tổng 99 → `weights_invalid`; tổng 100 → `getStageWeights(1)` đúng số vừa gửi.
  - `removeSapCodeAction(1, <id SAP của dự án 2>)` → Not found.
  - `createProjectAction` thiếu `tonnage` → lỗi; đủ field → ok, có `stageWeights` riêng, audit có `project_stage_weight`.
- Sửa `actions-key-milestones.test.ts` `base` thêm `tonnage: 100, plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31'`.
- **Xong khi:** `npm test` xanh (gồm `actions.test.ts`, `actions-security.test.ts`, `actions-valuechain.test.ts` không đổi), tsc sạch.
- Commit: `feat(p3a): action ho so du an, doi ma CT, trong so, go SAP + luat ho so dung chung`.

### Task 6: Action PIC/Backup (G-17) + duyệt chủ đầu tư (G-5)

**Files:** sửa `actions-project.ts`, `actions.ts` (`createDimValueAction` dòng 600-609), `validation.ts` · tạo `actions-members.test.ts` · vi/en (`activity.*`).

**Interfaces — Produces:**
```ts
export const projectMemberSchema; // { projectId: int>0, email: z.string().trim().toLowerCase().email(), roleInProject: z.enum(['PIC','Backup']) }
export async function setProjectMemberAction(projectId: number, email: string, roleInProject: 'PIC' | 'Backup'):
  Promise<{ ok: true; result: 'added' | 'changed' | 'unchanged' } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'user_not_found' | 'role_not_allowed' | 'pic_exists' }>;
export async function removeProjectMemberAction(projectId: number, email: string):
  Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_member' }>;
export async function approveCustomerAction(customerId: number):
  Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' | 'not_pending' }>;
```
- `setProjectMemberAction`: `requireRoleUser(['admin'])` (Q3) → parse → dự án tồn tại → `repo.findAccount(email)` phải có và `isActive`, ngược lại `user_not_found`. Vai trò: PIC cần `role === 'data-entry'`; Backup cần `'data-entry' | 'viewer'`. Sai → `role_not_allowed`. Gán PIC trong khi `getProjectMembers(id)` đã có PIC khác email này → `pic_exists` → `repo.setProjectMember(…, admin.email)` → `logActivity 'project_member_set'` (detail `project ${id} · ${email} · ${role}`) → `revalidateTag(profileTag)`.
- `removeProjectMemberAction`: admin → parse (`{ projectId, email }`) → `repo.removeProjectMember` → `logActivity 'project_member_remove'` → `revalidateTag(profileTag)`.
- `approveCustomerAction`: admin → `z.number().int().positive()` → `repo.approveCustomer` → `logActivity 'approve_customer'` → `revalidateTag(profileTag)`.
- `createDimValueAction`: gọi `repo.createDimValue(field, name, { needsReview: field === 'customer' && user.role !== 'admin', by: user.email })`.
- `activity` (vi/en): `project_member_set` Gán người phụ trách / Assign project member · `project_member_remove` Gỡ người phụ trách / Remove project member · `approve_customer` Duyệt chủ đầu tư / Approve customer.
- **Test** `actions-members.test.ts`. Tài khoản seed: `pm@` = data-entry PIC dự án 1,2,3,5,7,11; `viewer@` = Backup dự án 1,2,4,6,8,10.
  - pm gọi `setProjectMemberAction(1, …)` → Forbidden.
  - Admin gán `viewer@` làm PIC → `role_not_allowed`; gán `bod@` làm Backup → `role_not_allowed`.
  - Admin gán thêm PIC cho dự án 1 → `pic_exists`; đổi pm sang Backup ở dự án 1 → `changed`, rồi gán PIC mới được.
  - Gán email không tồn tại hoặc tài khoản bị khoá → `user_not_found`.
  - **Tích hợp authz:**
    - Admin gỡ pm khỏi dự án 1 → `saveKeyMilestonesAction(1, [])` với pm → Forbidden.
    - Admin gán pm làm Backup dự án 16 → pm lưu được dự án 16.
    - Admin gán `viewer@` làm Backup dự án 3 → `requireProjectRead(viewer, 3)` không ném `notFound`; `canWriteProject(viewer, 3) === false`. Mock `next/navigation.notFound` ném lỗi.
  - Audit có dòng `project_assignments`.
  - `createDimValueAction('customer', 'CDT Moi')` bởi pm → `needsReview === true`, `createdBy === 'pm@daidung.com.vn'`. Bởi admin → `false`.
  - `approveCustomerAction` bởi pm → Forbidden. Duyệt 2 lần → `not_pending`. `mergeDimAction` với nguồn đang chờ → nguồn `needsReview === false`.
- **Xong khi:** test xanh, tsc sạch.
- Commit: `feat(p3a): gan/go PIC Backup (chi admin) + hang cho duyet chu dau tu`.

### Task 7: Khối UI dùng chung — Switch, bảng trọng số, thẻ dấu vết

**Files:** tạo `src/components/ui/Switch.tsx`, `src/components/form/StageWeightEditor.tsx`, `src/components/project/ProjectAuditCard.tsx` + 3 file test · vi/en (`projectForm.weights.*`, `projectForm.audit.*`) · `messages.test.ts`.

**Interfaces — Produces:**
```ts
// Switch.tsx — server-safe (không 'use client', không hook)
export function Switch(p: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }): JSX.Element;
// <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? 'switch on' : 'switch'}
//   style={{ border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer' }} onClick={() => onChange?.(!checked)} disabled={disabled}><i /></button>

// StageWeightEditor.tsx — 'use client'
export function StageWeightEditor(p: { value: StageWeightInput[]; onChange: (rows: StageWeightInput[]) => void; onApplyPreset?: () => void }): JSX.Element;

// ProjectAuditCard.tsx — server-safe, nhận chuỗi đã dịch
export function ProjectAuditCard(p: { entries: AuditLogEntry[]; locale: string;
  labels: { title: string; chip: string; time: string; user: string; table: string; field: string; old: string; new: string; empty: string; note: string };
  tableLabels: Record<string, string> }): JSX.Element;
```
- `StageWeightEditor`: bảng `.tbl` 7 hàng theo `STAGE_ORDER`, cột `#`, Giai đoạn (`t(stageKey[code])`), Trọng số (`<input type="number" step="0.5" min 0 max 100 className="inp">`, rộng 88px, căn phải), Áp dụng (`Switch`), Đóng góp tối đa (`applicable ? weightPct : 0` + "%", in đậm, màu `var(--accent)`). Hàng tắt có `opacity: .45`. Dưới bảng là `.sumbar` theo `validateStageWeights(value)` (`src/lib/stages.ts:111`):
  - `ok` → class `good` + `projectForm.weights.ok`.
  - `error === 'empty'` → `bad` + `weights.empty`.
  - Còn lại → `bad` + `weights.bad` với `{ sum, diff }` (1 chữ số lẻ: `new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(x)`, `locale` lấy từ `useLocale()`).
  - Luôn hiện thêm `<span>` chứa `weights.note` và `weights.nextSave`.
  - Có `onApplyPreset` thì hiện nút `btn ghost` `weights.applyPreset`.
  - KHÔNG vẽ cột "Cách tính" của mock-up, vì app đang nhập tay % cho cả 7 giai đoạn (`DataEntryForm.tsx:545-577`); vẽ ra sẽ nói sai.
- `ProjectAuditCard`: `.card` + `CardHeader` (title + `<span className="chip c-plain">{chip}</span>`), bảng Thời điểm (`formatDateTime`) · Người sửa · Nội dung (`tableLabels[tableName] ?? tableName`) · Trường · Giá trị cũ · Giá trị mới. Ô giá trị cắt 160 ký tự + "…", chuỗi đầy đủ để ở `title`. Không có dòng → `.empty` + `labels.empty`. Dưới bảng là `.hintline` `labels.note`.
- **Test:**
  - `Switch.test.ts`: `checked` → `class="switch on"` + `aria-checked="true"`.
  - `StageWeightEditor.test.ts`: `DEFAULT_STAGE_WEIGHTS` → có `projectForm.weights.ok`; tổng 99 → `weights.bad`; tất cả tắt → `weights.empty`; không truyền `onApplyPreset` → không có `weights.applyPreset`.
  - `ProjectAuditCard.test.ts`: cắt 160 ký tự, map tên bảng, trạng thái trống.
- **Xong khi:** test xanh, tsc sạch.
- Commit: `feat(p3a): Switch, bang trong so 7 giai doan, the dau vet thay doi`.

### Task 8: Trang `/ho-so-du-an` + `ProjectForm` 6 mục (G-1,2,3,4,7,8,9,10,11,12,13,15,16,17,19,20 phía UI)

**Files:** tạo `app/[locale]/(app)/ho-so-du-an/page.tsx`, `ProjectForm.tsx`, `ProjectLinksSection.tsx`, `ho-so-du-an-page-guard.test.ts` · sửa `src/lib/project-form.ts` (+test, phần state) · vi/en (`projectForm.*` theo Phụ lục A) · `messages.test.ts`.

**Interfaces — Consumes:** Task 3-7. **Produces:**
```ts
// src/lib/project-form.ts (thêm)
export interface ProjectFormState { currentAliasCode: string; projectName: string; customerId: string; teamKdId: string; marketCode: string;
  projectType: string; contractValue: string; currencyCode: string; contractValueOriginal: string; tonnage: string; priority: string;
  factoryId: string; contractDate: string; plannedStartDate: string; plannedFinishDate: string; committedHandoverDate: string;
  actualStartDate: string; actualFinishDate: string; penaltyValue: string; penalized: boolean }
export function emptyProjectForm(): ProjectFormState;            // currencyCode 'VND', penalized false, còn lại ''
export function projectFormFromProject(p: Project): ProjectFormState; // ngày qua dateInput(); số → String(); null → ''
export const FORM_COUNT_FIELDS: readonly (keyof ProjectFormState)[]; // 19 field, mọi key trừ 'penalized'
export function countFilled(f: ProjectFormState): number;        // field có value.trim() !== ''
export type ProjectFieldError = 'required' | 'positive' | 'too_long' | 'code_invalid' | 'date_order' | 'fx';
export type FxPreview = { kind: 'vnd' } | { kind: 'manual' } | { kind: 'no_date' } | { kind: 'no_rate'; ym: string }
  | { kind: 'converted'; rate: number; ym: string; value: number };
export function fxPreview(f: ProjectFormState, rates: ExchangeRate[]): FxPreview;
export function validateProjectForm(f: ProjectFormState, mode: 'new' | 'edit', base: ProjectFormState | null, rates: ExchangeRate[]):
  { ok: boolean; errors: Partial<Record<keyof ProjectFormState, ProjectFieldError>>; dates: DateChainResult; fx: FxPreview };
export function buildCreateInput(f: ProjectFormState, fx: FxPreview): CreateProjectInput;
export function buildUpdatePatch(base: ProjectFormState, f: ProjectFormState, fx: FxPreview): UpdateProjectPatch; // chỉ field đổi; KHÔNG có currentAliasCode

// ProjectForm.tsx — 'use client'
export interface ProjectFormProps {
  mode: 'new' | 'edit'; project: Project | null; projects: { id: number; name: string; code: string }[];
  customers: Customer[]; teams: TeamKd[]; currencies: Currency[]; factories: Factory[]; exchangeRates: ExchangeRate[];
  sapCodes: ProjectSapCode[]; stageWeights: ProjectStageWeight[]; keyMilestones: ProjectKeyMilestone[];
  members: ProjectMember[]; assignableUsers: { email: string; name: string; role: Role }[] | null; // null = không phải admin
  contractorMembers: Contractor[]; allContractors: Contractor[]; ownerEmail: string; today: IsoDate;
}
export function ProjectForm(p: ProjectFormProps): JSX.Element;
// ProjectLinksSection.tsx — 'use client'
export function ProjectLinksSection(p: { projectId: number; sapCodes: ProjectSapCode[]; members: ProjectMember[];
  assignableUsers: ProjectFormProps['assignableUsers']; contractorMembers: Contractor[]; allContractors: Contractor[] }): JSX.Element;
```
**`validateProjectForm`:**
- **Tạo mới**, bắt buộc: `projectName`, `customerId`, `teamKdId`, `marketCode`, `projectType`, `priority`, 3 ngày `REQUIRED_DATE_FIELDS` (`required`). `tonnage` phải > 0 (`positive`). `contractValue` phải > 0 (`positive`), trừ khi `fx.kind === 'converted'`.
- **Sửa**: các field trên không được xoá rỗng. Riêng 3 ngày và `tonnage`: chỉ báo lỗi khi `base` có giá trị mà form bị xoá hoặc về 0. Dữ liệu cũ đang trống thì không chặn (khớp luật server Task 3).
- `projectName` > 160 ký tự → `too_long`. `currentAliasCode` không rỗng mà `!isValidProjectCode` → `code_invalid`.
- `dates.hard` có lỗi → gắn `date_order` lên ô ngày thứ hai của luật (HT KH / Bàn giao / BĐ KH / HT TT).
- `fx.kind` là `no_date` hoặc `no_rate` → `contractValueOriginal: 'fx'`.
- `ok` = không có lỗi nào.

**`fxPreview`:**
- `currencyCode === 'VND'` → `vnd`.
- Nguyên tệ trống → `manual`.
- Không có `contractDate` → `no_date`.
- Không có rate → `no_rate`.
- Còn lại → `converted` (`value = toVndBillion(...)`).

**`buildCreateInput` / `buildUpdatePatch`:**
- Chuỗi rỗng → `null` cho ngày, `penaltyValue`, `factoryId`, `contractValueOriginal`.
- Số dùng `Number(...)`. `converted` thì gửi `contractValue = fx.value`. `vnd` thì `contractValueOriginal = null`.
- `buildUpdatePatch` chỉ đưa field khác `base`. Nếu 1 trong 3 field G-7 đổi thì gửi cả `contractValue` (khi converted).

**Page (`page.tsx`, server):**
1. `getCurrentUser()`: không có → `redirect(\`/${locale}/login\`)`. Role không phải admin/data-entry → `redirect(\`/${locale}${homeForRole(role)}\`)`.
2. `writable` = admin: `listProjects()`; data-entry: lọc theo `getAssignmentsForUser` (khuôn `nhap-lieu/page.tsx:27-32`).
3. `?project=<số>`: có trong `writable` → mode `edit`; có nhưng không thuộc `writable` → `notFound()`. Không có `?project` → `new`.
4. Nạp: `getDims()`, `getExchangeRates()`, `todayIso()`. Chế độ edit nạp thêm `getProject`, `getSapCodes(id)`, `getStageWeights(id)`, `getKeyMilestones(id)`, `getProjectMembers(id)`, `getContractors(id)`, `getContractors()`, `readProjectAuditTrail(id, 50)`.
5. `assignableUsers` chỉ khi admin: `(await repo.getUserRoles()).filter(u => u.isActive && (u.role === 'data-entry' || u.role === 'viewer')).map(u => ({ email: u.email, name: u.name, role: u.role }))`. Không phải admin → `null`.
6. Render: `<ProjectForm key={project?.id ?? 'new'} … ownerEmail={user.email} />`. Edit mode render thêm `<ProjectAuditCard …>` bên dưới, label lấy từ `getTranslations()`.

**Bố cục `ProjectForm`** (copy cấu trúc HTML mock-up; mọi class đã có CSS):
- **Thẻ đầu** (mock-up 868-877): tiêu đề `projectForm.title.new` / `title.edit {name}`. `.seg` 2 nút `mode.new` / `mode.edit`: bấm → `router.push('?mode=new')` hoặc `router.push(\`?project=${project?.id ?? projects[0].id}\`)`; `projects` rỗng thì nút edit bị disabled. Edit mode có thêm `<select className="inp">` đổi dự án. `.msdetail` là dải 6 bước (mock-up 2014-2021): chữ đậm `steps.lead.new|edit`, 6 `<span className="k">` `s1…s6`, `.hint` `steps.hint`.
- **Mục 1 Định danh** (`.fsec` + `.f4`, mock-up 883-939):
  - Mã gốc: ô `inp ro` readonly, create hiện placeholder `field.masterAuto`, edit hiện `project.masterCode`; hint `field.masterHint`; `HelpTip tipText.masterCode`.
  - Mã CT: `hintline field.aliasHint`, `HelpTip tipText.aliasCode`. Edit mode: nếu khác base thì hiện thêm ô `field.aliasReason` (bắt buộc ≥ 5, `maxLength 300`) + hint `field.aliasReasonHint`.
  - Tên (`grid-column: span 2`): `maxLength={PROJECT_NAME_MAX}`, onChange `.toUpperCase()` (Q6), hint `field.nameHint {max}`.
  - Chủ đầu tư: `Combobox allowCreate` như `DataEntryForm.tsx:398-411`, `HelpTip tipText.customer`.
  - Team KD, Thị trường, Loại dự án: `HelpTip tipText.projectType`.
- **Mục 2 Giá trị** (mock-up 943-977):
  - Giá trị HĐ `*`: readonly (`inp ro`) khi `fx.kind === 'converted'`, lúc đó ô hiện `fx.value`. `HelpTip tipText.contractValue`, hint `field.contractValueHint`.
  - Nguyên tệ: `.inline` gồm select `currencyCode` từ `currencies` + input số `contractValueOriginal` (disabled khi VND). Hint theo `fx.kind`: `vnd` → `field.originalHint`; `converted` → `fx.converted {cur, ym, rate}`; `no_date` → `fx.noDate` (chữ màu `var(--danger)`); `no_rate` → `fx.noRate {cur, ym}` (đỏ).
  - Khối lượng thép `*`: `HelpTip tipText.tonnage`.
  - Mức ưu tiên `*`: option `projectForm.priority.P0..P3` (G-9), `HelpTip tipText.priority` (`alignRight`).
  - Khu vực sản xuất: copy select `DataEntryForm.tsx:464-477`, gồm cả option khu vực ngừng dùng.
- **Mục 3 Mốc thời gian** (mock-up 981-1035): 2 hàng `.f4`.
  - Hàng 1: Ký HĐ · BĐ KH `*` · HT KH `*` · Bàn giao cam kết `*`.
  - Hàng 2: BĐ TT · HT TT · "Đã bị phạt hợp đồng?" (`.inline` cao 38px: `Switch` + chữ `field.penalizedOn` màu `var(--danger)` / `field.penalizedOff` màu `var(--label2)`, G-13) · Giá trị phạt (hint "tỷ VNĐ").
  - CHƯA gắn HelpTip cho 5 ô G-14 (Task 14).
  - `.sumbar` `#dateCheck`: có `dates.hard` → class `bad` + `⚠ ` + các thông điệp `dateCheck.<code>` nối bằng " · ". Không có lỗi và `totalPlanDays != null` → `good` + `✓ dateCheck.ok {n}`, và nếu `startDelayDays > 0` thì nối " · " + `dateCheck.startDelay {n}`. Thiếu ngày → `dateCheck.empty`. Luôn có `<span>` `dateCheck.note`.
- **Mục 4**: `<KeyMilestoneEditor id="key-milestones" …>` dùng lại nguyên, state như `DataEntryForm.tsx:130-132`, cờ `msDirty`.
- **Mục 5**: `<StageWeightEditor value={weights} onChange={…} />`. Giá trị đầu: edit = `stageWeights` từ props; new = `DEFAULT_STAGE_WEIGHTS` (Task 13 thay bằng bộ theo loại). Cờ `weightsDirty`.
- **Mục 6** (mock-up 1067-1104): new mode chỉ hiện `.hintline links.afterCreate`. Edit mode render `ProjectLinksSection`:
  - **SAP** (`.tagbox`, `HelpTip tipText.sap`): mỗi mã là `<span className="tg">{sapCode} <b role="button" tabIndex={0} aria-label=…>×</b></span>`. Bấm × → `window.confirm(links.sapConfirmRemove)` → `removeSapCodeAction` → `router.refresh()`. Nút `.add` `links.sapAdd` mở ô nhập mã + ô `links.sapDocType` (mặc định `'Hợp đồng con'`) + nút `common.add` → `addSapCodeAction`; `ok === false` → `links.sapDuplicate`.
  - **PIC/Backup** (`.tagbox`, `HelpTip tipText.members alignRight`): mỗi người `<span className="tg">{name || email} · {roleInProject}</span>`. Có `assignableUsers` (admin) thì có ×: confirm `links.memberConfirmRemove` → `removeProjectMemberAction`. Nút `.add` `links.memberAdd` mở select người (lọc ra người đã là thành viên) + select vai trò PIC/Backup → `setProjectMemberAction`; lỗi → `projectForm.err.<code>`. Không có PIC → chip `c-warn` `links.noPic`. Không phải admin → không có × và .add, chỉ có `hintline links.membersAdminOnly`.
  - **Nhà thầu**: `<ContractorJoinBlock projectId members={contractorMembers} allContractors disabled={false} />` dùng lại nguyên, `HelpTip tipText.contractors` đặt ở nhãn phía trên.
- **Thanh dính `.stickybar`** (mock-up 1107-1113, G-19): nút chính `btn.create` / `btn.save` · `btn.draft` (Task 10 nối; Task 8 để `disabled`) · `btn.cancel` · bên phải `<span className="req">*</span> {required} · {count {n, total}}` với `n = countFilled(form)`, `total = FORM_COUNT_FIELDS.length`.
  - Hủy: đang dirty thì `confirm(confirmDiscard)`, rồi reset form, mốc và trọng số về base (new = `emptyProjectForm()`).
- **Lưu (new)**: `validateProjectForm` không ok → `sumbar bad err.invalid` + cuộn tới ô lỗi đầu tiên. Ok → `createProjectAction({ ...buildCreateInput(form, fx), keyMilestones: msRows.length ? normalizeKeyMilestones(msRows) : undefined, stageWeights: weights })`. `ok` → `router.replace(\`?project=${id}\`)` + `router.refresh()`. Lỗi → `err.<code>` (không có key thì `err.generic {msg}`).
- **Lưu (edit)**: chạy tuần tự, chỉ phần nào dirty:
  1. `updateProjectAction(id, buildUpdatePatch(...))` khi patch khác rỗng.
  2. `changeProjectCodeAction(id, code, reason)` khi mã đổi (lỗi `unchanged` coi như ok).
  3. `saveStageWeightsAction` khi `weightsDirty`.
  4. `saveKeyMilestonesAction` khi `msDirty`.
  - Dừng ở lỗi đầu tiên: `sumbar bad err.partial {done, failed, msg}`, tên phần lấy từ `part.*`.
  - Không phần nào dirty → chip `dataGuard.save.noChange`.
  - Tất cả ok → chip `c-ok saved.updated` + `router.refresh()`.
  - Nút Lưu chỉ `disabled` khi đang lưu. Form chưa hợp lệ thì vẫn bấm được, để hiện `err.invalid` và cuộn tới ô lỗi.
  - `fx.converted {rate}` định dạng bằng `formatTon(rate, locale)` (`src/lib/format.ts:16`). Ô "Giá trị HĐ" khi converted hiện `fx.value` dạng chuỗi số.
- **Test:**
  - `project-form.test.ts` (phần mới): `countFilled(emptyProjectForm()) === 1` (chỉ `currencyCode`). Validate new thiếu tonnage → `positive`. Edit với base có ngày mà form xoá ngày → `required`. Edit với base trống ngày → không lỗi. `fxPreview` đủ 5 nhánh. `buildUpdatePatch` chỉ chứa field đổi, không chứa `currentAliasCode`.
  - `ho-so-du-an-page-guard.test.ts`: mock `ProjectForm` và `ProjectAuditCard` thành hàm trả `null` nhưng ghi lại props. Kiểm: viewer, bod bị redirect; data-entry `?project=16` → `notFound`; data-entry `?project=1` → props `mode 'edit'`, `assignableUsers === null`; admin → `assignableUsers` không có field `passwordHash`; không có `?project` → `mode 'new'`.
  - Thêm `ProjectForm`, `ProjectLinksSection`, trang `/ho-so-du-an` vào `CHANGED_SOURCES`.
- **Xong khi:** test xanh, tsc sạch. `npm run dev` kiểm mắt `/vi/ho-so-du-an` (tạo 1 dự án thật) và `/vi/ho-so-du-an?project=1` (sửa tên, đổi mã CT, đổi trọng số, gỡ/thêm SAP, admin gán/gỡ Backup) ở giao diện sáng và tối, 1366px. Tooltip không bị cắt (card chứa HelpTip có `overflow-visible`).
- Commit: `feat(p3a): trang tao/sua du an 6 muc + thanh dinh dem truong`.

### Task 9: Gỡ luồng cũ, nối điều hướng (Q7)

**Files:** `DataEntryForm.tsx` · `nhap-lieu/page.tsx` · xoá `CreateProjectForm.tsx` · `nhap-lieu-page-guard.test.ts:32` · `projects/[id]/page.tsx:272` + `projects-detail-page-render.test.ts:217-221` · `AppShell.tsx:39-55` · `middleware.ts:11-16` · vi/en.
- [ ] `DataEntryForm`:
  - Bước `profile`: thay toàn bộ nội dung `step === 'profile'` (dòng 387-522) bằng thẻ `<div className="sumbar"><span>{t('projectForm.movedHint')}</span><Link href={\`/ho-so-du-an?project=${projectId}\`} className="btn">{t('projectForm.openForm')}</Link></div>`, với `Link` từ `@/i18n/navigation`. Giữ nguyên key `profile` trong `DataEntryStep` để URL cũ `?step=profile` vẫn chạy.
  - Bỏ state và luồng lưu mốc chính trong form này (dòng 130-133, 211-217, 242-245, 517-520), vì mốc đã chuyển sang `ProjectForm`.
  - Bỏ luật `committedRequired` (dòng 207-209).
  - Bước `extras`: bỏ khối Lịch sử mã + SAP (dòng 623-671), chỉ giữ ảnh.
  - Không đổi `FormState` hay `buildSavePatch`: các field hồ sơ không còn ô sửa nên luôn bằng base, không bao giờ vào patch.
- [ ] `nhap-lieu/page.tsx`: bỏ import và khối `CreateProjectForm` (dòng 82-85), thay bằng `<Link href="/ho-so-du-an?mode=new" className="btn">{t('form.newProject')}</Link>` đặt trong section cũ. Bỏ prop `aliases`, `sapCodes`, `keyMilestones` nếu `DataEntryForm` không còn dùng (xoá luôn khỏi `Props`).
- [ ] Xoá `src/components/form/CreateProjectForm.tsx` và dòng `vi.mock` ở `nhap-lieu-page-guard.test.ts:32`.
- [ ] `projects/[id]/page.tsx:272`: link "Sửa mốc" → `/ho-so-du-an?project=${project.id}#key-milestones`. Sửa test `:217` thành `href="/ho-so-du-an?project=1#key-milestones"`, và `:220-221` thành `not.toContain('ho-so-du-an')`.
- [ ] `AppShell.tsx`: thêm sau dòng 41 `{ href: '/ho-so-du-an', labelKey: 'projectForm.nav', icon: IconPlus (có sẵn ở `src/components/icons/index.tsx:324`), roles: ['admin', 'data-entry'] }`.
- [ ] `middleware.ts`: thêm `'/ho-so-du-an'` vào `DENIED.viewer` và `DENIED.bod`.
- [ ] Đổi GIÁ TRỊ (giữ key) cả vi/en:
  - `form.stepExtras` → "Ảnh hiện trường" / "Site photos".
  - `volumeEntry.hint` → "Ghi vào khu vực sản xuất của dự án (trang Tạo / Sửa dự án)." / "Recorded against the project's production area (Create / Edit project page)."
  - `volumeEntry.noFactory` → "Chọn khu vực sản xuất ở trang Tạo / Sửa dự án trước khi nhập sản lượng." / "Choose the production area on the Create / Edit project page before entering output."
- **Test:** `nhap-lieu-page-guard.test.ts`, `projects-detail-page-render.test.ts`, `pages-role-guard.test.ts` xanh. Thêm 1 ca vào guard: bod vào `/vi/ho-so-du-an` qua `middleware` bị redirect `/vi/overview` (nếu đã có test middleware thì theo mẫu đó, không thì chỉ kiểm mảng `DENIED` qua page guard).
- **Xong khi:** `npm test` xanh, tsc sạch. Kiểm mắt `/vi/nhap-lieu`: không còn form tạo cũ, bước Hồ sơ hiện thẻ dẫn. Sidebar có "Tạo / Sửa dự án" cho admin/data-entry, và chỉ mục đó sáng khi đứng ở `/ho-so-du-an`.
- Commit: `feat(p3a): go form tao cu + buoc Ho so, dieu huong sang trang Tao/Sua`.

### Task 10: F6 — bản nháp an toàn (2 form) + xoá khi đăng xuất

**Files:** tạo `src/lib/drafts.ts`, `src/lib/project-draft.ts` (+test) · sửa `dataEntryState.ts` (+test), `DataEntryForm.tsx:142-171`, `nhap-lieu/page.tsx` (prop `ownerEmail`), `ProjectForm.tsx`, `SettingsMenu.tsx:152-154`, `ChangePasswordModal.tsx:36` (+test `SettingsMenu.test.ts`).

**Interfaces — Produces:**
```ts
// src/lib/drafts.ts
export function draftOwnerTag(email: string): string;   // FNV-1a 32-bit của email.trim().toLowerCase() → 8 ký tự hex thường
type KeyStore = { readonly length: number; key(i: number): string | null; removeItem(k: string): void };
export function clearAllDrafts(s: KeyStore): number;     // xoá mọi key bắt đầu 'ddc_draft_' hoặc 'ddc_pform_'; trả số key đã xoá
export function purgeForeignDrafts(s: KeyStore, ownerTag: string): number;
// xoá: 'ddc_draft_v2_*', 'ddc_draft_<số>_*' (v1), và mọi 'ddc_draft_v3_*' / 'ddc_pform_v1_*' KHÔNG bắt đầu bằng `…_${ownerTag}_`

// dataEntryState.ts (sửa)
export const DRAFT_VERSION = 3;
export const DRAFT_FIELDS = ['pctPlan', 'ac', 'equipmentActual', 'volumeTonnage', 'stagePct', 'stageApplicable'] as const;
export type DraftForm = Pick<FormState, (typeof DRAFT_FIELDS)[number]>;
export interface StoredDraft { v: 3; savedAt: string; stamp: DraftStamp; form: DraftForm }
export function draftKey(ownerTag: string, projectId: number, month: string): string; // `ddc_draft_v3_${ownerTag}_${projectId}_${month}`
export function toDraftForm(f: FormState): DraftForm;
export function draftFieldsEqual(a: FormState, b: FormState): boolean;
export function restoreDraft(base: FormState, d: StoredDraft): FormState; // CHỈ áp key trong DRAFT_FIELDS, bỏ mọi key khác kể cả khi có trong JSON
// checkDraft giữ chữ ký, chỉ nhận v === 3

// src/lib/project-draft.ts
export interface ProjectDraft { v: 1; savedAt: string; projectCreatedAt: string | null; projectUpdatedAt: string | null;
  form: ProjectFormState; keyMilestones: KeyMilestoneDraft[]; stageWeights: StageWeightInput[] }
export function projectDraftKey(ownerTag: string, projectId: number | null): string; // `ddc_pform_v1_${ownerTag}_${projectId ?? 'new'}`
export function checkProjectDraft(raw: string | null, project: Pick<Project, 'createdAt' | 'updatedAt'> | null):
  { kind: 'none' } | { kind: 'fresh' | 'stale'; draft: ProjectDraft } | { kind: 'foreign' };
export function restoreProjectDraft(base: ProjectFormState, d: ProjectDraft): ProjectFormState; // chỉ key của ProjectFormState, kiểu phải khớp
```
- [ ] **DataEntryForm**:
  - Nhận prop `ownerEmail: string` (page truyền `user.email`), `tag = draftOwnerTag(ownerEmail)`.
  - Lúc mount: `purgeForeignDrafts(localStorage, tag)` (thay dòng 144). Sau đó `checkDraft(localStorage.getItem(draftKey(tag, …)))`.
  - Tự lưu: dùng `draftFieldsEqual` thay `formsEqual`, và ghi `{ v: 3, savedAt, stamp, form: toDraftForm(form) }`.
  - Hệ quả: số tài chính và hồ sơ không bao giờ vào localStorage.
- [ ] **ProjectForm**:
  - Mount: `checkProjectDraft`. `fresh`/`stale` → banner như `DataEntryForm.tsx:337-362`, dùng lại key `dataGuard.draft.*`; `foreign` → xoá.
  - KHÔNG bao giờ tự áp bản nháp.
  - Tự lưu sau 800ms khi dirty, bỏ qua khi banner đang chờ quyết định.
  - Nút `btn.draft` ghi ngay + chip `form.draftSaved` (key có sẵn).
  - Lưu thành công → `removeItem`.
  - `stale` = `projectUpdatedAt` khác. Đổi mốc/trọng số không làm đổi `updatedAt`, nên có thể không bắt được "stale" cho 2 phần này. Chấp nhận được vì bản nháp chỉ áp khi người dùng bấm "Khôi phục". Ghi câu này vào comment.
- [ ] **Đăng xuất**: `SettingsMenu.logout()` và `ChangePasswordModal` (trước `signOut`) gọi `clearAllDrafts(window.localStorage)` trong `try/catch` (localStorage có thể bị chặn).
- **Test:**
  - `drafts.test.ts` dùng store giả `{ data: Map }`: `draftOwnerTag('A@x.com') === draftOwnerTag(' a@x.com ')`; `clearAllDrafts` giữ `ddc-theme`; `purgeForeignDrafts` giữ đúng key của owner hiện tại.
  - `dataEntryState.test.ts`: `restoreDraft` với JSON bị chèn `revenueCumulative`/`projectName` → kết quả giữ giá trị base; `checkDraft` bỏ qua bản v2; `toDraftForm` không có key tài chính.
  - `project-draft.test.ts`: đủ 4 nhánh `check`; restore bỏ key lạ.
  - `SettingsMenu.test.ts`: bấm đăng xuất → `localStorage.removeItem` được gọi với key `ddc_draft_v3_…`. Gắn `globalThis.localStorage` giả trong test.
- **Xong khi:** test xanh, tsc sạch. Kiểm mắt: sửa %KH → reload → có banner, không tự áp. Đăng xuất → DevTools Application không còn key `ddc_draft_`/`ddc_pform_`. Đăng nhập tài khoản khác không thấy nháp của người trước.
- Commit: `fix(p3a): F6 ban nhap gan email, khong luu so tai chinh, xoa khi dang xuat`.

### Task 11: G-5 — hàng chờ duyệt chủ đầu tư trong "Sửa danh mục"

**Files:** `src/components/admin/FieldEditor.tsx` (+ test mới `FieldEditor.test.ts`) · vi/en (`customerReview`).
- [ ] Khi `field === 'customer'`: sắp dòng `needsReview` lên đầu. Dòng chờ duyệt có `<span className="chip c-warn">{t('customerReview.pending')}</span>` cạnh tên, và nút `btn ghost` `customerReview.approve` → `approveCustomerAction(v.id)` → `router.refresh()`. Lỗi → `sumbar bad` `customerReview.err.<code>`.
- [ ] Có ít nhất 1 dòng chờ → hiện `hintline customerReview.hint` phía trên bảng.
- [ ] Không đổi hành vi Merge có sẵn.
- **Test:** render có 1 dòng `needsReview: true` → chứa `customerReview.pending` và dòng đó đứng trước; `field="team"` → không có chip. Thêm `FieldEditor` vào `CHANGED_SOURCES`.
- **Xong khi:** test xanh. Kiểm mắt: data-entry tạo CĐT mới ở `/vi/ho-so-du-an` → admin thấy chip ở `/vi/admin` → bấm Duyệt thì chip mất.
- Commit: `feat(p3a): hang cho duyet chu dau tu moi o Sua danh muc (G-5)`.

### Task 12: Task 10 — form nhập `project_equipment_plan` (nguồn Gantt T14)

**Files:** tạo `src/lib/equipment-plan.ts` (+test), `EquipmentPlanEditor.tsx` (+test), `actions-equipment-plan.test.ts` · sửa `types.ts`, `mock-repo-form.ts`, `prisma-repo-form.ts` (+test), `validation.ts`, `actions-entry.ts`, `nhap-lieu/page.tsx:118-134` · vi/en (`equipmentPlan`, `activity.save_equipment_plans`).

**Interfaces — Produces:**
```ts
// types.ts
export interface EquipmentPlanInput { equipmentId: number; unitNo: number; workItemId: number | null;
  plannedStart: string; plannedFinish: string; note: string } // ngày 'YYYY-MM-DD'

// src/lib/equipment-plan.ts
export const EQUIP_PLAN_MAX_ROWS = 300; export const EQUIP_UNIT_MAX = 99; export const EQUIP_NOTE_MAX = 200;
export interface EquipmentPlanDraft { equipmentId: string; unitNo: string; workItemId: string; plannedStart: string; plannedFinish: string; note: string }
export type EquipPlanField = 'equipmentId' | 'unitNo' | 'workItemId' | 'plannedStart' | 'plannedFinish' | 'note';
export type EquipPlanErrors = Record<number, EquipPlanField[]>;
export function toEquipmentPlanDraft(p: ProjectEquipmentPlan): EquipmentPlanDraft;
export function normalizeEquipmentPlans(rows: EquipmentPlanDraft[]): EquipmentPlanInput[]; // trim note; '' workItemId → null
export function nextUnitNo(rows: EquipmentPlanDraft[], equipmentId: string): number;       // max unitNo của thiết bị đó + 1, tối thiểu 1
export function validateEquipmentPlans(rows: EquipmentPlanInput[], ctx: { equipmentIds: Set<number>; workItemIds: Set<number> }):
  { ok: boolean; errors: EquipPlanErrors; overlaps: [number, number][] }; // chỉ số 0-based
export function equipPlanAuditText(rows: EquipmentPlanInput[]): string;
// `${equipmentId}#${unitNo} ${plannedStart}..${plannedFinish}` (+ ` wi${workItemId}` nếu có), nối '; ', cắt 2000 ký tự

// repo (mock + prisma)
replaceEquipmentPlans(projectId: number, rows: EquipmentPlanInput[], by: string): void
// actions-entry.ts
export async function saveEquipmentPlansAction(projectId: number, rows: EquipmentPlanInput[]):
  Promise<{ ok: true; count: number } | { ok: false; error: 'Forbidden' | 'Not found' | 'Invalid input' | 'invalid_rows'; errors?: EquipPlanErrors; overlaps?: [number, number][] }>;
// EquipmentPlanEditor.tsx — 'use client'
export function EquipmentPlanEditor(p: { projectId: number; plans: ProjectEquipmentPlan[]; equipments: Equipment[]; workItems: ProjectWorkItem[] }): JSX.Element;
```
**Luật validate** (lỗi gắn theo field):
- `equipmentId` phải ∈ `ctx.equipmentIds`.
- `unitNo` là số nguyên 1..99.
- `workItemId` là `null` hoặc ∈ `ctx.workItemIds`.
- 2 ngày `isValidIsoDate`, và `plannedFinish >= plannedStart` (sai thì lỗi ở `plannedFinish`).
- `note` ≤ 200 ký tự.
- Quá 300 dòng → `ok: false`, lỗi dòng 300 trở đi ở `equipmentId`.
- Trùng: 2 dòng cùng `(equipmentId, unitNo)` có `a.start <= b.finish && b.start <= a.finish` → gắn `plannedStart` + `plannedFinish` cho cả 2 dòng, ghi cặp vào `overlaps`. Lý do chặn: `assignUsage` (`src/lib/equipment-gantt.ts:42-48`) chỉ gán ngày dùng cho 1 trong 2 thanh.

**Action:** `requireWriteProject` → Zod `saveEquipmentPlansSchema` (`projectId`, `rows` tối đa 300 phần tử, mỗi phần tử kiểu `EquipmentPlanInput`, ngày `isoDate`, `note` trim max 200) → dự án tồn tại → `ctx.equipmentIds` = id của `getEquipments()` (chỉ active) ∪ `equipmentId` của `readEquipmentPlans(projectId)` hiện có (để lưu lại được dòng cũ của thiết bị đã ngừng dùng); `ctx.workItemIds` = `getWorkItems(projectId)` → lỗi → `invalid_rows` kèm `errors`/`overlaps` → `repo.replaceEquipmentPlans` → `logActivity(user, 'save_equipment_plans', \`project ${id} · ${n}\`)`. Không kiểm khoá tháng (kế hoạch không theo tháng), không chạy alert engine.

**Repo:** thay toàn bộ trong 1 transaction.
- Prisma: `deleteMany({ where: { projectId } })` + `createMany` với ngày `new Date(\`${d}T00:00:00Z\`)`, `updatedBy: by`.
- Mock: sửa mảng kế hoạch trong `RepoData`, dùng đúng tên field mà `readEquipmentPlans` ở `read-mock.ts` đang đọc; id mới = max + 1.
- Audit `('project_equipment_plan', String(projectId), 'replace', equipPlanAuditText(cũ), equipPlanAuditText(mới), by)`.

**UI:**
- Tiêu đề `.sect` `equipmentPlan.title`, `hintline equipmentPlan.help`.
- Bảng `.tbl` cột: `#` · Thiết bị (select từ `equipments`; `equipmentId` không có trong danh sách thì thêm option `#${id}`) · Chiếc số (number 1..99, rộng 80px) · Hạng mục (select: `''` = `equipmentGantt.noWorkItem` + `workItems`) · Bắt đầu KH · Kết thúc KH (date) · Ghi chú (`maxLength 200`) · ✕.
- Ô lỗi thêm class `bad`.
- Dưới bảng:
  - Nút `equipmentPlan.add`: thêm dòng với `equipmentId` = thiết bị đầu tiên, `unitNo = nextUnitNo`, ngày trống. Disabled khi đủ 300 dòng, kèm `hintline equipmentPlan.limit`.
  - Nút `btn` `equipmentPlan.save`.
  - `hintline equipmentPlan.count {n, units}`, với `units` = số cặp `(equipmentId, unitNo)` khác nhau.
- Không có thiết bị → `.empty equipmentPlan.noEquipment` và ẩn nút.
- Validate client bằng cùng `validateEquipmentPlans` trước khi gửi. Lỗi → `sumbar bad err.invalid` + mỗi cặp `overlaps` 1 dòng `err.overlap {a, b}` (đánh số từ 1). Ok → chip `equipmentPlan.saved {n}` + `router.refresh()`.

**Đặt chỗ:** `nhap-lieu/page.tsx` nạp thêm `repo.readEquipmentPlans(project.id)` và `repo.getWorkItems(project.id)`, rồi truyền `resourcesPanel={<><ResourceEntryPanel …/>{project && <EquipmentPlanEditor projectId={project.id} plans={…} equipments={equipments} workItems={…} />}</>}`. `EquipmentPlanEditor` KHÔNG nằm trong `key={date}` của `ResourceEntryPanel`.

- **Test:**
  - `equipment-plan.test.ts`: từng luật; chồng ngày cùng chiếc → `overlaps [[0, 1]]`; 2 chiếc khác `unitNo` cùng ngày → ok; chạm mép (finish A = start B) → trùng; `nextUnitNo` với danh sách rỗng → 1.
  - `actions-equipment-plan.test.ts`: 5 ca quyền (như Task 5); `invalid_rows` có `errors`; lưu 2 dòng → `readEquipmentPlans(1)` trả đúng 2 dòng và audit có `project_equipment_plan`; `workItemId` của dự án khác → `invalid_rows`.
  - `prisma-repo-form.test.ts` (thêm): `replaceEquipmentPlans` gọi `$transaction` + `auditLog.create`.
  - `EquipmentPlanEditor.test.ts`: render 1 plan → có select thiết bị + `equipmentPlan.count`; `equipments: []` → `equipmentPlan.noEquipment`.
  - Thêm `EquipmentPlanEditor` vào `CHANGED_SOURCES`. Test Gantt P2B (`equipment-gantt*.test.ts`) phải vẫn xanh.
- **Xong khi:** test xanh, tsc sạch. Kiểm mắt: nhập 2 chiếc cẩu cho dự án 1 ở `/vi/nhap-lieu?project=1&step=resources` → `/vi/projects/1` Gantt hiện đúng 2 hàng, màu theo hạng mục.
- Commit: `feat(p3a): form nhap ke hoach thiet bi tung chiec - nguon Gantt T14 (Task 10)`.

### Task 13 — ĐÃ CHỐT (Q1): G-6 bộ trọng số theo loại dự án

**Files:** tạo `src/lib/stage-weight-presets.ts` (+test) · sửa `ProjectForm.tsx` · vi/en (`projectForm.tipText.projectType` đổi giá trị).
```ts
export const STAGE_WEIGHT_PRESETS: Record<ProjectType, StageWeightInput[]>; // đúng bảng Q1 (hoặc bảng chủ dự án chốt), 7 dòng theo STAGE_ORDER, applicable true
export function presetWeightsFor(type: ProjectType | ''): StageWeightInput[]; // '' → DEFAULT_STAGE_WEIGHTS
```
- `ProjectForm` new: đổi `projectType` mà `!weightsDirty` → `setWeights(presetWeightsFor(type))`. Truyền `onApplyPreset={() => { setWeights(presetWeightsFor(form.projectType)); setWeightsDirty(true); }}` cho `StageWeightEditor` ở cả hai chế độ. Chế độ edit không tự đổi (Q1-b).
- Giá trị `tipText.projectType` mới: vi "Loại hình công trình, dùng để lọc và phân nhóm dự án. Khi tạo dự án, loại này quyết định bộ trọng số 7 giai đoạn điền sẵn ở mục 5; chọn sai vẫn sửa được trọng số thủ công." · en "Project type, used to filter and group projects. When creating a project it decides the pre-filled 7-stage weights in section 5; you can still edit the weights manually."
- **Test:** mỗi loại `validateStageWeights(...).ok === true`, đủ 7 mã khác nhau; `Khac` bằng `DEFAULT_STAGE_WEIGHTS`.
- Commit: `feat(p3a): bo trong so mac dinh theo loai du an (G-6)`.

### Task 14 — ĐÃ CHỐT (Q2): G-14 tooltip 5 ô ngày/phạt

**Files:** `ProjectForm.tsx` (mục 3) · vi/en: thêm `projectForm.tip.plannedFinish`, `tip.committedHandover`, `tip.actualStart`, `tip.actualFinish`, `tip.penaltyValue` với đúng văn bản đã chốt (bản đề xuất ở Q2).
- Gắn `<HelpTip text={t('projectForm.tip.X')} label={t('projectForm.tip.X')} />` vào nhãn 5 ô. `alignRight` cho Bàn giao cam kết và Giá trị phạt (cột phải, như mock-up dùng `help rt`).
- **Test:** `messages.test.ts` xanh (key có ở cả vi và en). Kiểm mắt 5 bong bóng không bị cắt.
- Commit: `feat(p3a): tooltip 5 o ngay/phat (G-14)`.

### Task 15: Cổng cuối phase

- [ ] `npx tsc --noEmit` = 0 lỗi. `npm test` xanh, số test ≥ 1378 + test mới. `npm run check:read` OK. `npx prisma migrate status` up to date.
- [ ] Build kiểm compile: `$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES='D:\_project\DDC_dieu-phoi\tools\font-mock.js'; npm run build`.
- [ ] Rà `git diff main...HEAD --stat`: không đụng `PROGRESS.md`, `.serena/`, `app/globals.css`, `notify_*`, `app/[locale]/(app)/admin/page.tsx`. Mọi file nóng đã sửa đều có trong lịch sử "Đang giữ" của `phien-A.md`.
- [ ] Ghi `.bangiao/thay-doi.md` mục tổng: danh sách G đã làm, G-6/G-14 còn chờ (nếu chưa chốt), rủi ro `bodySizeLimit` cho security-reviewer.

---

## Phụ lục A — i18n (thêm ở CUỐI `vi.json` / `en.json`, sau `"alertClose"`)

Mỗi Task chỉ thêm các key mà Task đó dùng, nhưng GIỮ đúng cấu trúc dưới đây. `{…}` là tham số ICU.

**`importLimit`** (Task 2): `note` "Tối đa {mb}MB mỗi tệp" / "Max {mb}MB per file" · `tooBig` "Tệp {name} vượt quá {mb}MB - không gửi lên." / "File {name} exceeds {mb}MB - not uploaded."

**`customerReview`** (Task 11): `pending` "Chờ duyệt" / "Pending review" · `approve` "Duyệt" / "Approve" · `hint` "Chủ đầu tư mới do người nhập liệu tạo - bấm Duyệt để giữ, hoặc Merge vào khách hàng có sẵn." / "New customers created by data-entry users - Approve to keep, or Merge into an existing customer." · `err.not_pending` "Chủ đầu tư này đã được duyệt." / "This customer is already approved." · `err.not_found` "Không tìm thấy chủ đầu tư." / "Customer not found." · `err.generic` "Lỗi: {msg}" / "Error: {msg}"

**`equipmentPlan`** (Task 12):
| key | vi | en |
|---|---|---|
| title | Kế hoạch sử dụng thiết bị (nguồn cho Gantt) | Equipment usage plan (Gantt source) |
| help | Mỗi dòng = 1 chiếc thiết bị trong 1 khoảng ngày. Gantt thiết bị ở Chi tiết dự án vẽ từ bảng này; ngày thực tế có dùng lấy từ số liệu thiết bị hằng ngày. | Each row = one equipment unit over one date range. The equipment Gantt on Project detail is drawn from this table; actual usage days come from daily equipment data. |
| colEquipment / colUnit / colWorkItem / colStart / colFinish / colNote | Thiết bị / Chiếc số / Hạng mục / Bắt đầu KH / Kết thúc KH / Ghi chú | Equipment / Unit no. / Work item / Planned start / Planned finish / Note |
| add / remove / save | + Thêm dòng / Xoá dòng / Lưu kế hoạch thiết bị | + Add row / Remove row / Save equipment plan |
| saved | Đã lưu {n} dòng kế hoạch | Saved {n} plan rows |
| count | {n} dòng · {units} chiếc | {n} rows · {units} units |
| noEquipment | Chưa có thiết bị trong danh mục | No equipment in the catalogue |
| limit | Tối đa {n} dòng | Max {n} rows |
| err.invalid | Có dòng chưa hợp lệ - xem các ô tô đỏ | Some rows are invalid - see the red cells |
| err.overlap | Dòng {a} và {b}: cùng một chiếc bị trùng ngày | Rows {a} and {b}: the same unit overlaps in dates |
| err.forbidden | Bạn không có quyền sửa dự án này. | You cannot edit this project. |
| err.generic | Lưu thất bại: {msg} | Save failed: {msg} |

**`projectForm`** (Task 7-10, 13, 14):
| key | vi | en |
|---|---|---|
| nav | Tạo / Sửa dự án | Create / Edit project |
| movedHint | Hồ sơ dự án, mã SAP và các mốc chính đã chuyển sang trang Tạo / Sửa dự án. | Project profile, SAP codes and key milestones have moved to the Create / Edit project page. |
| openForm | Mở hồ sơ dự án | Open project profile |
| title.new / title.edit | Tạo dự án mới / Cập nhật dự án · {name} | Create new project / Update project · {name} |
| mode.new / mode.edit | Tạo mới / Cập nhật dự án | New / Update project |
| selectProject | Dự án | Project |
| steps.lead.new / steps.lead.edit | 6 bước tạo hồ sơ / 6 nhóm thông tin có thể sửa | 6 steps to create / 6 editable groups |
| steps.s1…s6 | Định danh / Giá trị HĐ / Mốc thời gian / Các mốc chính / Trọng số 7 giai đoạn / Liên kết & phân công | Identity / Contract value / Dates / Key milestones / 7-stage weights / Links & assignment |
| steps.hint | Rê chuột vào dấu ? ở mỗi trường để xem giải thích | Hover the ? next to a field for an explanation |
| sec.identity.title / .sub | Định danh dự án / Mã & tên - dùng để truy vết suốt vòng đời | Project identity / Code & name - traced for the whole lifecycle |
| sec.value.title / .sub | Giá trị hợp đồng & khối lượng / Cơ sở tính BAC, PV, EV | Contract value & quantity / Basis for BAC, PV, EV |
| sec.dates.title / .sub | Mốc thời gian / Nguồn tính % Kế hoạch và rủi ro phạt hợp đồng | Dates / Source of % Plan and contract penalty risk |
| sec.weights.title / .sub | Chuỗi giá trị - trọng số 7 giai đoạn / Tổng phải đúng 100% | Value chain - 7-stage weights / Must total exactly 100% |
| sec.links.title / .sub | Liên kết & phân công / Mã SAP, người phụ trách, nhà thầu | Links & assignment / SAP codes, owners, contractors |
| field.masterCode / masterAuto / masterHint | Mã gốc (master code) / Tự sinh khi lưu / Tự sinh khi lưu · không sửa được | Master code / Generated on save / Generated on save · read-only |
| field.aliasCode / aliasHint | Mã CT hiện hành / Đổi mã sẽ tạo bản ghi mới trong Lịch sử mã dự án | Current contract code / Changing it adds a new entry to the code history |
| field.aliasReason / aliasReasonHint | Lý do đổi mã / Bắt buộc khi đổi mã (ít nhất 5 ký tự) | Reason for the change / Required when changing the code (min 5 characters) |
| field.nameHint | Tên đầy đủ theo hợp đồng · tối đa {max} ký tự | Full name per contract · max {max} characters |
| field.originalValue / originalHint | Giá trị nguyên tệ / Bỏ trống nếu hợp đồng ký bằng VNĐ | Original-currency value / Leave empty if the contract is in VND |
| field.contractValueHint | tỷ VNĐ · trước VAT | bn VND · before VAT |
| field.penalized / penalizedOn / penalizedOff | Đã bị phạt hợp đồng? / Đã bị phạt hợp đồng / Chưa bị phạt | Penalty applied? / Penalty applied / No penalty |
| priority.P0…P3 | P0 - Trọng điểm / P1 - Lớn / P2 - Thường / P3 - Nhỏ | P0 - Strategic / P1 - Large / P2 - Standard / P3 - Small |
| fx.converted | Quy đổi theo tỷ giá {cur} tháng {ym}: {rate} VNĐ · chốt khi lưu | Converted at the {cur} rate for {ym}: {rate} VND · fixed on save |
| fx.noDate | Nhập Ngày ký HĐ để quy đổi theo tỷ giá tháng ký | Enter the contract date to convert at that month's rate |
| fx.noRate | Chưa có tỷ giá {cur} tháng {ym} - nhờ quản trị viên nhập ở Quản trị › Tỷ giá theo tháng | No {cur} rate for {ym} yet - ask an admin to add it under Admin › Monthly exchange rates |
| dateCheck.ok / empty / note | Chuỗi ngày hợp lệ · tổng thời gian kế hoạch {n} ngày / Nhập Ngày BĐ và HT kế hoạch để kiểm chuỗi ngày / % Kế hoạch được tính tự động từ cặp BĐ - HT kế hoạch, không cần nhập tay. | Dates are consistent · planned duration {n} days / Enter planned start and finish to check the dates / % Plan is calculated from planned start - finish; no manual entry needed. |
| dateCheck.plan_order / handover_before_finish / contract_after_start / actual_order | Ngày BĐ kế hoạch phải trước Ngày HT kế hoạch / Bàn giao cam kết đang sớm hơn Ngày HT kế hoạch - kiểm tra lại hợp đồng / Ngày ký hợp đồng đang sau Ngày BĐ kế hoạch / Ngày HT thực tế đang trước Ngày BĐ thực tế | Planned start must be before planned finish / Committed handover is earlier than planned finish - check the contract / Contract date is after planned start / Actual finish is before actual start |
| dateCheck.startDelay | Khởi công trễ {n} ngày so với kế hoạch (vẫn lưu được) | Started {n} days late vs plan (can still be saved) |
| weights.colStage / colWeight / colApplicable / colMax | Giai đoạn / Trọng số / Áp dụng / Đóng góp tối đa | Stage / Weight / Applies / Max contribution |
| weights.ok | Tổng trọng số 100% - hợp lệ. % Thực tế của dự án = Σ(trọng số × %HT từng giai đoạn) ÷ Σ trọng số. | Weights total 100% - valid. Project % Actual = Σ(weight × stage % complete) ÷ Σ weights. |
| weights.bad | Tổng trọng số đang là {sum}% - phải đúng 100% mới lưu được. Lệch {diff}%. | Weights total {sum}% - must be exactly 100% to save. Off by {diff}%. |
| weights.empty | Phải có ít nhất 1 giai đoạn áp dụng. | At least one stage must apply. |
| weights.note | Bỏ "Áp dụng" nếu dự án không có giai đoạn đó - nhớ chia lại trọng số cho các giai đoạn còn lại. | Turn off "Applies" for stages the project does not have - then redistribute the weights. |
| weights.nextSave | Trọng số mới áp dụng từ lần lưu tiến độ tháng kế tiếp; % Thực tế các tháng đã lưu không tự tính lại. | New weights apply from the next monthly progress save; saved months are not recalculated. |
| weights.applyPreset | Áp bộ mặc định theo loại dự án | Apply the default set for this project type |
| links.sap / sapAdd / sapDocType | Mã SAP liên kết / + Thêm mã SAP / Loại chứng từ | Linked SAP codes / + Add SAP code / Document type |
| links.sapDuplicate / sapConfirmRemove | Mã SAP đã gắn với một dự án / Gỡ mã SAP {code} khỏi dự án? | SAP code is already linked to a project / Remove SAP code {code} from this project? |
| links.members / memberAdd / roleInProject | Người phụ trách (PIC / Backup) / + Thêm người / Vai trò | Owners (PIC / Backup) / + Add person / Role |
| links.noPic / membersAdminOnly | Dự án chưa có PIC / Chỉ quản trị viên thêm/gỡ người phụ trách. | No PIC yet / Only admins can add or remove owners. |
| links.memberConfirmRemove | Gỡ {name} khỏi dự án? Người này sẽ mất quyền với dự án. | Remove {name} from the project? They will lose access to it. |
| links.afterCreate | Lưu dự án trước, rồi gắn mã SAP, người phụ trách và nhà thầu. | Save the project first, then link SAP codes, owners and contractors. |
| tipText.masterCode | Hệ thống tự sinh khi lưu, không bao giờ đổi. Mã CT ngoài thực tế có thể đổi nhiều lần; mã gốc giữ nguyên để không mất lịch sử tiến độ, còn mỗi mã CT được lưu thành bí danh có hiệu lực theo thời gian. | Generated on save and never changes. The contract code may change many times; the master code stays so progress history is never lost, while each contract code is kept as an alias with an effective period. |
| tipText.aliasCode | Mã đang dùng để trao đổi với chủ đầu tư. Đổi mã ở đây không ghi đè: mã cũ có hiệu lực đến hôm nay, mã mới có hiệu lực từ ngày mai, cả hai đều nằm trong Lịch sử mã. | The code used with the client. Changing it does not overwrite: the old code is valid until today, the new one from tomorrow, and both stay in the code history. |
| tipText.customer | Gõ để tìm theo tên. Không thấy thì chọn + Thêm: chủ đầu tư mới dùng được ngay và vào danh sách chờ quản trị viên duyệt hoặc gộp. | Type to search by name. Not found? Choose + Add: the new customer is usable at once and is queued for an admin to approve or merge. |
| tipText.projectType | Loại hình công trình, dùng để lọc và phân nhóm dự án. | Project type, used to filter and group projects. |
| tipText.contractValue | Nhập trước VAT, đơn vị tỷ VNĐ. Đây là BAC - PV, EV, EAC, VAC đều tính từ số này. Hợp đồng ngoại tệ: nhập giá trị nguyên tệ ở ô bên cạnh, hệ thống quy đổi theo tỷ giá tháng ký hợp đồng và giữ nguyên số đã quy đổi, không đổi theo tỷ giá sau này. | Before VAT, in bn VND. This is the BAC - PV, EV, EAC and VAC are all based on it. Foreign-currency contracts: enter the original amount next to it; it is converted at the contract month's rate and then kept fixed, regardless of later rates. |
| tipText.tonnage | Tổng khối lượng kết cấu thép theo hợp đồng, đơn vị tấn. | Total structural steel quantity per contract, in tonnes. |
| tipText.priority | P0 - Trọng điểm, P1 - Lớn, P2 - Thường, P3 - Nhỏ. Dùng để lọc danh sách dự án; danh sách ở Tổng quan mặc định xếp P0 lên đầu. | P0 - Strategic, P1 - Large, P2 - Standard, P3 - Small. Used to filter projects; the Overview list sorts P0 first by default. |
| tipText.sap | Một dự án có thể gắn nhiều mã SAP (mỗi đơn hàng / hợp đồng phụ một mã). Import Excel dùng mã SAP để tìm dự án; mã chưa gắn dự án nào sẽ vào hàng chờ ở trang Import. | A project can have several SAP codes (one per order / sub-contract). Excel import finds projects by SAP code; unknown codes go to the queue on the Import page. |
| tipText.members | Tài khoản Nhập liệu được gán (PIC hoặc Backup) sửa được số liệu dự án này; tài khoản Xem được gán Backup chỉ xem được. Cảnh báo tự sinh giao cho PIC. | Data-entry users assigned as PIC or Backup can edit this project; viewer accounts assigned as Backup can only view it. Automatic alerts are assigned to the PIC. |
| tipText.contractors | Danh sách này đổ thẳng vào bảng Nhân lực theo nhà thầu và Tracking theo tuần ở Chi tiết dự án. Thiếu nhà thầu ở đây thì không nhập được số nhân lực của họ. | This list feeds the Manpower by contractor and Weekly tracking views on Project detail. Contractors missing here cannot have manpower entered. |
| count / required | {n}/{total} trường đã điền / Bắt buộc | {n}/{total} fields filled / Required |
| btn.create / save / draft / cancel | Tạo dự án / Lưu thay đổi / Lưu nháp / Hủy | Create project / Save changes / Save draft / Cancel |
| confirmDiscard | Bỏ các thay đổi chưa lưu? | Discard unsaved changes? |
| saved.created / saved.updated | Đã tạo dự án / Đã lưu thay đổi | Project created / Changes saved |
| part.profile / code / weights / milestones | hồ sơ / mã CT / trọng số / các mốc chính | profile / contract code / weights / key milestones |
| err.partial | Đã lưu: {done}. Chưa lưu: {failed} - {msg} | Saved: {done}. Not saved: {failed} - {msg} |
| err.invalid | Còn trường chưa hợp lệ - xem các ô tô đỏ | Some fields are invalid - see the red cells |
| err.required / positive / too_long / code_invalid / date_order / fx | Bắt buộc / Phải lớn hơn 0 / Tối đa {max} ký tự / Mã chỉ gồm chữ, số và . _ - /, không có khoảng trắng / Sai thứ tự ngày / Chưa quy đổi được nguyên tệ | Required / Must be greater than 0 / Max {max} characters / Letters, digits and . _ - / only, no spaces / Dates out of order / Cannot convert the foreign amount |
| err.code_taken / unchanged | Mã này đã được dùng cho dự án khác / Mã không đổi | This code is used by another project / Code unchanged |
| err.date_required | Ngày BĐ kế hoạch, HT kế hoạch và Bàn giao cam kết là bắt buộc | Planned start, planned finish and committed handover are required |
| err.date_plan_order / date_handover_before_finish / date_contract_after_start / date_actual_order | (cùng văn bản với `dateCheck.<code>` tương ứng) | (same text as the matching `dateCheck.<code>`) |
| err.tonnage_required / name_too_long | Khối lượng thép phải lớn hơn 0 / Tên dự án tối đa 160 ký tự | Steel tonnage must be greater than 0 / Project name max 160 characters |
| err.fx_contract_date_required / fx_rate_missing | Nhập Ngày ký HĐ để quy đổi nguyên tệ / Chưa có tỷ giá tháng ký hợp đồng | Enter the contract date to convert the foreign amount / No exchange rate for the contract month |
| err.weights_invalid / invalid_factory | Trọng số chưa hợp lệ (tổng phải 100%) / Khu vực không hợp lệ hoặc đã ngừng dùng. | Invalid weights (must total 100%) / Invalid or inactive production area. |
| err.pic_exists / user_not_found / role_not_allowed / not_member | Dự án đã có PIC - đổi PIC cũ sang Backup hoặc gỡ trước / Không tìm thấy tài khoản đang hoạt động / PIC phải là tài khoản Nhập liệu; Backup phải là tài khoản Nhập liệu hoặc Xem / Người này không thuộc dự án | This project already has a PIC - change them to Backup or remove them first / No active account found / PIC must be a data-entry account; Backup must be data-entry or viewer / This person is not on the project |
| err.forbidden / notFound / generic | Bạn không có quyền sửa dự án này. / Không tìm thấy dự án. / Lưu thất bại: {msg} | You cannot edit this project. / Project not found. / Save failed: {msg} |
| audit.title / chip / note | Dấu vết thay đổi / append-only / Mỗi lần lưu, hệ thống chụp lại toàn bộ hồ sơ cũ thành một phiên bản mới thay vì ghi đè - nên số liệu lịch sử không đổi khi bạn sửa giá trị hợp đồng. | Change trail / append-only / Every save snapshots the previous profile as a new version instead of overwriting - so historical figures do not change when you edit the contract value. |
| audit.time / user / table / field / old / new / empty | Thời điểm / Người sửa / Nội dung / Trường / Giá trị cũ / Giá trị mới / Chưa có thay đổi nào | Time / Changed by / Area / Field / Old value / New value / No changes yet |
| audit.tbl.dim_project / dim_project_alias / project_key_milestone / project_sap_codes / project_stage_weight / project_contractor / project_assignments / project_equipment_plan | Hồ sơ / Mã CT / Các mốc chính / Mã SAP / Trọng số / Nhà thầu / Người phụ trách / Kế hoạch thiết bị | Profile / Contract code / Key milestones / SAP codes / Weights / Contractors / Owners / Equipment plan |
| tip.* (Task 14) | văn bản Q2 sau khi chốt | Q2 text once approved |

**Thêm vào cuối `"activity"`** (Task 5, 6, 12): `update_project`, `change_project_code`, `save_stage_weights`, `remove_sap`, `project_member_set`, `project_member_remove`, `approve_customer`, `save_equipment_plans` (Lưu kế hoạch thiết bị / Save equipment plan). Văn bản vi/en ghi trong từng Task.

---

## Ngoài phạm vi (không làm, không ai yêu cầu)
Tạo/sửa hạng mục `project_work_item` (form thiết bị chỉ chọn hạng mục có sẵn hoặc "Chưa gán") · thêm cột "Cách tính" ở bảng trọng số · nhắc việc Backup khi PIC quá hạn (mock-up dòng 1084: app chưa có) · áp "hàng chờ duyệt" cho Team KD · 5 mục nợ P3A khác ở Q9 · mọi phần thông báo P3B.
