# PROGRESS — DDC Control Tower

## Giai đoạn hiện tại
**Redesign giao diện "Apple Glass" (nhánh `feature/apple-glass-redesign`, tạo từ `main` sau khi Run 1 merge) — ĐANG CHẠY (bắt đầu 2026-09-23).** Run 1 — ERP data model v2 đã CHỐT + merge vào `main` (local, chưa push). Phase 2 Part B: Postgres local (5433) + swap mock→Prisma HOÀN TẤT. 4 trang nghiệp vụ mới + vá bảo mật P1-P6 (2026-09-20).

### ⚠️ NẾU PHIÊN NÀY BỊ ĐỨT GIỮA CHỪNG (chạm ngưỡng usage) — ĐỌC TRƯỚC KHI LÀM GÌ KHÁC
1. Đọc `.bangiao/checkpoint.md` nếu có, rồi đọc hết mục này.
2. Chạy `git log --oneline feature/apple-glass-redesign` — đếm commit prefix `style(glass):` để
   biết đã xong Task mấy trong 12 Task (đối chiếu bảng "Trạng thái 12 Task" bên dưới).
3. **KHÔNG chạy lại planner.** `.bangiao/ke-hoach.md` đã hoàn chỉnh, cả 8 câu hỏi Q1-Q8 đã có dòng
   "QUYẾT ĐỊNH"/"MẶC ĐỊNH ĐANG ÁP DỤNG" ngay trong file (mục "CÂU HỎI CÒN BỎ NGỎ — ĐÃ CHỦ DỰ ÁN
   CHỐT") — không cần hỏi lại chủ dự án các câu đó.
4. **KHÔNG chạy lại coder từ Task 1.** Giao lại cho coder đúng câu: *"Đọc `.bangiao/ke-hoach.md`,
   xem `git log feature/apple-glass-redesign` để biết đã xong Task nào (commit prefix
   `style(glass):`), tiếp tục đúng từ Task kế tiếp — không làm lại Task đã commit."*
5. Nếu coder đang dở 1 Task chưa commit lúc đứt phiên, đọc `.bangiao/thay-doi.md` xem có ghi chú
   dở dang không trước khi tiếp tục Task đó.

### Trạng thái 12 Task (redesign) — cập nhật khi có commit `style(glass):` mới
| Task | Nội dung | Trạng thái |
|---|---|---|
| 1 | Token màu/blur/elevation + cơ chế theme + 2 test canh | Chưa xong |
| 2 | Shell (sidebar/topbar/progress bar) | Chưa xong |
| 3 | Card / chip / alert / skeleton + motion engine | Chưa xong |
| 4 | KPI + tag vàng "Trọng tâm" | Chưa xong |
| 5 | Bảng | Chưa xong |
| 6 | Form nền tảng + modal | Chưa xong |
| 7 | Wizard nhập liệu + import | Chưa xong |
| 8 | 5 editor quản trị | Chưa xong |
| 9 | Recharts (màu series + tooltip kính) | Chưa xong |
| 10 | Tổng quan + Chi tiết dự án | Chưa xong |
| 11 | 10 trang còn lại (gồm trang không có trong mock-up) | Chưa xong |
| 12 | Login + dọn sạch di sản | Chưa xong |

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
