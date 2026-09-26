# PROGRESS — DDC Control Tower

## Giai đoạn hiện tại
**Redesign giao diện "Apple Glass" (nhánh `feature/apple-glass-redesign`, tạo từ `main` sau khi Run 1 merge) — ĐANG CHẠY (bắt đầu 2026-09-23).** Run 1 — ERP data model v2 đã CHỐT + merge vào `main` (local, chưa push). Phase 2 Part B: Postgres local (5433) + swap mock→Prisma HOÀN TẤT. 4 trang nghiệp vụ mới + vá bảo mật P1-P6 (2026-09-20).

### ✅ P7-C1 - Task bổ sung đợt 2: tên app, bỏ nút xoá dữ liệu, Tổng quan, tên dự án trên sidebar (Tài khoản C) - CHỐT + ĐÃ MERGE vào `main` (2026-09-26)
Nhánh `feature/p7-c-task-bo-sung`; hồ sơ `.bangiao/archive/p7-c1-2026-09-26/`. 203 file / 2213 test; e2e 74/74 trên cổng 3003 + DB `ddc_control_tower_c`.
Coder → tester XANH → security ĐẠT → reviewer CHỐT (vòng 2) cho C-0 + 7.1 + 7.3 + 7.6; 7.7-7.10 làm sau khi CHỐT (e2e riêng, chưa qua reviewer, chủ dự án đồng ý merge luôn).
- C-0: e2e chạy được cho C (guard cặp DB/cổng trong `e2e/helpers/env.ts`, chặn key schema lặp và fragment trong `DATABASE_URL`).
- 7.1: xoá hẳn nút + action reset dữ liệu. 7.2: đã xoá dữ liệu DB của A (backup `D:\_project\DDC_dieu-phoi\backup-db\`).
- 7.3: tên app "BÁO CÁO QUẢN TRỊ" / "Danh Mục Dự Án" (EN dịch tương ứng), chữ sidebar 12px. 7.6: chữ Timeline.
- 7.7: bỏ khối "Dự án cần lưu ý" dưới thanh lọc (đảo quyết định T2 ngày 2026-09-25). 7.8: thẻ tô nổi là "Đang triển khai".
- 7.9: số tổng dự án giữa biểu đồ tròn, biểu đồ tròn đứng trước "Lượng & Trị theo Team KD".
- 7.10: trang Chi tiết đẩy tên dự án (đậm) + mã dự án (mờ) lên sidebar qua context (`src/components/layout/SidebarBrand.tsx`), có hiệu ứng, tắt khi giảm chuyển động.
- Sổ nợ N-P7-1..6 (xem `danh-gia.md` trong archive): reuseExistingServer không kiểm DB, fontSize inline ở AppShell, e2e 02 chập chờn nghi cache, guard chưa gắn tên worktree, `isExpectedDbUrl` chưa kiểm protocol, dọn JSDoc env.ts.

### ✅ P3D-B - Chặn truy cập khi chưa đăng nhập, vá S-1 (Tài khoản B) - CHỐT + ĐÃ MERGE vào `main` (2026-09-26)
Nhánh `feature/p3d-b-chan-truy-cap`; hồ sơ `.bangiao/archive/p3d-b-chan-truy-cap-2026-09-26/`. Sau merge P3C-B: 200 file / 2168 test; e2e 09 44/44.
Coder (test đỏ trước) → tester XANH (19 ca độc lập + kiểm trình duyệt thật) → security ĐẠT (vá thêm L-1 trong phase) → reviewer CHỐT.
- **S-1 đã đóng:** `middleware.ts` chặn khi không có phiên hợp lệ hoặc `token.invalid` (tài khoản bị khoá), mặc định role `viewer` khi token thiếu role (tránh vòng lặp login↔overview); `src/lib/require-user.ts` (helper `requireUser`) gọi ở layout `(app)` và cả 13 page, là lệnh await đầu tiên, chặn cả kẽ hở Next.js App Router render layout/page song song (redirect ở layout không chặn được page stream dữ liệu).
- L-1 (security, đã vá trong phase): matcher middleware bỏ qua path có dấu chấm (`/vi/projects/1.0`), `projects/[id]/page.tsx` giờ chỉ nhận id số nguyên dương viết chuẩn (`^[1-9]\d*$`), sai thì `notFound()`.
- Test tĩnh chặn page `(app)` mới quên gọi `requireUser` + route API mới chưa khai cách chặn; e2e không cookie quét 13 page × vi/en × RSC, cộng 2 ca thử vượt qua header `x-middleware-subrequest` (kiểu CVE-2025-29927).
- Rà route API + server action: không phát hiện lỗ hổng S-1 ở tầng API (mọi route đã tự chặn từ trước).
- Không đổi hành vi người đã đăng nhập (bảng `DENIED`, `homeForRole` giữ nguyên).
- Để sau: L-2 (payload RSC kèm cả từ điển i18n), L-3 (rate-limit `/api/health` né được qua `X-Forwarded-For`), ghi nợ cho P5 (A). 2 điểm yếu phần ảnh (`/api/photos` xem chéo dự án, `deletePhotoAction` dò mã ảnh), A gỡ toàn bộ code ảnh ở P3E.

### ✅ P3C-B - Chart T1/T2/T4/T5 (Tài khoản B) - CHỐT + ĐÃ MERGE vào `main` (2026-09-26)
Nhánh `feature/p3c-b-chart`; hồ sơ `.bangiao/archive/p3c-b-chart-2026-09-26/`. Sau merge P3A: 193 file / 2075 test; e2e 21/21.
Tester XANH → security ĐẠT (S-2 thẻ Top gửi thừa trường: đã sửa) → reviewer CẦN SỬA (gạch dài trên Gantt) → sửa → CHỐT. Không migration.
- T1: nhãn số trên chart nhân lực tuần, tooltip "Tổng TT" dùng trung bình thật.
- T2: thẻ "Top dự án trọng điểm" (P0 đang triển khai, trễ xếp trước) thay "Dự án cần lưu ý" trên Tổng quan; che tiền N-3 rồi chỉ gửi 6 trường xuống client.
- T4/T5: component `EquipmentPlanGantt` (Gantt thiết bị theo đợt) + `ManpowerMonthChart` (KH nhân lực tháng theo ca) + hàm đọc `readManpowerActualByMonth`; kiểu tạm `src/lib/p3c-contract.ts`.
- **Bước 11 chuyển sang A** (chủ dự án chốt 2026-09-26): gắn T4/T5 vào trang Chi tiết + xoá `p3c-contract.ts` + xoá chart cũ, làm trong P3C-A.
- **Phát hiện chặn deploy (có sẵn từ trước):** người chưa đăng nhập đọc được dữ liệu dự án qua `/vi/overview`, `/vi/projects/...` (middleware cho qua khi không có token). Vá ở phase P3D-B (B) ngay sau.
- Để sau: chuỗi i18n cũ còn gạch dài (làm ở P4); chú thích `queries.ts` còn tên `WatchlistCard`; nhãn T1 sát nhau khi KH gần bằng TT.

### ✅ P3A — Form Tạo/Sửa dự án (Tài khoản A) — CHỐT + ĐÃ MERGE vào `main` (2026-09-26)
Nhánh `feature/p3a-form-tao-sua`; hồ sơ `.bangiao/archive/p3a-form-tao-sua-2026-09-26/`. Sau merge P3B: 177 file · 1958 test.
Reviewer vòng 1 CẦN SỬA 7 mục → vòng sửa 1 → security CẦN SỬA F-1/N-1 → vá → ĐẠT → reviewer vòng 2 CHỐT.
- Trang `/ho-so-du-an`: tạo/sửa dự án 6 bước (định danh, giá trị HĐ + nguyên tệ quy đổi, mốc thời gian, các mốc chính, trọng số 7 giai đoạn, liên kết SAP/PIC/nhà thầu), nháp localStorage không chứa số tiền (v2), dấu vết thay đổi.
- Mã CT không trùng (không phân biệt hoa thường): unique index `lower(currentAliasCode)` + khoá advisory; mẫu `M-\d+` dành cho mã tự sinh, bị chặn cả khi tạo lẫn khi đổi.
- Tối đa 1 PIC/dự án: partial unique index; thêm/đổi thành viên trong transaction có audit.
- Form kế hoạch thiết bị `project_equipment_plan` (Task 10), ghi chú giới hạn import 10MB.
- Migration mới `20260925110000_p3a_unique_code_pic` (có rollback): bên B chạy `npx prisma migrate deploy`.
- L-10 xong (audit đổi role ghi đúng admin). T-1 (data-entry luôn xem tiền) nay là quyết định lâu dài QĐ-10, không gỡ.
- Để sau: S-1 bắt buộc trước go-live P6; `handleSaveNew` chưa báo lỗi khác mã CT (P3C-A); test tích hợp race 2 kết nối Postgres.

### ✅ P3B — Thông báo + e2e + chặn số tiền (Tài khoản B) — CHỐT + ĐÃ MERGE vào `main` (2026-09-25)
Nhánh `feature/p3b-thong-bao`; hồ sơ `.bangiao/archive/p3b-thong-bao-2026-09-25/`. 139/139 file · 1603 test; e2e 21/21.
Security vòng 1 CẦN SỬA (T-1…T-5) → vòng 2 ĐẠT; reviewer CHỐT. Không migration.
- Thông báo cảnh báo: kênh webhook (generic/Slack/Teams) + email SMTP (`nodemailer@10`) cấu hình trong Quản trị, bí mật
  mã hoá AES-256-GCM (`NOTIFY_SECRET_KEY`), gửi nền khi engine T11 mở alert (không chặn lưu), chống trùng, thử lại ≤3,
  "Gửi thử" 5 lần/phút; chống SSRF (ghim IP đã kiểm, chặn IP nội bộ mọi dạng; SMTP cho IP LAN). Tin không kèm số tiền.
- N-3 (chủ dự án: "liên quan đến đơn vị tiền đều tính hết"): mọi số tiền chặn ở server theo `canViewFinance` — Tổng quan,
  Chi tiết, Cảnh báo, Báo cáo, `/api/export`, `/api/report/export`. SPI/CPI/%/tấn vẫn hiện.
- Q6: quyền xem tiền đọc cột `user_roles.canViewFinance` từng người (admin luôn có), bật/tắt trong Quản trị, có audit,
  hiệu lực ≤5 phút với phiên đang mở; khoá tài khoản → mất phiên. **Data-entry luôn có quyền** (T-1, nay là quyết định lâu dài QĐ-10).
- e2e Playwright (`npm run test:e2e`, cổng 3001, chốt DB B): 8 spec luồng chính.
- Để sau: L-7/L-9/L-10 (cần `actions.ts`)/L-11, gỡ T-1 — xem `danh-gia.md` trong archive.

### ✅ P2B Bước 11 — T1 hiệu năng ĐẠT (Tài khoản B) — CHỐT + ĐÃ MERGE vào `main` (2026-09-25)
Nhánh `feature/p2b-t1-hieu-nang`; hồ sơ `.bangiao/archive/p2b-t1-hieu-nang-2026-09-25/`. 120/120 file · 1396/1396 test.
- 10.046.500 dòng / 517 dự án, `next start` thật, đo độc lập 2 bên: Tổng quan max 833 ms (quy trình có kiểm soát),
  cold-start thật 941 ms, Chi tiết dự án lớn nhất ≤ 441 ms → **tiêu chí ≤1,5 s ĐẠT, KHÔNG cần migration/index**.
- Gốc chậm là `summarize()` (JS) bị gọi 6–8 lần/lượt render `/overview`, không phải SQL → `requestMemo()` (React.cache
  trong 1 request) cho `getProjectSummaries`; validate `month` ở /overview (N-2). Vá L-1/L-2/L-3 script perf.
- Để sau: R-1/R-2/R-3 (guard perf), N-2b (whitelist filter /overview) — xem `danh-gia.md` trong archive.

### ✅ P2B — Biểu đồ & hiệu năng (Tài khoản B) — CHỐT + ĐÃ MERGE vào `main` (2026-09-25, sau P2A)
Nhánh `feature/p2b-bieu-do`, dây chuyền ship đủ chặng (vòng 1 CAN SUA → vòng 2 CHỐT → vòng bổ sung KPI CHỐT; security ĐẠT
cả 3 vòng). Hồ sơ: `.bangiao/archive/p2b-bieu-do-2026-09-25/`. Sau khi gộp P2A: `tsc` sạch, 119/119 file · 1378/1378 test.
- T12b: chart nhân lực theo ca × nhà thầu (mặc định tháng hiện tại) + chart cột chồng theo tuần (kéo toàn timeline, lọc
  tháng = cuộn tới + làm mờ, đường KH tổng, tuần lẻ chia số ngày thực có). T14 Gantt thiết bị từng chiếc (màu theo hạng
  mục, ô đậm = ngày dùng thật; dùng ngoài KH đếm vào chú thích).
- T1-code: read repo `src/server/repo/read-*.ts` (SQL tổng hợp, `DISTINCT ON`), bỏ N+1 Tổng quan/report, lọc log trong DB,
  trang Chi tiết đọc song song; seed 10 triệu dòng + `perf:bench`/`perf:pages`. **T1 CHƯA chứng minh ≤1,5 s** — đo lại ở
  Bước 11 (index/bảng tổng hợp, làm sau khi P2A nhả khoá schema) theo `hieu-nang.md` mục 4b trong archive.
- T4: ERD/từ điển sinh từ `Prisma.dmmf` + `schema-meta/docs.ts` (test chống lệch: thêm bảng/cột mà quên mô tả → đỏ);
  `npm run docs:erd` cập nhật `docs/DATA_WAREHOUSE_README.md`.
- Chủ dự án thêm: thẻ Chuỗi giá trị theo mock-up (bỏ thẻ EVM, dòng chân Σ trọng số/%TT), dời cụm S-curve→Ảnh xuống cuối
  trang Chi tiết; KPI bỏ tag "Trọng tâm", %TT có dòng "Chậm/Nhanh N ngày" + "±x,x%", nhãn scorecard xuống 2 dòng.
- Để sau: vá L-1/L-2/L-3 script perf trước `perf:seed` kế tiếp; N-3 (S-curve/What-if hiện cho người không có quyền tài
  chính) chờ chủ dự án; dọn key i18n thừa `kpi.focusTag`, `detail.manpowerTrend`, `detail.evmMetrics`.

### ✅ P2A — Nhập liệu mới (Tài khoản A) — CHỐT + ĐÃ MERGE vào `main` (2026-09-25)
Nhánh `feature/p2a-nhap-lieu`, dây chuyền ship đủ chặng (2 vòng sửa → reviewer v3 CHỐT, security v3 ĐẠT). Hồ sơ:
`.bangiao/archive/p2a-nhap-lieu-2026-09-24/`. `tsc` sạch, 98/98 file · 1177/1177 test.
- Ca tối thay ca chiều (mã `afternoon` → ca tối; chart đọc tên ca từ `dim_shift`); G-18 nhà thầu tham gia dự án.
- Nhập nhân lực theo ca + thiết bị theo ngày (sửa ngày cũ bắt buộc lý do → `audit_log.note`) + import Excel/file mẫu.
- T8 CRUD khu vực SX + sản lượng tháng; T6 tỷ giá tự lấy Vietcombank + sửa tay + dải nhắc; hạ tầng `job_run`/cron.
- T11 engine cảnh báo R1–R7 (sau mỗi lần lưu + hằng ngày), đóng alert bắt buộc ghi hành động. F4: import Excel cũ → `exceljs` (bỏ `.xls`).
- Migration `20260924150000_p2a_entry_foundation`: `job_run`, `notify_channel`, `notify_recipient` (nền P3B), cột mới ở
  `alert_log`, `audit_log.note`, `dim_factory.isActive`, `dim_exchange_rate.source`, `updatedAt/updatedBy` 3 bảng fact.
- **Chờ chủ dự án**: 3 câu hỏi (Task 10 form `project_equipment_plan`, jszip, trần import 20MB) — `danh-gia.md` trong archive.
- **B sau khi kéo main**: `npx prisma migrate deploy` trên `ddc_control_tower_b` + checklist merge P2A↔P2B.

### ✅ P1A — Dữ liệu đúng (Tài khoản A) — CHỐT + ĐÃ MERGE vào `main` (2026-09-24)
Nhánh `feature/p1a-du-lieu-dung`, dây chuyền ship đủ chặng (2 vòng CAN SUA → CHỐT ở reviewer vòng 3). Hồ sơ:
`.bangiao/archive/p1a-du-lieu-dung-2026-09-24/`. `tsc` sạch, 838 test P1A (928/928 sau khi gộp P1B), `next build` (font mock) sạch.
- **T2**: bản nháp localStorage không tự đè DB (chỉ áp khi bấm "Khôi phục", có dấu phiên bản); ngày về `yyyy-MM-dd`;
  form chỉ gửi field đã đổi; dự án mới để trống ngày.
- **3 lỗi mất dữ liệu âm thầm**: tháng chưa có fact/tài chính → tạo version 1, field không gửi lấy từ tháng trước;
  data-entry không còn gửi số tài chính (hết Forbidden); import Excel báo lỗi từng dòng (`rowNo` + lý do); lỗi lưu luôn hiện chữ.
- **Bảo mật**: `/api/export` bắt đăng nhập admin/bod + chống chèn công thức (`safeCell`); `canViewFinance ?? false`;
  bắt buộc `NEXTAUTH_SECRET`; upload ảnh kiểm magic byte (bỏ SVG), `nosniff` + CSP sandbox ở `/api/photos`,
  giới hạn Content-Length; trang nhập liệu tự kiểm role; **Next 14.2.15 → 14.2.35** (vá CVE-2025-29927).
- **T3**: `PhotoDropzone` kéo-thả + icon cloud + thanh tiến trình (XHR tới `POST /api/photo-upload`).
- **Migration gộp** `20260924090000_p1a_data_foundation` (+ rollback `prisma/rollback/`): `dim_shift` + `shiftCode` nhân lực
  (dữ liệu cũ dồn vào ca sáng), `dim_date` tuần ISO 2020–2035, `dim_project.factoryId` + `contractValueOriginal`,
  `project_equipment_plan` (Gantt T14), index cho T1. Seed có ca + 6 thanh Gantt.
- **Nợ / chờ quyết**: nâng Next ≥ 15.5.24 + React 19 + next-intl ≥ 4.9.1 + next-auth 4.24.15 (Next 14 còn RCE khi host
  Windows — chặn go-live); tường lửa chặn inbound 3000/3001 (`-H 127.0.0.1` làm dev 500); F4 xlsx → P2A; F6 nháp → P3A;
  F5/F7/F9 → P5B; F8 (import lộ mã SAP) chờ chủ dự án. Chi tiết: `danh-gia.md` mục 4–5 trong archive.
- **B sau khi kéo main**: `npm install` (Next 14.2.35) + `npx prisma migrate deploy` + seed trên `ddc_control_tower_b`.

### ✅ P1B — UI nhanh (Tài khoản B) — CHỐT + ĐÃ MERGE vào `main` (2026-09-24)
Nhánh `feature/p1b-ui-nhanh`, dây chuyền ship đủ chặng (1 vòng debug, 1 vòng CAN SUA → CHỐT). Hồ sơ:
`.bangiao/archive/p1b-ui-nhanh-2026-09-24/`. Không migration. `tsc` sạch, 802/802 test, `next build` (font mock) sạch.
- **A**: trang chi tiết dự án bỏ EAC/VAC → thẻ "Tổng số nhân lực"/"Tổng số thiết bị" ("Số liệu ngày dd/mm",
  "KH x · n nhà thầu"), bấm cuộn tới chart; bỏ hàng nguồn lực riêng.
- **T7**: ↑↓ Enter Esc cho Combobox, ProjectSwitcher, SettingsMenu; Esc cho HelpTip (logic ở `src/lib/list-nav.ts`).
- **T5**: /audit phân trang server 20 dòng, mặc định 14 ngày + nút "Tất cả" (`src/server/audit-log-page.ts`);
  /admin sửa tiêu đề cột, có giờ. audit_log không xoá.
- **T9/T10**: "Dự án cần lưu ý" 5 dòng + cuộn; Team KD/Cơ cấu rộng bằng nhau.
- **T12a**: Backlog & Công nợ quá hạn thành 2 scorecard. **Chốt định nghĩa backlog = tổng HĐ dự án "Chuẩn bị"**
  (áp cho KPI, /report, Excel — bỏ dùng `fact_financial.backlog`).
- **T13**: Chuỗi giá trị thêm tấn TT/KH cạnh % (Thiết kế/Nghiệm thu để trống); trọng số lấy từ `project_stage_weight`.
- Sửa kèm: SearchBox topbar tự xoá `?page` khi mount (lỗi có từ trước).
- **Để sau**: Combobox ↓ khi đóng chưa sáng mục 0; `report.ts` gọi `getLatestFact` 2N; /admin lọc activity_log
  trong bộ nhớ; `audit-log-page.ts` gọi prisma trực tiếp + thiếu index audit_log (→ P2B/T1).

### ✅ Redesign Apple Glass — CHỐT kỹ thuật + ĐÃ MERGE vào `main` (2026-09-23)
Coder 12/12 Task + mọi vòng vá đã xong. Dây chuyền ship 6 agent (planner→coder→tester→debugger→
security-reviewer→reviewer) đã CHỐT ở reviewer VÒNG 3 (vòng review chốt, sau 2 vòng CAN SUA đã dùng
hết 2/2). Commit code cuối trước merge: `1e34b26` (B-1..B-5). Chuỗi vá: `0c77fdd` CS-1/CS-2 →
`9941505` CS-3 motion → `1e34b26` B-1..B-5. Test 548/548, `tsc` sạch, `npm run build` sạch.

1. ✅ **reviewer VÒNG 3 = CHỐT** (2026-09-23, tự chạy lại tsc/test 548/548/build sạch ở `1e34b26`,
   ghi trong `.bangiao/danh-gia.md`). Dây chuyền ship redesign HOÀN TẤT về kỹ thuật.
2. ✅ **Dọn file + merge XONG** (release-manager, 2026-09-23, chủ dự án chốt trực tiếp "merge trước,
   làm phần mock-up còn thiếu sau"): che mật khẩu seed trong `.bangiao/` + `PROGRESS.md`, xoá
   `.bangiao/_test.md` (file rác), merge `feature/apple-glass-redesign` → `main` fast-forward —
   **local, CHƯA push**. `main` hiện ở HEAD `1ee7d9d`. `tsc` sạch + 548/548 test xanh xác nhận lại
   sau merge. Nhánh `feature/apple-glass-redesign` vẫn còn (trỏ cùng commit), chưa xoá.
3. **App CHƯA giống mock-up 100% — dù plan 12 Task đã xong** (đối chiếu class mock-up dòng 591-1135
   với code, 2026-09-23). Phần mock-up có mà app chưa có, trang Chi tiết dự án:
   - `.cdpanel` "Còn lại đến ngày HT kế hoạch" (đếm ngược) + `.tl` "Timeline kế hoạch vs thực tế"
     (vạch "Hôm nay") — mock-up dòng 636-663. Bị loại theo **Q8 mặc định (a)**, chủ dự án chưa từng
     trả lời Q8. Plan dòng 2033 đã ghi sẵn cách làm nếu chọn (b)/(c), dữ liệu có sẵn, không cần query mới.
   - 3 tag "Trọng tâm" (%TT, SPI, CPI) — app chỉ 1 tag theo **Q7 mặc định** (gắn ở SPI qua
     `hero heroTagLabel={t('kpi.focusTag')}`, `app/[locale]/(app)/projects/[id]/page.tsx:134`; %TT/CPI không có).
   - **Khối "Tracking huy động theo tuần — 7 ngày gần nhất"** (3 tab: Nhật ký theo ngày / Ma trận nhân
     lực / Theo thiết bị, mock-up dòng 770-787) — app không có UI. **Cập nhật quan trọng (2026-09-23):**
     data model đã CÓ SẴN từ Run 1 — `FactDailyManpower` (projectId/contractorId/workDate/
     plannedHeadcount/actualHeadcount) + `FactDailyEquipmentUsage` (+equipmentId/qtyPlanned/qtyActual,
     đúng quan hệ nhiều-nhiều nhà thầu×thiết bị theo ngày) + `ProjectContractor`, xem `prisma/schema.prisma`
     dòng ~560-624. KHÔNG cần vòng data-model riêng như đánh giá lúc trước — chỉ thiếu query + component
     UI 3 tab. Vẫn nên qua 1 vòng planner (thiết kế UI/API cho tính năng mới, không phải sửa CSS).
   - Cố ý khác, đã chốt: Q1 logo đỏ, Q5 không HUD FPS, Q6 quả cầu đứng yên.

   **ĐÃ CHỐT (2026-09-23): làm CẢ 3 phần trên**, cộng thêm 2 phát hiện mới khi chủ dự án yêu cầu rà
   soát rộng hơn (so `app/[locale]/(app)/projects/[id]/page.tsx` với mock-up dòng 621-788, và
   `src/components/form/CreateProjectForm.tsx` với mock-up dòng 866-1123, 2026-09-23):
   - **"Các mốc chính của dự án" (Key Milestones) chưa có UI ở đâu cả** — thiếu cả biểu đồ
     `kmChart`/`msChart` ("Timeline của 7 giai đoạn") ở Chi tiết dự án, LẪN bước 4 "Các mốc chính"
     trong form Tạo/Sửa dự án (grep `CreateProjectForm.tsx` không ra chữ "mốc"/milestone nào). Model
     `ProjectKeyMilestone` + `FactStageMilestone` cũng ĐÃ CÓ SẴN từ Run 1 (`schema.prisma` dòng
     ~504-537) — cùng dạng thiếu UI, không thiếu data, giống Tracking huy động.
   - **3 chart khác của Chi tiết dự án cũng chưa có:** "Biểu đồ so sánh theo hạng mục" (`cmpChart`,
     KH/TT theo tấn cho 1 giai đoạn) và "Nhân lực theo nhà thầu" + "Thiết bị theo nhóm" (`manChart`/
     `eqpChart` — breakdown theo nhà thầu/nhóm thiết bị, KHÁC với `ManpowerDailyChart` hiện có ở cuối
     trang vốn là biểu đồ trend theo ngày, không phải breakdown theo nhà thầu/nhóm).
   - **Chưa kiểm tra hết (làm tiếp khi resume):** đối chiếu từng field còn lại của form Tạo/Sửa dự án
     (mã gốc/mã CT tách bạch, nguyên tệ, mức ưu tiên, nhà thầu tham gia, PIC/backup, mã SAP...) với
     mock-up dòng 866-1123 — mới xem qua, chưa soát kỹ từng ô.

   **Việc thẩm mỹ tag vàng (mục 4 dưới) và lỗi avatar (mục 5 dưới) vẫn treo riêng**, không thuộc
   Đợt 2 trừ khi chủ dự án nói thêm.

   **Đợt 2 — tiến độ (2026-09-23):** nhánh `feature/apple-glass-mock-parity` (từ `main`). Planner
   XONG → `.bangiao/ke-hoach.md` (10 Task, không migration). Đã lưu hồ sơ redesign cũ vào
   `.bangiao/archive/apple-glass-redesign-2026-09-23/`. **Coder XONG cả 10/10 Task** (10 commit
   `feat(parity):` từ `8438794` đến `719b6bd`) — `tsc` sạch, **699/699 test xanh** (tăng 151 so với
   mốc 548 trước Đợt 2), `npm run build` sạch. Không lệch đáng kể so với plan. `.bangiao/thay-doi.md`
   đã có, cố ý CHƯA commit (để tester soát trước). Còn thiếu: kiểm mắt qua trình duyệt thật (sáng/tối
   + nhiều khổ màn hình) — coder không có trình duyệt, để tester tự làm.
   **Next: giao `ddc-tower:tester` cho Đợt 2**, rồi tiếp `ddc-tower:ship` (security-reviewer→
   reviewer) như bình thường. Mục "Rà soát form Tạo/Sửa dự án" trong `ke-hoach.md` (20 điểm G-1…G-20,
   nhiều điểm cần migration/luồng ghi mới) CỐ Ý để ngoài Đợt 2, chờ chủ dự án chọn hạng mục.
4. **Chủ dự án xem qua (thẩm mỹ, không chặn):** thẻ "Trọng tâm" ở `/overview` + `/report` giờ luôn
   hiện số màu VÀNG (2 trang truyền `tone="warn"` cố định) — giữ vàng, hay đổi về trắng như mock-up.
   Backlog reviewer thêm N-7: unit test `spring()`/`riseIn()` với rAF giả.
4. **Việc treo song song — lỗi avatar bị che góc phải topbar** (chủ dự án báo, có ảnh): CHƯA tái
   hiện được. Đã đo `getBoundingClientRect()` ở 1366/1518/1920/2560px, cả dev lẫn production build,
   và số đo console thật từ máy chủ dự án (`innerWidth 1518`, `devicePixelRatio ≈ 0.9` → Chrome
   zoom ~90%) — avatar luôn cách mép topbar đúng 20px, không tràn. Đang CHỜ chủ dự án: mở lại
   `npm run dev` + tab mới + Ctrl+Shift+R, xem còn bị che không. Nếu còn → xin ảnh chụp lúc TẮT
   DevTools + mức zoom Chrome, rồi mới sửa (đừng vá mù). Nếu chủ dự án muốn chống tràn phòng xa bất
   kể: hướng an toàn là cho `.search` (`app/globals.css:80`, đang `width:230px` cứng) co giãn
   (`min-width:0; flex:0 1 230px`) để nó nhường chỗ trước avatar (`AppShell.tsx:152` `shrink-0`).
5. **Lưu ý test animation:** pane trình duyệt của Claude khi bị ẩn sẽ ngừng `requestAnimationFrame`
   → thẻ KPI trông như "kẹt opacity" — đó là artefact môi trường test, KHÔNG phải lỗi (đã loại trừ).
6. **Backlog sau merge (không chặn):** modal đổi/reset mật khẩu bị giam trong sidebar
   (`SettingsMenu.tsx:234`, `UserEditor.tsx:163`) → cần `createPortal`; T-2/T-3 bảo mật; `/api/export`
   không auth (HIGH, nợ cũ). Rồi tới **Run 2** (5 REST endpoint).

### Trạng thái 12 Task (redesign) — cập nhật khi có commit `style(glass):` mới
| Task | Nội dung | Trạng thái |
|---|---|---|
| 1 | Token màu/blur/elevation + cơ chế theme + 2 test canh | XONG (`3e3cbe5`) |
| 2 | Shell (sidebar/topbar/progress bar) | XONG (`7fd7964`) |
| 3 | Card / chip / alert / skeleton + motion engine | XONG (`c3e6922`) |
| 4 | KPI + tag vàng "Trọng tâm" | XONG (`a11ac45`) — lệch nhỏ so với plan, xem `.bangiao/thay-doi.md` mục 3.1 |
| 5 | Bảng | XONG (`623f6e5`) |
| 6 | Form nền tảng + modal | XONG (`6143966`) |
| 7 | Wizard nhập liệu + import | XONG (`7e7de59`) |
| 8 | 5 editor quản trị | XONG (`a5b46aa`) |
| 9 | Recharts (màu series + tooltip kính) | XONG (`aae5f62`) |
| 10 | Tổng quan + Chi tiết dự án | XONG (`decc12c`) |
| 11 | 10 trang còn lại (gồm trang không có trong mock-up) | XONG (`aec8d86`) |
| 12 | Login + dọn sạch di sản | XONG (`4b515e1`) |

**Coder XONG cả 12/12 Task (2026-09-23).** 537/537 test xanh, `tsc` 0 lỗi.

**Tester XONG vòng 1 — KẾT LUẬN: FAIL (2026-09-23).** Xem bằng mắt qua Playwright thật, tìm ra
**2 lỗi thật do redesign gây ra** (chi tiết + bằng chứng trong `.bangiao/ket-qua-test.md`):
1. Tag vàng "Trọng tâm" đè chữ nhãn KPI ở màn hình hẹp (~360-410px, iPhone SE/12/13/14) — đo được
   chồng lấn 12.5-21.2px thật. Gốc: `.kpi .lb{padding-right:30px}` trong `app/globals.css` không
   đủ chỗ cho tag chữ (~75px), chỉ tính cho icon 26px.
2. Mất khoảng cách chữ (dính liền) ở `/vi/admin` ("Adminadmin@...") và `/vi/import` ("File Excel
   File .xlsx...") — do đổi class `.en` làm mất `margin-left` cũ. Có **test RED thật**:
   `src/components/admin/ActivityViewer.test.ts`.

`npm test`: 544/545 (1 rớt đúng lỗi #2 ở trên). 3 quan sát khác xác nhận có TỪ TRƯỚC redesign
(không phải lỗi mới, ngoài phạm vi): aria-label sai ở nút hamburger, thiếu key i18n `admin.delete`,
404 mặc định Next.js cho URL lạ (giới hạn kiến trúc, không phải bug).

**Debugger XONG vòng test-debug #1 (2026-09-23).** Cả 2 lỗi đã xác minh lại root cause bằng đo
Playwright thật (không tin sẵn chẩn đoán tester) rồi sửa tối thiểu, commit `e35a540`:
- Lỗi 1: root cause thật rộng hơn tester ban đầu tìm ra (đè tới 410px ở bản `en`, không phải chỉ
  390px) — do `.tag` neo `position:absolute` theo cạnh phải card trong khi nhãn có bề rộng cố định.
  Sửa bằng `@media(max-width:680px)` cho tag xuống dòng riêng thay vì đoán số padding.
- Lỗi 2: cách CSS `margin-left` tester gợi ý sẽ KHÔNG làm xanh được `ActivityViewer.test.ts` (test
  assert khoảng trắng thật trong chuỗi HTML) — debugger tự phát hiện, sửa bằng `{' '}` JSX tường
  minh ở đúng 2 chỗ vỡ (`ActivityViewer.tsx`, `ImportPanel.tsx`), xác nhận 2 chỗ dùng `.en` còn lại
  vẫn an toàn nhờ flex `gap`.
- `npx tsc --noEmit` sạch, **545/545 test xanh** (bao gồm `ActivityViewer.test.ts` ĐỎ→XANH).

**Đang chuyển lại tester (vòng xác nhận sau sửa)** để chạy lại toàn bộ + soi mắt xác nhận cả 2 lỗi
đã hết thật, không có hồi quy mới — resume ĐÚNG agent tester cũ `a045103b661032c7a` (không giao
tester mới, agent này đã có sẵn ngữ cảnh vòng 1). Đếm vòng test-debug: **1/2** đã dùng — quá 2 vòng
mà vẫn rớt thì dừng lại báo chủ dự án, không tự ý giao debugger sửa lần 3.

**Tester XONG vòng 2 — KẾT LUẬN: PASS (2026-09-23).** Tự đo lại độc lập bằng script/Playwright
riêng (không copy số của debugger) — cả 2 lỗi đã hết thật: hết đè chữ ở toàn dải 360-681px (cả
vi/en, cả 2 điểm biên sát ngưỡng 680px), khoảng trắng `/vi/admin` + `/vi/import` đúng 1 ký tự
`" "` thật trong DOM. `tsc` sạch, **545/545 test xanh**. Rà nhanh hồi quy diện rộng (overview
desktop, alerts) — không phát sinh gì mới. Chi tiết đầy đủ + số đo trong `.bangiao/ket-qua-test.md`
mục 7 "VÒNG 2" (giữ nguyên lịch sử vòng 1 FAIL phía trên).

**security-reviewer XONG (2026-09-23) — KẾT LUẬN AN TOÀN.** Không có lỗ hổng mới mức cao/trung.
3 ghi chú THẤP: T-1 (snapshot Playwright lộ mật khẩu seed, thư mục chưa gitignore — **ĐÃ VÁ ngay**,
thêm `.playwright-mcp/`+`.obsidian/` vào `.gitignore`, chưa commit), T-2/T-3 (nợ có từ trước, đưa
backlog). Chi tiết đầy đủ: `.bangiao/danh-gia-bao-mat.md`.

**reviewer vòng 1 XONG (2026-09-23) — PHÁN QUYẾT: CẦN SỬA.** Tự chạy lại `npx tsc --noEmit` (0 lỗi)
+ `npm test` (545/545 xanh) độc lập, không tin suông báo cáo trước. Chi tiết đầy đủ:
`.bangiao/danh-gia.md`. Tóm tắt:
- 🔴 **CS-1 (CHẶN MERGE):** BUG #1 ("Trọng tâm" đè chữ) **CHƯA hết thật** — bản vá debugger chỉ phủ
  ≤680px; suy từ chính số đo debugger/tester ra công thức hình học, lỗi vẫn còn ở desktop
  **1181–~1450px** (đúng dải laptop văn phòng 1280/1366 phổ biến), do lưới 6 cột không có container
  giới hạn rộng và tag vẫn `position:absolute`. Tester vòng 2 chỉ quét 360-720px rồi nhảy tới 1440px
  nên bỏ sót đúng dải lỗi.
- 🟡 **CS-2 (1 dòng, sửa cùng lượt):** `tailwind.config.ts:69` `transitionDuration` thiếu đơn vị
  (`fast:'180'` thay vì `var(--dur-fast)`) → CSS build ra `transition-duration:180` không hợp lệ,
  trình duyệt bỏ qua, token `--dur-*` vô hiệu ở 12 chỗ dùng.
- 🟡 **CS-3 (CẦN CHỦ DỰ ÁN QUYẾT, chưa giao coder):** Q4=(a) "port engine spring y hệt mock-up" —
  coder tạo đủ `src/components/ui/motion.ts` (210 dòng, đúng chữ plan) nhưng **không hook vào đâu**
  → UI không có hiệu ứng rise/press nào. 3 phương án: (1) bật thật (cần vá thêm cleanup rAF/timeout
  trước khi bật), (2) chấp nhận là hạ tầng để dành, (3) xoá cho tới khi cần.

**⚠️ NEXT STEP đang treo:** đã giao coder vá CS-1 + CS-2 (chạy nền, không đụng gì khác) → tester đo
lại `overlapX` thật bằng Playwright ở đúng "Điều kiện đóng CS-1" trong `danh-gia.md` (viewport
1181/1200/1280/1366/1440/1536/1920, sidebar mở+thu gọn, cả vi/en, cả `/overview` và `/report`) →
quay lại reviewer vòng 2. Đây là vòng CAN SUA #2 của redesign (vòng 1 là 2 lỗi UI đã xong ở
tester/debugger trước đó) — đếm vòng: **dùng 1/2**, quá 2 vòng vẫn rớt thì dừng báo chủ dự án.

**CS-3 XONG (2026-09-23):** chủ dự án chốt "bật thật" motion engine → coder gắn `useRise`/
`useHoverLift`/`usePressable` vào 4 lưới `.kpis`, `Card.tsx`, nút đăng nhập (commit `9941505`) →
tester PASS vòng 4 (rise-in/hover-lift/press hoạt động, tôn trọng `prefers-reduced-motion`, có 1
quan sát KHÔNG CHẶN: failsafe 900ms trong `riseIn()` có thể bị spring gốc ghi đè dưới tải nặng
dev/HMR).

**reviewer vòng 2 XONG (2026-09-23) — PHÁN QUYẾT: CẦN SỬA (vẫn chưa CHỐT).** Tự chạy lại
`npx tsc --noEmit` (0 lỗi) + `npm test` (546/546 xanh) độc lập. Xác nhận CS-1/CS-2/CS-3 đã đúng.
Nhưng soát lại TOÀN NHÁNH (không chỉ diff mới) phát hiện **5 thoái lui so với `main`** mà vòng 1
bỏ sót — chi tiết đầy đủ trong `.bangiao/danh-gia.md` mục "VÒNG 2":
- 🔴 **B-1:** `ProjectTable.tsx:99,104` — dự án CHƯA có SPI/CPI hiện chip xanh "ok" (trông như đang
  khoẻ, sai). Ngưỡng 0.9/1 gõ cứng, lệch với `THRESHOLDS` dùng chỗ khác (SPI 0.85 đỏ ở Tổng quan
  nhưng vàng ở Báo cáo — không đồng bộ).
- 🔴 **B-2:** `report/page.tsx:101,106` — cùng lỗi null→chip xanh, ở `main` là trung tính.
- 🟡 **B-3:** `KpiCard.tsx:61` — thẻ "Trọng tâm" luôn chữ trắng nên SPI 0.70 và 1.10 trông giống
  nhau ở `/projects/[id]` (không còn chỗ nào khác tô màu SPI trên trang đó). Vá: tô `var(--gold)`
  khi tone warn/danger. Hệ quả phụ cần biết: hero ở Tổng quan/Báo cáo cũng chuyển vàng theo — nếu
  muốn giữ trắng ở 2 trang đó thì bỏ `tone="warn"` (lựa chọn thẩm mỹ, không chặn).
- 🟡 **B-4:** `globals.css:100-107` — trạng thái sidebar thu gọn rò sang drawer mobile: thu gọn ở
  màn rộng rồi snap xuống ~960px thì drawer mở ra chỉ rộng 68px, không mở lại được. Vá: bọc trong
  `@media (min-width:1024px)`.
- 🟢 **B-5:** `motion.ts:117-126` — failsafe phải huỷ spring trước khi trả lại hiển thị (đúng quan
  sát failsafe-race của tester vòng 4; reviewer tính ra thẻ KPI cuối xong ở ~0.74s, cách mốc 900ms
  chỉ ~160ms nên dễ nhảy giữa chừng trên máy yếu). 1 dòng, gộp vào lượt vá.

**Điều kiện đóng vòng sau (reviewer yêu cầu):** chạy `npm run build` thật (lần cuối trước CS-3, tức
trước khi `Card`/`Rise` thành Client Component) + thêm 2 test hero vào `KpiCard.test.ts` + tester đo
lại B-1→B-5. **Đây là vòng CAN SUA 2/2 — quá 2 vòng vẫn rớt thì DỪNG, báo chủ dự án, không tự ý
giao coder vá lần 3.**

**B-1→B-5 XONG (2026-09-23):** coder vá (commit `1e34b26`) → tester PASS VÒNG 5 (đo thật cả 5
điểm, 548/548 test, `npm run build` sạch). **Next: reviewer vòng 3 chốt.**

**Ghi nhận thêm (có từ trước, không do đợt này, ưu tiên cao nhưng KHÔNG chặn merge):** modal đổi
mật khẩu (`SettingsMenu.tsx:234`) và modal reset mật khẩu (`UserEditor.tsx:163`) bị giam trong
khung sidebar hẹp (~204px, ~36px khi thu gọn) — cần `createPortal`. Đưa vào backlog.

**⚠️ ĐANG ĐIỀU TRA SONG SONG (chủ dự án báo 2026-09-23, CHƯA xác định root cause):** avatar tài
khoản ở topbar bị cắt/che ở góc phải màn hình trên máy chủ dự án (có ảnh chụp). Đã test kỹ ở
1366/1518/1920/2560px qua Playwright + đo `getBoundingClientRect()` thật — KHÔNG tái hiện được,
avatar luôn cách mép topbar đúng 20px ở mọi mốc test. Dữ liệu console thật từ máy chủ dự án:
`devicePixelRatio ~0.9` (bất thường, đang zoom/scale <100%), `innerWidth:1518` — nhưng số đo tại
đúng thời điểm đó cũng cho kết quả bình thường (không tràn), ngay sau dòng log
`[Fast Refresh] rebuilding/done` — nghi vấn ảnh lỗi gốc chụp TRƯỚC khi dev server tự cập nhật code
mới nhất. Đã yêu cầu chủ dự án Ctrl+Shift+R rồi chụp lại để xác nhận — CHƯA có kết quả (máy chủ dự
án shutdown giữa chừng). **Việc tiếp theo khi resume: xác nhận lại với chủ dự án xem hard-refresh
có hết chưa; nếu còn, cần thêm dữ liệu thật (zoom % Windows, độ phân giải màn hình, có mở DevTools
lúc chụp không) trước khi sửa code — tránh vá mù vì chưa tái hiện được lỗi.**

**8 quyết định Q1-Q8 đã chốt (2026-09-23, tóm tắt — chi tiết đầy đủ trong `ke-hoach.md`):**
Q1 logo: giữ `logo.png` đỏ trên nền trắng bo góc (KHÔNG dùng `.appicon` navy vẽ tay). Q2 công tắc
sáng/tối: giữ nguyên trong SettingsMenu, không thêm lên topbar. Q3 sidebar: giữ đủ cả 3 tính năng
hiện có (thu gọn/hamburger/drawer mobile), tự thiết kế kiểu kính. Q4 motion engine: port đủ engine
spring bằng JavaScript (không làm bản CSS xấp xỉ). Q5 HUD đo FPS: KHÔNG ship. Q6 nền động 4 quả
cầu mờ: giữ màu/vị trí, TẮT HẲN animation drift (đứng yên mọi trang). Q7 tag "Trọng tâm" (không
chặn): mặc định giữ hiện trạng (1 tag ở "Chậm tiến độ"). Q8 thêm đồng hồ đếm ngược/timeline (không
chặn): mặc định KHÔNG thêm, đúng phạm vi chỉ đổi giao diện.

### Trạng thái dây chuyền ship — Run 1 — **PHAN QUYET CUOI CUNG: CHOT** (kỹ thuật xong hết + 3 quyết định nghiệp vụ B-1/B-2/B-3 đã chốt 2026-09-23 — không cần vá code — chỉ còn merge/PR, xem "Next step")
Dây chuyền ship có đúng **6 agent**: planner, coder, tester, debugger, security-reviewer, reviewer.

| Chặng | Trạng thái | Bàn giao |
|---|---|---|
| 0. Check nhánh + dọn `.bangiao/` | XONG | — |
| 1. planner | XONG — plan đã chốt Q1-Q11, thêm Task 8 | `.bangiao/ke-hoach.md` (168KB, Task 0→8) |
| 2. coder | XONG — 6 commit, 316/316 test xanh, `tsc` 0 lỗi | `.bangiao/thay-doi.md` |
| 3. tester | XONG — 320/320 rồi 335/335 xanh (sau vòng CAN SUA #1); Task 8 UI đã verify bằng mắt qua Playwright, đăng nhập thật | `.bangiao/ket-qua-test.md` |
| 3b. debugger | không cần — không có test nào rớt suốt cả 2 vòng | — |
| 4. security-reviewer | XONG — vòng 1 phát hiện 1 lỗi **CAO** (migration FK trỏ bảng `dim_stage` rỗng, nguy cơ mất dữ liệu %HT); vòng 2 xác nhận đã đóng | `.bangiao/danh-gia-bao-mat.md` |
| 5. reviewer | XONG — vòng 1 **CAN SUA** (5 điểm A-1→A-5) → coder vá (commit `987c2e1`) → tester/security chạy lại → vòng 2 **CHOT** | `.bangiao/danh-gia.md` |

**Tóm tắt vòng CAN SUA #1 (2026-09-23):** reviewer yêu cầu vá A-1 (migration FK trỏ `dim_stage` rỗng — coder Run 1 gốc phải chạy tay UPDATE/DELETE không WHERE để né, rủi ro xoá sạch %HT nếu ai lặp lại ở prod), A-2 (bug mới do Run 1: KPI delta bịa số khi lọc "Tất cả" ở `/overview`), A-3 (`?month=abc` → 500 ở `/projects/[id]`), A-4 (`.env.example` bật sẵn `DDC_FAKE_TODAY`), A-5 (`resetAllData` không xoá `sap_queue`, mock/prisma lệch nhau). Coder vá 4.5/5 điểm (bỏ sót nửa A-5 ở hàm `removeProject`, đã khai báo trung thực trong `thay-doi.md`). Tester viết thêm 15 test tự verify RED→GREEN thật (không tautology). Security-reviewer rà lại xác nhận lỗ hổng CAO đã đóng, không có lỗ hổng mới. Reviewer vòng 2 CHỐT nhánh, kèm 2 ràng buộc cứng và sổ nợ kỹ thuật 8 mục (N-2→N-8) + 5 mục mang từ vòng 1 (B-1→B-5).

**6 quyết định chủ dự án đã chốt (đã nằm trong plan, mục "QUYẾT ĐỊNH ĐÃ CHỐT"):**
- Q1: mốc thứ 6 = "Ngày chênh lệch" = `actualFinish - plannedFinish`, tính runtime (`calcDayVariance`), không lưu cột.
- Q2: "% Kế hoạch" CHỈ dùng duration (`calcDurationPctComplete`), SPI tính lại theo đó; bỏ hẳn `fact.pctPlan` khỏi vai trò % kế hoạch.
- Q3: nguồn lực lấy theo NGÀY (không phải monthly); 2 scorecard có highlight ngày; thêm line chart cuối trang `/projects/[id]` (2 đường KH/TT, toggle tuần/tháng, nhãn X kiểu `21.09 - 27.09`, badge năm ở góc) → Task 8.
- Q4: `fact_daily_equipment_usage.qty` tách `qtyPlanned` + `qtyActual`.
- Q5: volume = shop/procurement/fabrication/transport/erection; manual = design/handover.
- Q6: giữ danh sách 10 hạng mục tạm ở Task 6.

## Đã xong
- Skeleton Next.js 14 + TS + Tailwind + next-intl (vi/en) + next-auth v4 + Recharts + exceljs + Vitest + Prisma 6 + Zod + bcryptjs.
- **Auth** email/password + Google OAuth (chưa bật CLIENT_ID). 4 role (Admin/BOD/Data-entry/Viewer). Quản lý tài khoản + đổi pass + activity tracking + seed 4 account.
- Overview đủ widget + detail + nhập liệu (wizard 4 bước) + import + reset go-live + Data Dictionary + Data Schema/ERD + SettingsMenu + Dark mode.
- **Postgres local (2026-09-18):** `localhost:5433` (PG 16.6), DB `ddc_control_tower`. Swap mock→Prisma (async `prisma-repo.ts` + barrel; giữ `mock-repo.ts` cho test). Append-only → upsert + audit_log/project_history.
- **Dây chuyền agent + skill (2026-09-19):** 4→6 agent + ship.md auto-loop `CAN SUA` (max 2 vòng) + gói skill portable → repo `my_skill`.
- **6 MCP global (2026-09-20):** playwright, filesystem, sequential-thinking, context7, postgres (read-only, pin `mcp<2`), github (pending PAT — OAuth không tương thích). Skill `security-audit` (Cloudflare) nối security-reviewer.
- **Feature tiến độ 7 giai đoạn (2026-09-20):** nhập % từng giai đoạn (Thiết kế→Nghiệm thu) + checkbox "áp dụng"; `%HT = sum(applicable)/count(applicable)`; `pctActual` suy từ giai đoạn. Migration `add_value_chain_applicable`. `src/lib/stages.ts`. Sửa CAN SUA: month-lock server-side, chặn trùng stageCode, `chainDirty`. Fix flaky `savePhotoFile` (`crypto.randomUUID()`).
- **Redesign UI Apple-style (2026-09-20):** sidebar+header đỏ `#B91C1C` + chữ vàng `#F5B301`, font Inter (next/font), card frosted (backdrop-blur) + hover lift, KpiCard gradient đỉnh + glow + icon, chart đỏ/vàng (sửa `#1e5eff`), bảng zebra, FilterBar mới (thay SidebarFilter), sidebar thu gọn 240↔68, login frosted. Bỏ 202 em-dash "—"→"-". Chart donut 1/3 + "Team KD" 2/3 + title đậm. Header h-16 khớp line trắng.
- **4 trang nghiệp vụ (2026-09-20):** `/report` (báo cáo BOD + Xuất Excel 3 sheet auth admin+bod), `/alerts` (đóng alert, BOD đóng được), `/compliance` (dự án Dang_trien_khai thiếu số liệu tháng), `/audit` (nhật ký thay đổi, admin). Sidebar 2 nhóm "Vận hành"/"Quản trị" thay "Hệ thống". +4 icon mới.
- **Bảo mật P1-P6 (2026-09-20):** `canViewFinance ?? false` (fail-closed), guard role server-side `/admin`+`/data-dictionary`+`/data-schema`, chặn data-entry ghi finance, import giới hạn size/type (10MB, .xlsx/.xls/.csv), lọc preview import theo assignment.
- **Run 1 — ERP data model v2 (2026-09-22/23), dây chuyền ship CHỐT:** 11 bảng ERP mới (enum, FK, fact append-only theo `version`/`isLatest`), mở khoá đồng hồ ứng dụng (`src/lib/clock.ts`, bỏ neo cứng theo seed), %TT chuyển sang tổng có trọng số (`calcChainPctActual`), %KH chuyển sang tính theo duration (`calcDurationPctComplete`, bỏ hẳn `fact.pctPlan`), nguồn lực theo ngày (2 scorecard KH/TT + biểu đồ Recharts cuối trang `/projects/[id]`, toggle tuần/tháng, đã verify UI bằng mắt qua Playwright đăng nhập thật). 7 commit tổng (6 Task 0-8 + 1 vá CAN SUA `987c2e1`). Test cuối: **335/335 xanh**, `tsc` 0 lỗi.
- **Vá N-4/N-5 (2026-09-23, sau khi dây chuyền CHOT):** `getPortfolioKpis()` trả `delta = 0` khi `yearMonth` sai format/miền giá trị, hoặc khi tháng đang xem HAY tháng liền trước chưa có dòng `fact_progress_monthly` nào — trước đây bịa ra KPI tăng/tụt giả. Vá đúng "quả bom nổ chậm" N-5 (từ 01/10/2026 `/overview` mặc định mở tháng chưa có fact). Commit `1a629c5`, kèm 2 test RED→GREEN mới + 3 file test tester viết ở vòng CAN SUA #1 lần 2 trước đó bị bỏ sót chưa commit (A-3, A-5). **338/338 xanh**, `tsc` 0 lỗi.
- **Vá N-3 (2026-09-23):** `?month=9999-12` (ĐÚNG format `YYYY-MM`, khớp regex, nhưng năm tràn số) từng vẫn ném RangeError ở `endOfMonth()` vì `isValidYearMonth()` trước đây chỉ check format, không check miền giá trị năm. `isValidYearMonth()` (`clock.ts`) giờ bound thêm năm 1900-2999; `resourceWindow()` (`project-queries.ts`) tự validate + fallback `currentMonth()` ngay tại nguồn, không phụ thuộc trang gọi đã validate hay chưa. Commit `020647f`.
- **Vá N-2 + N-8 (2026-09-23):** `removeProject()` giờ xoá cả `sap_queue` mồ côi (nửa còn lại của A-5, khớp `mock-repo`); `todayIso()` chỉ cho `DDC_FAKE_TODAY` có hiệu lực khi `NODE_ENV !== 'production'`, cảnh báo `console.warn` một lần nếu phát hiện lọt vào production. Commit `cd9123f`.
- **Vá N-7 (2026-09-23):** regex `yearMonth` ở đường GHI (`validation.ts`) từng lỏng hơn đường ĐỌC (`clock.ts`), chấp nhận `2026-00`/`2026-99`. Giờ dùng chung `isValidYearMonth()` - một nguồn định nghĩa duy nhất cho cả đọc/ghi. Commit `7f76131`.
- **Vá N-6 (2026-09-23):** 2 scorecard nguồn lực (nhân lực/thiết bị) từng dùng CHUNG 1 nhãn ngày (ngày mới hơn trong 2 ngày cuối) dù 2 bên có thể nhập lệch ngày - card có dữ liệu cũ hơn hiện nhầm ngày của card kia. `ResourceSnapshot` giờ trả `manpowerAsOfDate`/`equipmentAsOfDate` riêng biệt. Commit `a64ea69`.
- **Vá B-4 - BOLA/IDOR (2026-09-23):** viết `src/server/authz.ts` (`requireProjectRead()`) - phần đúng tên/đúng vị trí mà bản kế hoạch Run 1 đã liệt kê trong "Bản đồ file" nhưng chưa Task nào triển khai. Không phải đoán nghiệp vụ: seed (`buildAssignments()`, history.ts) đã có sẵn dữ liệu + ghi chú ý định từ trước ("viewer@ được gán Backup để có quyền đọc", "data-entry/viewer sẽ không đọc được dự án nào sau khi requireProjectRead có hiệu lực") - chỉ là hàm enforce chưa từng được viết. admin/bod xem mọi dự án; data-entry/viewer chỉ xem dự án có trong `project_assignments`. Gắn vào `/projects/[id]/page.tsx`. Commit `3c6c804`.
- **Vá B-5 (2026-09-23):** 4 FK trỏ tới `dim_contractor`/`dim_equipment` (dimension dùng chung mọi dự án) đang `ON DELETE CASCADE` - đổi `RESTRICT`, dùng `isActive=false` để xoá mềm. Migration `20260923025310_b5_dim_fk_restrict` đã kiểm chứng ĐỘC LẬP trên 1 DB Postgres tạm (tự tạo/tự xoá trong phiên, không đụng DB dev thật): áp từ đầu thành công + xác nhận RESTRICT chặn đúng DELETE khi còn lịch sử dùng. **CHƯA áp dụng lên DB dev thật** - xem N-1 ở "Next step". Commit `2178ef8`.
- **Test:** 366/366 pass. `tsc` 0 lỗi.

## Đang sửa / lỗi tồn đọng
- ⚠️ **HIGH: `/api/export` (route cũ) không auth** — ai cũng export được toàn bộ dự án gồm `contractValue`. Route mới `/api/report/export` đã auth đúng; route cũ cần vá.
- ~~BOLA/IDOR đọc `/projects/[id]`~~ **ĐÃ VÁ (2026-09-23, B-4, commit `3c6c804`)** — `src/server/authz.ts`.
- **KHÔNG có flow quên/reset mật khẩu (blocker pre-prod):** admin mất pass = chết cứng.
- **Bảo mật còn lại:** NEXTAUTH_SECRET hardcoded (đã set .env) · login không rate-limit · Excel formula injection (export mới đã safe, route cũ CSV cần check) · upload không giới hạn.
- **4 LOW (từ review 4 trang):** closeAlert thiếu validate alertId/action + guard alert tồn tại (P2025→500) · export mới thiếu rate-limit · `getUserRoles` trả `passwordHash`.
- **Chưa apply:** RLS (`rls.sql`) · Google OAuth (CLIENT_ID trống) · Supabase/Vercel deploy.
- **MCP → subagent:** wildcard `mcp__<server>` không cấp MCP cho subagent (Claude Code 2.1.278) — chưa điều tra.
- **i18n/a11y/UX:** vài label hardcode (`alert.type` dùng `common.status`, action "Đã xử lý" chưa i18n) · label thiếu htmlFor · silent fail.

## Next step

### ~~N-1~~ ĐÃ XONG (2026-09-23) — chủ dự án tự chạy UPDATE checksum + `prisma migrate deploy`
DB dev thật (`ddc_control_tower`) đã đồng bộ checksum + áp nốt `20260923025310_b5_dim_fk_restrict`.
`npx prisma migrate status` xác nhận **"Database schema is up to date!"**. Không còn việc kỹ thuật
nào treo cho Run 1.

### ~~Ưu tiên 1~~ B-1/B-2/B-3 ĐÃ CHỐT (2026-09-23, chủ dự án quyết định trực tiếp) — KHÔNG cần vá code
- **B-1/B-2:** chủ dự án xác nhận thực tế nghiệp vụ "lúc nào cũng có 2 ngày [kế hoạch] đấy" — tạo
  dự án mới luôn biết `plannedStartDate`/`plannedFinishDate` ngay từ đầu, tình huống thiếu gần như
  không xảy ra. Quyết định: **giữ nguyên hành vi hiện tại** — khi thiếu ngày kế hoạch, `onTrack`
  vẫn mặc định `true` (`queries.ts:86`). Không vá code.
- **B-3:** chủ dự án chốt **giữ "% Kế hoạch" tính theo hôm nay** (`today()`, đúng như plan gốc
  `ke-hoach.md:1182`), không đổi theo tháng đang xem. Không vá code.
- **Phát hiện thêm khi rà lại (LOW, không chặn merge, chưa vá):** ô "Ngày cam kết bàn giao" trên
  form Tạo/Sửa dự án có dấu `*` (gợi ý bắt buộc) nhưng KHÔNG được validate bắt buộc ở cả client
  (`DataEntryForm.tsx` — comment dòng ~179 "Thiếu field → cho submit, bổ sung sau") lẫn server
  (`createProjectSchema` ở `validation.ts:88` khai `committedHandoverDate: nullableDate`) — dấu
  `*` hiện chỉ mang tính hình thức. `plannedStartDate`/`plannedFinishDate` cũng vậy. Ghi nhận cho
  chủ dự án, chưa vá vì chưa được yêu cầu.
- **Việc còn lại của Run 1: merge nhánh `feature/erp-model-v2` vào `main` + mở PR** (đang chờ chủ
  dự án xác nhận trước khi push/tạo PR — xem quy tắc xác nhận hành động).

### Thứ tự ưu tiên tiếp theo (chủ dự án chốt 2026-09-23)
1. ~~Redesign giao diện theo `mockup-apple-glass.html`~~ **ĐANG CHẠY** — xem mục "Giai đoạn hiện
   tại" ở đầu file (nhánh, trạng thái 12 Task, resume nếu đứt phiên).
2. **Run 2** — 5 REST endpoint `GET /api/projects/[id]/{summary,value-chain,milestones,work-items,resources}`.
   `src/server/authz.ts` (`requireProjectRead()`, viết cho B-4) tái dùng được ngay — chỉ còn phần
   route handler + `authzError()` (401/403 JSON) chưa viết. Làm SAU khi redesign xong.

### Nợ cũ (trước Run 1, ưu tiên thấp hơn 2 việc trên trừ khi chủ dự án đổi ý)
- **Vá HIGH `/api/export`** (thêm auth) + 4 LOW (closeAlert validate, rate-limit, getUserRoles).
- **Thêm flow reset/forgot password** (pre-prod blocker).
- Apply RLS + bật Google OAuth + deploy Supabase/Vercel + go-live reset.
- Smoke UI bằng Playwright (redesign + 4 trang mới) — cần restart Claude Code để MCP nạp tool.
- Điều tra MCP không tới subagent.

### Ghi chú vận hành (2026-09-23, không phải bug code)
Dev server cổng 3000 (chủ dự án tự chạy `npm run dev` ở terminal ngoài phiên này) đang bị kẹt ở
trang đăng nhập — chunk `/_next/static/chunks/app/%5Blocale%5D/login/page.js` trả 404 liên tục,
đăng nhập không vào được. Nhiều khả năng do dev server chạy lâu qua nhiều lần sửa file chưa được
restart. Chưa tự ý tắt/khởi động lại vì đó là process chủ dự án đang chạy tay — chủ dự án restart
`npm run dev` nếu cần soi giao diện thật.

> Cập nhật: 2026-09-23 (dây chuyền ship Run 1 CHỐT qua scheduled task; vá tuần tự N-2→N-8 + B-4,
> B-5; N-1 chủ dự án tự chạy xong; B-1/B-2/B-3 chủ dự án chốt trực tiếp trong phiên — cả 3 đều
> GIỮ NGUYÊN, không cần vá code). **Run 1 kỹ thuật + nghiệp vụ đã xong 100%, chỉ còn merge/PR.**
> Thứ tự việc tiếp theo đã chốt: Run 1 merge → Redesign giao diện theo mock-up (nhánh riêng) →
> Run 2 (5 endpoint).
