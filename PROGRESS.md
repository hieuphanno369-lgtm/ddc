# PROGRESS — DDC Control Tower

## Giai đoạn hiện tại
**Run 1 — ERP data model v2 (nhánh `feature/erp-model-v2`) — dây chuyền `/ddc-tower:ship` ĐÃ CHỐT (2026-09-23, chạy tự động qua scheduled task).**
Phase 2 Part B: Postgres local (5433) + swap mock→Prisma HOÀN TẤT. Redesign UI Apple-style + 4 trang nghiệp vụ mới + vá bảo mật P1-P6 (2026-09-20).

### Trạng thái dây chuyền ship — Run 1 — **PHAN QUYET CUOI CUNG: CHOT** (1 ràng buộc cứng còn lại + sổ nợ kỹ thuật, xem "Next step")
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

### Ưu tiên 0 — N-1: còn 1 bước THỦ CÔNG cần chủ dự án tự chạy (không AI-agent nào được phép tự ý làm)
Migration `20260922220000_erp_model_v2` đã được **kiểm chứng độc lập đầy đủ** (2026-09-23, trên 1 DB
Postgres tạm tự tạo/tự xoá trong phiên, KHÔNG đụng DB dev thật):
- Áp cả 4 migration (kể cả `20260923025310_b5_dim_fk_restrict` mới) từ DB RỖNG → thành công.
- Kịch bản nâng cấp từ schema CŨ (mô phỏng đúng tình huống original coder gặp: 1 dự án có
  `fact_progress_monthly.bottleneckStage` rác + 2 dòng `fact_value_chain_progress` — 1 hợp lệ,
  1 rác) → migration dọn ĐÚNG: giá trị rác → NULL/xoá, giá trị hợp lệ được giữ nguyên.
- `prisma db seed` chạy sạch sau đó.

→ **Migration ĐÚNG.** Vấn đề CÒN LẠI chỉ là bookkeeping: DB dev thật (`ddc_control_tower`) có
checksum LỆCH trong bảng `_prisma_migrations` (file `migration.sql` bị sửa ở vòng CAN SUA #1
SAU KHI đã apply lên DB đó) → `prisma migrate dev/deploy` từ chối chạy tiếp trên DB này cho tới
khi checksum được đồng bộ lại. Sửa bookkeeping bảng nội bộ của Prisma trên DB dev thật là hành
động chạm **shared resource thật** — phiên làm việc này bị chặn tự thực hiện, đúng như Prisma
tự chặn AI agent chạy `migrate reset`. **Bạn (chủ dự án) tự chạy 1 trong 2 cách sau:**

1. **Cách nhanh (không mất dữ liệu, chỉ sửa bookkeeping):** kết nối `ddc_control_tower`
   (`localhost:5433`) rồi chạy:
   ```sql
   UPDATE _prisma_migrations SET checksum = '1acf260db75a0c1e6efe929671b7fad8ce61cd2d3b5734206ecfdedf3fffbd1e'
   WHERE migration_name = '20260922220000_erp_model_v2' AND finished_at IS NOT NULL;
   ```
   rồi chạy `npx prisma migrate deploy` (sẽ áp nốt `20260923025310_b5_dim_fk_restrict`).
2. **Cách sạch (mất dữ liệu, seed lại):** `npx prisma migrate reset` (Prisma sẽ đòi biến môi
   trường `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` — chỉ bạn tự set khi chạy tay).

Sau khi xong 1 trong 2 cách trên, migration `b5_dim_fk_restrict` (B-5, đã test riêng, xem "Đã
xong") sẽ lên DB dev thật.

### Ưu tiên 1 — 3 quyết định NGHIỆP VỤ cần chủ dự án chốt (KHÔNG tự vá — đổi định nghĩa KPI cho BOD)
- **B-1/B-2:** dự án thiếu ngày kế hoạch (`plannedStartDate`/`plannedFinishDate` = null) →
  `pctPlan = null` → `queries.ts:86` `isOnTrack(pctActual, pctPlan ?? 0)` ép về 0 → dự án đó
  VĨNH VIỄN được coi "đúng tiến độ", không bao giờ lọt KPI `behindSchedule` lẫn watchlist. Cần
  chốt: khi chưa biết ngày kế hoạch, `onTrack` nên trả `true` (như hiện tại), `false` (thận
  trọng — coi thiếu kế hoạch là rủi ro), hay tách hẳn thành trạng thái thứ 3 "chưa xác định"?
- **B-3:** `queries.ts:71` tính `pctPlan` (% Kế hoạch) neo theo `today()` (ngày THẬT hôm nay),
  trong khi `spi`/`pctActual` của CÙNG một dòng lấy từ fact của tháng ĐANG XEM (`?month=`). Xem
  `?month=2025-11` sẽ thấy "% KH" tính theo hôm nay (2026-09) nằm cạnh "% TT"/SPI của 11/2025 —
  hai con số không cùng một mốc thời gian. Bản kế hoạch gốc (`ke-hoach.md:1182`) chỉ định đúng
  `today()` nên đây có thể là CHỦ Ý (đo "vị trí kế hoạch NGAY BÂY GIỜ" bất kể đang xem tháng
  nào) hoặc là SƠ SÓT. Cần chốt: "% Kế hoạch" hiển thị trên trang chi tiết dự án nên luôn là
  hôm nay, hay phải đổi theo tháng đang xem (`endOfMonth(yearMonth)`) để khớp với %TT/SPI cùng
  dòng?

*(Đã cân nhắc tự chọn một mặc định và vá luôn, nhưng đây là định nghĩa KPI hiển thị cho BOD —
theo đúng quy ước làm việc đã có [tự quyết nghiệp vụ], phần này để chủ dự án quyết định.)*

### Ưu tiên 2 — phần Run 1 còn thiếu (plan tuyên bố nhưng chưa Task nào triển khai)
- 5 REST endpoint `GET /api/projects/[id]/{summary,value-chain,milestones,work-items,resources}`.
  `src/server/authz.ts` đã có (`requireProjectRead()`, viết cho B-4) và tái dùng được ngay cho
  các endpoint này khi triển khai — chỉ còn phần route handler + `authzError()` (401/403 JSON)
  chưa viết. **Chủ dự án cần quyết định có làm chunk tiếp theo cho Run 2 không.**

### Ưu tiên 3 — nợ cũ (trước Run 1, chưa đụng tới)
- **Vá HIGH `/api/export`** (thêm auth) + 4 LOW (closeAlert validate, rate-limit, getUserRoles).
- **Thêm flow reset/forgot password** (pre-prod blocker).
- Apply RLS + bật Google OAuth + deploy Supabase/Vercel + go-live reset.
- Smoke UI bằng Playwright (redesign + 4 trang mới) — cần restart Claude Code để MCP nạp tool.
- Điều tra MCP không tới subagent.

> Cập nhật: 2026-09-23 (dây chuyền ship Run 1 đã CHỐT qua scheduled task; sau đó vá tuần tự N-2→N-8 + B-4, B-5 trong phiên tương tác — không merge/push/PR, giữ nguyên nhánh `feature/erp-model-v2`. Còn lại: N-1 cần 1 bước thủ công từ chủ dự án (xem "Next step" Ưu tiên 0), B-1/B-2/B-3 cần chủ dự án chốt nghiệp vụ (Ưu tiên 1))
