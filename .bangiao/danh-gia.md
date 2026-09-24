PHAN QUYET: CHOT

# Đánh giá cuối P2B — Biểu đồ & hiệu năng (nhánh `feature/p2b-bieu-do`)

> Nội dung do subagent reviewer (vai chỉ đọc) trả về; điều phối viên lưu nguyên văn vào file này.

Skill đã dùng: `ddc-tower:code-review`.

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
- `vi.json`/`en.json`: giữ đủ **5** nhóm `contractorJoin`, `dailyEntry`, `manpowerCharts`, `equipmentGantt`, `valueChainCard` — cả hai bên cùng thêm ở cuối nên chắc chắn conflict ở đuôi: nối đủ, kiểm dấu phẩy/ngoặc JSON, chạy test i18n phủ key.
- Schema P2A thêm bảng/cột → `docs.test.ts`, `erd-doc.test.ts` sẽ đỏ: bổ sung `TABLE_DOCS`/`ERD_LAYOUT` trong `src/lib/schema-meta/docs.ts`, chạy `npm run docs:erd`; sửa mô tả `docs.ts:105` (`'afternoon'` → A đổi sang `evening`).
- Sau merge: `prisma migrate deploy` + `generate` + `npm test` + `npm run check:read`, so KPI/donut/S-curve `/vi/overview` bằng mắt; mở `/vi/projects/1` kiểm thẻ "Chuỗi giá trị" và wizard nhập liệu (thanh `.stage .fill`).

**Bảo mật script dev** (vá trước lần `perf:seed` kế tiếp): L-1 host loopback + `PERF_CONFIRM`; L-2 `AND "createdBy"='perf-seed'`; L-3 `PERF_BASE` chỉ localhost.

**Hiệu năng T1:** đo lại có kiểm soát ở Bước 11 theo `hieu-nang.md` mục 4b; quyết định index sau khi P2A nhả khoá `schema.prisma`.

**Việc nhỏ khác:** tooltip "Tổng TT" (`WeeklyManpowerStackChart.tsx:142`) nên hiện `w.actualAvg`; dọn `detail.manpowerTrend` + `detail.evmMetrics` sau khi P2A merge; `/overview` gọi `getProjectSummaries` 6–8 lần/lượt render → cân nhắc `React.cache()` nếu đo lại cần; `.stagesub` xuống dòng ở 390px (`app/globals.css:480`); ghi chú có từ trước N-1/N-2/N-3 + thiếu key `admin.delete` chờ chủ dự án.

## Kết luận
CHỐT. 4 mục CẦN SỬA vòng 1 xong đúng tiêu chí; tsc sạch, 1110/1110 xanh; không có thay đổi ngoài phạm vi, file cấm không đổi. Merge `main` chờ chủ dự án đồng ý; trước merge chuyển hồ sơ `.bangiao/` vào `.bangiao/archive/p2b-bieu-do-<yyyy-mm-dd>/` và làm theo checklist merge ở trên.
