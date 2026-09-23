# PROGRESS — DDC Control Tower

## Giai đoạn hiện tại
**Run 1 — ERP data model v2 (nhánh `feature/erp-model-v2`) — dây chuyền `/ddc-tower:ship` ĐÃ CHỐT (2026-09-23, chạy tự động qua scheduled task).**
Phase 2 Part B: Postgres local (5433) + swap mock→Prisma HOÀN TẤT. Redesign UI Apple-style + 4 trang nghiệp vụ mới + vá bảo mật P1-P6 (2026-09-20).

### Trạng thái dây chuyền ship — Run 1 — **PHAN QUYET CUOI CUNG: CHOT** (kèm 2 ràng buộc cứng + sổ nợ kỹ thuật, xem "Next step")
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
- **Test:** 335/335 pass. `tsc` 0 lỗi.

## Đang sửa / lỗi tồn đọng
- ⚠️ **HIGH: `/api/export` (route cũ) không auth** — ai cũng export được toàn bộ dự án gồm `contractValue`. Route mới `/api/report/export` đã auth đúng; route cũ cần vá.
- **BOLA/IDOR đọc `/projects/[id]`** — viewer/data-entry xem dự án người khác (pre-existing, defer).
- **KHÔNG có flow quên/reset mật khẩu (blocker pre-prod):** admin mất pass = chết cứng.
- **Bảo mật còn lại:** NEXTAUTH_SECRET hardcoded (đã set .env) · login không rate-limit · Excel formula injection (export mới đã safe, route cũ CSV cần check) · upload không giới hạn.
- **4 LOW (từ review 4 trang):** closeAlert thiếu validate alertId/action + guard alert tồn tại (P2025→500) · export mới thiếu rate-limit · `getUserRoles` trả `passwordHash`.
- **Chưa apply:** RLS (`rls.sql`) · Google OAuth (CLIENT_ID trống) · Supabase/Vercel deploy.
- **MCP → subagent:** wildcard `mcp__<server>` không cấp MCP cho subagent (Claude Code 2.1.278) — chưa điều tra.
- **i18n/a11y/UX:** vài label hardcode (`alert.type` dùng `common.status`, action "Đã xử lý" chưa i18n) · label thiếu htmlFor · silent fail.

## Next step
### Ưu tiên 0 — 2 ràng buộc cứng từ phán quyết CHOT (reviewer vòng 2, `.bangiao/danh-gia.md`)
1. **N-1 (CHẶN DEPLOY, không chặn merge):** migration `20260922220000_erp_model_v2` mới chỉ chạy trên DB dev nội bộ và checksum hiện đã LỆCH (file bị sửa sau khi apply ở vòng CAN SUA #1). **Trước khi chạm staging/prod**, phải: (a) trên DB dev máy này chạy `npx prisma migrate resolve --applied 20260922220000_erp_model_v2`; (b) tại QA gate `ddc-tower:golive`, dựng một DB rỗng, nạp trước vài dòng `fact_value_chain_progress` + 1 `bottleneckStage` rác, chạy `prisma migrate deploy` + `prisma db seed` một lượt để chứng minh migration tự chạy sạch từ đầu.
2. **N-5 (VÁ TRƯỚC 01/10/2026):** từ ngày này `currentMonth()` sẽ ra `2026-10` (chưa có fact), khiến `/overview` mặc định mở tháng trống → toàn bộ KPI về 0, "trễ tiến độ", delta bịa trên dashboard BOD. Vá ở `src/server/queries.ts:209` (khi `kpisForMonth(prevYm)` không có fact thì trả delta 0) — xem chi tiết trong `.bangiao/danh-gia.md` mục N-5.

### Ưu tiên 1 — sổ nợ kỹ thuật Run 1 (không chặn merge, nên làm đầu Run 2), chi tiết đầy đủ ở `.bangiao/danh-gia.md`
- N-2: `removeProject` chưa xoá `sap_queue` mồ côi (nửa còn lại của A-5).
- N-3: `?month=9999-12` vẫn ra 500 (validate miền giá trị, không chỉ format).
- N-4: `/overview?month=abc` vẫn ra delta KPI bịa (validate ở tầng hàm, không phải từng trang).
- N-6: nhãn ngày "Số liệu ngày ..." dán chung cho nhân lực + thiết bị dù 2 số có thể khác ngày nhập.
- N-7: `validation.ts` (đường ghi) lỏng hơn `clock.ts` (đường đọc) — có thể ghi rác vào bảng append-only.
- N-8: `DDC_FAKE_TODAY` chưa bị chặn ở `NODE_ENV=production`.
- B-1/B-2: dự án thiếu ngày kế hoạch → `pctPlan=null` bị ép thành 0 → vĩnh viễn "đúng tiến độ", không lọt KPI/watchlist. **Cần chủ dự án chốt nghiệp vụ**: `null` thì `onTrack` nên là gì?
- B-3: `pctPlan` neo theo `today()` nhưng `spi`/`pctActual` cùng dòng neo theo `endOfMonth(yearMonth)` — lệch mốc thời gian khi xem tháng quá khứ.
- B-4: BOLA/IDOR cũ ở `/projects/[id]` (pre-existing) nay lộ thêm dữ liệu nhân lực/thiết bị theo ngày của Task 8 — **rủi ro lớn nhất trước go-live**.
- B-5: 3 FK `dim_contractor`/`dim_equipment` đang `ON DELETE CASCADE` — chưa khai thác được nhưng là mìn cho Run 2 nếu thêm nút xoá nhà thầu/thiết bị.

### Ưu tiên 2 — phần Run 1 còn thiếu (plan tuyên bố nhưng chưa Task nào triển khai)
- `src/server/authz.ts` + 5 REST endpoint `GET /api/projects/[id]/{summary,value-chain,milestones,work-items,resources}`. Đây là mục tiêu Run 1 tự đặt ra trong tiêu đề nhưng plan chỉ ghi "viết ở chunk sau" — **chủ dự án cần quyết định có làm chunk tiếp theo cho Run 2 không**, và nếu làm thì nên gộp cùng N-2→N-4 ở trên (theo đề nghị của reviewer).

### Ưu tiên 3 — nợ cũ (trước Run 1, chưa đụng tới)
- **Vá HIGH `/api/export`** (thêm auth) + 4 LOW (closeAlert validate, rate-limit, getUserRoles).
- **Thêm flow reset/forgot password** (pre-prod blocker).
- Apply RLS + bật Google OAuth + deploy Supabase/Vercel + go-live reset.
- Smoke UI bằng Playwright (redesign + 4 trang mới) — cần restart Claude Code để MCP nạp tool.
- Điều tra MCP không tới subagent.

> Cập nhật: 2026-09-23 (chạy tự động qua scheduled task, dây chuyền ship Run 1 đã CHỐT — không merge/push/PR, giữ nguyên nhánh `feature/erp-model-v2` chờ chủ dự án xem)
