# Đợt 2 — App khớp `mockup-apple-glass.html` · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans`. Các bước dùng checkbox `- [ ]`.

**Goal:** Thêm phần trang Chi tiết dự án + form Tạo/Sửa còn thiếu so với mock-up (6 hạng mục chủ dự án chốt ở `PROGRESS.md` dòng 19-55), dùng data model có sẵn từ Run 1, KHÔNG migration.

**Architecture:** Logic thuần (hình học timeline, đếm ngược, gom tracking, trạng thái mốc, trục thời gian) nằm ở `src/lib/*.ts` và có unit test. Query mới nằm ở `src/server/project-queries.ts`, đi qua barrel `@/server/repo`. UI mới nằm ở `src/components/project/*`: component có hook thì nạp bằng `next/dynamic({ ssr:false })`, component không hook thì nhận chuỗi đã dịch qua props. Có đúng 1 luồng ghi mới: `saveKeyMilestonesAction` → `repo.replaceKeyMilestones`.

**Tech Stack:** Next.js 14.2.15 App Router · React 18.3 · TS 5.5 · next-intl 3.26.3 (`useTranslations`, `t.rich` — đã xác nhận có trong `node_modules/use-intl/dist/types/src/core/createTranslator.d.ts`) · Recharts 2.12.7 · Zod 4 · Vitest 2.1 (env `node`) · Prisma 6.19.

**Spec:** `mockup-apple-glass.html` ở gốc repo. Mọi "dòng N" trong plan là số dòng của file này. Nhánh làm việc: `feature/apple-glass-mock-parity`.

---

## CÂU HỎI CÒN BỎ NGỎ

Không câu nào chặn Task 1-10. Mỗi câu có **MẶC ĐỊNH ĐANG ÁP DỤNG**. Coder làm đúng theo mặc định; nếu chủ dự án đổi ý, sửa ở đúng chỗ ghi trong câu hỏi.

**Q1 — Đồng hồ đếm ngược đếm tới ngày nào? (Task 3)**
Mock-up tự mâu thuẫn. Panel ghi "Còn lại đến ngày HT kế hoạch", JS đếm tới `TARGET="2027-02-28"` = ngày HT KH (dòng 637-639, 1241, 1343). Nhưng tooltip ô "Bàn giao cam kết" ở form (dòng 997-998) lại nói mốc bàn giao cam kết (15/03/2027) mới là "mốc dùng để tính … đồng hồ đếm ngược".
→ **MẶC ĐỊNH (a):** đếm tới `plannedFinishDate`, nhãn đúng như mock-up vẽ. (b) = đếm tới `committedHandoverDate`: đổi prop `targetDate` ở page + 2 key `detail.cd.title`/`detail.cd.target`. Ghi chú: ở seed, dự án 1 có 2 ngày này trùng nhau (29/09/2026) nên demo không thấy khác biệt.

**Q2 — Tag "Trọng tâm" ở /overview và /report (Task 1)**
Mock-up gắn 3 tag lên `%TT BQ / SPI danh mục / CPI danh mục` (dòng 595-597). Nhưng 6 thẻ KPI của /overview (`OverviewWidgets.tsx:58-65`) và /report (`report/page.tsx:49-54`) là bộ khác hẳn (Tổng dự án / Đang triển khai / Trễ tiến độ / Nguy cơ phạt / Đã phạt / Backlog), không có thẻ %TT/SPI/CPI nào để gắn tag. Muốn thêm thì phải có chỉ số danh mục mới, cần công thức mà chưa ai định nghĩa (bình quân gia quyền theo BAC hay trung bình cộng?).
→ **MẶC ĐỊNH (a):** chỉ sửa /projects/[id]: 3 tag trên %TT/SPI/CPI, đổi thứ tự 6 thẻ thành `%KH, %TT, SPI, CPI, EAC, VAC` để 3 thẻ trọng tâm đứng liền nhau như mock-up (dòng 646-649). /overview và /report giữ nguyên 1 tag.

**Q3 — Đặt trình sửa "Các mốc chính" ở đâu? (Task 8)**
App KHÔNG có trang "Tạo / Sửa dự án" 6 bước như mock-up. Hiện tạo mới dùng `CreateProjectForm` (form gọn 9 ô), còn sửa nằm ở bước "Hồ sơ dự án" của `DataEntryForm`, cùng trang `/nhap-lieu`.
→ **MẶC ĐỊNH (a):** làm 1 component `KeyMilestoneEditor` và đặt vào CẢ HAI chỗ. Nút "Sửa mốc" trên thẻ biểu đồ dẫn tới `/nhap-lieu?project=ID&step=profile#key-milestones`, chỉ hiện với admin và data-entry. (b) dựng trang 6 bước mới giống mock-up: việc lớn, gắn với mục G ở Q7.

**Q4 — "Tracking 7 ngày gần nhất" tính lùi từ ngày nào? (Task 5)**
→ **MẶC ĐỊNH (a):** tính 7 ngày liên tiếp, kết thúc ở ngày cuối CÓ số liệu (nhân lực hoặc thiết bị) trong cửa sổ `resourceWindow(month)`. Cách này khớp với 2 thẻ nguồn lực đang có (Q3 Run 1: "ảnh chụp ngày gần nhất có dữ liệu"). Chip "Hôm nay" chỉ hiện khi ngày đó đúng là hôm nay. (b) luôn lấy 7 ngày kết thúc ở hôm nay, ngày chưa nhập hiện "-". Với seed hiện tại và đồng hồ thật (23/09) thì (b) ra bảng trống, vì seed dừng ở 16/09.

**Q5 — Cột "CHÊNH LỆCH" của "Timeline của 7 giai đoạn" (Task 9)**
Mock-up tính `ngày BĐ KH → ngày TT HT (hoặc dự kiến)`, thực chất là THỜI LƯỢNG, và tô đỏ khi > 150 ngày (dòng 1455-1457). Nhưng Q1 Run 1 đã chốt "Ngày chênh lệch = TT kết thúc − KH hoàn thành" (`calcDayVariance`, ghi chú `schema.prisma:499-503`).
→ **MẶC ĐỊNH (a):** hiện `dayVariance` theo Q1 Run 1. Chưa có ngày TT HT thì hiện "-". Giá trị > 0 hiện "+N ngày", tô đỏ; ≤ 0 giữ màu chữ thường.

**Q6 — Ngưỡng tô màu tỷ lệ huy động (Task 4, 5)**
App chưa có ngưỡng nào cho việc này, mock-up tự đặt: từng dòng TT/KH < 85% đỏ, < 95% vàng, còn lại xanh (dòng 1600, 1828); dòng TỔNG và cả tuần < 90% cảnh báo (dòng 1616, 1922); "Ngày sử dụng" thiết bị ≥ 5/7 xanh, ≥ 3/7 vàng (dòng 1893).
→ **MẶC ĐỊNH (a):** thêm đúng các số này vào `THRESHOLDS` (nguồn ngưỡng duy nhất).

**Q7 — Kết quả rà soát form Tạo/Sửa (hạng mục 6) — CẦN CHỦ DỰ ÁN CHỌN**
Đối chiếu mock-up dòng 866-1123 với `CreateProjectForm.tsx` + bước "Hồ sơ" và "Mã SAP & Ảnh" của `DataEntryForm.tsx`, ngoài "Các mốc chính" (đã có Task 6-8):

| # | Mock-up (dòng) | App hiện tại | Loại việc |
|---|---|---|---|
| G-1 | 1 trang 6 bước, nút gạt Tạo mới/Cập nhật, dải "6 bước" (868-877, 2014-2035) | Form gọn + wizard tháng 4 bước | UI lớn |
| G-2 | Mã gốc hiện ở dạng chỉ đọc, hint "Tự sinh khi lưu" (886-896) | Tạo mới không hiện; sửa chỉ hiện `currentAliasCode` | UI nhỏ |
| G-3 | "Mã CT hiện hành *" sửa được, đổi mã sẽ tạo alias mới (897-906) | Chỉ đọc, không có luồng ghi alias | Luồng ghi + quy tắc |
| G-4 | Tên: "tối đa 160 ký tự", viết thường (907-911) | Ép VIẾT HOA toàn bộ, không giới hạn độ dài | Quy tắc (mâu thuẫn) |
| G-5 | "+ Thêm CĐT" → vào hàng chờ duyệt gộp (915-923) | Tạo thẳng customer | Luồng mới |
| G-6 | Loại dự án quyết định bộ trọng số mặc định (930-934) | Mọi loại dùng chung `DEFAULT_STAGE_WEIGHTS` | Quy tắc chưa có số |
| G-7 | Ô "Giá trị nguyên tệ" + quy đổi theo tỷ giá tháng ký (947-960) | `dim_project` KHÔNG có cột này | **Cần migration** |
| G-8 | Khối lượng thép bắt buộc (961-968) | Không bắt buộc | Đổi hành vi validate |
| G-9 | Nhãn ưu tiên "P0 — Trọng điểm…P3 — Nhỏ" + tooltip (969-976) | Chỉ "P0..P3" | UI nhỏ |
| G-10 | Có bước "Mốc thời gian" ngay khi TẠO (980-1035) | Không có ô ngày nào (dù `createProjectAction` đã nhận các ngày) | UI vừa |
| G-11 | Dấu * bắt buộc ở BĐ KH / HT KH / Bàn giao cam kết (985-1001) | * chỉ để trang trí, không validate (`PROGRESS.md` dòng 280-285) | Đổi hành vi validate |
| G-12 | Thanh kiểm chuỗi ngày `#dateCheck` (1034, 1981-2000) | Không có | UI + validate |
| G-13 | "Đã bị phạt?" là công tắc `.switch` (1021-1023) | Checkbox | UI nhỏ |
| G-14 | Tooltip "?" cho 5 ô ngày/phạt (986-1031) | Không có; vài câu mô tả hành vi app chưa có | Cần duyệt nội dung |
| G-15 | Bảng trọng số 7 giai đoạn + kiểm tổng 100% (1058-1064, 1940-1980) | Không có UI; repo không có hàm ghi `project_stage_weight` | Luồng ghi mới |
| G-16 | Mã SAP dạng tagbox, có nút × xoá (1070-1079) | Thêm được, không xoá được | Luồng ghi mới |
| G-17 | PIC/Backup (1080-1089) | Không có UI/action; ảnh hưởng thẳng tới authz | Luồng ghi + bảo mật |
| G-18 | Nhà thầu tham gia (1092-1103) | Không có UI, không có hàm ghi `project_contractor` | Luồng ghi mới |
| G-19 | Thanh dính "Tạo / Lưu nháp / Hủy" + "n/24 trường" (1107-1113) | Lưu/Hủy, không đếm | UI nhỏ |
| G-20 | Thẻ "dấu vết thay đổi" của chính dự án (1116-1121) | Chỉ có trang /audit (admin) | UI + query |

→ **MẶC ĐỊNH:** KHÔNG làm mục nào trong Đợt 2. Lý do: nhiều mục cần migration, luồng ghi mới, hoặc quy tắc nghiệp vụ chưa ai định nghĩa. Riêng tooltip của mock-up: nhiều câu mô tả hành vi app chưa có, chép sang sẽ khiến UI nói sai. Chủ dự án chọn mục nào thì planner viết thêm Task cho mục đó.

**Q8 — (Thông tin) Chỗ khác ở Chi tiết dự án còn lệch mock-up, KHÔNG nằm trong 6 hạng mục nên không có Task:**
D-1 dải "Tầng 1-4" (`.sect`, dòng 644/654/722/759) · D-2 chip "Khâu nghẽn" nằm trong dòng tên dự án (630) · D-3 dòng phụ dưới KPI ("205/364 ngày", "▼ Chậm 2,8%"…, 646-649) · D-4 mock-up gộp Nhân lực/Thiết bị vào hàng 6 KPI, bấm vào thì cuộn tới thẻ (650-651, 2316) · D-5 Chuỗi giá trị: cột trọng số `.w` đang in "-" (`page.tsx:200`), dòng chân "Σ trọng số…" (705-706), bấm giai đoạn để chọn liên thông, tooltip giai đoạn (1366-1371) — plan này chỉ cho CHỌN giai đoạn bằng cách bấm hàng trong "Timeline của 7 giai đoạn" · D-6 thẻ Chuỗi giá trị full-width, không ghép với EVM · D-7 What-if ghép cặp với Lịch sử mã (731-757).

---

## Global Constraints

Áp dụng cho MỌI Task. Coder đọc lại mục này trước mỗi Task.

1. **Không migration, không đụng `prisma/schema.prisma`.** Mọi dữ liệu đều đã có: `FactStageMilestone`, `ProjectKeyMilestone`, `ProjectContractor`, `FactDailyManpower`, `FactDailyEquipmentUsage`, `ProjectWorkItem`, `FactStageWorkItem`.
2. **Truy cập dữ liệu:** code app import `repo` từ `@/server/repo` (barrel), không bao giờ import thẳng `prisma-repo`/`mock-repo`. Thêm hàm repo thì phải thêm ở CẢ `prisma-repo.ts` (async) LẪN `mock-repo.ts` (sync), cùng chữ ký (mẫu: cặp `getKeyMilestones`).
3. **"Hôm nay"** lấy từ `todayIso()` trong `src/lib/clock.ts`, không `new Date()` trong logic. Ngoại lệ duy nhất là nhịp giây của đồng hồ đếm ngược (Task 3): dùng `Date.now()` + `clockOffsetMs()`.
4. **Authz:** page chi tiết đã gọi `requireProjectRead(user, id)` (`page.tsx:56`) trước mọi lần đọc nên dữ liệu mới đọc trong page không cần check thêm. Action ghi mới dùng `requireProject()` (`src/server/actions.ts:27`), giống `saveMonthlyData`.
5. **Style** (test `src/ui/legacy-style-guard.test.ts` sẽ đỏ nếu vi phạm): trong `.tsx` cấm hex (`#fff`, `#abc`…, kể cả id SVG trông giống hex như `#cdD`); màu trắng trong SVG viết `fill="white"`. Cấm `dark:`, cấm palette Tailwind cũ. Màu luôn là `var(--token)`.
6. **Màu SVG tự vẽ:** đặt qua `style={{ fill: 'var(--x)' }}` / `style={{ stroke: 'var(--x)' }}` / `style={{ stopColor: 'var(--x)' }}`, KHÔNG đặt qua attribute `fill="var(--x)"` (var() không chạy trong presentation attribute). Riêng Recharts: lấy màu qua `useChartTokens()` như `src/components/dashboard/charts.tsx`.
7. **CSS mới:** copy nguyên văn từ mock-up theo số dòng ghi trong Task, dán vào `app/globals.css` BÊN TRONG `@layer components`, ngay trước dấu `}` đóng khối (hiện ở dòng 529). Mở đầu mỗi khối bằng comment `/* --- Dot 2 · Task N: … (mockup-apple-glass.html dong a-b) --- */`.
8. **Client component trên trang Chi tiết** (có hook hoặc `useTranslations`) phải nạp bằng `next/dynamic(() => import(...).then((m) => m.X), { ssr: false, loading: () => <div className="sk h-60" /> })`, đúng mẫu `page.tsx:18-23`. Lý do: `src/server/projects-detail-page-month-guard.test.ts` render trang bằng `renderToStaticMarkup`, không có NextIntlClientProvider. Component không hook (không `'use client'`) thì nhận chuỗi đã dịch qua props, như `KpiCard.heroTagLabel`.
9. **i18n:** key mới phải thêm vào CẢ `src/i18n/messages/vi.json` LẪN `en.json`, cùng vị trí (nếu thiếu, `src/i18n/messages.test.ts` sẽ đỏ). KHÔNG dùng em-dash "—" trong chuỗi UI (repo đã thay hết bằng "-"). Mỗi file mới có lời gọi `t('…')` với key literal phải thêm vào `CHANGED_SOURCES` trong `src/i18n/messages.test.ts` (dòng 37-44). Chỉ thêm file thật sự có key literal, vì test đòi mỗi file trích được ≥ 1 key.
10. **Test:** Vitest chỉ chạy `src/**/*.test.ts` (không `.tsx`), môi trường `node` (không DOM), `DDC_FAKE_TODAY=2026-09-16` (`vitest.config.ts`). Test component dùng `React.createElement` + shim `(globalThis as …).React = React`; mock `next-intl` theo mẫu `src/components/admin/ActivityViewer.test.ts:26-29`. Test action mock `next/cache` + `@/server/repo` → mock-repo + `@/lib/session`, theo mẫu `src/server/actions-valuechain.test.ts:12-17`. Test prisma-repo mock `@/server/db`, theo mẫu `src/server/repo/prisma-repo-reset.test.ts:16-43`.
11. **Không bịa số:** thiếu dữ liệu thì hiện "-" hoặc trạng thái trống, không bao giờ hiện 0 như số thật. Chia cho 0 thì trả `null`.
12. **Khoảng trắng JSX:** chữ nằm cạnh phần tử trong ô không phải flex phải có `{' '}` tường minh (bài học `ActivityViewer.tsx`, `PROGRESS.md` dòng 110-112).
13. **Không đụng:** `/overview`, `/report` (Q2), màu tag vàng/trắng, lỗi avatar topbar (`PROGRESS.md` mục 4-5).
14. **Cổng cuối mỗi Task:** `npx tsc --noEmit` = 0 lỗi, `npm test` xanh toàn bộ (mốc trước Đợt 2: 548/548, không được tụt), kiểm mắt `npm run dev` ở `/vi/projects/1` (và `/vi/nhap-lieu` ở Task 8) ở cả giao diện sáng lẫn tối. Task 10 chạy thêm `npm run build`.
15. **Commit** mỗi Task 1 lần, prefix `feat(parity):`, tiếng Việt KHÔNG dấu. Cuối Task ghi vào `.bangiao/thay-doi.md` như quy ước dây chuyền.

---

## File Structure

**Tạo mới**
| File | Trách nhiệm | Task |
|---|---|---|
| `src/lib/timeline.ts` (+test) | Hình học thanh KH/TT, vạch hôm nay, trễ khởi công | 2 |
| `src/components/ui/Legend.tsx` (+test) | Chú thích `.legend` + biến thể hình dạng | 2 |
| `src/components/project/PlanActualTimeline.tsx` | Khối `.tl` (server-safe) | 2 |
| `src/lib/countdown.ts` (+test) | Tính ngày/giờ/phút/giây, độ lệch đồng hồ app | 3 |
| `src/components/project/CountdownPanel.tsx` | `.cdpanel` chạy từng giây | 3 |
| `src/lib/resources.ts` (+test) | Kiểu `ResourceRow`, tỷ lệ + màu huy động | 4, 5 |
| `src/components/project/ChartTip.tsx` | Tooltip kính `.tip` (portal) | 4 |
| `src/components/project/ResourceBreakdownChart.tsx` (+test) | "Nhân lực theo nhà thầu" / "Thiết bị theo nhóm" | 4 |
| `src/components/ui/Card.test.ts` | Test `CardHeader.titleExtra` | 4 |
| `src/lib/tracking.ts` (+test) | Kiểu `WeeklyTracking` + dựng 3 view + thanh tổng kết | 5 |
| `src/components/ui/HelpTip.tsx` (+test) | Nút `?` + bong bóng `.help .bub` | 5 |
| `src/components/project/WeeklyTrackingCard.tsx` (+test) | Thẻ Tracking 3 tab | 5 |
| `src/lib/time-axis.ts` (+test) | Vạch đầu tháng + nhãn MM/YY | 6 |
| `src/lib/key-milestones.ts` (+test) | Trạng thái mốc, xếp nhãn, miền trục; validate + helper editor | 6, 7, 8 |
| `src/components/project/keyMsText.ts` | Chuỗi trạng thái mốc (dùng chung chart + editor) | 6 |
| `src/components/project/KeyMilestoneChart.tsx` (+test) | Biểu đồ `kmChart` | 6 |
| `src/server/repo/key-milestones.test.ts` | Test `replaceKeyMilestones` (mock) | 7 |
| `src/server/repo/prisma-repo-key-milestones.test.ts` | Test `replaceKeyMilestones` (prisma, db mock) | 7 |
| `src/server/actions-key-milestones.test.ts` | Test action ghi mốc | 7 |
| `src/components/form/KeyMilestoneEditor.tsx` (+test) | Bảng thêm/xoá/sửa mốc | 8 |
| `src/lib/stage-timeline.ts` (+test) | Hàng timeline 7 giai đoạn, miền trục, marker; kiểu so sánh hạng mục | 9, 10 |
| `src/components/project/stageText.ts` | Chuỗi/màu "Chênh lệch" | 9 |
| `src/components/project/StageTimelineChart.tsx` | SVG `msChart` | 9 |
| `src/components/project/StageExplorer.tsx` (+test) | 2 thẻ dùng chung giai đoạn đang chọn | 9, 10 |
| `src/components/project/WorkItemCompareChart.tsx` | Recharts `cmpChart` | 10 |
| `src/server/projects-detail-page-render.test.ts` | Render thật trang chi tiết | 1, 2, 6 |

**Sửa:** `app/[locale]/(app)/projects/[id]/page.tsx` (1-6, 9, 10) · `app/globals.css` (2, 3, 5) · `src/lib/thresholds.ts` (4, 5) · `src/lib/format.ts` (+test, 5) · `src/components/ui/Card.tsx` (4) · `src/components/ui/motion.ts` (4) · `src/server/project-queries.ts` (+test, 4, 5, 10) · `src/server/repo/types.ts`, `prisma-repo.ts`, `mock-repo.ts`, `src/server/validation.ts` (+test), `src/server/actions.ts` (7) · `src/components/form/CreateProjectForm.tsx`, `DataEntryForm.tsx`, `app/[locale]/(app)/nhap-lieu/page.tsx` (8) · `src/i18n/messages/vi.json`, `en.json`, `src/i18n/messages.test.ts` (2-10).

---

### Task 1: 3 thẻ "Trọng tâm" ở Chi tiết dự án + đổi thứ tự KPI

**Files:**
- Modify: `app/[locale]/(app)/projects/[id]/page.tsx:132-140`
- Create: `src/server/projects-detail-page-render.test.ts`

**Interfaces:** Consumes `KpiCard` (không đổi). Produces file test `projects-detail-page-render.test.ts` với hàm `render(searchParams, projectId, user)`; Task 2 và Task 6 sẽ thêm `describe` vào file này.

- [ ] **Bước 1: Viết test đỏ.** Tạo `src/server/projects-detail-page-render.test.ts`. Copy NGUYÊN khối mock + import + shim ở dòng 1-46 của `src/server/projects-detail-page-month-guard.test.ts` (next/navigation, next-intl/server, session, repo → mock-repo, `@/i18n/navigation` Link, Badges, WhatIf, ProjectSwitcher), rồi thêm:

```ts
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

async function render(searchParams: Record<string, string> = {}, projectId = '1', user: CurrentUser = ADMIN) {
  (getCurrentUser as Mock).mockResolvedValue(user);
  return renderToStaticMarkup(
    (await ProjectDetailPage({ params: { id: projectId, locale: 'vi' }, searchParams })) as React.ReactElement,
  );
}

afterEach(() => vi.clearAllMocks());

describe('Task 1 - 3 the "Trong tam" (%TT, SPI, CPI) dung canh nhau', () => {
  it('dung 3 the .kpi.key, gan dung %TT/SPI/CPI', async () => {
    const out = await render();
    const keys = [...out.matchAll(/class="kpi rise key"><span class="tag">kpi\.focusTag<\/span><div class="lb">([^<]+)<\/div>/g)].map((m) => m[1]);
    expect(keys).toEqual(['metric.pctActual', 'metric.spi', 'metric.cpi']);
  });
  it('thu tu 6 the: %KH, %TT, SPI, CPI, EAC, VAC', async () => {
    const out = await render();
    const pos = ['metric.pctPlan', 'metric.pctActual', 'metric.spi', 'metric.cpi', 'metric.eac', 'metric.vac']
      .map((k) => out.indexOf(`<div class="lb">${k}</div>`));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });
});
```

- [ ] **Bước 2:** `npx vitest run src/server/projects-detail-page-render.test.ts` → phải ĐỎ (hiện chỉ có 1 thẻ key là SPI).
- [ ] **Bước 3:** Thay dòng 132-140 của `page.tsx` bằng:

```tsx
      {/* 6 KPI - 3 the "Trong tam" (%TT, SPI, CPI) dung canh nhau nhu mock-up dong 646-649 */}
      <Rise className="kpis">
        <KpiCard label={t('metric.pctPlan')} value={formatPct(summary.pctPlan, locale)} delta={null} tone="neutral" icon={IconProject} />
        <KpiCard label={t('metric.pctActual')} value={formatPct(summary.pctActual, locale)} delta={null} tone="neutral" hero heroTagLabel={t('kpi.focusTag')} icon={IconAlert} />
        <KpiCard label={t('metric.spi')} value={formatRatio(summary.spi)} delta={null} tone={summary.spi != null && summary.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'} hero heroTagLabel={t('kpi.focusTag')} icon={IconTrend} />
        <KpiCard label={t('metric.cpi')} value={formatRatio(summary.cpi)} delta={null} tone={summary.cpi != null && summary.cpi < THRESHOLDS.cpiWarn ? 'warn' : 'ok'} hero heroTagLabel={t('kpi.focusTag')} icon={IconMoney} />
        <KpiCard label={t('metric.eac')} value={formatTyd(summary.eac, locale)} delta={null} tone="neutral" icon={IconGauge} />
        <KpiCard label={t('metric.vac')} value={formatTyd(summary.vac, locale)} delta={null} tone={summary.vac != null && summary.vac < 0 ? 'danger' : 'ok'} icon={IconFlag} />
      </Rise>
```

Giữ nguyên tone của từng thẻ. Không đổi `KpiCard.tsx`.

- [ ] **Bước 4:** chạy lại test → XANH. `npx tsc --noEmit`, `npm test`.
- [ ] **Bước 5:** kiểm mắt `/vi/projects/1` ở 1366px và 1920px: 3 thẻ gradient nằm ở vị trí 2-4, tag không đè chữ.
- [ ] **Bước 6:** `git commit -m "feat(parity): 3 the trong tam %TT/SPI/CPI o chi tiet du an + doi thu tu KPI"`

---

### Task 2: Timeline KH/TT dạng thanh + vạch "Hôm nay"

**Files:**
- Create: `src/lib/timeline.ts`, `src/lib/timeline.test.ts`, `src/components/ui/Legend.tsx`, `src/components/ui/Legend.test.ts`, `src/components/project/PlanActualTimeline.tsx`
- Modify: `page.tsx:162-175` (khối `{/* Timeline */}`), `app/globals.css`, `vi.json`/`en.json`, `src/i18n/messages.test.ts`
- Test: bổ sung `src/server/projects-detail-page-render.test.ts`

**Interfaces:**
- Produces `buildPlanActualTimeline(i: PlanActualTimelineInput): PlanActualTimeline | null`.
- Produces `Legend({ items: LegendItem[] })`, với `LegendItem = { label: string; color: string; line?: boolean; shape?: LegendShape }` và `LegendShape = 'ring' | 'dot' | 'diamondO' | 'diamond' | 'tri'`. Task 4, 6, 9, 10 dùng lại.
- Produces trong `page.tsx`: `const today = todayIso();`, đặt ngay sau dòng `const summary = …`. Task 3, 6, 9 dùng lại biến này.

- [ ] **Bước 1: Test đỏ `src/lib/timeline.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { MIN_ACTUAL_BAR, buildPlanActualTimeline } from './timeline';

// 2026-01-01 → 2026-12-31 = 364 ngày; 2026-01-01 → 2026-07-02 = 182 ngày
const BASE = { plannedStart: '2026-01-01', plannedFinish: '2026-12-31', actualStart: '2026-01-11', pctActual: 0.4, today: '2026-07-02' };

describe('buildPlanActualTimeline', () => {
  it('duong chay thuan: vi tri hom nay, thanh TT tu ngay BD TT toi vi tri %TT, tre khoi cong', () => {
    const r = buildPlanActualTimeline(BASE)!;
    expect(r.todayPos).toBeCloseTo(182 / 364, 10);
    expect(r.actual!.left).toBeCloseTo(10 / 364, 10);
    expect(r.actual!.width).toBeCloseTo(0.4 - 10 / 364, 10);
    expect(r.startDelayDays).toBe(10);
  });
  it('nhan ISO day du nhu prisma-repo tra ("...T00:00:00.000Z")', () => {
    const r = buildPlanActualTimeline({ ...BASE, plannedStart: '2026-01-01T00:00:00.000Z', plannedFinish: '2026-12-31T00:00:00.000Z', actualStart: '2026-01-11T00:00:00.000Z' })!;
    expect(r.startDelayDays).toBe(10);
  });
  it('thieu ngay KH hoac HT KH <= BD KH -> null', () => {
    expect(buildPlanActualTimeline({ ...BASE, plannedStart: null })).toBeNull();
    expect(buildPlanActualTimeline({ ...BASE, plannedFinish: null })).toBeNull();
    expect(buildPlanActualTimeline({ ...BASE, plannedFinish: '2026-01-01' })).toBeNull();
  });
  it('chua khoi cong -> actual null, startDelayDays null', () => {
    const r = buildPlanActualTimeline({ ...BASE, actualStart: null })!;
    expect(r.actual).toBeNull();
    expect(r.startDelayDays).toBeNull();
  });
  it('hom nay truoc BD KH -> 0; sau HT KH -> 1', () => {
    expect(buildPlanActualTimeline({ ...BASE, today: '2025-12-01' })!.todayPos).toBe(0);
    expect(buildPlanActualTimeline({ ...BASE, today: '2027-03-01' })!.todayPos).toBe(1);
  });
  it('BD TT som hon BD KH -> left kep 0, startDelayDays am', () => {
    const r = buildPlanActualTimeline({ ...BASE, actualStart: '2025-12-22' })!;
    expect(r.actual!.left).toBe(0);
    expect(r.actual!.width).toBeCloseTo(0.4, 10);
    expect(r.startDelayDays).toBe(-10);
  });
  it('%TT nho hon vi tri BD TT -> thanh van rong toi thieu', () => {
    const r = buildPlanActualTimeline({ ...BASE, actualStart: '2026-07-01', pctActual: 0.1 })!;
    expect(r.actual!.width).toBe(MIN_ACTUAL_BAR);
  });
  it('BD TT sau HT KH -> thanh don sat mep phai, khong tran', () => {
    const r = buildPlanActualTimeline({ ...BASE, actualStart: '2027-02-01', pctActual: 0 })!;
    expect(r.actual!.left + r.actual!.width).toBeCloseTo(1, 10);
  });
});
```

- [ ] **Bước 2:** chạy → ĐỎ (chưa có module).
- [ ] **Bước 3: `src/lib/timeline.ts`**

```ts
import { daysBetween, type IsoDate } from '@/lib/clock';

/** Bề rộng tối thiểu (phân số trục) của thanh "Thực tế" để luôn nhìn thấy. */
export const MIN_ACTUAL_BAR = 0.02;

export interface PlanActualTimelineInput {
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  pctActual: number;
  today: IsoDate;
}

export interface PlanActualTimeline {
  /** Vị trí "Hôm nay" trên trục KH, kẹp [0,1]; cũng là bề rộng phần tô đậm `.tlfill`. */
  todayPos: number;
  /** null = chưa có ngày BĐ thực tế. */
  actual: { left: number; width: number } | null;
  /** BĐ TT − BĐ KH (ngày, dương = trễ); null nếu thiếu 1 trong 2 ngày. */
  startDelayDays: number | null;
}

const d10 = (s: string) => s.slice(0, 10);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Hình học khối "Timeline kế hoạch vs thực tế" (mock-up dòng 661-670). Trục = [BĐ KH, HT KH].
 * Thanh TT bắt đầu ở ngày BĐ TT và DÀI TỚI vị trí %TT trên trục (mock-up: left 3% + width 50,5%
 * = 53,5% = %TT), không tới một ngày cụ thể. Thiếu ngày hoặc HT <= BĐ → null (trang giữ hiển thị chữ cũ).
 */
export function buildPlanActualTimeline(i: PlanActualTimelineInput): PlanActualTimeline | null {
  if (!i.plannedStart || !i.plannedFinish) return null;
  const ps = d10(i.plannedStart);
  const span = daysBetween(ps, d10(i.plannedFinish));
  if (span <= 0) return null;
  const todayPos = clamp01(daysBetween(ps, i.today) / span);
  let actual: PlanActualTimeline['actual'] = null;
  if (i.actualStart) {
    let left = clamp01(daysBetween(ps, d10(i.actualStart)) / span);
    const width = Math.max(clamp01(i.pctActual) - left, MIN_ACTUAL_BAR);
    if (left + width > 1) left = 1 - width;
    actual = { left, width };
  }
  return { todayPos, actual, startDelayDays: i.actualStart ? daysBetween(ps, d10(i.actualStart)) : null };
}
```

- [ ] **Bước 4:** chạy → XANH.
- [ ] **Bước 5: `src/components/ui/Legend.tsx`** (server-safe: KHÔNG `'use client'`, không hook) + test

```tsx
import type { CSSProperties } from 'react';

export type LegendShape = 'ring' | 'dot' | 'diamondO' | 'diamond' | 'tri';
export interface LegendItem { label: string; color: string; line?: boolean; shape?: LegendShape }

/** `.legend` mock-up dòng 375-378; biến thể hình dạng theo renderMsLegend dòng 1396-1401. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <span className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i className={it.line ? 'ln' : undefined} style={swatch(it)} />
          {it.label}
        </span>
      ))}
    </span>
  );
}

function swatch({ color, shape }: LegendItem): CSSProperties {
  const s: CSSProperties = { background: color };
  if (shape === 'ring' || shape === 'diamondO') { s.background = 'transparent'; s.border = `2px solid ${color}`; }
  if (shape === 'diamond' || shape === 'diamondO') s.transform = 'rotate(45deg)';
  if (shape === 'tri') { s.clipPath = 'polygon(50% 0,100% 100%,0 100%)'; s.borderRadius = 0; }
  return s;
}
```

`src/components/ui/Legend.test.ts`: render 5 mục `{KH, var(--s-plan)}`, `{Hôm nay, var(--danger), line}`, `{HT, var(--s-third), diamond}`, `{DK, var(--s-cost), tri}`, `{BĐ, var(--s-plan), ring}`, rồi assert output chứa lần lượt: `<i style="background:var(--s-plan)"></i>KH`, `class="ln"`, `transform:rotate(45deg)`, `clip-path:polygon(50% 0,100% 100%,0 100%)`, `background:transparent;border:2px solid var(--s-plan)`.

- [ ] **Bước 6: `src/components/project/PlanActualTimeline.tsx`** (server-safe)

```tsx
import type { CSSProperties } from 'react';
import type { PlanActualTimeline as Geometry } from '@/lib/timeline';

export interface PlanActualTimelineProps {
  geometry: Geometry;
  labels: { planned: string; actual: string; todayPill: string; notStarted: string };
  planRange: string;      // "15/12/2025 → 29/09/2026"
  actualRange: string;    // "15/12/2025 → đang chạy" (chỉ dùng khi geometry.actual != null)
  planPctText: string;
  actualPctText: string;
}

const pct = (x: number) => `${(x * 100).toFixed(3)}%`;
/** Cột nhãn 76px + gap 12px = 88px (mock-up dòng 313, 662). */
const onAxis = (x: number) => `calc(88px + (100% - 88px) * ${x.toFixed(5)})`;

export function PlanActualTimeline({ geometry: g, labels, planRange, actualRange, planPctText, actualPctText }: PlanActualTimelineProps) {
  // Viên "Hôm nay" sát mép thì neo trái/phải để không bị .card (overflow:hidden) cắt.
  const pill: CSSProperties = { left: onAxis(g.todayPos) };
  if (g.todayPos < 0.1) pill.transform = 'translateX(0)';
  else if (g.todayPos > 0.9) pill.transform = 'translateX(-100%)';
  const planChip = g.todayPos > 0.85 ? `calc(${pct(g.todayPos)} - 64px)` : `calc(${pct(g.todayPos)} + 10px)`;
  const actRight = g.actual ? g.actual.left + g.actual.width : 0;
  const actChip = actRight < 0.12 ? `calc(${pct(actRight)} + 10px)` : `calc(${pct(actRight)} - 54px)`;
  return (
    <div className="tl">
      <div className="todaypill" style={pill}>{labels.todayPill}</div>
      <div className="today" style={{ left: onAxis(g.todayPos) }} />
      <div className="tlrow">
        <div className="lb">{labels.planned}</div>
        <div className="tltrack">
          <div className="tlbar plan" style={{ left: 0, width: '100%' }}>{planRange}</div>
          <div className="tlfill" style={{ width: pct(g.todayPos) }} />
          <div className="tlchip" style={{ left: planChip }}>{planPctText}</div>
        </div>
      </div>
      <div className="tlrow">
        <div className="lb">{labels.actual}</div>
        <div className="tltrack">
          {g.actual ? (
            <>
              <div className="tlbar act" style={{ left: pct(g.actual.left), width: pct(g.actual.width) }}>{actualRange}</div>
              <div className="tlchip" style={{ left: actChip }}>{actualPctText}</div>
            </>
          ) : (
            <div className="tlbar" style={{ left: 0, width: '100%', color: 'var(--label3)' }}>{labels.notStarted}</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Bước 7: CSS.** Copy mock-up **dòng 311-332** (`/* ---------- Timeline ---------- */` tới hết `.tlfoot{…}`) vào `globals.css` theo Global Constraint 7.
- [ ] **Bước 8: i18n.** Thêm vào object `"detail"` (sau `"actualHeadcount"`):
  - vi: `"tl": { "todayPill": "Hôm nay · {date}", "running": "đang chạy", "notStarted": "Chưa khởi công", "startDelay": "Trễ khởi công", "gap": "Khoảng cách KH - TT", "days": "{n} ngày" }`
  - en: `"tl": { "todayPill": "Today · {date}", "running": "in progress", "notStarted": "Not started", "startDelay": "Start delay", "gap": "Plan - actual gap", "days": "{n} days" }`

  Thêm `'trang /projects/[id]': 'app/[locale]/(app)/projects/[id]/page.tsx'` vào `CHANGED_SOURCES`.
- [ ] **Bước 9: Nối vào page.** Import `todayIso` (thêm vào dòng import `@/lib/clock`), `calcScheduleGap` từ `@/lib/evm`, `buildPlanActualTimeline` từ `@/lib/timeline`, `Legend` từ `@/components/ui/Legend`, `PlanActualTimeline` từ `@/components/project/PlanActualTimeline`. Ngay sau `const summary = …` (dòng 61), thêm:

```ts
  const today = todayIso();
  const timeline = buildPlanActualTimeline({
    plannedStart: project.plannedStartDate, plannedFinish: project.plannedFinishDate,
    actualStart: project.actualStartDate, pctActual: summary.pctActual, today,
  });
  const startDelay = timeline?.startDelayDays ?? null;
  const gap = summary.pctPlan != null ? calcScheduleGap(summary.pctPlan, summary.pctActual) : null;
```

Thay toàn bộ khối `{/* Timeline */}` (dòng 162-175) bằng:

```tsx
      {/* Timeline KH vs TT dang thanh (mock-up dong 655-676) */}
      <Card>
        <CardHeader
          title={t('detail.timeline')}
          action={<Legend items={[
            { label: t('detail.planned'), color: 'var(--s-plan)' },
            { label: t('detail.actual'), color: 'var(--s-actual)' },
            { label: t('common.today'), color: 'var(--danger)', line: true },
          ]} />}
        />
        <CardBody>
          {timeline ? (
            <PlanActualTimeline
              geometry={timeline}
              labels={{ planned: t('detail.planned'), actual: t('detail.actual'), todayPill: t('detail.tl.todayPill', { date: formatDate(today, locale) }), notStarted: t('detail.tl.notStarted') }}
              planRange={`${formatDate(project.plannedStartDate, locale)} → ${formatDate(project.plannedFinishDate, locale)}`}
              actualRange={`${formatDate(project.actualStartDate, locale)} → ${project.actualFinishDate ? formatDate(project.actualFinishDate, locale) : t('detail.tl.running')}`}
              planPctText={formatPct(summary.pctPlan, locale)}
              actualPctText={formatPct(summary.pctActual, locale)}
            />
          ) : (
            <div className="g2">
              <TimelineItem label={t('detail.planned')} start={project.plannedStartDate} finish={project.plannedFinishDate} locale={locale} />
              <TimelineItem label={t('detail.actual')} start={project.actualStartDate} finish={project.actualFinishDate} locale={locale} />
            </div>
          )}
          <div className="tlfoot">
            <span>{t('form.contractDate')}: {formatDate(project.contractDate, locale)}</span>
            <span>{t('form.committedHandover')}: <b style={{ color: 'var(--label)' }}>{formatDate(project.committedHandoverDate, locale)}</b></span>
            <span>{t('detail.tl.startDelay')}: <b style={{ color: startDelay != null && startDelay > 0 ? 'var(--danger)' : 'var(--label)' }}>{startDelay == null ? '-' : t('detail.tl.days', { n: Math.max(startDelay, 0) })}</b></span>
            <span>{t('detail.tl.gap')}: <b style={{ color: !gap ? 'var(--label)' : gap.direction === 'behind' && gap.pct > 0 ? 'var(--danger)' : 'var(--ok)' }}>{gap ? formatPct(gap.pct, locale) : '-'}</b></span>
          </div>
        </CardBody>
      </Card>
```

Giữ hàm `TimelineItem` (dòng 393-414) làm nhánh dự phòng.

- [ ] **Bước 10: Test page** (thêm vào `projects-detail-page-render.test.ts`):

```ts
describe('Task 2 - Timeline KH/TT dang thanh', () => {
  it('du an 1: co .tl, vien Hom nay, thanh TT, dong chan 4 muc', async () => {
    const out = await render();
    for (const s of ['class="tl"', 'class="todaypill"', 'detail.tl.todayPill', 'class="tlbar act"', 'class="tlfoot"', 'detail.tl.startDelay', 'detail.tl.gap']) expect(out).toContain(s);
  });
  it('du an 17 (chua khoi cong): khong co thanh TT, hien "Chua khoi cong"', async () => {
    const out = await render({}, '17');
    expect(out).toContain('detail.tl.notStarted');
    expect(out).not.toContain('class="tlbar act"');
  });
});
```

- [ ] **Bước 11:** `npx tsc --noEmit`, `npm test`. Kiểm mắt `/vi/projects/1` (vạch hôm nay ~95%, viên "Hôm nay" không bị cắt mép phải) và `/vi/projects/17` (chữ "Chưa khởi công"), cả sáng lẫn tối.
- [ ] **Bước 12:** `git commit -m "feat(parity): timeline KH/TT dang thanh + vach hom nay o chi tiet du an"`

---

### Task 3: Đồng hồ đếm ngược `.cdpanel`

**Files:**
- Create: `src/lib/countdown.ts`, `src/lib/countdown.test.ts`, `src/components/project/CountdownPanel.tsx`
- Modify: `page.tsx` (khối `.phead`, dòng 108-130), `globals.css`, `vi.json`/`en.json`, `messages.test.ts`

**Interfaces:**
- Consumes `today` (Task 2).
- Produces `countdownTargetMs(target: IsoDate): number`, `clockOffsetMs(appToday: IsoDate, realNowMs: number): number`, `countdownParts(targetMs: number, nowMs: number): CountdownParts`.
- Produces `CountdownPanel({ targetDate: IsoDate; appToday: IsoDate; locale: string })`.

- [ ] **Bước 1: Test đỏ `src/lib/countdown.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { clockOffsetMs, countdownParts, countdownTargetMs } from './countdown';

const at = (s: string) => Date.parse(s);

describe('countdownParts', () => {
  it('con 2 ngay 3 gio 4 phut 6 giay toi 17:00 gio VN ngay dich', () => {
    expect(countdownParts(countdownTargetMs('2026-09-29'), at('2026-09-27T13:55:54+07:00')))
      .toEqual({ days: 2, hours: 3, minutes: 4, seconds: 6, done: false });
  });
  it('qua han -> tat ca 0, done=true (mock-up Math.max(0, ...))', () => {
    expect(countdownParts(countdownTargetMs('2026-09-01'), at('2026-09-16T08:00:00+07:00')))
      .toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });
  it('nhan ca ISO day du (lay 10 ky tu dau)', () => {
    expect(countdownTargetMs('2026-09-29T00:00:00.000Z')).toBe(at('2026-09-29T17:00:00+07:00'));
  });
});

describe('clockOffsetMs - dong ho app (DDC_FAKE_TODAY) vs gio that', () => {
  it('app ghim 16/09, gio that 23/09 -> lech -7 ngay', () => {
    expect(clockOffsetMs('2026-09-16', at('2026-09-23T10:00:00+07:00'))).toBe(-7 * 86_400_000);
  });
  it('cung ngay -> 0 (production)', () => {
    expect(clockOffsetMs('2026-09-22', at('2026-09-22T23:30:00+07:00'))).toBe(0);
  });
  it('tinh ngay theo gio VN, khong theo UTC: 00:30 ngay 23 gio VN (= 17:30 ngay 22 UTC) van la ngay 23', () => {
    expect(clockOffsetMs('2026-09-23', at('2026-09-23T00:30:00+07:00'))).toBe(0);
  });
});
```

- [ ] **Bước 2:** chạy → ĐỎ.
- [ ] **Bước 3: `src/lib/countdown.ts`**

```ts
import { APP_TIMEZONE, type IsoDate } from '@/lib/clock';

/** Mock-up dòng 1343: đếm tới TARGET + "T17:00:00". */
export const COUNTDOWN_HOUR = '17:00:00';
/** Asia/Ho_Chi_Minh cố định UTC+7, không có giờ mùa hè. */
const APP_UTC_OFFSET = '+07:00';
const DAY_MS = 86_400_000;
const appDate = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const startOfAppDay = (iso: string) => Date.parse(`${iso}T00:00:00${APP_UTC_OFFSET}`);

export function countdownTargetMs(target: IsoDate): number {
  return Date.parse(`${target.slice(0, 10)}T${COUNTDOWN_HOUR}${APP_UTC_OFFSET}`);
}

/**
 * Độ lệch giữa "hôm nay" của app (clock.ts, có thể bị DDC_FAKE_TODAY ghim ngoài production) và hôm
 * nay thật theo giờ VN. Production luôn 0. Cộng vào Date.now() để đồng hồ chạy từng giây nhưng vẫn
 * khớp ngày với %KH / "Hôm nay" trên cùng trang.
 */
export function clockOffsetMs(appToday: IsoDate, realNowMs: number): number {
  return startOfAppDay(appToday) - startOfAppDay(appDate.format(new Date(realNowMs)));
}

export interface CountdownParts { days: number; hours: number; minutes: number; seconds: number; done: boolean }

export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  const ms = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(ms / DAY_MS),
    hours: Math.floor((ms % DAY_MS) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
    done: ms === 0,
  };
}
```

- [ ] **Bước 4:** chạy → XANH.
- [ ] **Bước 5: `src/components/project/CountdownPanel.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IsoDate } from '@/lib/clock';
import { formatDate } from '@/lib/format';
import { clockOffsetMs, countdownParts, countdownTargetMs } from '@/lib/countdown';
import { spring } from '@/components/ui/motion';

/** Mỗi lần chữ số đổi: nảy bằng spring 'bouncy' như setDigit mock-up dòng 1338-1341. */
function Digit({ value, sec = false }: { value: string; sec?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return spring({
      preset: 'bouncy', from: 0, to: 1,
      onUpdate: (p) => {
        el.style.transform = `translateY(${(6 * (1 - p)).toFixed(2)}px)`;
        el.style.opacity = String(Math.min(1, 0.35 + p * 0.65));
      },
    });
  }, [value]);
  return <b ref={ref} className={sec ? 'sec' : undefined}>{value}</b>;
}

export function CountdownPanel({ targetDate, appToday, locale }: { targetDate: IsoDate; appToday: IsoDate; locale: string }) {
  const t = useTranslations();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const offset = clockOffsetMs(appToday, Date.now());
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [appToday]);
  const p = now == null ? null : countdownParts(countdownTargetMs(targetDate), now);
  const two = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="cdpanel">
      <div className="t"><span className="pulsedot" />{t('detail.cd.title')}</div>
      <div className="cd">
        <Digit value={p ? String(p.days) : '-'} /><span>{t('detail.cd.days')}</span>
        <Digit value={p ? two(p.hours) : '-'} /><span>{t('detail.cd.hours')}</span>
        <Digit value={p ? two(p.minutes) : '-'} /><span>{t('detail.cd.minutes')}</span>
        <Digit value={p ? two(p.seconds) : '-'} sec /><span>{t('detail.cd.seconds')}</span>
      </div>
      <div className="d">
        {t('detail.cd.target')}: <b>{formatDate(targetDate, locale)}</b> · {t('detail.cd.today')} {formatDate(appToday, locale)}
      </div>
    </div>
  );
}
```

- [ ] **Bước 6: CSS.** Copy mock-up **dòng 293-309** (`.cdpanel{…` tới `.cdpanel .d{…}`). Đổi đúng 2 tên keyframes cho khỏi đụng `@keyframes pulse` của Tailwind (utility `animate-pulse`): `shine` → `cdShine` (ở dòng 298 và 299), `pulse` → `cdPulse` (ở dòng 302 và 303). Thêm ngay sau khối vừa dán (mock-up không vẽ màn hẹp; `.phead` 1 hàng sẽ tràn khi có thêm panel):

```css
  @media(max-width:820px){.phead{flex-wrap:wrap}.phead .cdpanel{flex:1 1 100%}}
```

- [ ] **Bước 7: i18n** vào `"detail"`:
  - vi: `"cd": { "title": "Còn lại đến ngày HT kế hoạch", "days": "ngày", "hours": "giờ", "minutes": "phút", "seconds": "giây", "target": "Ngày HT KH", "today": "hôm nay" }`
  - en: `"cd": { "title": "Time left to planned finish", "days": "days", "hours": "hrs", "minutes": "min", "seconds": "sec", "target": "Planned finish", "today": "today" }`

  Thêm `'CountdownPanel': 'src/components/project/CountdownPanel.tsx'` vào `CHANGED_SOURCES`.
- [ ] **Bước 8: Nối vào page.** Khai báo dynamic ở đầu file, cạnh `SCurve`:

```ts
const CountdownPanel = dynamic(() => import('@/components/project/CountdownPanel').then((m) => m.CountdownPanel), { ssr: false, loading: () => <div className="sk" style={{ width: 240, height: 88 }} /> });
```

Trong `.phead`, ngay sau `</div>` đóng `<div className="val">` (dòng 128):

```tsx
          {/* Q1 mac dinh (a): dem toi ngay HT ke hoach. Thieu ngay -> khong ve panel */}
          {project.plannedFinishDate && (
            <CountdownPanel targetDate={project.plannedFinishDate.slice(0, 10)} appToday={today} locale={locale} />
          )}
```

- [ ] **Bước 9:** `npx tsc --noEmit`, `npm test`. Kiểm mắt: số giây chạy, chữ số nảy, vệt sáng chạy, chấm xanh nhấp nháy. Bật `prefers-reduced-motion` (DevTools → Rendering) thì hết animation. Ở 390px panel xuống hàng riêng.
- [ ] **Bước 10:** `git commit -m "feat(parity): dong ho dem nguoc toi ngay HT ke hoach o header du an"`

---

### Task 4: "Nhân lực theo nhà thầu" + "Thiết bị theo nhóm"

**Files:**
- Create: `src/lib/resources.ts`, `src/lib/resources.test.ts`, `src/components/project/ChartTip.tsx`, `src/components/project/ResourceBreakdownChart.tsx`, `src/components/project/ResourceBreakdownChart.test.ts`, `src/components/ui/Card.test.ts`
- Modify: `src/lib/thresholds.ts`, `src/components/ui/motion.ts`, `src/components/ui/Card.tsx:27-45`, `src/server/project-queries.ts`, `src/server/project-queries.test.ts`, `page.tsx`, `vi.json`/`en.json`, `messages.test.ts`

**Interfaces:**
- Produces trong `src/lib/resources.ts`: `ResourceRow = { id: number; name: string; note: string; planned: number; actual: number }`, `MobilizationTone = 'ok' | 'warn' | 'danger' | 'neutral'`, `mobilizationRatio(actual, planned): number | null`, `mobilizationTone(r)`, `mobilizationTotalTone(r)`, `TONE_VAR`, `TONE_CHIP`.
- Produces `getResourceBreakdown(projectId, yearMonth): Promise<ResourceBreakdown>`.
- Produces `CardHeader` prop mới `titleExtra?: React.ReactNode`, render trong `<h3>` sau subtitle.
- Produces trong `motion.ts`: `export type SpringPreset`, `useSpringProgress(preset?, key?): number`, `staggered(p, i, n, step?): number`.
- Produces `useChartTip(): { tip, show(ev, title, rows), hide() }` + `ChartTip({ tip })`, với `TipRow = { k: string; v: string; color?: string; valueColor?: string }`. Task 5, 6, 9 dùng lại.

- [ ] **Bước 1: `thresholds.ts`**, thêm trước `} as const;`:

```ts
  /** Tỷ lệ huy động TT/KH của 1 dòng (mock-up dòng 1600, 1828): < 85% đỏ */
  mobilizationDangerPct: 0.85,
  /** ... < 95% vàng, còn lại xanh */
  mobilizationWarnPct: 0.95,
  /** Dòng TỔNG của bảng nguồn lực và cả tuần tracking (mock-up dòng 1616, 1922): < 90% cảnh báo */
  mobilizationTotalWarnPct: 0.9,
```

- [ ] **Bước 2: Test đỏ `src/lib/resources.test.ts`:** `mobilizationRatio(96,100)=0.96`; `(5,0)` và `(0,0)` → `null`. `mobilizationTone`: `0.8499`→danger, `0.85`→warn, `0.9499`→warn, `0.95`→ok, `null`→neutral. `mobilizationTotalTone`: `0.8999`→warn, `0.9`→ok, `null`→neutral.
- [ ] **Bước 3: `src/lib/resources.ts`**

```ts
import { THRESHOLDS } from '@/lib/thresholds';

/** 1 dòng bảng nguồn lực: nhà thầu (nhân lực) hoặc nhóm thiết bị. */
export interface ResourceRow { id: number; name: string; note: string; planned: number; actual: number }
export type MobilizationTone = 'ok' | 'warn' | 'danger' | 'neutral';

/** TT/KH; KH <= 0 → null (không chia 0, UI hiện "-"). */
export function mobilizationRatio(actual: number, planned: number): number | null {
  return planned > 0 ? actual / planned : null;
}
export function mobilizationTone(ratio: number | null): MobilizationTone {
  if (ratio == null) return 'neutral';
  if (ratio < THRESHOLDS.mobilizationDangerPct) return 'danger';
  if (ratio < THRESHOLDS.mobilizationWarnPct) return 'warn';
  return 'ok';
}
export function mobilizationTotalTone(ratio: number | null): MobilizationTone {
  if (ratio == null) return 'neutral';
  return ratio < THRESHOLDS.mobilizationTotalWarnPct ? 'warn' : 'ok';
}
export const TONE_VAR: Record<MobilizationTone, string> = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', neutral: 'var(--label3)' };
export const TONE_CHIP: Record<MobilizationTone, string> = { ok: 'c-ok', warn: 'c-warn', danger: 'c-dan', neutral: 'c-plain' };
```

- [ ] **Bước 4: Test đỏ trong `src/server/project-queries.test.ts`** (thêm `getResourceBreakdown` vào import từ `./project-queries`):

```ts
describe('getResourceBreakdown - "Nhan luc theo nha thau" / "Thiet bi theo nhom"', () => {
  it('du an 1 ngay 16/09: 6 nha thau, tong 520/486, dong dau la KH lon nhat', async () => {
    const r = await getResourceBreakdown(1, MONTH);
    expect(r.manpowerAsOfDate).toBe('2026-09-16');
    expect(r.manpower).toHaveLength(6);
    expect(r.manpower[0]).toEqual({ id: 1, name: 'Nhà thầu Lắp dựng A', note: 'Lắp dựng kết cấu chính', planned: 120, actual: 112 });
    expect(r.manpower.reduce((s, x) => s + x.planned, 0)).toBe(520);
    expect(r.manpower.reduce((s, x) => s + x.actual, 0)).toBe(486);
  });
  it('thiet bi gop theo nhom, cong NGANG nha thau dung chung: TB1 = 14/12 cua NT1+NT2+NT3', async () => {
    const r = await getResourceBreakdown(1, MONTH);
    expect(r.equipmentAsOfDate).toBe('2026-09-16');
    expect(r.equipment).toHaveLength(7);
    expect(r.equipment[0]).toEqual({ id: 1, name: 'Cẩu bánh xích', note: 'Nhà thầu Lắp dựng A, Nhà thầu Lắp dựng B, Nhà thầu Cơ khí C', planned: 14, actual: 12 });
    expect(r.equipment.reduce((s, x) => s + x.planned, 0)).toBe(72);
    expect(r.equipment.reduce((s, x) => s + x.actual, 0)).toBe(63);
  });
  it('hoa KH thi xep theo ten (vi): "Giàn giáo di động" (8) truoc "Xe tải chuyên dụng" (8)', async () => {
    const r = await getResourceBreakdown(1, MONTH);
    expect(r.equipment.slice(5).map((x) => x.id)).toEqual([7, 6]);
  });
  it('du an chua co du lieu ngay -> mang rong, ngay null', async () => {
    expect(await getResourceBreakdown(17, MONTH)).toEqual({ manpowerAsOfDate: null, equipmentAsOfDate: null, manpower: [], equipment: [] });
  });
  it('nha thau/thiet bi khong con trong dim -> ten "#id", khong crash', async () => {
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([{ projectId: 1, contractorId: 99, workDate: '2026-09-16', plannedHeadcount: 3, actualHeadcount: 2 }]);
    vi.spyOn(repo, 'getDailyEquipment').mockResolvedValueOnce([{ projectId: 1, contractorId: 99, equipmentId: 98, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 }]);
    const r = await getResourceBreakdown(1, MONTH);
    expect(r.manpower[0].name).toBe('#99');
    expect(r.equipment[0]).toMatchObject({ name: '#98', note: '#99' });
  });
});
```

- [ ] **Bước 5: Viết `getResourceBreakdown`** trong `project-queries.ts`: import `type ResourceRow` từ `@/lib/resources`, đặt sau `getManpowerDaily`.

```ts
export interface ResourceBreakdown {
  manpowerAsOfDate: IsoDate | null;
  equipmentAsOfDate: IsoDate | null;
  /** Theo nhà thầu, đúng ngày manpowerAsOfDate; sort KH giảm dần rồi tên. */
  manpower: ResourceRow[];
  /** Theo nhóm thiết bị (dim_equipment), đúng ngày equipmentAsOfDate, cộng ngang nhà thầu; note = tên nhà thầu dùng. */
  equipment: ResourceRow[];
}

const byPlannedDesc = (a: ResourceRow, b: ResourceRow) => b.planned - a.planned || a.name.localeCompare(b.name, 'vi');

/** Bảng "Nhân lực theo nhà thầu" / "Thiết bị theo nhóm" (mock-up dòng 759-767) - cùng ngày chụp với getResourceSnapshot. */
export async function getResourceBreakdown(projectId: number, yearMonth: string): Promise<ResourceBreakdown> {
  const { from, to } = resourceWindow(yearMonth);
  const manpower = await repo.getDailyManpower(projectId, from, to);
  const equipment = await repo.getDailyEquipment(projectId, from, to);
  const contractors = new Map((await repo.getContractors()).map((c) => [c.id, c]));
  const equipments = new Map((await repo.getEquipments()).map((e) => [e.id, e]));
  const manpowerAsOfDate = manpower.at(-1)?.workDate ?? null;
  const equipmentAsOfDate = equipment.at(-1)?.workDate ?? null;

  const man = new Map<number, ResourceRow>();
  for (const m of manpower) {
    if (m.workDate !== manpowerAsOfDate) continue;
    const c = contractors.get(m.contractorId);
    const row = man.get(m.contractorId) ?? { id: m.contractorId, name: c?.name ?? `#${m.contractorId}`, note: c?.scopeOfWork ?? '', planned: 0, actual: 0 };
    row.planned += m.plannedHeadcount;
    row.actual += m.actualHeadcount;
    man.set(m.contractorId, row);
  }
  const eqp = new Map<number, ResourceRow & { users: number[] }>();
  for (const e of equipment) {
    if (e.workDate !== equipmentAsOfDate) continue;
    const row = eqp.get(e.equipmentId) ?? { id: e.equipmentId, name: equipments.get(e.equipmentId)?.name ?? `#${e.equipmentId}`, note: '', planned: 0, actual: 0, users: [] };
    row.planned += e.qtyPlanned;
    row.actual += e.qtyActual;
    if (!row.users.includes(e.contractorId)) row.users.push(e.contractorId);
    eqp.set(e.equipmentId, row);
  }
  const equipmentRows = [...eqp.values()].map(({ users, ...r }) => ({
    ...r, note: [...users].sort((a, b) => a - b).map((id) => contractors.get(id)?.name ?? `#${id}`).join(', '),
  }));
  return { manpowerAsOfDate, equipmentAsOfDate, manpower: [...man.values()].sort(byPlannedDesc), equipment: equipmentRows.sort(byPlannedDesc) };
}
```

Chạy `npx vitest run src/server/project-queries.test.ts src/lib/resources.test.ts` → XANH.

- [ ] **Bước 6: `CardHeader.titleExtra`.** Test đỏ trước, trong `src/components/ui/Card.test.ts` (shim React, import `{ CardHeader } from './Card'`):
  - `CardHeader({ title: 'T', subtitle: 'S', titleExtra: <span class="chip c-plain">X</span> })` → đúng chuỗi `<div class="hd"><h3>T<span class="en">S</span><span class="chip c-plain">X</span></h3></div>`.
  - `CardHeader({ title: 'T' })` → `<div class="hd"><h3>T</h3></div>`.

  Sau đó sửa `Card.tsx:27-45`: thêm `titleExtra?: React.ReactNode` vào props, render `{titleExtra}` ngay sau dòng `{subtitle && …}` trong `<h3>`. Không đổi gì khác.
- [ ] **Bước 7: `motion.ts`.** Đổi dòng 17 thành `export type SpringPreset = …`; import thêm `useState` từ `react`; thêm cuối file:

```ts
/** 0 → 1 bằng spring mỗi khi mount / `key` đổi. Reduced-motion hoặc không có rAF: nhảy thẳng 1. */
export function useSpringProgress(preset: SpringPreset = 'smooth', key: unknown = 0): number {
  const [p, setP] = useState(0);
  useEffect(() => spring({ preset, from: 0, to: 1, onUpdate: setP }), [preset, key]);
  return p;
}

/** Tiến độ so le của phần tử i/n (mock-up dùng delay i*step), kẹp [0, 1]. */
export function staggered(p: number, i: number, n: number, step = 0.04): number {
  return Math.max(0, Math.min(1, p * (1 + step * n) - step * i));
}
```

- [ ] **Bước 8: `src/components/project/ChartTip.tsx`**

```tsx
'use client';

import { useCallback, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

export interface TipRow { k: string; v: string; color?: string; valueColor?: string }
export interface TipState { x: number; y: number; title: string; rows: TipRow[] }

/**
 * Tooltip kính `.tip` của mock-up (dòng 1325-1335). PHẢI portal ra body: Card có transform (hover
 * lift, motion.ts), khiến position:fixed bên trong tính theo Card chứ không theo viewport.
 */
export function useChartTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = useCallback((ev: MouseEvent, title: string, rows: TipRow[]) => {
    const w = 200;
    const h = 34 + rows.length * 20;
    let x = ev.clientX + 16;
    let y = ev.clientY + 16;
    if (x + w > window.innerWidth - 10) x = ev.clientX - w - 14;
    if (y + h > window.innerHeight - 10) y = ev.clientY - h - 14;
    setTip({ x, y, title, rows });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, hide };
}

export function ChartTip({ tip }: { tip: TipState | null }) {
  if (!tip || typeof document === 'undefined') return null;
  return createPortal(
    <div className="tip show" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      <b>{tip.title}</b>
      {tip.rows.map((r) => (
        <div key={r.k} className="r">
          <span>{r.color && <i style={{ background: r.color }} />}{r.k}</span>
          <span style={r.valueColor ? { color: r.valueColor } : undefined}>{r.v}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
```

- [ ] **Bước 9: `src/components/project/ResourceBreakdownChart.tsx`** (`'use client'`). Port hàm `renderResource` ở mock-up dòng 1576-1617 sang JSX:
  - Props: `{ rows: ResourceRow[]; kind: 'manpower' | 'equipment' }`.
  - Hooks gọi TRƯỚC mọi nhánh return: `useTranslations()`, `useLocale()`, `const p = useSpringProgress('smooth')`, `const { tip, show, hide } = useChartTip()`.
  - Trống → `<p className="empty">{t('detail.noDailyData')}</p>`.
  - Hằng số: `W=560, ROW_H=32, HEAD=24, FOOT=32, ML=152, MR=126, IW=W-ML-MR, C_KH=W-92, C_TT=W-46, C_PC=W-4`. `H = HEAD + rows.length*ROW_H + FOOT`. `max = Math.max(1, ...rows.map(r => Math.max(r.planned, r.actual)))`.
  - Màu: KH = `var(--s-plan)`; TT = `var(--s-third)` nếu manpower, `var(--s-cost)` nếu equipment. Đơn vị tooltip: `t('detail.res.people')` hoặc `t('detail.res.units')`.
  - `nf(n, d=0)` = `Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })`. `cut(s, n)` = `s.length > n ? s.slice(0, n-1) + '…' : s`.
  - `<svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tiêu đề}>`, bên trong theo thứ tự:
    1. 4 `<text>` tiêu đề cột ở y=14, fontSize 9.5, fontWeight 800, letterSpacing 0.4, `style={{ fill:'var(--label3)' }}`: x=ML anchor start `t('detail.res.header')` · x=C_KH anchor end `t('detail.res.planShort')` · x=C_TT end `t('detail.res.actualShort')` · x=C_PC end `t('detail.res.rate')`.
    2. `<line x1=0 x2=W y1=HEAD-5 y2=HEAD-5 style={{ stroke:'var(--sep)' }}/>`.
    3. Mỗi dòng i (`top=HEAD+i*ROW_H`, `cy=top+ROW_H/2`, `k=staggered(p,i,rows.length)`, `ratio=mobilizationRatio(r.actual,r.planned)`):
       - i>0: đường kẻ `var(--grid)` tại y=top.
       - Tên `cut(r.name,24)`: x=4, y=cy-2, fontSize 10.5, fontWeight 650, fill `var(--label)`. Ghi chú `cut(r.note,28)`: x=4, y=cy+10, fontSize 9, fill `var(--label3)`.
       - Thanh KH `<rect x=ML y=cy-9 height=7 rx=3.5 width={Math.max(IW*r.planned/max*k,2)}>`. Thanh TT tương tự ở y=cy+2 với `r.actual`.
       - Số KH (x=C_KH, y=cy+4, anchor end, fontSize 11, fontWeight 700, fill `var(--label2)`). Số TT (x=C_TT, fontSize 11, fontWeight 800, fill màu TT). % đạt (x=C_PC, fontSize 10.5, fontWeight 800, fill `TONE_VAR[mobilizationTone(ratio)]`, text `ratio==null?'-':nf(ratio*100)+'%'`).
       - Rect bắt chuột `x=0 y=top width=W height=ROW_H fill="transparent"` với `onMouseMove={(ev) => show(ev, r.name, rows5)}` và `onMouseLeave={hide}`. `rows5` gồm: `{k:t('detail.res.owner'), v:r.note||'-'}`, `{k:t('detail.planned'), v:nf(planned)+' '+unit, color:'var(--s-plan)'}`, `{k:t('detail.actual'), v:…, color: màu TT}`, `{k:t('detail.res.shortfall'), v:nf(planned-actual)+' '+unit, valueColor: planned>actual?'var(--danger)':'var(--label)'}`, `{k:t('detail.res.rate'), v: ratio==null?'-':nf(ratio*100,1)+'%'}`.
    4. Dòng tổng (`ty=HEAD+rows.length*ROW_H`): đường kẻ `strokeWidth 1.4`, `var(--sep-2)`. Chữ `t(kind==='manpower'?'detail.res.totalMan':'detail.res.totalEqp', { n: rows.length })` ở x=4, y=ty+20, fontSize 10.5, fontWeight 800. Tổng KH ở C_KH, tổng TT ở C_TT (fontSize 11.5, fontWeight 800, màu TT). % tổng ở C_PC với `TONE_VAR[mobilizationTotalTone(tổngTT/tổngKH)]`, 1 chữ số thập phân.
  - Sau `</svg>` render `<ChartTip tip={tip} />` (bọc cả 2 trong fragment).
- [ ] **Bước 10: Test `ResourceBreakdownChart.test.ts`.** Mock `next-intl`: `useTranslations: () => (k, v) => v ? `${k}|${Object.values(v).join(',')}` : k`, `useLocale: () => 'vi'`. Rows `[{id:1,name:'NT A',note:'Lắp dựng',planned:100,actual:96},{id:2,name:'NT B',note:'',planned:0,actual:3}]`, kind `'manpower'`. Assert output chứa `NT A`, `96%`, `detail.res.totalMan|2`. Dòng NT B (KH=0) có `>-<`. `rows=[]` → chứa `detail.noDailyData`.
- [ ] **Bước 11: i18n** vào `"detail"`:
  - vi: `"res": { "manTitle": "Nhân lực theo nhà thầu", "eqpTitle": "Thiết bị theo nhóm", "manual": "Nhập tay", "header": "Huy động (thanh: KH / TT)", "planShort": "KH", "actualShort": "TT", "rate": "Đạt", "totalMan": "TỔNG ({n} nhà thầu)", "totalEqp": "TỔNG ({n} nhóm thiết bị)", "owner": "Phụ trách", "shortfall": "Thiếu", "people": "người", "units": "thiết bị" }`
  - en: `"res": { "manTitle": "Manpower by contractor", "eqpTitle": "Equipment by group", "manual": "Manual input", "header": "Mobilisation (bars: plan / actual)", "planShort": "Plan", "actualShort": "Act.", "rate": "Rate", "totalMan": "TOTAL ({n} contractors)", "totalEqp": "TOTAL ({n} equipment groups)", "owner": "Scope", "shortfall": "Shortfall", "people": "people", "units": "units" }`

  Thêm `'ResourceBreakdownChart': 'src/components/project/ResourceBreakdownChart.tsx'` vào `CHANGED_SOURCES`.
- [ ] **Bước 12: Nối vào page.** Thêm dynamic `ResourceBreakdownChart` (mẫu Global Constraint 8). Thêm `getResourceBreakdown` vào import từ `@/server/project-queries`. Thêm dữ liệu `const breakdown = await getResourceBreakdown(id, month);` sau dòng `manpowerDaily`. Chèn NGAY TRƯỚC `{/* Biểu đồ nhân lực KH vs TT - đặt cuối trang theo yêu cầu */}` (thẻ "nhân lực theo thời gian" phải giữ ở cuối trang, theo Q3 Run 1):

```tsx
      {/* Tang 4 - Huy dong nguon luc (mock-up dong 759-767) */}
      <div className="g2">
        <Card>
          <CardHeader
            title={t('detail.res.manTitle')}
            titleExtra={<span className="chip c-plain">{t('detail.res.manual')}</span>}
            action={<Legend items={[{ label: t('detail.planned'), color: 'var(--s-plan)' }, { label: t('detail.actual'), color: 'var(--s-third)' }]} />}
          />
          <CardBody><ResourceBreakdownChart rows={breakdown.manpower} kind="manpower" /></CardBody>
        </Card>
        <Card>
          <CardHeader
            title={t('detail.res.eqpTitle')}
            titleExtra={<span className="chip c-plain">{t('detail.res.manual')}</span>}
            action={<Legend items={[{ label: t('detail.planned'), color: 'var(--s-plan)' }, { label: t('detail.actual'), color: 'var(--s-cost)' }]} />}
          />
          <CardBody><ResourceBreakdownChart rows={breakdown.equipment} kind="equipment" /></CardBody>
        </Card>
      </div>
```

- [ ] **Bước 13:** `npx tsc --noEmit`, `npm test`. Kiểm mắt: thanh mọc ra lần lượt, rê chuột ra tooltip đúng vị trí khi card đang nâng (hover lift), dòng TỔNG 520/486 và 72/63, cả sáng lẫn tối.
- [ ] **Bước 14:** `git commit -m "feat(parity): bang nhan luc theo nha thau + thiet bi theo nhom"`

---

### Task 5: Tracking huy động theo tuần — 3 tab

**Files:**
- Create: `src/lib/tracking.ts`, `src/lib/tracking.test.ts`, `src/components/ui/HelpTip.tsx`, `src/components/ui/HelpTip.test.ts`, `src/components/project/WeeklyTrackingCard.tsx`, `src/components/project/WeeklyTrackingCard.test.ts`
- Modify: `src/lib/thresholds.ts`, `src/lib/resources.ts` (+test), `src/lib/format.ts` (+`src/lib/format.test.ts`), `project-queries.ts` (+test), `page.tsx`, `globals.css`, `vi.json`/`en.json`, `messages.test.ts`

**Interfaces:**
- Consumes từ Task 4: `mobilizationRatio`, `mobilizationTone`, `mobilizationTotalTone`, `TONE_VAR`, `TONE_CHIP`, `useChartTip`, `ChartTip`, `CardHeader.titleExtra`.
- Produces `WeeklyTracking` (định nghĩa ở `src/lib/tracking.ts`), `getWeeklyTracking(projectId, yearMonth): Promise<WeeklyTracking | null>`, `buildLogView`, `buildMatrixView`, `buildEquipmentView`, `buildTrackingSummary`, `equipmentColor(index)`, `daysUsedTone(n)`.
- Produces `formatDateShort(iso): string` ('DD/MM/YY') và `formatDayMonth(iso): string` ('DD/MM'). Task 6, 9 dùng.
- Produces `HelpTip({ text, label, alignRight? })`. Task 6 dùng.

- [ ] **Bước 1: `thresholds.ts`** thêm:

```ts
  /** "Ngày sử dụng" 1 thiết bị trong 7 ngày tracking (mock-up dòng 1893): >= 5 xanh */
  equipmentDaysUsedOk: 5,
  /** ... >= 3 vàng, còn lại trung tính */
  equipmentDaysUsedWarn: 3,
```

Trong `resources.ts` thêm:

```ts
export function daysUsedTone(n: number): MobilizationTone {
  if (n >= THRESHOLDS.equipmentDaysUsedOk) return 'ok';
  return n >= THRESHOLDS.equipmentDaysUsedWarn ? 'warn' : 'neutral';
}
```

Thêm test: `daysUsedTone(5)`=ok, `(4)`=warn, `(3)`=warn, `(2)`=neutral.
- [ ] **Bước 2: `format.ts`** thêm, kèm test trong `src/lib/format.test.ts`:
  - `formatDateShort('2026-09-16')` = `'16/09/26'`; nhận ISO đầy đủ; `null` hoặc `'abc'` → `'-'`.
  - `formatDayMonth('2026-09-16')` = `'16/09'`.

```ts
const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}/;
/** 'YYYY-MM-DD' (hoặc ISO đầy đủ) → 'DD/MM/YY' - nhãn ngắn biểu đồ/bảng (mock-up fmtD dòng 1319). */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso || !ISO_PREFIX.test(iso)) return '-';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}
/** 'YYYY-MM-DD' → 'DD/MM' (mock-up dLabel dòng 1825). */
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso || !ISO_PREFIX.test(iso)) return '-';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
```

- [ ] **Bước 3: Test đỏ `src/lib/tracking.test.ts`.** Fixture:

```ts
const W: WeeklyTracking = {
  days: ['2026-09-14', '2026-09-15', '2026-09-16'],
  today: '2026-09-16',
  contractors: [{ id: 1, name: 'A', scopeOfWork: 'Lắp dựng' }, { id: 2, name: 'B', scopeOfWork: 'Sơn' }, { id: 3, name: 'C', scopeOfWork: '' }],
  equipments: [{ id: 10, name: 'Cẩu' }, { id: 11, name: 'Hàn' }],
  manpower: [
    { projectId: 1, contractorId: 1, workDate: '2026-09-15', plannedHeadcount: 100, actualHeadcount: 80 },
    { projectId: 1, contractorId: 1, workDate: '2026-09-16', plannedHeadcount: 100, actualHeadcount: 96 },
    { projectId: 1, contractorId: 2, workDate: '2026-09-16', plannedHeadcount: 0, actualHeadcount: 5 },
  ],
  equipmentUsage: [
    { projectId: 1, contractorId: 1, equipmentId: 10, workDate: '2026-09-16', qtyPlanned: 2, qtyActual: 2 },
    { projectId: 1, contractorId: 2, equipmentId: 10, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 },
    { projectId: 1, contractorId: 1, equipmentId: 11, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 0 }, // co KH nhung KHONG dung
    { projectId: 1, contractorId: 1, equipmentId: 11, workDate: '2026-09-15', qtyPlanned: 1, qtyActual: 1 },
  ],
};
```

Assert:
  - **buildLogView:** thứ tự ngày giảm dần `['2026-09-16','2026-09-15','2026-09-14']`.
    - Ngày 16: `isToday` true, planned 100, actual 101, ratio ≈ 1.01, `equipmentTypeCount` 1, rows =
      `[{contractorId:1,name:'A',scope:'Lắp dựng',planned:100,actual:96,diff:-4,ratio:0.96,equipmentIds:[10]}, {contractorId:2,name:'B',scope:'Sơn',planned:0,actual:5,diff:5,ratio:null,equipmentIds:[10]}]`.
    - Ngày 15: rows A với `equipmentIds:[11]`.
    - Ngày 14: rows `[]`, planned 0, ratio null, `equipmentTypeCount` 0.
  - **buildMatrixView:** 3 hàng. A.cells = `[null,{planned:100,actual:80,ratio:0.8},{planned:100,actual:96,ratio:0.96}]`, A.weekRatio ≈ 0.88. B.weekRatio null. C: mọi ô null. `totals[0]={planned:0,actual:0,ratio:null}`, `totals[2].actual=101`, weekRatio ≈ 0.905.
  - **buildEquipmentView:**
    - Hàng 10: `color:'var(--s-actual)'`, cells[2] = `[{contractorId:1,name:'A',actualHeadcount:96},{contractorId:2,name:'B',actualHeadcount:5}]`, daysUsed 1.
    - Hàng 11: `color:'var(--s-plan)'`, cells[1] = `[{contractorId:1,name:'A',actualHeadcount:80}]`, cells[2] = `[]`, daysUsed 1.
  - **buildTrackingSummary:** `{from:'2026-09-14', to:'2026-09-16', contractorCount:2, equipmentCount:2, lastDayIsToday:true, lastPlanned:100, lastActual:101}`, weekRatio ≈ 0.905.
- [ ] **Bước 4: `src/lib/tracking.ts`**

```ts
import type { IsoDate } from '@/lib/clock';
import { mobilizationRatio } from '@/lib/resources';
import type { FactDailyEquipmentUsage, FactDailyManpower } from '@/server/repo/types';

export const TRACKING_DAYS = 7;

/** Dữ liệu thô của thẻ Tracking (mock-up dòng 768-787, 1794-1927). */
export interface WeeklyTracking {
  days: IsoDate[];                                   // liên tiếp, tăng dần
  today: IsoDate;                                    // todayIso()
  contractors: { id: number; name: string; scopeOfWork: string }[];
  equipments: { id: number; name: string }[];        // thiết bị xuất hiện trong tuần, id tăng dần
  manpower: FactDailyManpower[];                     // chỉ dòng nằm trong `days`
  equipmentUsage: FactDailyEquipmentUsage[];         // chỉ dòng nằm trong `days`
}

/** Màu chip thiết bị theo thứ tự (mock-up EQ_COLOR dòng 1802). */
export const EQUIPMENT_COLORS = ['var(--s-actual)', 'var(--s-plan)', 'var(--s-third)', 'var(--s-cost)', 'var(--s-third-lt)', 'var(--s-neutral)', 'var(--accent-2)'];
export const equipmentColor = (index: number) => EQUIPMENT_COLORS[((index % EQUIPMENT_COLORS.length) + EQUIPMENT_COLORS.length) % EQUIPMENT_COLORS.length];

const findMan = (w: WeeklyTracking, date: IsoDate, contractorId: number) =>
  w.manpower.find((m) => m.workDate === date && m.contractorId === contractorId);
/** "Đã dùng" = qtyActual > 0 (có KH mà TT = 0 thì KHÔNG tính). */
const used = (w: WeeklyTracking, date: IsoDate, contractorId: number, equipmentId: number) =>
  w.equipmentUsage.some((u) => u.workDate === date && u.contractorId === contractorId && u.equipmentId === equipmentId && u.qtyActual > 0);
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

export interface LogRow { contractorId: number; name: string; scope: string; planned: number; actual: number; diff: number; ratio: number | null; equipmentIds: number[] }
export interface LogDay { date: IsoDate; isToday: boolean; planned: number; actual: number; ratio: number | null; equipmentTypeCount: number; rows: LogRow[] }

/** Tab "Nhật ký theo ngày": ngày mới nhất trên cùng (mock-up dòng 1837); chỉ nhà thầu có dòng nhân lực ngày đó. */
export function buildLogView(w: WeeklyTracking): LogDay[] {
  return [...w.days].reverse().map((date) => {
    const rows: LogRow[] = w.contractors.flatMap((c) => {
      const m = findMan(w, date, c.id);
      if (!m) return [];
      return [{
        contractorId: c.id, name: c.name, scope: c.scopeOfWork,
        planned: m.plannedHeadcount, actual: m.actualHeadcount, diff: m.actualHeadcount - m.plannedHeadcount,
        ratio: mobilizationRatio(m.actualHeadcount, m.plannedHeadcount),
        equipmentIds: w.equipments.filter((e) => used(w, date, c.id, e.id)).map((e) => e.id),
      }];
    });
    const planned = sum(rows, (r) => r.planned);
    const actual = sum(rows, (r) => r.actual);
    const types = new Set(w.equipmentUsage.filter((u) => u.workDate === date && u.qtyActual > 0).map((u) => u.equipmentId));
    return { date, isToday: date === w.today, planned, actual, ratio: mobilizationRatio(actual, planned), equipmentTypeCount: types.size, rows };
  });
}

export interface MatrixCell { planned: number; actual: number; ratio: number | null }
export interface MatrixRow { contractorId: number; name: string; scope: string; cells: (MatrixCell | null)[]; weekRatio: number | null }
export interface MatrixView { rows: MatrixRow[]; totals: MatrixCell[]; weekRatio: number | null }

/** Tab "Ma trận nhân lực" (mock-up dòng 1857-1879). Ô null = nhà thầu không có dòng ngày đó. */
export function buildMatrixView(w: WeeklyTracking): MatrixView {
  const rows = w.contractors.map((c) => {
    const cells = w.days.map((date): MatrixCell | null => {
      const m = findMan(w, date, c.id);
      return m ? { planned: m.plannedHeadcount, actual: m.actualHeadcount, ratio: mobilizationRatio(m.actualHeadcount, m.plannedHeadcount) } : null;
    });
    const filled = cells.filter((x): x is MatrixCell => x != null);
    return { contractorId: c.id, name: c.name, scope: c.scopeOfWork, cells, weekRatio: mobilizationRatio(sum(filled, (x) => x.actual), sum(filled, (x) => x.planned)) };
  });
  const totals = w.days.map((date) => {
    const ms = w.manpower.filter((m) => m.workDate === date);
    const planned = sum(ms, (m) => m.plannedHeadcount);
    const actual = sum(ms, (m) => m.actualHeadcount);
    return { planned, actual, ratio: mobilizationRatio(actual, planned) };
  });
  return { rows, totals, weekRatio: mobilizationRatio(sum(totals, (x) => x.actual), sum(totals, (x) => x.planned)) };
}

export interface EquipmentUser { contractorId: number; name: string; actualHeadcount: number | null }
export interface EquipmentRow { equipmentId: number; name: string; color: string; cells: EquipmentUser[][]; daysUsed: number }

/** Tab "Theo thiết bị" (mock-up dòng 1880-1896): mỗi ô = các nhà thầu đã dùng thiết bị hôm đó. */
export function buildEquipmentView(w: WeeklyTracking): EquipmentRow[] {
  return w.equipments.map((e, idx) => {
    const cells = w.days.map((date) => w.contractors
      .filter((c) => used(w, date, c.id, e.id))
      .map((c) => ({ contractorId: c.id, name: c.name, actualHeadcount: findMan(w, date, c.id)?.actualHeadcount ?? null })));
    return { equipmentId: e.id, name: e.name, color: equipmentColor(idx), cells, daysUsed: cells.filter((u) => u.length > 0).length };
  });
}

export interface TrackingSummary { from: IsoDate; to: IsoDate; contractorCount: number; equipmentCount: number; lastDayIsToday: boolean; lastPlanned: number; lastActual: number; weekRatio: number | null }

/** Thanh tổng kết `#trackSum` (mock-up dòng 1916-1926). */
export function buildTrackingSummary(w: WeeklyTracking): TrackingSummary {
  const to = w.days[w.days.length - 1];
  const last = w.manpower.filter((m) => m.workDate === to);
  return {
    from: w.days[0], to,
    contractorCount: new Set(w.manpower.map((m) => m.contractorId)).size,
    equipmentCount: new Set(w.equipmentUsage.filter((u) => u.qtyActual > 0).map((u) => u.equipmentId)).size,
    lastDayIsToday: to === w.today,
    lastPlanned: sum(last, (m) => m.plannedHeadcount),
    lastActual: sum(last, (m) => m.actualHeadcount),
    weekRatio: mobilizationRatio(sum(w.manpower, (m) => m.actualHeadcount), sum(w.manpower, (m) => m.plannedHeadcount)),
  };
}
```

Chạy test → XANH.
- [ ] **Bước 5: Test đỏ `getWeeklyTracking`** trong `project-queries.test.ts`:
  - `(1, MONTH)`: `days` = 7 ngày `'2026-09-10'…'2026-09-16'`, `today` = `'2026-09-16'`, `contractors.map(c=>c.id)` = `[1,2,3,4,5,6]`, `equipments.map(e=>e.id)` = `[1..7]`, `manpower.length` = 42, `equipmentUsage.length` = 70.
  - `(17, MONTH)` → `null`.
  - Spy `getDailyManpower` trả 1 dòng ngày `'2026-09-12'`, spy `getDailyEquipment` trả 1 dòng ngày `'2026-09-14'` → `days.at(-1)` = `'2026-09-14'`.
  - Spy trả 1 dòng manpower của `contractorId: 99` → `contractors` chứa `{ id: 99, name: '#99', scopeOfWork: '' }` và nằm SAU 6 nhà thầu của dự án.
- [ ] **Bước 6: Viết `getWeeklyTracking`** trong `project-queries.ts`: import `TRACKING_DAYS, type WeeklyTracking` từ `@/lib/tracking`; `addDaysIso` và `todayIso` đã có trong import `@/lib/clock` ở dòng 1.

```ts
/**
 * 7 ngày tracking liên tiếp, kết thúc ở ngày cuối CÓ số liệu (nhân lực hoặc thiết bị) trong
 * resourceWindow(month) - Q4 mặc định (a). Không có số liệu → null.
 * Nhà thầu = danh sách project_contractor + nhà thầu có số liệu nhưng không còn trong danh sách.
 */
export async function getWeeklyTracking(projectId: number, yearMonth: string): Promise<WeeklyTracking | null> {
  const { from, to } = resourceWindow(yearMonth);
  const manpowerAll = await repo.getDailyManpower(projectId, from, to);
  const equipmentAll = await repo.getDailyEquipment(projectId, from, to);
  const lastDay = [manpowerAll.at(-1)?.workDate, equipmentAll.at(-1)?.workDate].filter((d): d is IsoDate => d != null).sort().at(-1);
  if (!lastDay) return null;
  const days = Array.from({ length: TRACKING_DAYS }, (_, i) => addDaysIso(lastDay, i - (TRACKING_DAYS - 1)));
  const inWeek = (d: IsoDate) => d >= days[0] && d <= lastDay;
  const manpower = manpowerAll.filter((m) => inWeek(m.workDate));
  const equipmentUsage = equipmentAll.filter((e) => inWeek(e.workDate));

  const all = new Map((await repo.getContractors()).map((c) => [c.id, c]));
  const contractors = (await repo.getContractors(projectId)).map((c) => ({ id: c.id, name: c.name, scopeOfWork: c.scopeOfWork }));
  const extra = [...new Set([...manpower.map((m) => m.contractorId), ...equipmentUsage.map((e) => e.contractorId)])]
    .filter((id) => !contractors.some((c) => c.id === id)).sort((a, b) => a - b);
  for (const id of extra) contractors.push({ id, name: all.get(id)?.name ?? `#${id}`, scopeOfWork: all.get(id)?.scopeOfWork ?? '' });

  const eqNames = new Map((await repo.getEquipments()).map((e) => [e.id, e.name]));
  const equipments = [...new Set(equipmentUsage.map((e) => e.equipmentId))].sort((a, b) => a - b)
    .map((id) => ({ id, name: eqNames.get(id) ?? `#${id}` }));
  return { days, today: todayIso(), contractors, equipments, manpower, equipmentUsage };
}
```

- [ ] **Bước 7: `src/components/ui/HelpTip.tsx`** (server-safe). Kèm test: `HelpTip({ text: 'Nội dung', label: 'Giải thích', alignRight: true })` phải ra đúng chuỗi `<button type="button" class="help rt" aria-label="Giải thích">?<span class="bub">Nội dung</span></button>`.

```tsx
/** Nút "?" + bong bóng `.help .bub` (mock-up dòng 437-458). Card chứa nó phải có className="overflow-visible". */
export function HelpTip({ text, label, alignRight = false }: { text: string; label: string; alignRight?: boolean }) {
  return (
    <button type="button" className={alignRight ? 'help rt' : 'help'} aria-label={label}>
      ?<span className="bub">{text}</span>
    </button>
  );
}
```

- [ ] **Bước 8: `src/components/project/WeeklyTrackingCard.tsx`** (`'use client'`). Component tự render cả `<Card className="overflow-visible">`, vì nút chọn tab nằm trên header:
  - Props `{ data: WeeklyTracking; locale: string }`. State `view: 'log' | 'mx' | 'eq'`, mặc định `'log'`. Có `useChartTip()`.
  - Helpers: `dName(d) = t(`detail.track.weekday.d${new Date(`${d}T00:00:00Z`).getUTCDay()}`)`; `pct0(r)` = `r == null ? '-' : `${Math.round(r*100)}%``; `pct1(r)` = 1 chữ số thập phân theo `vi-VN`/`en-US`; `eqInfo = new Map(data.equipments.map((e, i) => [e.id, { name: e.name, color: equipmentColor(i) }]))`.
  - `<CardHeader>`:
    - `title={t('detail.track.title')}`
    - `titleExtra={<HelpTip text={t('detail.track.help')} label={t('common.explain')} alignRight />}`
    - `action`: `<div className="seg">` chứa 3 `<button type="button">`, nút đang chọn có `className="on"`. Nhãn: `detail.track.tabLog` / `tabMatrix` / `tabEquipment`.
  - `<CardBody>`, bên trong theo thứ tự:
    1. `sumbar`, class thêm ` good` khi `mobilizationTotalTone(sum.weekRatio)==='ok'`, ` bad` khi `'warn'`, không thêm gì khi `'neutral'`. Hai `<span>` dùng `t.rich('detail.track.sumLeft', { from: formatDayMonth(sum.from), to: formatDayMonth(sum.to), contractors, equipments, b: (c) => <b>{c}</b> })` và `t.rich('detail.track.sumRight', { day: sum.lastDayIsToday ? t('common.today') : t('detail.track.dayOn', { date: formatDayMonth(sum.to) }), actual, planned, pct: pct1(weekRatio), b })`.
    2. `<div className="trackwrap scroll" style={{ marginTop: 12 }}><table className="tbl">…</table></div>`.
  - **Tab `log`** (port dòng 1833-1856):
    - `thead` 7 cột: `colDate`, `colContractor`, `colScope`, `colPlanned` (num), `colActual` (num), `colDiff` (num), `colEquipment` với `style={{ minWidth: 240, whiteSpace: 'normal' }}`.
    - Mỗi `LogDay` là 1 `<Fragment key={date}>` gồm:
      - `<tr className="dayhead">`: ô `colSpan={3}` = `{dName} · {formatDateShort(date)}`, thêm `{' '}<span className="chip c-info">{t('common.today')}</span>` nếu `isToday`; ô num planned; ô num actual; ô num `<span className={`chip ${TONE_CHIP[mobilizationTone(ratio)]}`}>{pct0(ratio)}</span>`; ô `t('detail.track.eqTypes', { n })`.
      - `rows.length === 0` → 1 hàng `colSpan={7}`, `color: var(--label3)`, nội dung `t('detail.track.noDataDay')`.
      - Ngược lại mỗi `LogRow` 1 hàng: `formatDayMonth(date)` · tên (fontWeight 600) · `scope || '-'` (màu `--label2`) · planned · actual (fontWeight 750) · chip màu `mobilizationTone(ratio)` với chữ `${diff >= 0 ? '+' : ''}${diff}` · `<div className="eqchips">`. Nếu có thiết bị: mỗi thiết bị 1 `<span className="eqchip"><i style={{ background: color }} />{name}</span>`. Nếu không có: `<span style={{ color: 'var(--label3)', fontSize: 'var(--t-caption2)' }}>{t('detail.track.noEquipment')}</span>`.
  - **Tab `mx`** (port dòng 1857-1879):
    - `thead`: `colContractor`, sau đó mỗi ngày 1 `<th>{dName}<br />{formatDayMonth}{ngày cuối && === today ? ' ●' : ''}</th>`, cuối là `colWeekAvg` (num).
    - `<tbody className="mx">`. Mỗi hàng: ô đầu `textAlign:left` gồm tên + `<div>` scope (caption2, `--label3`). Ô ngày: có dữ liệu → `<div className="cell"><b style={{ color: TONE_VAR[mobilizationTone(c.ratio)] }}>{c.actual}</b><span>{t('detail.track.planShort', { n: c.planned })}</span></div>`; null → `<span style={{ color: 'var(--label4)' }}>-</span>`. Ô cuối: chip `pct0(weekRatio)`.
    - Hàng cuối `t('detail.track.siteTotal')` (fontWeight 800) với `totals` (b không tô màu), ô cuối chip màu `mobilizationTone(m.weekRatio)`, chữ `pct1`.
  - **Tab `eq`** (port dòng 1880-1913):
    - `thead`: `colEquipmentName`, 7 cột ngày, `colDaysUsed` (num). `<tbody className="mx">`.
    - Ô đầu: `<span className="eqchip"><i style={{ background: color }} />{name}</span>`.
    - Ô ngày có user: `style={{ cursor: 'pointer' }}`, `onMouseMove={(ev) => show(ev, `${name} · ${formatDateShort(day)}`, users.map((u) => ({ k: u.name, v: u.actualHeadcount == null ? '-' : t('detail.track.peopleN', { n: u.actualHeadcount }) })))}`, `onMouseLeave={hide}`, nội dung `<div className="cell"><b style={{ color: 'var(--accent)' }}>{users.length}</b><span>{t('detail.track.contractorsUnit')}</span></div>`. Ô trống → `-` màu `--label4`.
    - Ô cuối: chip `TONE_CHIP[daysUsedTone(daysUsed)]`, chữ `${daysUsed}/${data.days.length}`.
    - Không có thiết bị nào → 1 hàng `colSpan={data.days.length + 2}` với `t('detail.track.noDataDay')`.
  - Cuối component render `<ChartTip tip={tip} />`.
- [ ] **Bước 9: Test `WeeklyTrackingCard.test.ts`.** Mock `next-intl`: `useTranslations` trả hàm `t = Object.assign((k, v) => v ? `${k}|${Object.values(v).join(',')}` : k, { rich: (k: string) => k })`, `useLocale: () => 'vi'`. Dùng lại fixture `W` của Bước 3 (khai báo lại trong file). Assert:
  - Có đúng 3 lần `class="dayhead"`.
  - Có `class="chip c-info">common.today`.
  - Có `detail.track.noDataDay`.
  - Có `<button type="button" class="on">detail.track.tabLog</button>`.
- [ ] **Bước 10: CSS.** Copy mock-up **dòng 496-510** (từ `/* ---------- Tracking tuần ---------- */` tới `.cell span{…}`).
- [ ] **Bước 11: i18n.** `"common"` thêm `"explain": "Giải thích"` / `"Explain"`. Vào `"detail"`:
  - vi: `"track": { "title": "Tracking huy động theo tuần - 7 ngày gần nhất", "help": "Ghi nhận theo ngày: mỗi ngày từng nhà thầu chốt số nhân lực kế hoạch và báo lại số thực tế có mặt, kèm danh sách thiết bị đã dùng hôm đó. Quan hệ nhiều-nhiều: một nhà thầu có thể dùng nhiều thiết bị, và một thiết bị có thể được nhiều nhà thầu dùng chung trong cùng ngày.", "tabLog": "Nhật ký theo ngày", "tabMatrix": "Ma trận nhân lực", "tabEquipment": "Theo thiết bị", "colDate": "Ngày", "colContractor": "Nhà thầu", "colScope": "Hạng mục phụ trách", "colPlanned": "NL kế hoạch", "colActual": "NL thực tế", "colDiff": "Chênh", "colEquipment": "Thiết bị đã dùng", "colWeekAvg": "TB tuần", "colEquipmentName": "Thiết bị", "colDaysUsed": "Ngày sử dụng", "noEquipment": "- không dùng thiết bị -", "eqTypes": "{n} loại thiết bị", "noDataDay": "Chưa có số liệu ngày này", "siteTotal": "TỔNG CÔNG TRƯỜNG", "planShort": "KH {n}", "contractorsUnit": "nhà thầu", "peopleN": "{n} người", "dayOn": "Ngày {date}", "weekday": { "d0": "CN", "d1": "T2", "d2": "T3", "d3": "T4", "d4": "T5", "d5": "T6", "d6": "T7" }, "sumLeft": "Tuần {from} - {to} · <b>{contractors}</b> nhà thầu · <b>{equipments}</b> nhóm thiết bị được huy động", "sumRight": "{day} <b>{actual}/{planned}</b> người · cả tuần đạt <b>{pct}</b> so với kế hoạch" }`
  - en: `"track": { "title": "Weekly mobilisation tracking - last 7 days", "help": "Recorded daily: each contractor sets planned headcount and reports actual attendance, plus the equipment used that day. Many-to-many: one contractor can use several pieces of equipment, and one piece of equipment can be shared by several contractors on the same day.", "tabLog": "Daily log", "tabMatrix": "Manpower matrix", "tabEquipment": "By equipment", "colDate": "Date", "colContractor": "Contractor", "colScope": "Scope", "colPlanned": "Planned", "colActual": "Actual", "colDiff": "Diff.", "colEquipment": "Equipment used", "colWeekAvg": "Week", "colEquipmentName": "Equipment", "colDaysUsed": "Days used", "noEquipment": "- no equipment -", "eqTypes": "{n} equipment types", "noDataDay": "No data for this day", "siteTotal": "SITE TOTAL", "planShort": "Plan {n}", "contractorsUnit": "contractors", "peopleN": "{n} people", "dayOn": "On {date}", "weekday": { "d0": "Sun", "d1": "Mon", "d2": "Tue", "d3": "Wed", "d4": "Thu", "d5": "Fri", "d6": "Sat" }, "sumLeft": "Week {from} - {to} · <b>{contractors}</b> contractors · <b>{equipments}</b> equipment groups mobilised", "sumRight": "{day} <b>{actual}/{planned}</b> people · week at <b>{pct}</b> of plan" }`

  Thêm `'WeeklyTrackingCard': 'src/components/project/WeeklyTrackingCard.tsx'` vào `CHANGED_SOURCES`.
- [ ] **Bước 12: Nối vào page.** Thêm dynamic `WeeklyTrackingCard`, import `getWeeklyTracking`, dữ liệu `const tracking = await getWeeklyTracking(id, month);`. Chèn ngay SAU `g2` nguồn lực của Task 4, TRƯỚC thẻ "nhân lực theo thời gian":

```tsx
      {tracking ? (
        <WeeklyTrackingCard data={tracking} locale={locale} />
      ) : (
        <Card>
          <CardHeader title={t('detail.track.title')} />
          <CardBody><p className="empty">{t('detail.noDailyData')}</p></CardBody>
        </Card>
      )}
```

- [ ] **Bước 13:** `npx tsc --noEmit`, `npm test`. Kiểm mắt 3 tab ở `/vi/projects/1`: tiêu đề cột dính khi cuộn trong khung 460px, tooltip ô thiết bị, bong bóng "?" không bị cắt. `/vi/projects/17` hiện thẻ rỗng.
- [ ] **Bước 14:** `git commit -m "feat(parity): tracking huy dong 7 ngay gan nhat 3 tab"`

---

### Task 6: Biểu đồ "Các mốc chính của dự án" (`kmChart`)

**Files:**
- Create: `src/lib/time-axis.ts`, `src/lib/time-axis.test.ts`, `src/lib/key-milestones.ts`, `src/lib/key-milestones.test.ts`, `src/components/project/keyMsText.ts`, `src/components/project/KeyMilestoneChart.tsx`, `src/components/project/KeyMilestoneChart.test.ts`
- Modify: `page.tsx`, `vi.json`/`en.json`, `messages.test.ts`, `projects-detail-page-render.test.ts`

**Interfaces:**
- Consumes `today` (Task 2), `Legend` (Task 2), `useChartTip`/`ChartTip`/`useSpringProgress` (Task 4), `HelpTip` + `formatDateShort` (Task 5).
- Produces `monthTicks(from: IsoDate, to: IsoDate): MonthTick[]`, với `MonthTick = { date: IsoDate; label: string | null }`. Task 9 dùng.
- Produces `keyMilestoneState(planned, actual | null, today): KeyMsState`, `KEY_MS_TONE_VAR`, `layoutMilestoneLabels`, `estimateLabelWidth`, `keyMsDomain`.
- Produces `keyMsStateText(t, state): string`. Task 8 dùng.

- [ ] **Bước 1: Test đỏ `time-axis.test.ts`:**
  - `monthTicks('2026-02-15','2026-06-30')` → `[{date:'2026-03-01',label:'03/26'},{date:'2026-04-01',label:null},{date:'2026-05-01',label:'05/26'},{date:'2026-06-01',label:null}]`.
  - `monthTicks('2026-03-01','2026-03-31')` → `[{date:'2026-03-01',label:'03/26'}]`.
  - `monthTicks('2025-12-01','2026-01-31')` → nhãn `[null,'01/26']`.
- [ ] **Bước 2: `src/lib/time-axis.ts`**

```ts
import { addMonths, type IsoDate } from '@/lib/clock';

export interface MonthTick { date: IsoDate; label: string | null }

/** Ngày 1 của mọi tháng trong [from, to]; nhãn 'MM/YY' chỉ ở tháng lẻ (mock-up dòng 1427, 2129). */
export function monthTicks(from: IsoDate, to: IsoDate): MonthTick[] {
  const out: MonthTick[] = [];
  let ym = from.slice(0, 7);
  if (`${ym}-01` < from) ym = addMonths(ym, 1);
  while (`${ym}-01` <= to) {
    out.push({ date: `${ym}-01`, label: Number(ym.slice(5, 7)) % 2 === 1 ? `${ym.slice(5, 7)}/${ym.slice(2, 4)}` : null });
    ym = addMonths(ym, 1);
  }
  return out;
}
```

- [ ] **Bước 3: Test đỏ `key-milestones.test.ts`:**
  - `keyMilestoneState('2026-01-15','2026-01-18','2026-09-16')` = `{kind:'done',days:3,tone:'warn'}`
  - `('2026-03-01','2026-02-27',…)` = `{done,-2,ok}`; `('2026-03-01','2026-03-01',…)` = `{done,0,ok}`
  - `('2026-09-15',null,'2026-09-16')` = `{late,1,danger}`
  - `('2026-09-29',null,'2026-09-16')` = `{next,13,accent}`; `('2026-09-16',null,'2026-09-16')` = `{next,0,accent}`
  - `layoutMilestoneLabels([{x:100,width:100},{x:150,width:100},{x:200,width:100},{x:250,width:100}])` = `[{side:-1,tier:0},{side:1,tier:0},{side:-1,tier:1},{side:1,tier:1}]`
  - `layoutMilestoneLabels` với 5 hộp cùng `{x:100,width:100}` = `[{-1,0},{1,0},{-1,1},{1,1},{1,1}]` (hộp thứ 5 đổi phía)
  - `estimateLabelWidth('abcd','ab')` ≈ 47.6
  - `keyMsDomain(['2026-09-16'],'2026-09-16')` = `{lo: T-14 ngày, hi: T+14 ngày}` với `T=Date.parse('2026-09-16T00:00:00Z')`
  - `keyMsDomain(['2026-01-01','2026-12-31'],'2026-06-01')`: `hi-lo` = `364 ngày × 1.12` (sai số `toBeCloseTo`)
- [ ] **Bước 4: `src/lib/key-milestones.ts`** (Task 7 và Task 8 sẽ thêm vào file này)

```ts
import { daysBetween, type IsoDate } from '@/lib/clock';

export type KeyMsTone = 'ok' | 'warn' | 'danger' | 'accent';
export interface KeyMsState { kind: 'done' | 'late' | 'next'; days: number; tone: KeyMsTone }
export const KEY_MS_TONE_VAR: Record<KeyMsTone, string> = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', accent: 'var(--accent)' };

/** Port msState() mock-up dòng 2072-2080. done.days: dương = trễ, âm = sớm. */
export function keyMilestoneState(plannedDate: IsoDate, actualDate: IsoDate | null, today: IsoDate): KeyMsState {
  if (actualDate) {
    const slip = daysBetween(plannedDate, actualDate);
    return { kind: 'done', days: slip, tone: slip > 0 ? 'warn' : 'ok' };
  }
  const left = daysBetween(today, plannedDate);
  return left < 0 ? { kind: 'late', days: -left, tone: 'danger' } : { kind: 'next', days: left, tone: 'accent' };
}

export interface LabelBox { x: number; width: number }
export interface LabelSlot { side: -1 | 1; tier: 0 | 1 }

/** Xếp nhãn xen kẽ trên/dưới trục; chạm nhau thì đẩy ra tầng ngoài, vẫn chạm thì đổi phía (mock-up dòng 2107-2114). */
export function layoutMilestoneLabels(boxes: LabelBox[]): LabelSlot[] {
  const lastRight = { up: [-1e9, -1e9], down: [-1e9, -1e9] };
  const lane = (s: -1 | 1) => (s === -1 ? lastRight.up : lastRight.down);
  return boxes.map((b, i) => {
    let side: -1 | 1 = i % 2 === 0 ? -1 : 1;
    const left = b.x - b.width / 2;
    let tier: 0 | 1 = left < lane(side)[0] + 10 ? 1 : 0;
    if (tier === 1 && left < lane(side)[1] + 10) {
      side = side === -1 ? 1 : -1;
      tier = left < lane(side)[0] + 10 ? 1 : 0;
    }
    lane(side)[tier] = b.x + b.width / 2;
    return { side, tier };
  });
}

/** Ước lượng bề rộng khối nhãn (đơn vị viewBox 1000), thay getComputedTextLength của mock-up (dòng 2098-2103). */
export function estimateLabelWidth(name: string, sub: string): number {
  return Math.max(name.length * 7.4, sub.length * 6.2) + 18;
}

/** Miền trục: [min, max] của các ngày + hôm nay, nới 6% mỗi đầu; cùng 1 ngày → ±14 ngày (mock-up dòng 2090-2093). */
export function keyMsDomain(dates: IsoDate[], today: IsoDate): { lo: number; hi: number } {
  const ms = [...dates, today].map((d) => Date.parse(`${d}T00:00:00Z`));
  const lo = Math.min(...ms);
  const hi = Math.max(...ms);
  const pad = (hi - lo) * 0.06 || 14 * 86_400_000;
  return { lo: lo - pad, hi: hi + pad };
}
```

- [ ] **Bước 5: `src/components/project/keyMsText.ts`**

```ts
import type { KeyMsState } from '@/lib/key-milestones';

type T = (key: string, values?: Record<string, number>) => string;

/** Nhãn trạng thái mốc - dùng chung KeyMilestoneChart (Task 6) + KeyMilestoneEditor (Task 8). */
export function keyMsStateText(t: T, s: KeyMsState): string {
  if (s.kind === 'done') {
    if (s.days > 0) return t('detail.keyMs.doneLate', { n: s.days });
    if (s.days < 0) return t('detail.keyMs.doneEarly', { n: -s.days });
    return t('detail.keyMs.doneOnTime');
  }
  return s.kind === 'late' ? t('detail.keyMs.late', { n: s.days }) : t('detail.keyMs.left', { n: s.days });
}
```

- [ ] **Bước 6: `src/components/project/KeyMilestoneChart.tsx`** (`'use client'`). Port `renderKeyMs` ở mock-up dòng 2082-2192:
  - Props: `{ milestones: ProjectKeyMilestone[]; today: IsoDate }`.
  - Hooks đứng đầu: `useTranslations()`, `const grow = useSpringProgress('gentle')`, `const pop = useSpringProgress('bouncy')`, `useChartTip()`, `const gradId = `km-${useId().replace(/:/g, '')}``.
  - `list` = các mốc có `plannedDate`, sort tăng theo `plannedDate`. `at(m) = m.actualDate ?? m.plannedDate`.
  - Trống → `<svg className="chart" viewBox="0 0 1000 80" role="img" aria-label={t('detail.keyMs.title')}><text x={500} y={46} textAnchor="middle" fontSize={13} style={{ fill: 'var(--label3)' }}>{t('detail.keyMs.empty')}</text></svg>`.
  - Hằng số: `W=1000, ML=40, MR=40, IW=920, LBH=54`. `{lo,hi} = keyMsDomain([...list.map(at), ...list.map(m=>m.plannedDate)], today)`. `X(d) = ML + IW*((Date.parse(`${d}T00:00:00Z`)-lo)/(hi-lo))`.
  - `items` = list.map → `{ m, st: keyMilestoneState(...), label: keyMsStateText(t, st), x: X(at(m)), width: estimateLabelWidth(m.name, `${formatDateShort(at(m))} · ${label}`) }`; `slots = layoutMilestoneLabels(items)`.
  - `tiersUp = Math.max(0, ...slots.map(s => s.side===-1 ? s.tier+1 : 0))`, `tiersDn` tương tự với `side===1`. `axisY = 26 + tiersUp*LBH`. `H = axisY + 30 + tiersDn*LBH`. viewBox `0 0 1000 H`.
  - Nội dung SVG theo thứ tự:
    1. `<defs><linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">` với 2 stop `style={{ stopColor: 'var(--accent-2)' }}` / `'var(--accent)'`.
    2. `monthTicks(iso(lo), iso(hi))` (`iso = ms => new Date(ms).toISOString().slice(0,10)`): mỗi vạch `line axisY-9 → axisY+9` màu `--grid`; nhãn ở `axisY+24`, fontSize 10, fontWeight 600, màu `--axis`.
    3. Nền thanh: `x1 = X(at(list[0]))`, `x2 = X(list[list.length-1].plannedDate)`, `rect x1, axisY-5, width max(x2-x1,4), height 10, rx 5`, màu `--fill-2`. Phần đã qua: `tx = X(today)`, `dn = max(0, min(tx,x2)-x1)`, `rect` cùng vị trí, `width = max(dn*grow, 2)`, `fill={`url(#${gradId})`}`.
    4. Vạch hôm nay: `line tx, axisY - tiersUp*LBH - 18 → axisY + 22 + tiersDn*LBH`, strokeWidth 2, dash `6 5`, màu `--danger`. Viên: `rect tx-38, axisY - tiersUp*LBH - 36, 76×20, rx 10`, màu `--danger`; chữ `t('common.today')` ở `y = axisY - tiersUp*LBH - 22.5`, fontSize 10.5, fontWeight 800, `fill="white"`.
    5. Mỗi mốc i (`sd = slots[i].side`, `ly = axisY + sd*(26 + tier*LBH)`, `x = items[i].x`, `done = st.kind==='done'`, `c = KEY_MS_TONE_VAR[st.tone]`):
       - Đường nối `x, axisY+sd*7 → ly - sd*4`, màu `--sep-2`, width 1.4, dash `3 3`.
       - Nếu `done && actualDate !== plannedDate`: `circle cx=X(plannedDate) cy=axisY r=4.6 strokeWidth 2.2`, `style={{ fill:'var(--glass-3)', stroke:'var(--s-plan)' }}`.
       - Hình thoi `path d={`M ${x} ${axisY-9} L ${x+8} ${axisY} L ${x} ${axisY+9} L ${x-8} ${axisY} Z`}`, fill `done ? var(--s-third) : var(--s-plan)`, stroke `--glass-3`, width 2, `strokeLinejoin="round"`, `transform={`translate(${x} ${axisY}) scale(${pop.toFixed(3)}) translate(${-x} ${-axisY})`}`.
       - Khối nhãn: `ty = sd===-1 ? ly-30 : ly+4`. Tên ở `ty+12` (13, 700, `--label`, middle). Ngày `formatDateShort(at(m))` ở `ty+27` (11, 600, `--label2`). Nền chip: `rect x-cw/2, ty+31, cw×15, rx 7.5`, fill `c`, `fillOpacity 0.13`, với `cw = label.length*6 + 14`. Chữ chip ở `ty+41` (10.5, 750, fill `c`).
       - Rect bắt chuột: `x - max(width,40)/2`, `y = min(ly,axisY)-12`, `width max(width,40)`, `height |ly-axisY|+58`, `fill="transparent"`. Tooltip rows: `{k:t('detail.keyMs.plannedDate'), v:formatDateShort(plannedDate), color:'var(--s-plan)'}`; nếu có actual thêm `{k:t('detail.keyMs.actualDate'), v:…, color:'var(--s-third)'}`; luôn có `{k:t('detail.keyMs.status'), v:label, valueColor:c}`; nếu chưa xong thêm `{k:t('detail.keyMs.prev'), v: i>0 ? list[i-1].name : t('detail.keyMs.first')}`.
  - Sau `</svg>` render `<ChartTip tip={tip} />`.
- [ ] **Bước 7: Test `KeyMilestoneChart.test.ts`.** Mock `next-intl` như Task 4 Bước 10; `vi.mock('@/server/repo', …mock-repo)`. `milestones = repo.getKeyMilestones(1)`, `today = '2026-09-16'`. Assert có đủ 5 tên seed (`src/data/seed/erp.ts:51-57`), có `detail.keyMs.doneLate|3` (01-15 → 01-18), `detail.keyMs.doneLate|5` (03-01 → 03-06), `detail.keyMs.late|1` (09-15), `detail.keyMs.left|13` (09-29). `milestones=[]` → có `detail.keyMs.empty`.
- [ ] **Bước 8: i18n** vào `"detail"`:
  - vi: `"keyMs": { "title": "Các mốc chính của dự án", "titleEn": "Key Milestones of the Project", "help": "Danh sách mốc là động: mỗi dự án có bộ mốc riêng (sân bay có \"Lifting Zone\", cầu có \"Hợp long\"...). Thêm / xoá / đổi tên mốc ở Nhập liệu → Hồ sơ dự án → Các mốc chính, biểu đồ cập nhật ngay. Mỗi mốc có ngày kế hoạch (bắt buộc) và ngày thực tế (điền khi đã đạt); có ngày thực tế thì mốc chuyển sang \"Đã xong\" kèm số ngày sớm/trễ so với kế hoạch.", "legendPlanned": "Mốc kế hoạch", "legendDone": "Đã đạt", "edit": "Sửa mốc", "empty": "Chưa có mốc nào - thêm ở Nhập liệu → Hồ sơ dự án", "doneLate": "Đã xong · trễ {n}đ", "doneEarly": "Đã xong · sớm {n}đ", "doneOnTime": "Đã xong · đúng hạn", "late": "Trễ {n} ngày", "left": "Còn {n} ngày", "plannedDate": "Ngày kế hoạch", "actualDate": "Ngày thực tế", "status": "Trạng thái", "prev": "Mốc trước đó", "first": "- đây là mốc đầu -" }`
  - en: `"keyMs": { "title": "Key milestones", "titleEn": "Key Milestones of the Project", "help": "The milestone list is dynamic: each project has its own set (airports have \"Lifting Zone\", bridges have \"Closure\"...). Add / remove / rename milestones in Data entry → Project profile → Key milestones and this chart updates immediately. Each milestone has a planned date (required) and an actual date (filled once achieved); with an actual date it becomes \"Done\" with days early/late versus plan.", "legendPlanned": "Planned", "legendDone": "Achieved", "edit": "Edit milestones", "empty": "No milestones yet - add them in Data entry → Project profile", "doneLate": "Done · {n}d late", "doneEarly": "Done · {n}d early", "doneOnTime": "Done · on time", "late": "{n} days overdue", "left": "{n} days left", "plannedDate": "Planned date", "actualDate": "Actual date", "status": "Status", "prev": "Previous milestone", "first": "- first milestone -" }`

  Thêm `'KeyMilestoneChart': 'src/components/project/KeyMilestoneChart.tsx'` và `'keyMsText': 'src/components/project/keyMsText.ts'` vào `CHANGED_SOURCES`.
- [ ] **Bước 9: Nối vào page.** Thêm dynamic `KeyMilestoneChart`; import `HelpTip` và `IconDataEntry`. Dữ liệu: `const keyMilestones = await repo.getKeyMilestones(id);`, `const canEditMs = user?.role === 'admin' || user?.role === 'data-entry';`. Chèn ngay SAU thẻ Timeline (Task 2):

```tsx
      {/* Cac moc chinh cua du an (mock-up dong 678-700) */}
      <Card className="overflow-visible">
        <CardHeader
          title={t('detail.keyMs.title')}
          subtitle={locale === 'vi' ? t('detail.keyMs.titleEn') : undefined}
          titleExtra={<HelpTip text={t('detail.keyMs.help')} label={t('common.explain')} />}
          action={
            <div className="flex flex-wrap items-center gap-2.5">
              <Legend items={[
                { label: t('detail.keyMs.legendPlanned'), color: 'var(--s-plan)' },
                { label: t('detail.keyMs.legendDone'), color: 'var(--s-third)' },
                { label: t('common.today'), color: 'var(--danger)', line: true },
              ]} />
              {canEditMs && (
                <Link href={`/nhap-lieu?project=${project.id}&step=profile#key-milestones`} className="btn ghost" style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}>
                  <IconDataEntry size={16} />{t('detail.keyMs.edit')}
                </Link>
              )}
            </div>
          }
        />
        <CardBody><KeyMilestoneChart milestones={keyMilestones} today={today} /></CardBody>
      </Card>
```

(data-entry đọc được trang nghĩa là đã được gán dự án, theo `requireProjectRead`; action ghi ở Task 7 vẫn tự kiểm lại quyền.)

- [ ] **Bước 10: Test page** (thêm vào `projects-detail-page-render.test.ts`):

```ts
describe('Task 6 - the "Cac moc chinh" + nut "Sua moc" theo vai tro', () => {
  it('admin thay the + link toi dung buoc Ho so', async () => {
    const out = await render();
    expect(out).toContain('detail.keyMs.title');
    expect(out).toContain('href="/nhap-lieu?project=1&amp;step=profile#key-milestones"');
  });
  it('bod va viewer KHONG thay nut sua', async () => {
    expect(await render({}, '1', BOD)).not.toContain('step=profile');
    expect(await render({}, '1', VIEWER)).not.toContain('step=profile');
  });
});
```

- [ ] **Bước 11:** `npx tsc --noEmit`, `npm test`. Kiểm mắt: 5 mốc, nhãn không đè nhau, thoi nảy khi vào trang, vạch hôm nay, tooltip, nút "Sửa mốc" (tới Task 8 mới mở đúng bước).
- [ ] **Bước 12:** `git commit -m "feat(parity): bieu do cac moc chinh cua du an"`

---

### Task 7: Luồng ghi "Các mốc chính" (repo + validation + action)

**Files:**
- Modify: `src/server/repo/types.ts` (sau `ProjectKeyMilestone`, dòng 210-217), `src/server/repo/prisma-repo.ts` (sau `addAssignment`, dòng 938-944), `src/server/repo/mock-repo.ts` (sau `addAssignment`, dòng 776-784), `src/lib/key-milestones.ts`, `src/server/validation.ts`, `src/server/validation.test.ts`, `src/server/actions.ts`
- Create: `src/server/repo/key-milestones.test.ts`, `src/server/repo/prisma-repo-key-milestones.test.ts`, `src/server/actions-key-milestones.test.ts`

**Interfaces:**
- Produces `KeyMilestoneInput = { name: string; plannedDate: string; actualDate: string | null }` (ở `types.ts`).
- Produces `repo.replaceKeyMilestones(projectId: number, rows: KeyMilestoneInput[], changedBy?: string)` (prisma: `Promise<void>`; mock: `void`).
- Produces `KEY_MS_NAME_MAX = 160`, `KEY_MS_MAX_ROWS = 50`, `keyMsAuditText(rows)` (ở `key-milestones.ts`).
- Produces `keyMilestoneRowSchema`, `saveKeyMilestonesSchema`, `createProjectSchema.keyMilestones?`.
- Produces `saveKeyMilestonesAction(projectId: number, rows: KeyMilestoneInput[]): Promise<{ ok: boolean; error?: string }>`; `createProjectAction(input)` nhận thêm `keyMilestones?: KeyMilestoneInput[]`.

- [ ] **Bước 1: `types.ts`** thêm sau `ProjectKeyMilestone`:

```ts
/** Dòng mốc chính khi GHI (form → action → repo). sortOrder = thứ tự trong mảng, không nhận từ client. */
export interface KeyMilestoneInput {
  name: string;
  plannedDate: string;        // 'YYYY-MM-DD', bắt buộc
  actualDate: string | null;  // 'YYYY-MM-DD'
}
```

`key-milestones.ts` thêm:

```ts
export const KEY_MS_NAME_MAX = 160;
/** Chặn payload phình (DoS) - mock-up không giới hạn, 50 mốc/dự án là quá đủ. */
export const KEY_MS_MAX_ROWS = 50;

/** Chuỗi audit_log cho bộ mốc: "tên|ngàyKH|ngàyTT; ...". */
export function keyMsAuditText(rows: { name: string; plannedDate: string | null; actualDate: string | null }[]): string {
  return rows.map((r) => `${r.name}|${r.plannedDate ?? ''}|${r.actualDate ?? ''}`).join('; ');
}
```

- [ ] **Bước 2: Test đỏ validation** (thêm vào `validation.test.ts`):

```ts
describe('saveKeyMilestonesSchema', () => {
  const ok = { name: 'Mốc A', plannedDate: '2026-09-20', actualDate: null };
  it('hop le + trim ten', () => {
    const r = saveKeyMilestonesSchema.safeParse({ projectId: 1, rows: [{ ...ok, name: '  Mốc A ' }] });
    expect(r.success && r.data.rows[0].name).toBe('Mốc A');
  });
  it('mang rong hop le (xoa het moc)', () => expect(saveKeyMilestonesSchema.safeParse({ projectId: 1, rows: [] }).success).toBe(true));
  it.each([
    ['ten rong', { ...ok, name: '   ' }],
    ['ten 161 ky tu', { ...ok, name: 'x'.repeat(161) }],
    ['thieu ngay KH', { ...ok, plannedDate: '' }],
    ['ngay KH khong ton tai', { ...ok, plannedDate: '2026-02-30' }],
    ['ngay TT sai dinh dang', { ...ok, actualDate: '20/09/2026' }],
  ])('tu choi: %s', (_, row) => expect(saveKeyMilestonesSchema.safeParse({ projectId: 1, rows: [row] }).success).toBe(false));
  it('tu choi > 50 dong', () => expect(saveKeyMilestonesSchema.safeParse({ projectId: 1, rows: Array(51).fill(ok) }).success).toBe(false));
  it('createProjectSchema nhan keyMilestones tuy chon', () => {
    const base = { projectName: 'X', customerId: 1, teamKdId: 1, marketCode: 'TN', projectType: 'EPC', priority: 'P1', contractValue: 1 };
    expect(createProjectSchema.safeParse(base).success).toBe(true);
    expect(createProjectSchema.safeParse({ ...base, keyMilestones: [ok] }).success).toBe(true);
    expect(createProjectSchema.safeParse({ ...base, keyMilestones: [{ ...ok, name: '' }] }).success).toBe(false);
  });
});
```

- [ ] **Bước 3: `validation.ts`.** Import `isValidIsoDate` (thêm vào dòng import `@/lib/clock`) và `KEY_MS_MAX_ROWS, KEY_MS_NAME_MAX` từ `@/lib/key-milestones`. Thêm sau hằng `nullableDate`:

```ts
const isoDate = z.string().refine(isValidIsoDate, 'Ngày phải dạng YYYY-MM-DD hợp lệ');
export const keyMilestoneRowSchema = z.object({
  name: z.string().trim().min(1).max(KEY_MS_NAME_MAX),
  plannedDate: isoDate,
  actualDate: isoDate.nullable(),
});
export const saveKeyMilestonesSchema = z.object({
  projectId: z.number().int().positive(),
  rows: z.array(keyMilestoneRowSchema).max(KEY_MS_MAX_ROWS),
});
```

Trong `createProjectSchema` thêm dòng `keyMilestones: z.array(keyMilestoneRowSchema).max(KEY_MS_MAX_ROWS).optional(),`. Chạy test → XANH.
- [ ] **Bước 4: Test đỏ mock-repo** `src/server/repo/key-milestones.test.ts` (`import { repo } from './mock-repo'`, `beforeEach(() => repo.reset())`):
  - Gọi `replaceKeyMilestones(1, [{name:'B',plannedDate:'2026-10-01',actualDate:null},{name:'A',plannedDate:'2026-09-01',actualDate:'2026-09-02'}], 'admin@x')` → `getKeyMilestones(1).map(m=>[m.name,m.sortOrder])` = `[['B',1],['A',2]]`, id không trùng nhau.
  - `replaceKeyMilestones(2, [...])` → `getKeyMilestones(1)` vẫn đủ 5 mốc seed.
  - `replaceKeyMilestones(1, [])` → rỗng.
  - `getAuditLog()[0]`: `tableName` = `'project_key_milestone'`, `recordId` = `'1'`, `field` = `'replace'`, `oldValue` chứa `'Duyệt thiết kế kỹ thuật|2026-01-15|2026-01-18'`, `changedBy` = `'admin@x'`.
- [ ] **Bước 5: `mock-repo.ts`** (import `keyMsAuditText` từ `@/lib/key-milestones`, import type `KeyMilestoneInput`):

```ts
  /** Thay TOÀN BỘ bộ mốc của 1 dự án (bảng cấu hình, không phải fact append-only); sortOrder = thứ tự mảng. */
  replaceKeyMilestones(projectId: number, rows: KeyMilestoneInput[], changedBy = 'system') {
    const d = getData();
    const before = this.getKeyMilestones(projectId);
    let nextId = d.keyMilestones.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    d.keyMilestones = d.keyMilestones
      .filter((m) => m.projectId !== projectId)
      .concat(rows.map((r, i) => ({ id: nextId++, projectId, name: r.name, sortOrder: i + 1, plannedDate: r.plannedDate, actualDate: r.actualDate })));
    this.logAudit('project_key_milestone', String(projectId), 'replace', keyMsAuditText(before), keyMsAuditText(rows), changedBy);
  },
```

- [ ] **Bước 6: Test đỏ prisma-repo** `src/server/repo/prisma-repo-key-milestones.test.ts`, mock theo mẫu `prisma-repo-reset.test.ts:16-43`:

```ts
const { deleteMany, createMany, findMany, auditCreate, txCalls } = vi.hoisted(() => ({
  deleteMany: vi.fn(async () => ({ count: 0 })),
  createMany: vi.fn(async () => ({ count: 0 })),
  findMany: vi.fn(async () => []),
  auditCreate: vi.fn(async () => ({})),
  txCalls: [] as unknown[][],
}));
vi.mock('@/server/db', () => ({
  prisma: {
    projectKeyMilestone: { deleteMany, createMany, findMany },
    auditLog: { create: auditCreate },
    $transaction: vi.fn(async (ops: unknown[]) => { txCalls.push(ops); return Promise.all(ops); }),
  },
}));
import { repo } from './prisma-repo';
```

  - Gọi `replaceKeyMilestones(7, [{name:'A',plannedDate:'2026-09-20',actualDate:null},{name:'B',plannedDate:'2026-10-01',actualDate:'2026-10-03'}], 'admin@x')`:
    - `txCalls` có 1 phần tử gồm 2 op.
    - `deleteMany` gọi với `{ where: { projectId: 7 } }`.
    - `createMany` gọi với `{ data: [{ projectId: 7, name: 'A', sortOrder: 1, plannedDate: new Date('2026-09-20T00:00:00Z'), actualDate: null }, { projectId: 7, name: 'B', sortOrder: 2, plannedDate: new Date('2026-10-01T00:00:00Z'), actualDate: new Date('2026-10-03T00:00:00Z') }] }`.
    - `auditCreate` gọi với `{ data: expect.objectContaining({ tableName: 'project_key_milestone', recordId: '7', field: 'replace', changedBy: 'admin@x' }) }`.
  - Gọi với mảng rỗng: transaction chỉ có 1 op, `createMany` KHÔNG được gọi.
- [ ] **Bước 7: `prisma-repo.ts`** (import `keyMsAuditText`, type `KeyMilestoneInput`; dùng helper `dayStart` có sẵn ở dòng 61):

```ts
  /** Thay TOÀN BỘ bộ mốc trong 1 transaction; ngày lưu 00:00Z khớp cách đọc day() của getKeyMilestones. */
  async replaceKeyMilestones(projectId: number, rows: KeyMilestoneInput[], changedBy = 'system'): Promise<void> {
    const before = await this.getKeyMilestones(projectId);
    const del = prisma.projectKeyMilestone.deleteMany({ where: { projectId } });
    if (rows.length) {
      await prisma.$transaction([
        del,
        prisma.projectKeyMilestone.createMany({
          data: rows.map((r, i) => ({
            projectId, name: r.name, sortOrder: i + 1,
            plannedDate: dayStart(r.plannedDate),
            actualDate: r.actualDate ? dayStart(r.actualDate) : null,
          })),
        }),
      ]);
    } else {
      await prisma.$transaction([del]);
    }
    await this.logAudit('project_key_milestone', String(projectId), 'replace', keyMsAuditText(before), keyMsAuditText(rows), changedBy);
  },
```

- [ ] **Bước 8: Test đỏ action** `src/server/actions-key-milestones.test.ts`. Mock theo mẫu `actions-valuechain.test.ts:12-17`; `beforeEach` gồm `repo.reset()` + `vi.clearAllMocks()`. `ROW = { name: 'Mốc A', plannedDate: '2026-09-20', actualDate: null }`.
  - admin, dự án 1 → `{ ok: true }`, `repo.getKeyMilestones(1)` chỉ còn 1 mốc `'Mốc A'`.
  - data-entry `pm@daidung.com.vn` (PIC dự án 1) → ok.
  - data-entry `pm@` với dự án 4 (không phải PIC) → `{ ok: false, error: 'Forbidden' }`, dự án 4 không đổi.
  - viewer và bod → Forbidden.
  - admin gửi `[{ ...ROW, name: '' }]` → `ok: false`, dự án 1 vẫn đủ 5 mốc seed.
  - admin, dự án 999 → `{ ok: false, error: 'Not found' }`.
  - admin `createProjectAction({ projectName: 'DU AN TEST', customerId: 1, teamKdId: 1, marketCode: 'TN', projectType: 'EPC', priority: 'P1', contractValue: 10, keyMilestones: [ROW] })` → dự án `res.id` có 1 mốc. Không kèm `keyMilestones` → 0 mốc.
- [ ] **Bước 9: `actions.ts`.** Import thêm `saveKeyMilestonesSchema` (vào danh sách import ở dòng 11) và `type KeyMilestoneInput`. Thêm `keyMilestones?: KeyMilestoneInput[];` vào kiểu `input` của `createProjectAction`. Trong thân hàm, thay dòng `const p = await repo.createProject(parsed.data, user.email);` bằng:

```ts
  const { keyMilestones, ...projectInput } = parsed.data;
  const p = await repo.createProject(projectInput, user.email);
  if (user.role === 'data-entry') await repo.addAssignment(p.id, user.email, 'PIC');
  if (keyMilestones?.length) await repo.replaceKeyMilestones(p.id, keyMilestones, user.email);
```

(xoá dòng `addAssignment` cũ để không gọi 2 lần). Thêm action mới sau `createProjectAction`:

```ts
/** Thay toàn bộ "Các mốc chính" của dự án. Quyền như saveMonthlyData: admin, hoặc data-entry là PIC dự án. */
export async function saveKeyMilestonesAction(projectId: number, rows: KeyMilestoneInput[]) {
  const user = await requireProject(projectId);
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = saveKeyMilestonesSchema.safeParse({ projectId, rows });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  if (!(await repo.getProject(projectId))) return { ok: false, error: 'Not found' };
  await repo.replaceKeyMilestones(projectId, parsed.data.rows, user.email);
  await logActivity(user, 'save_key_milestones', `project ${projectId} · ${parsed.data.rows.length}`);
  return { ok: true };
}
```

Không kiểm khoá tháng ở server: mốc chính không thuộc số liệu tháng. Trên UI, card vẫn bị khoá theo cơ chế hiện có của `DataEntryForm`.

- [ ] **Bước 10:** `npx tsc --noEmit`, `npm test` → xanh.
- [ ] **Bước 11:** `git commit -m "feat(parity): luong ghi cac moc chinh - repo replaceKeyMilestones + action + zod"`

---

### Task 8: Trình sửa "Các mốc chính" trong form Tạo mới + Hồ sơ dự án

**Files:**
- Create: `src/components/form/KeyMilestoneEditor.tsx`, `src/components/form/KeyMilestoneEditor.test.ts`
- Modify: `src/lib/key-milestones.ts` (+test), `src/components/form/CreateProjectForm.tsx`, `src/components/form/DataEntryForm.tsx`, `app/[locale]/(app)/nhap-lieu/page.tsx`, `vi.json`/`en.json`, `messages.test.ts`

**Interfaces:**
- Consumes `KeyMilestoneInput`, `saveKeyMilestonesAction`, `createProjectAction({ keyMilestones })`, `KEY_MS_*` (Task 7); `keyMilestoneState`, `KEY_MS_TONE_VAR`, `keyMsStateText` (Task 6).
- Produces trong `key-milestones.ts`: `KeyMilestoneDraft = KeyMilestoneInput`, `KeyMsField`, `KeyMsErrors`, `validateKeyMilestones`, `normalizeKeyMilestones`, `toKeyMilestoneDraft`, `addKeyMilestone`, `removeKeyMilestone`, `updateKeyMilestone`, `keyMsSuggestions`.
- Produces `KeyMilestoneEditor({ id?, value, onChange, today, errors? })`, `export type DataEntryStep`, prop mới `DataEntryForm.{ keyMilestones, today, initialStep? }`, prop mới `CreateProjectForm.today`.

- [ ] **Bước 1: Test đỏ** (thêm vào `key-milestones.test.ts`):
  - `validateKeyMilestones([{name:' ',plannedDate:'2026-09-01',actualDate:null},{name:'A',plannedDate:'',actualDate:'x'}])` → `{ ok:false, errors:{0:['name'],1:['plannedDate','actualDate']} }`; mảng hợp lệ → `{ ok:true, errors:{} }`; 51 dòng hợp lệ → `ok:false`.
  - `normalizeKeyMilestones([{name:' A ',plannedDate:'2026-09-01',actualDate:''}])` → `[{name:'A',plannedDate:'2026-09-01',actualDate:null}]`.
  - `toKeyMilestoneDraft({ id:1, projectId:1, name:'A', sortOrder:1, plannedDate:null, actualDate:null })` → `{ name:'A', plannedDate:'', actualDate:null }`.
  - `addKeyMilestone([], 'Mốc mới 1', '2026-09-16')` → `[{name:'Mốc mới 1',plannedDate:'2026-09-16',actualDate:null}]`; khi đã có 50 dòng thì trả nguyên mảng.
  - `removeKeyMilestone` và `updateKeyMilestone` không mutate mảng gốc.
  - `keyMsSuggestions([{name:'S1',…}], ['S1','S2','S3','S4','S5','S6'])` → `['S2','S3','S4','S5']`.
- [ ] **Bước 2: Thêm vào `key-milestones.ts`**

```ts
import type { KeyMilestoneInput, ProjectKeyMilestone } from '@/server/repo/types';
// (bổ sung isValidIsoDate vào import '@/lib/clock' có sẵn)

export type KeyMilestoneDraft = KeyMilestoneInput;
export type KeyMsField = 'name' | 'plannedDate' | 'actualDate';
export type KeyMsErrors = Record<number, KeyMsField[]>;

/** Validate phía client - cùng luật với keyMilestoneRowSchema (validation.ts). */
export function validateKeyMilestones(rows: KeyMilestoneDraft[]): { ok: boolean; errors: KeyMsErrors } {
  const errors: KeyMsErrors = {};
  rows.forEach((r, i) => {
    const bad: KeyMsField[] = [];
    const name = r.name.trim();
    if (!name || name.length > KEY_MS_NAME_MAX) bad.push('name');
    if (!isValidIsoDate(r.plannedDate)) bad.push('plannedDate');
    if (r.actualDate && !isValidIsoDate(r.actualDate)) bad.push('actualDate');
    if (bad.length) errors[i] = bad;
  });
  return { ok: Object.keys(errors).length === 0 && rows.length <= KEY_MS_MAX_ROWS, errors };
}
export function normalizeKeyMilestones(rows: KeyMilestoneDraft[]): KeyMilestoneDraft[] {
  return rows.map((r) => ({ name: r.name.trim(), plannedDate: r.plannedDate, actualDate: r.actualDate ? r.actualDate : null }));
}
export function toKeyMilestoneDraft(m: ProjectKeyMilestone): KeyMilestoneDraft {
  return { name: m.name, plannedDate: m.plannedDate ?? '', actualDate: m.actualDate };
}
export function addKeyMilestone(rows: KeyMilestoneDraft[], name: string, today: string): KeyMilestoneDraft[] {
  return rows.length >= KEY_MS_MAX_ROWS ? rows : [...rows, { name, plannedDate: today, actualDate: null }];
}
export function removeKeyMilestone(rows: KeyMilestoneDraft[], index: number): KeyMilestoneDraft[] {
  return rows.filter((_, i) => i !== index);
}
export function updateKeyMilestone(rows: KeyMilestoneDraft[], index: number, patch: Partial<KeyMilestoneDraft>): KeyMilestoneDraft[] {
  return rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
}
/** Gợi ý nhanh chưa có trong danh sách (khớp tên y hệt), tối đa `limit` (mock-up dòng 2226-2228). */
export function keyMsSuggestions(rows: KeyMilestoneDraft[], all: string[], limit = 4): string[] {
  return all.filter((s) => !rows.some((r) => r.name === s)).slice(0, limit);
}
```

- [ ] **Bước 3: `src/components/form/KeyMilestoneEditor.tsx`** (`'use client'`). Port mock-up dòng 1037-1056 (markup) + 2195-2232 (hành vi):

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { IsoDate } from '@/lib/clock';
import { isValidIsoDate } from '@/lib/clock';
import {
  KEY_MS_MAX_ROWS, KEY_MS_NAME_MAX, KEY_MS_TONE_VAR, addKeyMilestone, keyMilestoneState, keyMsSuggestions,
  removeKeyMilestone, updateKeyMilestone, type KeyMilestoneDraft, type KeyMsErrors, type KeyMsField,
} from '@/lib/key-milestones';
import { keyMsStateText } from '@/components/project/keyMsText';

const SUGGEST_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];

export function KeyMilestoneEditor({ id, value, onChange, today, errors = {} }: {
  id?: string; value: KeyMilestoneDraft[]; onChange: (rows: KeyMilestoneDraft[]) => void; today: IsoDate; errors?: KeyMsErrors;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const tableRef = useRef<HTMLTableElement>(null);
  const focusLast = useRef(false);
  useEffect(() => {
    if (!focusLast.current) return;
    focusLast.current = false;
    const inputs = tableRef.current?.querySelectorAll<HTMLInputElement>('input[data-ms="name"]');
    const last = inputs?.[inputs.length - 1];
    last?.focus();
    last?.select();
  }, [value.length]);

  const done = value.filter((r) => r.actualDate).length;
  const full = value.length >= KEY_MS_MAX_ROWS;
  const suggestions = keyMsSuggestions(value, SUGGEST_KEYS.map((k) => t(`form.keyMs.suggest.${k}`)));
  const cls = (i: number, f: KeyMsField) => `inp${errors[i]?.includes(f) ? ' bad' : ''}`;
  const b = (c: React.ReactNode) => <b>{c}</b>;

  return (
    <div className="fsec" id={id}>
      <div className="h">
        <h4>{t('form.keyMs.title')}{locale === 'vi' && <>{' '}<span className="en">{t('form.keyMs.titleEn')}</span></>}</h4>
        <p>{t('form.keyMs.subtitle')}</p>
      </div>
      <div className="sumbar" style={{ marginBottom: 12 }}>
        <span>{t.rich('form.keyMs.intro', { b })}</span>
        <span>{t.rich('form.keyMs.count', { count: value.length, done, b })}</span>
      </div>
      <div className="scroll">
        <table className="tbl" ref={tableRef}>
          <thead>
            <tr>
              <th style={{ width: 34 }}>#</th>
              <th>{t('form.keyMs.colName')}</th>
              <th style={{ width: 160 }}>{t('form.keyMs.colPlanned')} <span className="req">*</span></th>
              <th style={{ width: 160 }}>{t('form.keyMs.colActual')}</th>
              <th style={{ width: 150 }}>{t('form.keyMs.colStatus')}</th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {value.map((r, i) => {
              const st = isValidIsoDate(r.plannedDate)
                ? keyMilestoneState(r.plannedDate, r.actualDate && isValidIsoDate(r.actualDate) ? r.actualDate : null, today)
                : null;
              const color = st ? KEY_MS_TONE_VAR[st.tone] : 'var(--label3)';
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input data-ms="name" className={cls(i, 'name')} value={r.name} maxLength={KEY_MS_NAME_MAX} onChange={(e) => onChange(updateKeyMilestone(value, i, { name: e.target.value }))} /></td>
                  <td><input type="date" className={cls(i, 'plannedDate')} value={r.plannedDate} onChange={(e) => onChange(updateKeyMilestone(value, i, { plannedDate: e.target.value }))} /></td>
                  <td><input type="date" className={cls(i, 'actualDate')} value={r.actualDate ?? ''} onChange={(e) => onChange(updateKeyMilestone(value, i, { actualDate: e.target.value || null }))} /></td>
                  <td><span className="chip" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{st ? keyMsStateText(t, st) : '-'}</span></td>
                  <td>
                    <button type="button" className="btn ghost" title={t('form.keyMs.remove')} aria-label={t('form.keyMs.remove')} style={{ padding: '5px 9px', minWidth: 0 }} onClick={() => onChange(removeKeyMilestone(value, i))}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 13 }}>
        <button type="button" className="btn ghost" style={{ padding: '7px 13px' }} disabled={full}
          onClick={() => { focusLast.current = true; onChange(addKeyMilestone(value, t('form.keyMs.newName', { n: value.length + 1 }), today)); }}>
          {t('form.keyMs.add')}
        </button>
        <span className="hintline" style={{ margin: '0 4px 0 6px' }}>{t('form.keyMs.suggestLabel')}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip c-plain" style={{ border: 'none', cursor: 'pointer' }} disabled={full} onClick={() => onChange(addKeyMilestone(value, s, today))}>{`+ ${s}`}</button>
          ))}
        </div>
        {full && <span className="hintline">{t('form.keyMs.limit', { n: KEY_MS_MAX_ROWS })}</span>}
      </div>
      <p className="hintline" style={{ marginTop: 10 }}>{t.rich('form.keyMs.naming', { b })}</p>
    </div>
  );
}
```

- [ ] **Bước 4: Test `KeyMilestoneEditor.test.ts`.** Mock `next-intl` như Task 5 Bước 9, riêng key `form.keyMs.suggest.sN` trả `'Mốc ' + N` (ví dụ `'Mốc 1'`). `value = [{name:'Mốc 1',plannedDate:'2026-09-20',actualDate:null},{name:'Xong',plannedDate:'2026-09-01',actualDate:'2026-09-03'}]`, `today = '2026-09-16'`, `id = 'key-milestones'`, `errors = {0:['name']}`. Assert:
  - Có `id="key-milestones"`.
  - Có `value="Mốc 1"`.
  - Có `detail.keyMs.left|4` và `detail.keyMs.doneLate|2`.
  - Có `+ Mốc 2` … `+ Mốc 5`; KHÔNG có `+ Mốc 1`, KHÔNG có `+ Mốc 6` (tối đa 4).
  - Ô tên dòng 0 có `class="inp bad"`.
- [ ] **Bước 5: `CreateProjectForm.tsx`.**
  - Props thêm `today: IsoDate`.
  - State: `const [msRows, setMsRows] = useState<KeyMilestoneDraft[]>([]); const [msErrors, setMsErrors] = useState<KeyMsErrors>({});`.
  - Trong `validate()`, sau khối `if (missing.length) {…}` và trước `setErr(null)`:

```ts
    const ms = validateKeyMilestones(msRows);
    setMsErrors(ms.errors);
    if (!ms.ok) { setErr(t('form.keyMs.invalid')); return false; }
```

  - Payload `createProjectAction` thêm `keyMilestones: msRows.length ? normalizeKeyMilestones(msRows) : undefined,`. Nhánh `res.ok` thêm `setMsRows([]); setMsErrors({});`.
  - Render: ngay TRƯỚC dòng `{err && …}` (dòng 198) chèn `<div style={{ gridColumn: '1 / -1' }}><KeyMilestoneEditor id="key-milestones-new" value={msRows} onChange={setMsRows} today={today} errors={msErrors} /></div>`.
- [ ] **Bước 6: `DataEntryForm.tsx`.**
  - Dòng 35 đổi thành `export type DataEntryStep = 'progress' | 'finance' | 'profile' | 'extras';` + `type Step = DataEntryStep;`.
  - `Props` thêm `keyMilestones: ProjectKeyMilestone[]; today: IsoDate; initialStep?: DataEntryStep;` (thêm vào destructuring).
  - Dòng 114 đổi thành `useState<Step>(initialStep ?? 'progress')`.
  - State mới: `msRows` (khởi tạo `() => keyMilestones.map(toKeyMilestoneDraft)`), `msDirty` (false), `msErrors` (`{}`), `msSaveErr` (`string | null`).
  - `validate()`: trước `return`, thêm

```ts
    let msOk = true;
    if (msDirty) {
      const r = validateKeyMilestones(msRows);
      setMsErrors(r.errors);
      msOk = r.ok;
      if (!r.ok) setStep('profile');
    }
```

  rồi đổi `return` thành `return msOk && !e.pctPlan && !STAGE_ORDER.some((s) => e['stagePct.' + s]);`.
  - `submit()`: trong nhánh `if (res.ok) {`, TRƯỚC `router.refresh()`:

```ts
        if (msDirty) {
          const ms = await saveKeyMilestonesAction(projectId, normalizeKeyMilestones(msRows));
          if (ms.ok) { setMsDirty(false); setMsSaveErr(null); } else setMsSaveErr(t('form.keyMs.saveError'));
        }
```

  - Render bước `profile`: bọc `<div className="f2">…</div>` hiện có (dòng 344-457) trong fragment `<>…</>`, và ngay sau `</div>` của `f2` chèn (KHÔNG bọc thêm div, để `.fsec` có viền trên):

```tsx
            <KeyMilestoneEditor id="key-milestones" value={msRows} today={today} errors={msErrors}
              onChange={(rows) => { setMsRows(rows); setMsDirty(true); setSaved(false); }} />
            {Object.keys(msErrors).length > 0 && <p className="sumbar bad" style={{ marginTop: 10 }}>{t('form.keyMs.invalid')}</p>}
            {msSaveErr && <p className="sumbar bad" style={{ marginTop: 10 }}>{msSaveErr}</p>}
```

  - Import: `KeyMilestoneEditor`, `saveKeyMilestonesAction` (vào import `@/server/actions` ở dòng 29), `ProjectKeyMilestone` (vào import type ở dòng 6-23), `type IsoDate` từ `@/lib/clock`, và `normalizeKeyMilestones, toKeyMilestoneDraft, validateKeyMilestones, type KeyMilestoneDraft, type KeyMsErrors` từ `@/lib/key-milestones`.
- [ ] **Bước 7: `nhap-lieu/page.tsx`.**

```ts
import { currentMonth, historyMonths, todayIso } from '@/lib/clock';
import type { DataEntryStep } from '@/components/form/DataEntryForm';
const STEPS: DataEntryStep[] = ['progress', 'finance', 'profile', 'extras'];
// trong thân hàm, sau `const photos = …`:
  const keyMilestones = project ? await repo.getKeyMilestones(project.id) : [];
  const today = todayIso();
  const initialStep = typeof searchParams.step === 'string' && (STEPS as string[]).includes(searchParams.step)
    ? (searchParams.step as DataEntryStep) : undefined;
```

Truyền `today={today}` cho `<CreateProjectForm>`, và `keyMilestones={keyMilestones} today={today} initialStep={initialStep}` cho `<DataEntryForm>`.
- [ ] **Bước 8: i18n** vào `"form"` (sau `"validation"`):
  - vi: `"keyMs": { "title": "Các mốc chính của dự án", "titleEn": "Key Milestones of the Project", "subtitle": "Danh sách động - mỗi dự án một bộ mốc riêng", "intro": "Bộ mốc này <b>không cố định</b>. Thêm mốc đặc thù của dự án (Lifting Zone, Hợp long, Thanh thải...), xoá mốc không dùng - biểu đồ <b>Các mốc chính</b> ở Chi tiết dự án đổi theo ngay.", "count": "<b>{count}</b> mốc · <b>{done}</b> đã đạt", "colName": "Tên mốc", "colPlanned": "Ngày kế hoạch", "colActual": "Ngày thực tế", "colStatus": "Trạng thái", "add": "+ Thêm mốc mới", "suggestLabel": "Gợi ý nhanh:", "newName": "Mốc mới {n}", "remove": "Xoá mốc", "naming": "Tên mốc nên là <b>danh từ + trạng thái</b> (ví dụ \"Ngày HT Hợp Long\"), tránh viết tắt riêng của một phòng ban vì mốc này hiển thị trên báo cáo ban điều hành.", "invalid": "Các mốc chính: tên mốc và ngày kế hoạch là bắt buộc, ngày phải hợp lệ", "saveError": "Đã lưu hồ sơ nhưng chưa lưu được các mốc chính", "limit": "Tối đa {n} mốc", "suggest": { "s1": "Ngày Lifting Zone 2", "s2": "Ngày HT móng", "s3": "Ngày HT lắp dựng mái", "s4": "Ngày chạy thử", "s5": "Ngày nghiệm thu PCCC", "s6": "Ngày bàn giao tạm", "s7": "Ngày HT kết cấu chính" } }`
  - en: `"keyMs": { "title": "Key milestones", "titleEn": "Key Milestones of the Project", "subtitle": "Dynamic list - each project has its own milestones", "intro": "This set is <b>not fixed</b>. Add project-specific milestones (Lifting Zone, Closure, Site clearance...) and remove unused ones - the <b>Key milestones</b> chart in Project detail updates immediately.", "count": "<b>{count}</b> milestones · <b>{done}</b> achieved", "colName": "Milestone", "colPlanned": "Planned date", "colActual": "Actual date", "colStatus": "Status", "add": "+ Add milestone", "suggestLabel": "Quick picks:", "newName": "New milestone {n}", "remove": "Remove milestone", "naming": "Name milestones as <b>noun + state</b> (e.g. \"Closure completed\") and avoid department-specific abbreviations - these appear in executive reports.", "invalid": "Key milestones: name and planned date are required and dates must be valid", "saveError": "Profile saved but key milestones could not be saved", "limit": "Up to {n} milestones", "suggest": { "s1": "Lifting Zone 2 date", "s2": "Foundation completed", "s3": "Roof erection completed", "s4": "Commissioning", "s5": "Fire safety acceptance", "s6": "Temporary handover", "s7": "Main structure completed" } }`

  Thêm `'KeyMilestoneEditor': 'src/components/form/KeyMilestoneEditor.tsx'` vào `CHANGED_SOURCES`.
- [ ] **Bước 9:** `npx tsc --noEmit`, `npm test`.
- [ ] **Bước 10: Kiểm mắt** (đăng nhập admin):
  - Từ `/vi/projects/1` bấm "Sửa mốc" → `/vi/nhap-lieu` mở sẵn bước "Hồ sơ dự án", cuộn tới bảng mốc.
  - Thêm mốc thì ô tên được focus và bôi chọn sẵn. Chip gợi ý biến mất sau khi dùng. Xoá, sửa ngày thì chip trạng thái đổi theo.
  - Lưu rồi quay lại chi tiết → biểu đồ đổi theo.
  - Để trống tên thì ô viền đỏ, thanh lỗi hiện, và KHÔNG lưu gì cả (kể cả hồ sơ).
  - Tạo dự án mới kèm 1 mốc → chọn dự án đó, mốc hiện ở bước Hồ sơ.
  - Tháng đã khoá → bảng mốc bị mờ cùng card.
- [ ] **Bước 11:** `git commit -m "feat(parity): trinh sua cac moc chinh o form tao moi + ho so du an"`

---

### Task 9: "Timeline của 7 giai đoạn" (`msChart`) + chọn giai đoạn

**Files:**
- Create: `src/lib/stage-timeline.ts`, `src/lib/stage-timeline.test.ts`, `src/components/project/stageText.ts`, `src/components/project/StageTimelineChart.tsx`, `src/components/project/StageExplorer.tsx`, `src/components/project/StageExplorer.test.ts`
- Modify: `page.tsx`, `vi.json`/`en.json`, `messages.test.ts`

**Interfaces:**
- Consumes `monthTicks` (Task 6), `Legend`/`LegendShape` (Task 2), `formatDateShort` (Task 5), `useChartTip`/`ChartTip` (Task 4), `today` (Task 2).
- Produces `StageTimelineRow`, `buildStageTimelineRows(ms, weights)`, `TimeDomain`, `buildTimeDomain(rows, today)`, `xOf(date, domain, x0, width)`, `STAGE_MARKERS`, `stageMarkers(row)`.
- Produces `StageExplorer({ rows, today, locale })`, giữ state `selected: StageCode | null`. Task 10 thêm prop `compare` và thẻ thứ 2.

- [ ] **Bước 1: Test đỏ `stage-timeline.test.ts`:**
  - `buildStageTimelineRows`: đúng thứ tự `STAGE_ORDER`, bỏ giai đoạn không có dòng milestone, `weightPct` = null khi dòng trọng số `applicable=false` hoặc không có dòng.
  - `buildTimeDomain`: hàng có ngày từ `'2025-12-15'` tới `'2026-09-29'`, today `'2026-09-16'` → `from` = `'2025-12-01'`, `to` = `'2026-09-30'`, `ticks[0]` = `{date:'2025-12-01',label:null}`, `ticks[1].label` = `'01/26'`. Mọi ngày null → `null`. Today sau mọi ngày (`'2026-11-05'`) → `to` = `'2026-11-30'`.
  - `xOf`: `from` → `x0`, `to` → `x0+width`.
  - `stageMarkers`: có `actualFinish` thì không có `forecastDate`; ngày null bị bỏ.
- [ ] **Bước 2: `src/lib/stage-timeline.ts`**

```ts
import { daysBetween, endOfMonth, type IsoDate } from '@/lib/clock';
import { STAGE_ORDER } from '@/lib/stages';
import { monthTicks, type MonthTick } from '@/lib/time-axis';
import type { ProjectStageWeight, StageCode, StageMilestoneView } from '@/server/repo/types';

export interface StageTimelineRow {
  stageCode: StageCode;
  weightPct: number | null;          // null = không áp dụng / chưa có trọng số
  plannedStart: IsoDate | null;
  plannedFinish: IsoDate | null;
  actualStart: IsoDate | null;
  actualFinish: IsoDate | null;
  forecastDate: IsoDate | null;
  dayVariance: number | null;        // Q1 Run 1 + Q5 mặc định (a)
}

export function buildStageTimelineRows(ms: StageMilestoneView[], weights: ProjectStageWeight[]): StageTimelineRow[] {
  return STAGE_ORDER.flatMap((code) => {
    const m = ms.find((x) => x.stageCode === code);
    if (!m) return [];
    const w = weights.find((x) => x.stageCode === code);
    return [{
      stageCode: code, weightPct: w && w.applicable ? w.weightPct : null,
      plannedStart: m.plannedStart, plannedFinish: m.plannedFinish,
      actualStart: m.actualStart, actualFinish: m.actualFinish, forecastDate: m.forecastDate,
      dayVariance: m.dayVariance,
    }];
  });
}

export interface TimeDomain { from: IsoDate; to: IsoDate; ticks: MonthTick[] }

/** Trục = ngày 1 của tháng sớm nhất → ngày cuối của tháng muộn nhất (gồm cả hôm nay). */
export function buildTimeDomain(rows: StageTimelineRow[], today: IsoDate): TimeDomain | null {
  const dates = rows.flatMap((r) => [r.plannedStart, r.plannedFinish, r.actualStart, r.actualFinish, r.forecastDate])
    .filter((d): d is IsoDate => !!d);
  if (!dates.length) return null;
  const all = [...dates, today].sort();
  const from = `${all[0].slice(0, 7)}-01`;
  const to = endOfMonth(all[all.length - 1].slice(0, 7));
  return { from, to, ticks: monthTicks(from, to) };
}

export function xOf(date: IsoDate, d: TimeDomain, x0: number, width: number): number {
  return x0 + width * (daysBetween(d.from, date) / Math.max(1, daysBetween(d.from, d.to)));
}

export type StageMarkerKey = 'plannedStart' | 'plannedFinish' | 'actualStart' | 'actualFinish' | 'forecastDate';
export type StageMarkerShape = 'ring' | 'dot' | 'diamondO' | 'diamond' | 'tri';

/** 5 mốc + hình + màu theo MS_KEYS mock-up dòng 1380-1384. */
export const STAGE_MARKERS: { key: StageMarkerKey; lane: 'plan' | 'actual'; color: string; shape: StageMarkerShape; labelKey: string }[] = [
  { key: 'plannedStart', lane: 'plan', color: 'var(--s-plan)', shape: 'ring', labelKey: 'detail.stageMs.plannedStart' },
  { key: 'plannedFinish', lane: 'plan', color: 'var(--s-actual)', shape: 'dot', labelKey: 'detail.stageMs.plannedFinish' },
  { key: 'actualStart', lane: 'actual', color: 'var(--s-third-lt)', shape: 'diamondO', labelKey: 'detail.stageMs.actualStart' },
  { key: 'actualFinish', lane: 'actual', color: 'var(--s-third)', shape: 'diamond', labelKey: 'detail.stageMs.actualFinish' },
  { key: 'forecastDate', lane: 'actual', color: 'var(--s-cost)', shape: 'tri', labelKey: 'detail.stageMs.forecast' },
];

/** Mốc cần vẽ: bỏ ngày null; bỏ "dự kiến" khi đã có ngày TT HT (mock-up dòng 1451). */
export function stageMarkers(r: StageTimelineRow) {
  return STAGE_MARKERS.filter((m) => r[m.key] != null && !(m.key === 'forecastDate' && r.actualFinish));
}
```

- [ ] **Bước 3: `src/components/project/stageText.ts`**

```ts
type T = (key: string, values?: Record<string, string | number>) => string;
/** Q5 (a): dayVariance > 0 = trễ → "+N ngày"; null → "-". */
export function varianceText(t: T, v: number | null): string {
  return v == null ? '-' : t('detail.stageMs.days', { n: v > 0 ? `+${v}` : String(v) });
}
export function varianceColor(v: number | null, fallback: string): string {
  return v != null && v > 0 ? 'var(--danger)' : fallback;
}
```

- [ ] **Bước 4: `src/components/project/StageTimelineChart.tsx`** (`'use client'`). Port `renderMilestones` + `mark()` ở mock-up dòng 1385-1395, 1416-1470:
  - Props: `{ rows: StageTimelineRow[]; today: IsoDate; selected: StageCode | null; onToggle: (c: StageCode) => void }`.
  - Hằng số: `W=1000, ROW_H=54, MT=56, MB=16, ML=212, MR=132, IW=W-ML-MR, BH=9`. `dom = buildTimeDomain(rows, today)`; null → `<p className="empty">{t('detail.stageMs.empty')}</p>`. `X = (d) => xOf(d, dom, ML, IW)`. `H = MT + rows.length*ROW_H + MB`. `tx = X(today)`.
  - Nội dung SVG theo thứ tự:
    1. Mỗi tick: vạch dọc `MT-12 → MT+n*ROW_H`, màu `--grid`; nếu `label` thì chữ ở `y=MT-19`, fontSize 11, fontWeight 700, màu `--axis`, middle.
    2. Vạch hôm nay `tx, 19 → MT+n*ROW_H+4`, width 2, dash `6 5`, `--danger`. Viên `rect tx-36,1,72×20,rx10` màu `--danger`. Chữ `t('common.today')` ở `y=14.5`, fontSize 10.5, fontWeight 800, `fill="white"`.
    3. Chữ `t('detail.stageMs.varianceCol')` ở `(W-6, MT-19)`, end, fontSize 9.5, fontWeight 800, `--label3`.
    4. Mỗi hàng i (`top=MT+i*ROW_H`, `cy=top+ROW_H/2`, `pY=cy-13`, `aY=cy+4`, `on = selected===r.stageCode`, `aEnd = r.actualFinish ?? r.forecastDate`):
       - `on` → `rect 2, top+3, W-4 × ROW_H-6, rx 10, strokeWidth 1.2`, `style={{ fill:'var(--accent-tint)', stroke:'var(--accent)' }}`.
       - i>0: đường kẻ `--grid` tại `top`.
       - Tên `t(stageKey[r.stageCode])` ở `(8, cy+5)`, fontSize 14, fontWeight 700, màu `on ? --accent : --label`. Trọng số `r.weightPct==null ? '-' : `${r.weightPct}%`` ở `(196, cy+5)`, end, fontSize 11, fontWeight 800, `--label3`.
       - Thanh KH (nếu có cả BĐ và HT KH): `rect X(ps), pY, width max(X(pf)-X(ps),3), height BH, rx 4.5, fillOpacity .55`, `--s-plan`.
       - Thanh TT (nếu có `actualStart` và `aEnd`): `rect X(as), aY, width max(X(aEnd)-X(as),3), BH, rx 4.5, fillOpacity .42`, màu `r.actualFinish ? --s-third : --s-cost`.
       - `stageMarkers(r)` → `<Marker shape x={X(r[m.key]!)} y={(m.lane==='plan'?pY:aY)+BH/2} color={m.color} />`.
       - Chênh lệch ở `(W-6, cy+5)`, end, fontSize 13.5, fontWeight 800, fill `varianceColor(r.dayVariance,'var(--label)')`, text `varianceText(t, r.dayVariance)`.
       - Rect bắt chuột `0, top, W × ROW_H`, `fill="transparent"`, `style={{ cursor:'pointer' }}`, `onClick={() => onToggle(r.stageCode)}`. Tooltip: tiêu đề `r.weightPct==null ? tên : `${tên} · ${t('detail.stageMs.weight', { n: r.weightPct })}``, 5 dòng `STAGE_MARKERS.map(m => ({ k: t(m.labelKey), v: formatDateShort(r[m.key]), color: m.color }))` + dòng `{ k: t('detail.stageMs.variance'), v: varianceText(…), valueColor: varianceColor(…,'var(--label)') }`. `onMouseLeave={hide}`.
  - `Marker` (component trong cùng file):
    - `ring`: `circle r 5.4, strokeWidth 2.4`, fill `--glass-3`, stroke `color`.
    - `dot`: `circle r 5.6, strokeWidth 1.6`, fill `color`, stroke `--glass-3`.
    - `diamondO`: `rect x-4.9, y-4.9, 9.8×9.8, rx 1, strokeWidth 2.2, transform rotate(45 x y)`, fill `--glass-3`, stroke `color`.
    - `diamond`: `rect x-5, y-5, 10×10, rx 1, strokeWidth 1.4, rotate`, fill `color`, stroke `--glass-3`.
    - `tri`: `path M x y-6 L x+5.5 y+4.5 L x-5.5 y+4.5 Z, strokeWidth 1.3, strokeLinejoin round`, fill `color`, stroke `--glass-3`.

    Màu đặt qua `style` (Global Constraint 6).
  - Sau `</svg>` render `<ChartTip tip={tip} />`.
- [ ] **Bước 5: `src/components/project/StageExplorer.tsx`** (`'use client'`)

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { StageCode } from '@/server/repo/types';
import type { IsoDate } from '@/lib/clock';
import { stageKey } from '@/lib/labels';
import { formatDateShort } from '@/lib/format';
import { STAGE_MARKERS, type StageTimelineRow } from '@/lib/stage-timeline';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Legend } from '@/components/ui/Legend';
import { StageTimelineChart } from './StageTimelineChart';
import { varianceColor, varianceText } from './stageText';

/** Thẻ "Timeline của 7 giai đoạn" (mock-up dòng 710-714). Task 10 thêm thẻ "Biểu đồ so sánh" dùng chung `selected`. */
export function StageExplorer({ rows, today }: { rows: StageTimelineRow[]; today: IsoDate; locale: string }) {
  const t = useTranslations();
  const [selected, setSelected] = useState<StageCode | null>(null);
  const toggle = (c: StageCode) => setSelected((s) => (s === c ? null : c));
  const sel = rows.find((r) => r.stageCode === selected) ?? null;
  return (
    <>
      <Card>
        <CardHeader
          title={t('detail.stageMs.title')}
          action={<Legend items={[
            ...STAGE_MARKERS.map((m) => ({ label: t(m.labelKey), color: m.color, shape: m.shape })),
            { label: t('common.today'), color: 'var(--danger)', line: true },
          ]} />}
        />
        <div className="msdetail">
          {sel ? (
            <>
              <span style={{ fontWeight: 750, color: 'var(--label)' }}>{t(stageKey[sel.stageCode])}</span>
              {STAGE_MARKERS.map((m) => (
                <span key={m.key} className="k"><i style={{ background: m.color }} />{t(m.labelKey)} <b>{formatDateShort(sel[m.key])}</b></span>
              ))}
              <span className="k">
                <i style={{ background: varianceColor(sel.dayVariance, 'var(--label3)') }} />{t('detail.stageMs.variance')}{' '}
                <b style={{ color: varianceColor(sel.dayVariance, 'var(--label)') }}>{varianceText(t, sel.dayVariance)}</b>
              </span>
            </>
          ) : (
            <span className="hint">{t('detail.stageMs.hint')}</span>
          )}
        </div>
        <CardBody>
          {rows.length ? <StageTimelineChart rows={rows} today={today} selected={selected} onToggle={toggle} /> : <p className="empty">{t('detail.stageMs.empty')}</p>}
        </CardBody>
      </Card>
    </>
  );
}
```

(`locale` chưa dùng ở Task 9. Khai báo sẵn để Task 10 không phải đổi chữ ký; nếu lint báo biến thừa thì destructure khi Task 10 cần.)
- [ ] **Bước 6: Test `StageExplorer.test.ts`.** Mock `next-intl` như Task 4; `vi.mock('@/server/repo', …mock-repo)`. `rows = buildStageTimelineRows(repo.getStageMilestones(1), repo.getStageWeights(1))`, `today = '2026-09-16'`. Assert:
  - Có đủ 7 chuỗi `stage.design` … `stage.handover`.
  - Có `detail.stageMs.hint`.
  - `detail.stageMs.days|0` xuất hiện đúng 3 lần (seed: design/shop/procurement xong đúng hạn, `src/data/seed/history.ts:325`).
  - `rows = []` → có `detail.stageMs.empty`.
- [ ] **Bước 7: i18n** vào `"detail"`:
  - vi: `"stageMs": { "title": "Timeline của 7 giai đoạn", "plannedStart": "Ngày BĐ KH", "plannedFinish": "Ngày HT KH", "actualStart": "Ngày TT BĐ", "actualFinish": "Ngày TT HT", "forecast": "Ngày dự kiến", "variance": "Chênh lệch", "varianceCol": "CHÊNH LỆCH", "days": "{n} ngày", "weight": "trọng số {n}%", "hint": "Bấm vào một giai đoạn để xem đầy đủ 6 mốc ngày · rê chuột lên từng hàng để xem nhanh", "empty": "Chưa có mốc ngày của các giai đoạn" }`
  - en: `"stageMs": { "title": "7-stage timeline", "plannedStart": "Planned start", "plannedFinish": "Planned finish", "actualStart": "Actual start", "actualFinish": "Actual finish", "forecast": "Forecast", "variance": "Variance", "varianceCol": "VARIANCE", "days": "{n} days", "weight": "weight {n}%", "hint": "Click a stage to see all 6 dates · hover a row for a quick look", "empty": "No stage dates yet" }`

  Thêm `'StageExplorer': 'src/components/project/StageExplorer.tsx'`, `'StageTimelineChart': 'src/components/project/StageTimelineChart.tsx'`, `'stageText': 'src/components/project/stageText.ts'` vào `CHANGED_SOURCES`.
- [ ] **Bước 8: Nối vào page.** Thêm dynamic `StageExplorer`; import `buildStageTimelineRows` từ `@/lib/stage-timeline`. Dữ liệu: `const stageRows = buildStageTimelineRows(await repo.getStageMilestones(id), await repo.getStageWeights(id));`. Chèn ngay SAU `</div>` đóng `g2` "Value chain + EVM" (dòng 227 gốc): `<StageExplorer rows={stageRows} today={today} locale={locale} />`.
- [ ] **Bước 9:** `npx tsc --noEmit`, `npm test`. Kiểm mắt: 7 hàng, 5 loại mốc đúng hình, bấm hàng thì hàng sáng lên + dải `msdetail` hiện 6 chip, bấm lại thì bỏ chọn, tooltip đúng.
- [ ] **Bước 10:** `git commit -m "feat(parity): timeline 7 giai doan + chon giai doan"`

---

### Task 10: "Biểu đồ so sánh theo hạng mục" (`cmpChart`)

**Files:**
- Create: `src/components/project/WorkItemCompareChart.tsx`
- Modify: `src/lib/stage-timeline.ts`, `src/server/project-queries.ts` (+test), `src/components/project/StageExplorer.tsx` (+test), `page.tsx`, `vi.json`/`en.json`, `messages.test.ts`

**Interfaces:**
- Consumes `StageExplorer` + `selected` (Task 9), `Legend` (Task 2), `useChartTokens`, `TOOLTIP_STYLE`.
- Produces `WorkItemCompareRow = { workItemId: number; name: string; planned: number; actual: number }`, `WorkItemCompare = Partial<Record<StageCode, WorkItemCompareRow[]>>` (ở `stage-timeline.ts`), `getWorkItemComparison(projectId, yearMonth): Promise<WorkItemCompare>`, prop mới `StageExplorer.compare: WorkItemCompare`.

- [ ] **Bước 1:** thêm 2 kiểu trên vào `stage-timeline.ts`.
- [ ] **Bước 2: Test đỏ** trong `project-queries.test.ts`:
  - `getWorkItemComparison(1, MONTH)`: `fabrication` dài 10 phần tử, `fabrication[0]` = `{ workItemId: 1, name: 'Hệ giàn nâng', planned: 4828, actual: 3814 }` (seed `history.ts:357-377`: 26822×0.18 → 4828; tỷ lệ 1.15−3×0.12 = 0.79 → 3814); `shop` dài 10; `design` và `handover` là `undefined`.
  - `(17, MONTH)` → `{}`.
  - `(1, 'abc')` → không throw.
- [ ] **Bước 3: Viết query** trong `project-queries.ts` (import `STAGE_CALC_MODE, STAGE_ORDER` từ `@/lib/stages`, type `WorkItemCompare` và `WorkItemCompareRow` từ `@/lib/stage-timeline`):

```ts
/** KH/TT (tấn) theo hạng mục cho từng giai đoạn ĐỊNH LƯỢNG của tháng (mock-up dòng 716-720, 1474-1506). */
export async function getWorkItemComparison(projectId: number, yearMonth: string): Promise<WorkItemCompare> {
  const ym = isValidYearMonth(yearMonth) ? yearMonth : currentMonth();
  const items = await repo.getWorkItems(projectId);
  const facts = await repo.getWorkItemFacts(projectId, ym);
  const out: WorkItemCompare = {};
  for (const stage of STAGE_ORDER) {
    if (STAGE_CALC_MODE[stage] !== 'volume') continue;
    const rows: WorkItemCompareRow[] = items.flatMap((wi) => {
      const fs = facts.filter((f) => f.stageCode === stage && f.workItemId === wi.id);
      if (!fs.length) return [];
      return [{ workItemId: wi.id, name: wi.name, planned: fs.reduce((s, f) => s + f.qtyPlan, 0), actual: fs.reduce((s, f) => s + f.qtyActual, 0) }];
    });
    if (rows.length) out[stage] = rows;
  }
  return out;
}
```

- [ ] **Bước 4: `WorkItemCompareChart.tsx`** (`'use client'`, Recharts, mẫu `ManpowerDailyChart.tsx`):
  - Props `{ rows: WorkItemCompareRow[]; locale: string }`. Dùng `useTranslations()`, `const c = useChartTokens()`. `nf` = `Intl.NumberFormat(vi-VN|en-US, { maximumFractionDigits: 0 })`. `data = rows.map((r) => ({ ...r, short: r.name.length > 19 ? `${r.name.slice(0, 18)}…` : r.name }))`.
  - Markup:

```tsx
    <div>
      <div className="hintline">{t('detail.cmp.unit')}</div>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 18, right: 10, left: 0, bottom: 0 }} barGap={3} barCategoryGap="17%">
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="short" interval={0} angle={-38} textAnchor="end" height={92} tick={{ fontSize: 10, fill: c.label2 }} tickLine={false} axisLine={{ stroke: c.grid }} />
          <YAxis width={48} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} tickFormatter={(v: number) => nf(v)} />
          <Tooltip cursor={{ fill: c.grid }} content={({ active, payload }) => <CompareTip active={active} row={payload?.[0]?.payload as WorkItemCompareRow | undefined} nf={nf} />} />
          <Bar dataKey="planned" name={t('detail.planned')} fill={c.plan} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="planned" position="top" fontSize={9} fontWeight={700} fill={c.label2} formatter={(v: unknown) => nf(Number(v))} />
          </Bar>
          <Bar dataKey="actual" name={t('detail.actual')} fill={c.actual} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="actual" position="top" fontSize={9} fontWeight={700} fill={c.actual} formatter={(v: unknown) => nf(Number(v))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
```

  - `CompareTip` (trong cùng file, dùng `useTranslations`): `!active || !row` → `null`. Ngược lại `<div style={TOOLTIP_STYLE.contentStyle}>` gồm:
    - `<div style={TOOLTIP_STYLE.labelStyle}>{row.name}</div>`
    - 4 dòng, mỗi dòng `<div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, color: 'var(--label2)' }}>`: KH `nf(planned) + ' ' + unit` · TT · Chênh lệch `nf(actual-planned)` với giá trị màu `var(--danger)` · `% HT` (1 chữ số thập phân; `planned=0` → `-`).
    - Nhãn dòng: `t('detail.planned')`, `t('detail.actual')`, `t('detail.cmp.diff')`, `t('detail.cmp.pct')`.
- [ ] **Bước 5: `StageExplorer.tsx`.** Thêm prop `compare: WorkItemCompare` (và dùng `locale`). Thêm Card thứ 2 ngay sau Card timeline, bên trong fragment:

```tsx
      <Card>
        <CardHeader
          title={`${t('detail.cmp.title')} -`}
          titleExtra={<span style={{ color: 'var(--accent)' }}>{t(stageKey[cmpStage])}{selected ? '' : ` ${t('detail.cmp.default')}`}</span>}
          action={<Legend items={[{ label: t('detail.cmp.planTon'), color: 'var(--s-plan)' }, { label: t('detail.cmp.actualTon'), color: 'var(--s-actual)' }]} />}
        />
        <CardBody>
          {STAGE_CALC_MODE[cmpStage] === 'manual' ? (
            <p className="empty">{t('detail.cmp.manualStage')}</p>
          ) : cmpRows.length ? (
            <WorkItemCompareChart rows={cmpRows} locale={locale} />
          ) : (
            <p className="empty">{t('detail.cmp.empty')}</p>
          )}
        </CardBody>
      </Card>
```

với `const cmpStage: StageCode = selected ?? 'fabrication';` (mặc định "Gia công", mock-up dòng 1475-1477) và `const cmpRows = compare[cmpStage] ?? [];`. Import `STAGE_CALC_MODE` từ `@/lib/stages`, `WorkItemCompareChart`, type `WorkItemCompare`.
- [ ] **Bước 6: Test** (thêm vào `StageExplorer.test.ts`): truyền `compare = await getWorkItemComparison(1, '2026-09')` (import từ `@/server/project-queries`, repo đã mock) → output có `detail.cmp.title`, `stage.fabrication`, `detail.cmp.default`. Truyền `compare = {}` → có `detail.cmp.empty`.
- [ ] **Bước 7: i18n** vào `"detail"`:
  - vi: `"cmp": { "title": "Biểu đồ so sánh", "default": "(mặc định)", "planTon": "Kế hoạch (tấn)", "actualTon": "Thực tế (tấn)", "unit": "tấn", "diff": "Chênh lệch", "pct": "% HT", "manualStage": "Giai đoạn này nhập tay %, không có sản lượng theo hạng mục", "empty": "Chưa có sản lượng hạng mục của tháng này" }`
  - en: `"cmp": { "title": "Comparison", "default": "(default)", "planTon": "Plan (t)", "actualTon": "Actual (t)", "unit": "t", "diff": "Difference", "pct": "% done", "manualStage": "This stage is entered as %, no per-item quantities", "empty": "No item quantities for this month" }`

  Thêm `'WorkItemCompareChart': 'src/components/project/WorkItemCompareChart.tsx'` vào `CHANGED_SOURCES`.
- [ ] **Bước 8: Nối vào page.** Import `getWorkItemComparison`; `const compare = await getWorkItemComparison(id, month);`; đổi dòng Task 9 thành `<StageExplorer rows={stageRows} compare={compare} today={today} locale={locale} />`.
- [ ] **Bước 9: Cổng cuối Đợt 2:** `npx tsc --noEmit`, `npm test` (≥ 548 + số test mới, không test nào đỏ), `npm run build` sạch. Kiểm mắt TOÀN trang `/vi/projects/1`, `/en/projects/1` và `/vi/projects/17` ở 390px, 1366px, 1920px, cả sáng lẫn tối. Bấm chọn "Lắp dựng" thì biểu đồ so sánh đổi theo; bấm "Thiết kế" thì hiện chữ "nhập tay"; bỏ chọn thì quay về "Gia công (mặc định)".
- [ ] **Bước 10:** `git commit -m "feat(parity): bieu do so sanh khoi luong theo hang muc cho giai doan dang chon"`

---

## Bảng phủ phạm vi (tự rà)

| Hạng mục chốt (`PROGRESS.md` mục 3) | Task |
|---|---|
| 1. Đồng hồ đếm ngược + Timeline KH/TT dạng thanh | 3, 2 |
| 2. Đủ 3 tag "Trọng tâm" (soát cả /overview, /report) | 1 + Q2 |
| 3. Tracking huy động 7 ngày, 3 tab | 5 |
| 4. Các mốc chính: biểu đồ (chi tiết) + bước sửa trong form | 6 (biểu đồ), 7 (ghi), 8 (form) |
| 5. `msChart` + `cmpChart` + `manChart`/`eqpChart` | 9, 10, 4 |
| 6. Rà soát form Tạo/Sửa | Q7 (G-1…G-20, chờ chủ dự án chọn) |

Thứ tự phụ thuộc: 1 → 2 (Legend, `today`) → 3 → 4 (ChartTip, motion, titleExtra, resources) → 5 (HelpTip, format) → 6 (time-axis, key-milestones) → 7 → 8 → 9 → 10. Làm tuần tự, không song song.
