PHAN QUYET: CHOT

# Đánh giá cuối P2B — Biểu đồ & hiệu năng (nhánh `feature/p2b-bieu-do`)

> Nội dung do subagent reviewer (vai chỉ đọc) trả về; điều phối viên lưu vào file này.

Skill đã dùng: `ddc-tower:code-review`.

## Vòng bổ sung — KPI (yêu cầu chủ dự án sau khi CHỐT vòng 2; diff `f9934a4..HEAD`: `a09b56e`, `7a28268`, `3d24821`, `dabd1c6`, `c0f7e01`, `ae5a74f`, `30d0756`)

### Cổng kiểm (reviewer tự chạy lại qua PowerShell)
- `npx tsc --noEmit`: sạch. `npm test`: **97/97 file, 1126/1126 xanh**.
- File cấm (`prisma/`, `actions.ts`, `prisma-repo.ts`, `queries.ts`, `project-queries.ts`, `PROGRESS.md`, `.serena/`): **không đổi**.
- Trùng với nhánh A: chỉ hồ sơ `.bangiao/*.md` (luật archive) và đuôi `vi.json`/`en.json` (đã biết). A không đụng `globals.css`, `tokens.css`, `KpiCard.tsx`, `OverviewWidgets.tsx`, `report/page.tsx`, `projects/[id]/page.tsx`. Key động `kpiSchedule.${direction}` có đủ 3 key ở cả vi/en nên test i18n của A không đỏ sau merge.

### 3 yêu cầu — đối chiếu
1. **Bỏ chữ "Trọng tâm" — ĐẠT.** Xoá prop `heroTagLabel` + span `.tag`; bỏ ở 5 chỗ gọi (`projects/[id]/page.tsx:208-210`, `report/page.tsx:51`, `OverviewWidgets.tsx:58`); gỡ CSS `.kpi.key .tag` + `@container` chết; nền gradient hero giữ nguyên. Key `kpi.focusTag` thừa để dọn sau.
2. **Dòng chậm/nhanh dưới thẻ %TT — ĐẠT, đúng định nghĩa đã chốt.** `schedule-gap.ts:52-69`: `gapPct = pctActual − pctPlan`, `gapDays = Math.round(gapPct × planDays)`; `pctPlan` = %KH theo thời gian (`queries.ts:73`); `planDays` cùng cách `evm.ts:66`; `null` khi thiếu số liệu/`planDays ≤ 0`. Dự án 1: "▼ Chậm 56 ngày · −19,3%" — tester tính tay độc lập từ DB B khớp (283/288 ngày). Màu behind `--gold`, ahead `--mint`, onTrack kế thừa `.sb`.
3. **Nhãn scorecard hiện đủ chữ — ĐẠT.** `globals.css:249-251` `.kpi .lb` bỏ nowrap/ellipsis, `line-height:1.3` + `min-height` 2 dòng; ảnh 390px: "TỔNG SỐ NHÂN LỰC/THIẾT BỊ" đủ 2 dòng, số chính thẳng hàng, chữ không chui dưới icon.

### Kiểm thêm
- Token `--mint` (`tokens.css:61`) đúng quy ước (cạnh `--gold`, không hex thô trong `.tsx`). [nit] `#30d158` là systemGreen chứ không phải systemMint.
- CSS `.kpi .lb` chỉ ảnh hưởng nơi render qua `KpiCard` (overview/KpiGrid, BacklogOverdueCard, report, projects/[id]); không vỡ. Mọi thẻ cao thêm ~1 dòng caption2 — đánh đổi có chủ đích. [nit] skeleton `overview/page.tsx:33` (`height: 96`) thấp hơn thẻ thật.

### Test
- `schedule-gap.test.ts` 13 ca có giá trị thật; `KpiCard.test.ts` behind/ahead kiểm màu; test render trang khoá việc gỡ tag.

### Tính đúng / thẩm mỹ
- [important, thẩm mỹ] Ở lưới 6 cột, dòng chậm/nhanh tách "−19,3%" + `.sb` rỗng phía trên chiếm 1 dòng trống. **→ ĐÃ SỬA bởi điều phối viên ở `dc4e425`**: không render `.sb` rỗng khi có `scheduleGap`; dòng chậm/nhanh xếp cố định 2 dòng "▼ Chậm 56 ngày" / "−19,3%", mỗi dòng nowrap; thêm 2 test khoá (không có `<span>-</span>`, chỉ 1 `.sb`; có `sub` thì vẫn 2 `.sb`) + ca `onTrack` assert không có màu inline. Ảnh `kpi-v3-1440-projects1-row.png`, `kpi-v3-390-projects1-row.png`. tsc sạch, **1128/1128** xanh.
- [nit] Trùng tên `calcScheduleGap` (`evm.ts:81`, `schedule-gap.ts:52`) + `toDate` chép lại — gộp khi dọn.
- [nit] Dự án > ~1000 ngày KH có thể ra "Chậm 1 ngày · −0,0%".
- Nhánh ahead/onTrack chưa có ảnh dữ liệu thật (seed không có dự án nhanh), chỉ unit test.

### Kết luận vòng bổ sung
ĐẠT cả 3 yêu cầu; không mục nào chặn merge.

## Vòng 2 (kiểm lại sau vòng sửa 1 — diff `fa2b261..HEAD`, toàn phase `10cda5a..HEAD`)

### Cổng kiểm (reviewer tự chạy lại qua PowerShell, `D:\_project\DDC_Control_Tower-B`)
- `npx tsc --noEmit`: sạch (exit 0).
- `npm test`: **96 file, 1110/1110 xanh** (exit 0).
- File cấm, xét trên toàn phase `10cda5a..HEAD`:
  - `prisma/`, `src/server/actions.ts`, `src/server/repo/prisma-repo.ts`, `src/server/project-queries.ts`, `PROGRESS.md`, `.serena/`: **không đổi**.
  - `src/server/queries.ts` (refactor T1) và `package.json` (script `perf:*`) đã được duyệt ở vòng 1. Vòng sửa `fa2b261..HEAD` không đụng 2 file đó.
  - `package-lock.json`: không đổi.
- File nóng vòng này:
  - `app/globals.css`: 2 commit `cdd5733`, `4024dd2`. `phien-A.md` ghi A "KHÔNG đụng `globals.css`", nên không có xung đột giữ file.
  - `vi.json`/`en.json`: chỉ thêm nhóm `valueChainCard` ở cuối file, đúng luật.

### 4 mục CẦN SỬA vòng 1 — đối chiếu tiêu chí
1. **Chart tuần giữ nhà thầu đã tắt** — `src/server/manpower-queries.ts:48-51`. **ĐẠT.**
   - `contractors` dựng từ key của `totalActual`; tên tra qua `nameById`, không có thì `#<id>`; sort theo tổng actual giảm dần.
   - Test mới trong `manpower-queries.test.ts` spy `getContractors` trả thiếu đúng 1 id có dữ liệu; chạy trên code cũ sẽ fail.
2. **Gantt đọc usage toàn bộ ngày dự án** — `src/server/equipment-gantt-queries.ts:9-21`. **ĐẠT.**
   - Gọi `readEquipmentUsageDays(projectId, '0001-01-01', '9999-12-31')`; SQL `read-prisma.ts:69-76` vẫn bind `::date` và lọc `projectId`. `buildGantt` không đổi.
   - Test mới mô phỏng đúng cách repo lọc `from`/`to`: ngày trước plan được đếm (`unplannedUsage=2`), `planFrom`/`planTo` không đổi. Code cũ sẽ fail.
3. **Kết luận hiệu năng T1** — `.bangiao/hieu-nang.md`, `.bangiao/thay-doi.md` "Lệch kế hoạch" số 3. **ĐẠT.**
   - Không còn câu "tiêu chí nghiệm thu T1 đạt"/"steady state"; có mục "4b. Chưa kết luận, chờ đo lại ở Bước 11" kèm quy trình (c); nêu cache `loadSpiCpiTrend`/`loadSCurve` không khoá theo `month`; ghi đúng 1/12 request vượt mốc, median 1789 / max 2384 ms.
4. **Thẻ "Chuỗi giá trị" theo mock-up** — `app/[locale]/(app)/projects/[id]/page.tsx:263-311, 570-583`, `src/lib/value-chain-view.ts`, `StageSelectionContext.tsx`, `ValueChainModeChip.tsx`, `StageExplorer.tsx`, `app/globals.css:469,479-480`. **ĐẠT.** Đối chiếu ảnh `v3-desktop-chuoi-gia-tri.png`, `v3-mobile-chuoi-gia-tri.png`, `v3-wizard-stage-fill.png`:
   - (a) Thẻ EVM bỏ hẳn; SPI/CPI vẫn ở KPI (`page.tsx:193-194`). Thẻ rộng hết hàng; 2 cột cố định `VALUE_CHAIN_COLUMNS` render 2 khối `.stagecol` riêng; `%HT` 1 chữ số thập phân; 390px xuống 1 cột, thanh và % hiện đủ.
   - (b) Số tấn `.stagesub` ghim cột 3 dưới thanh; Thiết kế/Nghiệm thu không có dòng này.
   - (c) Dòng chân dùng `validateStageWeights` (lệch 100 tô `var(--warn)`) + `calcChainPctActual` từ `src/lib/stages.ts`; nhất quán với wizard (79,0% vs 78,98%); unit test 4 trường hợp.
   - (d) Chip góc nối `StageExplorer` qua Context; `useStageSelection` gọi `useState` vô điều kiện rồi mới rẽ nhánh (đúng rules of hooks); props `StageExplorer` không đổi; chip "Khâu nghẽn" giữ nguyên, hàng nghẽn tô cam thật (đã kiểm computed style).
   - **Fix `.stage .fill{display:block}`** (`app/globals.css:469`): gốc đúng (`<i>` inline; có tiền lệ `.bar-mini i{display:block}`). Nơi khác duy nhất dùng `.stage` là `DataEntryForm.tsx:512-521` — trước cũng 0×0, giờ hiện đúng %, bố cục không vỡ. `.stagegrid`/`.stage`/`.chainfoot` gốc không đổi.
   - Test render `projects-detail-page-render.test.ts` kiểm thứ tự 2 cột + rule CSS thật từ `globals.css`; đã đỏ trước fix `4024dd2`.

### Dời cụm xuống cuối trang (commit `c61fa61`, yêu cầu chủ dự án) — ĐẠT
- Chỉ di chuyển JSX, nội dung từng khối giống hệt; thứ tự đúng như `thay-doi.md`. `requireProjectRead` vẫn chạy trước mọi đọc; gating `canViewFinance` thẻ Tài chính giữ nguyên (khớp bảo mật V2-1).

### Commit `b8991b4` (phiên khác tạo)
- Không bất thường: chỉ chụp lại 4 ảnh `after-*.png` + 17 dòng `thay-doi.md`, không đụng code; tác giả `hieupt1`, trailer đúng. Tiêu đề "…noi chip StageExplorer" gây hiểu nhầm (việc nối chip ở `cdd5733`); không cần sửa lịch sử.

### Bảo mật / hiệu năng / tính đúng
- Bảo mật vòng 2 ĐẠT, reviewer đồng ý. Không `dangerouslySetInnerHTML`; SQL bind; bỏ EVM giảm dữ liệu hiển thị.
- Hiệu năng: usage Gantt không cắt theo plan nhưng vẫn lọc `projectId` + `GROUP BY` trong 1 dự án — chấp nhận được. `value` của `StageSelectionProvider` tạo mới mỗi render, chỉ 2 consumer — không đáng kể.

### Không chặn merge (ghi nhận)
- 390px: chữ "tấn" của `.stagesub` rớt dòng 2 → có thể đổi `app/globals.css:480` sang `grid-column:1/-1` hoặc `white-space:nowrap` (thẩm mỹ).
- Key `detail.evmMetrics` (`vi.json:176`, `en.json`) không còn dùng — dọn cùng `detail.manpowerTrend` sau khi P2A merge.
- Quy trình: coder vòng sửa 1 dùng `git stash` trần để chụp ảnh "trước" — stash dùng chung giữa worktree, lần sau dùng commit WIP hoặc `git stash push -m <tag>` rồi `apply <sha>`.

## Vòng 1 — tóm tắt (CAN SUA, đã xử lý hết ở vòng 2)
- Cổng kiểm vòng 1: tsc sạch, 1088/1088 xanh. Refactor `queries.ts` đúng ngữ nghĩa. i18n `manpowerCharts`/`equipmentGantt` đúng luật. Bảo mật ĐẠT (L-1/L-2/L-3 thấp, script dev).
- 4 mục CẦN SỬA: (1) chart tuần mất nhà thầu đã tắt → `710abab`; (2) chú thích Gantt đếm thiếu, lệch Q1 → `f794113`; (3) kết luận hiệu năng T1 quá bằng chứng → `c59716f`; (4) thẻ "Chuỗi giá trị" theo mock-up (yêu cầu chủ dự án) → `cdd5733`, `c61fa61`, `b8991b4`, `4024dd2`.

## Để sau (không chặn merge)

**Checklist merge P2A ↔ P2B** (khi `git merge main` sau khi P2A vào `main`):
- `src/server/audit-log-page.ts` chắc chắn conflict: A thêm `note: a.note` vào phần map mà B đã chuyển sang `read-prisma.ts:166-175` (`readAuditLogPage`) → đưa `note` vào `readAuditLogPage` (+ `read-mock.ts`).
- `src/server/repo/mock-repo.ts` cuối file: A đổi thành `const coreRepo = {…}` + `export const repo = { ...coreRepo, ...makeEntryMockRepo(...) }`; B thêm `Object.assign(repo, createReadMock(getData))` → giữ dòng của B sau dòng export của A.
- `vi.json`/`en.json`: giữ đủ **6** nhóm `contractorJoin`, `dailyEntry`, `manpowerCharts`, `equipmentGantt`, `valueChainCard`, `kpiSchedule` — cả hai bên cùng thêm ở cuối nên chắc chắn conflict ở đuôi: nối đủ, kiểm dấu phẩy/ngoặc JSON, chạy test i18n phủ key (`src/i18n/messages.test.ts` của A).
- `app/[locale]/(app)/admin/page.tsx`, `package.json` (scripts): cả hai bên đều sửa — gộp giữ phần của cả hai.
- Schema P2A thêm bảng/cột → `docs.test.ts`, `erd-doc.test.ts` sẽ đỏ: bổ sung `TABLE_DOCS`/`ERD_LAYOUT` trong `src/lib/schema-meta/docs.ts`, chạy `npm run docs:erd`; sửa mô tả `docs.ts:105` (`'afternoon'` → A đổi sang `evening`).
- Sau merge: `prisma migrate deploy` + `generate` + `npm test` + `npm run check:read`, so KPI/donut/S-curve `/vi/overview` bằng mắt; mở `/vi/projects/1` kiểm thẻ "Chuỗi giá trị", thẻ %TT có dòng "Chậm/Nhanh N ngày" / "±x,x%", không còn tag "Trọng tâm", và wizard nhập liệu (thanh `.stage .fill`).

**Bảo mật script dev** (vá trước lần `perf:seed` kế tiếp): L-1 host loopback + `PERF_CONFIRM`; L-2 `AND "createdBy"='perf-seed'`; L-3 `PERF_BASE` chỉ localhost.

**Hiệu năng T1:** đo lại có kiểm soát ở Bước 11 theo `hieu-nang.md` mục 4b; quyết định index sau khi P2A nhả khoá `schema.prisma`.

**Vòng bổ sung KPI — việc nhỏ:** test render trang khẳng định thẻ `metric.pctActual` có dòng `kpiSchedule.*`; nâng skeleton KPI `overview/page.tsx:33`; dọn key `kpi.focusTag`; gộp `toDate` + đặt lại tên một trong hai `calcScheduleGap`; chụp ảnh nhánh ahead/onTrack khi có dữ liệu; xác nhận ảnh `.bangiao/anh-test/*.png` không chứa dữ liệu khách hàng thật trước khi push remote.

**Việc nhỏ khác:** tooltip "Tổng TT" (`WeeklyManpowerStackChart.tsx:142`) nên hiện `w.actualAvg`; dọn `detail.manpowerTrend` + `detail.evmMetrics` sau khi P2A merge; `/overview` gọi `getProjectSummaries` 6–8 lần/lượt render → cân nhắc `React.cache()` nếu đo lại cần; `.stagesub` xuống dòng ở 390px (`app/globals.css:480`); ghi chú có từ trước N-1/N-2/N-3 + thiếu key `admin.delete` chờ chủ dự án.

## Kết luận
CHỐT (toàn phase, sau vòng bổ sung KPI + sửa thẩm mỹ `dc4e425`). Cổng kiểm xanh (tsc sạch, 1128/1128); file cấm không đổi; không trùng file mới với nhánh A ngoài i18n đuôi file. Merge `main`: **A merge P2A trước, B gộp `main` về theo checklist trên rồi mới merge P2B**; trước merge chuyển hồ sơ `.bangiao/` vào `.bangiao/archive/p2b-bieu-do-<yyyy-mm-dd>/`.
