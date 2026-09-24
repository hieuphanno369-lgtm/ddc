# P2B — Biểu đồ & hiệu năng — Tóm tắt thay đổi (coder)

Nhánh `feature/p2b-bieu-do`, tạo từ `main` @ `10cda5a`. Coder đã làm **Bước 1 → 10** theo đúng thứ tự
trong `.bangiao/ke-hoach.md`, mỗi bước 1 commit, `npx tsc --noEmit` sạch + `npm test` xanh trước khi
commit. **Bước 11 (T1-migration) TREO đúng chỉ định — KHÔNG làm**, không sửa `prisma/schema.prisma`
hay `prisma/migrations/`. Không push, không merge, không tạo PR.

Số test cuối: **1060/1060 xanh** (mốc đầu phiên: 928/928). `npx tsc --noEmit` sạch.

## Danh sách commit theo bước

| Bước | Commit | Nội dung |
|---|---|---|
| 1 | `54a9ed9` | Read repo nền (T12b/T14/T1 dùng): `read-types.ts`, `read-prisma.ts`, `read-mock.ts`, gộp vào `repo` qua `index.ts`/`mock-repo.ts`; `scripts/check-read-parity.ts` |
| 2 | `c7fb5b9` | T12b(a) chart nhân lực theo ca × nhà thầu |
| 3 | `8a0f145` | T12b(b) chart cột chồng theo tuần × nhà thầu, lọc tháng, kéo timeline; xoá `ManpowerDailyChart.tsx` |
| 4 | `bfe9156` | T14 Gantt thiết bị theo từng chiếc (Q1 = b), đánh dấu ngày thực tế |
| 5 | `72c71ca` | T1-code (a): bỏ N+1 ở `queries.ts`, `dims` 1 lần, nhánh `month='all'` qua `DISTINCT ON`, EVM aggregate trong DB |
| 6 | `65f586b` | T1-code (b): nhật ký lọc trong DB, `lastUpdate` bằng `MAX`, trang Chi tiết đọc song song (1 `Promise.all`) |
| 7 | `0d82897` | T1-code (c): seed 10 triệu dòng giả + script đo (`perf:seed/bench/pages/clean`) |
| 8 | `496e57e` | T4(a): `schema-meta/build.ts` + `docs.ts` — siêu dữ liệu sinh từ `Prisma.dmmf.datamodel` |
| 9 | `317062d` | T4(b): `erd-geometry.ts`; `/data-schema` + `/data-dictionary` vẽ lại từ schema thật |
| 10 | `106575e` | T4(c): `mermaid.ts` + `scripts/gen-erd-doc.ts`; `docs/DATA_WAREHOUSE_README.md` mục 1 sinh tự động |

## File đã tạo (theo bước)

- **B1**: `src/server/repo/read-types.ts`, `read-prisma.ts` (+test), `read-mock.ts` (+test), `scripts/check-read-parity.ts`
- **B2**: `src/lib/manpower-charts.ts` (+test, phần ca), `src/server/manpower-queries.ts` (+test, phần ca), `src/components/project/ShiftManpowerChart.tsx` (+test)
- **B3**: bổ sung `manpower-charts.ts`/`manpower-queries.ts` (phần tuần), `src/components/project/WeeklyManpowerStackChart.tsx` (+test)
- **B4**: `src/lib/equipment-gantt.ts` (+test), `src/server/equipment-gantt-queries.ts` (+test), `src/components/project/EquipmentGantt.tsx` (+test)
- **B5**: bổ sung `read-types.ts`/`read-prisma.ts`/`read-mock.ts` (Bước 5), `src/server/queries-n1.test.ts`
- **B6**: bổ sung `read-types.ts`/`read-prisma.ts`/`read-mock.ts` (Bước 6)
- **B7**: `src/lib/perf-guard.ts` (+test), `scripts/perf/seed-perf.ts`, `scripts/perf/bench-data.ts`, `scripts/perf/measure-pages.ts`, `.bangiao/hieu-nang.md`
- **B8**: `src/lib/schema-meta/build.ts` (+test), `src/lib/schema-meta/docs.ts` (+test)
- **B9**: `src/lib/schema-meta/erd-geometry.ts` (+test), `src/server/data-pages-render.test.ts`
- **B10**: `src/lib/schema-meta/mermaid.ts` (+`erd-doc.test.ts`), `scripts/gen-erd-doc.ts`

## File đã sửa (theo bước)

- **B1**: `src/server/repo/index.ts`, `mock-repo.ts` (chỉ thêm cuối file), `package.json` (script `check:read`)
- **B2, B3, B4**: `app/[locale]/(app)/projects/[id]/page.tsx` (thêm thẻ `res-shift`/`res-weekly`/`eq-gantt`), `src/i18n/messages/vi.json`/`en.json` (2 nhóm mới `manpowerCharts`, `equipmentGantt` — CHỈ thêm ở cuối file), `src/server/projects-detail-page-render.test.ts`
- **B5**: `src/server/queries.ts` 🔥, `src/server/report.ts`, `src/server/overdue-scorecard.ts`, `scripts/check-read-parity.ts` (mở rộng)
- **B6**: `src/server/audit-log-page.ts` (+viết lại test), `app/[locale]/(app)/overview/page.tsx`, `app/[locale]/(app)/admin/page.tsx`, `app/[locale]/(app)/projects/[id]/page.tsx` (gom Promise.all), `src/server/repo/read-prisma.test.ts`/`read-mock.test.ts`
- **B7**: `package.json` (4 script `perf:*`)
- **B8, B9**: `src/lib/data-schema.ts` (xoá `SCHEMA_ENTITIES`, sửa `IMPORT_MAPPING` — xem mục "Lệch kế hoạch"), `app/[locale]/(app)/data-schema/page.tsx`, `app/[locale]/(app)/data-dictionary/page.tsx`
- **B10**: `docs/DATA_WAREHOUSE_README.md`, `package.json` (script `docs:erd`)

## Quyết định kỹ thuật đáng chú ý

- **Read repo** (`src/server/repo/read-*.ts`) tách hoàn toàn khỏi `prisma-repo.ts`/`mock-repo.ts` (file nóng A đang
  dùng ở P2A), gộp vào `repo` bằng `Object.assign` — không sửa nội dung 2 file đó (chỉ thêm 1-2 dòng cuối file).
  Tên hàm luôn bắt đầu `read` để không đụng hàm nào A thêm sau.
- **Q1(b)** (Gantt): `assignUsage` gán N chiếc dùng thực tế theo `unitNo` tăng dần trong số các chiếc có kế hoạch
  phủ đúng ngày đó; phần dư cộng vào `unplannedUsage`, không vẽ. 2 plan cùng chiếc chồng ngày → gán về `id` nhỏ hơn.
- **Q3/Q4/Q5** (chart tuần): `projectTimeline` nới khoảng theo dữ liệu thực tế nếu vượt ra ngoài ngày dự án; tuần
  đầu/cuối chia cho số ngày thực có (không phải luôn chia 7); cột chồng tô mờ (`fillOpacity=0.35`) cho tuần ngoài
  tháng đang lọc thay vì ẩn hẳn, giữ được bối cảnh toàn timeline khi cuộn.
- **T1**: `queries.ts` đổi `summarize`/`matchesGroup`/`filterSummaries` thành hàm **đồng bộ** nhận `dims` truyền
  vào (không tự gọi `repo.getDims()` mỗi dòng); `getProjectSummaries` chỉ gọi `listProjects`+`getDims`+
  `readFactSnapshots` đúng 1 lần bằng `Promise.all`. Test hồi quy (`queries.test.ts`, `project-queries.test.ts`,
  `overdue-scorecard.test.ts`, `report-export-route.test.ts`) chạy **nguyên vẹn, không sửa 1 kỳ vọng nào**.
- **T4**: không viết tay danh sách bảng/cột nữa — `buildSchemaMeta(Prisma.dmmf.datamodel)` đọc trực tiếp schema
  thật; `docs.test.ts` chặn cứng "mọi bảng/cột thật phải có mô tả, không được thừa" nên ai thêm bảng mà quên cập
  nhật `docs.ts` là `npm test` đỏ ngay.

## Lệch kế hoạch và lý do

1. **Gộp việc của 8.3 (xoá `SCHEMA_ENTITIES` trong `data-schema.ts`) vào commit Bước 9 thay vì Bước 8.**
   Kế hoạch liệt kê 8.3 là 1 phần của Bước 8 ("sửa `src/lib/data-schema.ts`") nhưng `app/.../data-schema/page.tsx`
   (nơi import `SCHEMA_ENTITIES`) chỉ được sửa ở Bước 9. Nếu xoá `SCHEMA_ENTITIES` ngay ở Bước 8 thì `npx tsc
   --noEmit` đỏ giữa 2 bước (vi phạm "mỗi bước tsc sạch + test xanh" trước khi commit). Đã hoãn phần xoá/sửa
   `IMPORT_MAPPING` trong `data-schema.ts` sang commit Bước 9, làm cùng lúc với việc sửa 2 trang — không đổi nội
   dung cuối cùng so với kế hoạch, chỉ đổi commit nào chứa thay đổi đó. Bước 8 do vậy chỉ có `build.ts`/`docs.ts`
   (đúng như mô tả, chỉ thiếu việc xoá file kia).
2. **`check-read-parity.ts` cần làm tròn số thực trước khi so sánh.** Kế hoạch không nêu chi tiết này. Khi chạy
   thật trên Postgres, `SUM`/`AVG` của DB và `reduce()` của JS cộng cùng tập giá trị `float64` theo **thứ tự khác
   nhau** nên lệch nhau cỡ 1e-10 — không phải lỗi đọc sai dữ liệu. Đã thêm bước làm tròn 6 chữ số thập phân trước
   khi so sánh JSON (xem code trong file), giữ nguyên việc so sánh giá trị ngày/chuỗi/số nguyên chính xác tuyệt đối.
3. **Bước 7 (đo hiệu năng): 1 trong 12 request đo được 1635 ms, vượt mốc 1500 ms — CHƯA KẾT LUẬN đạt hay
   không đạt.** "Cold-start tiến trình `next start`" (nạp module route + khởi tạo pool kết nối Prisma lần đầu)
   mới là **giả thuyết chưa kiểm chứng**, không có lượt đo đối chứng tách riêng; bench tầng dữ liệu (không qua
   cache) cho kịch bản `month='all'` cũng cho median 1789 ms / max 2384 ms, vượt 1500 ms, mà **chưa rõ nút cổ
   chai nằm ở đâu** (EXPLAIN mục 5 cho 3 câu SQL nền tảng chỉ 4–18 ms nên gần như chắc chắn không phải đó, nhưng
   chưa đo được phần còn lại). Chi tiết + quy trình đo lại có kiểm soát cho Bước 11: xem
   `.bangiao/hieu-nang.md` mục 4/4b/6 (mục "Chưa kết luận, chờ đo lại ở Bước 11"). **Không tạo migration/index để
   "vá" con số này** — đúng chỉ định của nhiệm vụ; quyết định index (nếu cần) để lại cho lần đo lại ở Bước 11.
4. **Giữ nguyên key i18n `detail.manpowerTrend` trong `vi.json`/`en.json` dù không còn nơi nào dùng** (Bước 3, sau
   khi xoá `ManpowerDailyChart.tsx`). Kế hoạch không yêu cầu dọn key i18n cũ; xoá thêm coi là việc ngoài phạm vi
   (mục 0 của kế hoạch: "Không thêm tính năng ngoài danh sách"). Không ảnh hưởng test (`i18n: vi/en phủ key như
   nhau` chỉ kiểm 2 file khớp nhau, không kiểm "không key thừa").

Không có lệch nào về hành vi/tiêu chí nghiệm thu đã nêu trong kế hoạch — chỉ 4 điểm trên là điều chỉnh cách làm
(thứ tự file trong commit, làm tròn số so sánh, ghi nhận số đo, giữ 1 key cũ) để tuân đúng cổng kiểm.

## Chỗ Tester nên soi kỹ

- **Q1(b) Gantt** (`src/lib/equipment-gantt.ts`, hàm `assignUsage`): logic gán N chiếc dùng thực tế theo `unitNo`
  tăng dần + xử lý 2 plan chồng ngày cùng chiếc — nghiệp vụ tinh vi nhất trong cả đợt, có 13 test riêng nhưng nên
  xác nhận lại bằng mắt trên `/vi/projects/1` (10–16/09/2026 seed có dữ liệu dùng thật).
- **`projectTimeline`/`buildWeeklyStack`** (`src/lib/manpower-charts.ts`): các biên tuần lẻ đầu/cuối dự án, dự án
  ngắn hơn 1 tuần, dữ liệu nằm ngoài ngày kế hoạch — đã có test nhưng là phần dễ sai số học nhất.
- **`queries.ts` sau khi bỏ N+1**: dù mọi test hồi quy đã chạy nguyên (không sửa kỳ vọng), đây là refactor lớn
  nhất trên 1 file nóng — nên `npm run check:read` + so KPI/donut/S-curve bằng mắt trên `/vi/overview` một lần nữa
  sau khi merge, trước khi B tiếp tục P3B.
- **`.bangiao/hieu-nang.md` mục 3-4**: số đo 1635 ms và cách lý giải cold-start — nếu nghi ngờ, có thể đo lại độc
  lập bằng đúng quy trình ghi trong file (seed → build → start → `perf:pages`).
- **Trang `/data-schema` mới (ERD SVG tự vẽ, `src/lib/schema-meta/erd-geometry.ts`)**: hình học đường nối/hộp là
  code mới hoàn toàn, test chỉ kiểm không chồng hộp + đúng nhãn 2 quan hệ mẫu — nên mở trang thật xem bố cục có dễ
  đọc không (chưa có ai xem bằng mắt).

## Cách chạy lại seed/đo hiệu năng (Bước 7)

Xem đầy đủ ở `.bangiao/hieu-nang.md` mục 7. Tóm tắt:

```bash
npm run perf:seed              # seed 10 trieu dong gia tren ddc_control_tower_b (co assertPerfDb chan nham DB)
npm run perf:bench             # do tang du lieu, khong qua cache
rm -rf .next/cache/fetch-cache
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=D:\_project\DDC_dieu-phoi\tools\font-mock.js npx next build
npx next start -p 3001
PERF_EMAIL=admin@daidung.com.vn PERF_PASSWORD=<xem prisma/seed> npm run perf:pages
npm run perf:clean             # xoa het du lieu PERF-*/perf-seed/perf@seed.local
npx prisma db seed             # tra DB ve seed mac dinh
```

DB `ddc_control_tower_b` hiện đã ở trạng thái **seed mặc định** (17 dự án) sau khi coder chạy xong Bước 7 —
không còn dữ liệu `PERF-*`. `npm test` chạy trên mock-repo nên xanh bất kể trạng thái DB thật.

## Việc còn treo

- **Bước 11 (T1-migration)**: TREO đúng chỉ định. Điều kiện mở (đủ cả 4, xem `ke-hoach.md` Bước 11): (1) P2A đã
  merge `main`; (2) `phien-A.md` không còn giữ `prisma/schema.prisma`; (3) B đã `git merge main` + `migrate
  deploy` + `generate` + `npm test` xanh; (4) đo lại `hieu-nang.md` sau merge có truy vấn > 1500 ms **hoặc**
  EXPLAIN cho thấy quét tuần tự trên bảng lớn. Lần đo này (mục 6, `hieu-nang.md`) **không có bằng chứng cần
  index** — nếu điều kiện (4) vẫn không xuất hiện sau merge, Bước 11 có thể đóng luôn mà không tạo migration nào.
- **Q6 (không thuộc P2B)**: form nhập `project_equipment_plan` giao cho A làm trong P2A (đã ghi trong `phien-B.md`
  từ trước khi coder bắt đầu, không phải việc mới phát sinh).

## CÂU HỎI CHO CHỦ DỰ ÁN

Không có — mọi câu hỏi nghiệp vụ (Q1–Q6) đã được chốt sẵn trong `ke-hoach.md` trước khi coder bắt đầu, coder làm
đúng theo đề xuất đã chốt, không phát sinh câu hỏi mới trong quá trình triển khai.

## Vòng sửa 1 (sau đánh giá reviewer, `.bangiao/danh-gia.md`)

4 mục "CẦN SỬA TRƯỚC MERGE" (3 của reviewer + 1 yêu cầu chủ dự án 2026-09-24 về thẻ "Chuỗi giá trị"), mỗi mục 1
commit riêng, `npx tsc --noEmit` sạch + `npm test` xanh trước mỗi commit. Không làm phần "Để sau" (checklist merge
P2A↔P2B, bảo mật script dev, việc nhỏ khác) — đúng chỉ định chỉ sửa "CẦN SỬA TRƯỚC MERGE".

### Mục 1 — Chart tuần nhân lực mất số liệu nhà thầu đã tắt

- **Commit:** `710abab` fix(p2b): chart tuan nhan luc giu du lieu nha thau da tat
- **File:** `src/server/manpower-queries.ts` (`getWeeklyChartData`), `src/server/manpower-queries.test.ts`
- **Sửa:** danh sách `contractors` dựng từ `contractorId` thực có trong `totalActual` (tổng hợp từ
  `readManpowerWeekly`) thay vì lọc theo `repo.getContractors()` (chỉ trả `isActive:true`); tên lấy từ
  `getContractors()`, không có thì `#<id>`; giữ sort theo tổng actual giảm dần.
- **Test thêm:** spy `repo.getContractors` trả thiếu đúng 1 nhà thầu có dòng dữ liệu (id lấy động từ dữ liệu dự án
  1, không hard-code) → assert nhà thầu đó vẫn có mặt trong `contractors`, tên đúng `#<id>`.

### Mục 2 — Gantt thiết bị đọc usage bị cắt theo khoảng plan, dòng chú thích đếm thiếu

- **Commit:** `f794113` fix(p2b): Gantt thiet bi doc usage toan bo ngay du an, khong cat theo plan
- **File:** `src/server/equipment-gantt-queries.ts` (`getEquipmentGantt`), `src/server/equipment-gantt-queries.test.ts`
- **Sửa:** bỏ `minStart`/`maxFinish` tính từ plans để bound query; `readEquipmentUsageDays` gọi với khoảng ngày rộng
  hết mức (`ALL_TIME_FROM`/`ALL_TIME_TO` = `'0001-01-01'`/`'9999-12-31'`) thay vì `[minStart, maxFinish]`. `buildGantt`
  giữ nguyên — trục Gantt (`planFrom`/`planTo`/`ticks`) vẫn dựng từ plan như cũ, chỉ có `unplannedUsage` (đếm ở
  `assignUsage`) là được tính đủ.
- **Test thêm:** spy `readEquipmentPlans` trả 1 plan hẹp + `mockImplementationOnce` cho `readEquipmentUsageDays` mô
  phỏng đúng hành vi lọc `from`/`to` thật của repo (không mock cứng kết quả, để bài test thật sự phân biệt được
  code cũ/mới) — 1 ngày dùng trước `plannedStart` 5 ngày → `unplannedUsage=2`, `planFrom`/`planTo` không đổi, và
  assert `readEquipmentUsageDays` được gọi với khoảng ngày bao trùm cả ngày đó (không còn bị bó hẹp theo plan).

### Mục 3 — Kết luận hiệu năng T1 khẳng định quá bằng chứng (chỉ sửa câu chữ, không sửa code/script đo)

- **Commit:** `c59716f` docs(p2b): sua ket luan hieu nang T1 qua bang chung, chua ket luan dat/khong dat
- **File:** `.bangiao/hieu-nang.md` (mục 4, mục 4b mới, mục 6), `.bangiao/thay-doi.md` (mục "Lệch kế hoạch" số 3 —
  bản gốc, đã ghi đè bởi bản dưới đây khi coder ghi lại toàn văn file này qua vòng sửa)
- **Sửa:** bỏ câu "tiêu chí nghiệm thu T1 đạt ở steady state"; nêu rõ 1/12 request vượt 1500 ms, cold-start tiến
  trình là **giả thuyết chưa kiểm chứng** (không có lượt đo đối chứng tách bạch), bench `month='all'` median
  1789 ms / max 2384 ms cũng vượt mốc mà chưa rõ nút cổ chai; thêm lý do thứ 3 trước đó bị bỏ sót:
  `loadSpiCpiTrend`/`loadSCurve` (`src/server/cache.ts`) khoá cache chỉ theo `filters`, không theo `month`, nên các
  tháng đo sau ở "Lượt 1" không còn là cache-miss toàn phần như ngầm giả định khi so sánh với request đầu. Thêm
  mục "4b. Chưa kết luận, chờ đo lại ở Bước 11" nêu quy trình đo lại có kiểm soát: warm-up 1 URL ngoài `/overview`
  trước, đo `month=all` trước tiên, đo riêng từng hàm nhánh `'all'` trong `perf:bench`.

### Mục 4 — Thẻ "Chuỗi giá trị" theo mock-up (yêu cầu chủ dự án 2026-09-24)

- **Commit:** `cdd5733` fix(p2b): the Chuoi gia tri rong het hang, 2 cot theo mock-up, bo the EVM
- **File sửa:**
  - `app/[locale]/(app)/projects/[id]/page.tsx` — bỏ hẳn thẻ "Chỉ số EVM" (và hàm nội bộ `EvmRow`); thẻ "Chuỗi giá
    trị" thành `<Card>` rộng hết hàng (không còn `<div className="g2">` ghép với EVM); thêm hàm nội bộ `StageRow`
    (thay `EvmRow`) render 1 hàng giai đoạn; bọc thẻ + `<StageExplorer>` trong `<StageSelectionProvider>` mới.
  - `src/lib/value-chain-view.ts` — thêm `stagePctLabel` (1 chữ số thập phân cố định, khác `formatPct`),
    `VALUE_CHAIN_COLUMNS` (thứ tự 2 cột đúng mock-up), `chainFooterSummary`/`chainWeightTotalLabel` (dòng chân Σ
    trọng số + %TT, tái dùng `calcChainPctActual`/`validateStageWeights` của `src/lib/stages.ts` để nhất quán công
    thức với wizard nhập liệu `DataEntryForm.tsx`).
  - `src/components/project/StageSelectionContext.tsx` (mới) — Context chia sẻ `{selected, toggle}` giữa chip góc
    và `StageExplorer`; ngoài Provider tự tạo state cục bộ (không phá `StageExplorer.test.ts` gọi độc lập).
  - `src/components/project/ValueChainModeChip.tsx` (mới) — chip góc, nhận nhãn đã dịch sẵn qua props (tránh gọi
    `useTranslations` trong client component không có `NextIntlClientProvider` khi test bằng
    `renderToStaticMarkup`), đổi tên theo `selected` từ context.
  - `src/components/project/StageExplorer.tsx` — đổi `useState` nội bộ sang `useStageSelection()` (context dùng
    chung), hành vi bên ngoài (props, DOM) không đổi.
  - `app/globals.css` — thêm `.stagecol` (flex column, xếp dọc từng cột) + `.stage .stagesub` (dòng tấn nhỏ màu
    xám dưới thanh); **không sửa** `.stagegrid`/`.stage` gốc (giữ nguyên để không ảnh hưởng `DataEntryForm.tsx`
    đang dùng chung 2 class này).
  - `src/i18n/messages/vi.json`, `en.json` — nhóm mới `valueChainCard` (`allStages`, `footerWeight`,
    `footerFormula`) thêm ở cuối file, không chèn giữa key có sẵn.
- **Quyết định theo yêu cầu chủ dự án (a)-(d):**
  - (a) Bỏ hẳn thẻ EVM; 2 cột **không** dùng `grid-auto-flow` (dễ vỡ thứ tự khi 1 giai đoạn "không áp dụng" bị ẩn
    — số item mỗi cột thay đổi); thay vào đó `VALUE_CHAIN_COLUMNS` định nghĩa rõ 2 mảng cố định
    (`[design,procurement,transport,handover]` / `[shop,fabrication,erection]`), mỗi mảng render vào 1
    `.stagecol` riêng (flex dọc) — luôn đúng cột dù ẩn bớt hàng. `.stagegrid` gốc (2 cột `1fr 1fr`, xuống 1 cột ở
    ≤1180px) không đổi, giờ chỉ có 2 con trực tiếp (2 `.stagecol`) thay vì 7 `.stage` phẳng.
  - (b) Số tấn TT/KH chuyển xuống `<span className="stagesub" style={{gridColumn:3}}>` — dòng riêng dưới thanh
    (`.stage` vẫn 4 cột `116px 38px 1fr auto`, dòng phụ ghim cột 3 = cột thanh).
  - (c) `chainFooterSummary(chain, weights)`: `weightTotal`/`weightOk` từ `validateStageWeights` (tổng trọng số
    applicable thật, không ghi cứng 100; `weightOk=false` khi lệch → tô `var(--warn)`); `pctTotal` từ
    `calcChainPctActual` trên đủ 7 giai đoạn (thiếu dòng chain → mặc định applicable=true/pct=0, khớp cách mỗi
    hàng hiển thị tự suy khi không có dòng).
  - (d) **Đã nối được** chip góc với state chọn giai đoạn của `StageExplorer`, không viết lại `StageExplorer` (chỉ
    đổi nguồn `useState` sang Context dùng chung `StageSelectionContext`) — khi bấm chọn giai đoạn ở thẻ "Timeline
    của 7 giai đoạn", chip đổi từ "Toàn bộ 7 giai đoạn" sang tên giai đoạn đang chọn; bấm lại bỏ chọn → chip trở về
    mặc định. Chip đỏ "Khâu nghẽn: …" giữ nguyên logic cũ (Badge tone="danger", cùng điều kiện `bottleneck`), hiện
    cạnh chip góc. Thanh giai đoạn nghẽn tô cam qua `.stage.bt .fill` (CSS có sẵn, không đổi) — `isBottleneck`
    truyền y nguyên logic gốc `stage === latest?.bottleneckStage`.
- **Test thêm:**
  - `src/lib/value-chain-view.test.ts`: `stagePctLabel` (vi/en/làm tròn 1 chữ số), `VALUE_CHAIN_COLUMNS` (đúng thứ
    tự + gộp lại = STAGE_ORDER không thiếu không trùng), `chainFooterSummary` (4 ca: trọng số đủ 100 + 1 giai đoạn
    "không áp dụng" ở chain dù có trọng số vẫn không tính — khớp `effectiveWeight` của `stages.ts`; trọng số lệch
    100 → `weightOk=false`; thiếu hẳn 1 dòng chain → mặc định pct=0; khớp `calcChainPctActual` khi truyền đủ 7 giai
    đoạn), `chainWeightTotalLabel`.
  - `src/server/projects-detail-page-render.test.ts`: không còn `detail.evmMetrics`/`metric.pv`/`metric.sv`/
    `metric.cv`/`metric.eac`; chip `valueChainCard.allStages` luôn hiện; `class="chainfoot"` có đủ
    `footerWeight`/`footerFormula`; đúng 2 `class="stagecol"`, thứ tự trái/phải đúng theo `VALUE_CHAIN_COLUMNS`
    (không xen kẽ như `STAGE_ORDER` gốc).
  - `src/components/project/ValueChainModeChip.test.ts` (mới, 3 test): ngoài Provider → mặc định; trong Provider
    chưa chọn → mặc định; bơm `StageSelectionContext.Provider` với `selected:'shop'` → chip đổi tên đúng.
- **Ảnh trước/sau** (`.bangiao/anh-test/`, chụp bằng `playwright-core` + Edge hệ thống, đăng nhập
  `admin@daidung.com.vn`, trang `/vi/projects/1`): `before-desktop-chuoi-gia-tri.png`/`before-mobile-*.png` (lấy
  bằng cách `git stash` tạm 7 file code mục 4, chụp, rồi `git stash apply`+`drop` khôi phục — xác nhận đúng bug đã
  báo: thẻ ghép nửa hàng với EVM, cột phải Shop Drawing/Gia công/Lắp dựng mất hẳn thanh+%, Vật tư/Vận chuyển chữ
  tấn đẩy mất thanh) vs `after-desktop-chuoi-gia-tri.png`/`after-mobile-*.png` (thẻ rộng hết hàng, 2 cột đúng thứ
  tự, thanh+% hiện đủ mọi giai đoạn, dòng tấn xuống dưới thanh, dòng chân Σ trọng số 100%/%TT 79,0%); kèm
  `*-full.png` (toàn trang) để đối chiếu bối cảnh.
- **Lệch/rủi ro Tester nên soi kỹ:**
  1. **(d) đã làm được** dù kế hoạch cho phép bỏ qua nếu "viết lại lớn" — không viết lại `StageExplorer`, chỉ đổi
     nguồn state; nhưng đây là thay đổi lan giữa 2 component (context mới) nên Tester nên bấm thử chọn/bỏ chọn giai
     đoạn ở thẻ "Timeline của 7 giai đoạn" trên trình duyệt thật, xác nhận chip góc đổi tên đúng và không vỡ hành vi
     click cũ của `StageExplorer` (mở/đóng chi tiết mốc, đổi `cmpStage` biểu đồ so sánh).
  2. Trong lúc chụp ảnh, `npm install --no-save playwright-core` (chỉ để chụp ảnh, không lưu vào package.json) đã
     vô tình làm lệch resolve của `node_modules` khiến 1 lượt `npm test` đỏ giả (lỗi `NextIntlClientProvider not
     found` không liên quan code) — đã chạy `npm ci` (khôi phục đúng `package-lock.json` đã commit, gỡ
     `playwright-core`) + `npx prisma generate` (client Prisma bị `npm ci` sinh thiếu `Prisma.sql`) rồi xác nhận lại
     `tsc`/`npm test` xanh. `package.json`/`package-lock.json` **không đổi** (đã kiểm `git diff` rỗng). Tester nên tự
     chạy lại `npm ci && npx prisma generate && npx tsc --noEmit && npm test` một lượt độc lập trên máy mình để chắc
     chắn `node_modules` sạch, không phụ thuộc trạng thái tạm trong phiên coder.
  3. Dòng tấn (`stagesub`) chỉ set `gridColumn:3` — nếu sau này đổi `gridTemplateColumns` của `.stage` (hiện
     `116px 38px 1fr auto`, 4 cột) mà không cập nhật số cột, dòng tấn có thể lệch khỏi cột thanh.
  4. Không đổi `detail.evmMetrics` (key i18n) dù không còn nơi dùng — giữ nguyên theo tiền lệ đã có ở mục "Lệch kế
     hoạch" số 4 (giữ `detail.manpowerTrend`), không dọn dẹp ngoài phạm vi.

## Vòng sửa 1 — bổ sung (điều phối viên, theo yêu cầu chủ dự án 2026-09-24)

- Commit `c61fa61`: trang Chi tiết dự án — dời nguyên cụm **S-curve PV/EV/AC + SPI/CPI trend + What-if** và cụm
  **Lịch sử mã + Mã SAP + Alert/Action + Tài chính chi tiết + Ảnh hiện trường** xuống **cuối trang** (sau Gantt thiết bị),
  giữ nguyên thứ tự nội bộ. Chỉ đổi vị trí JSX trong `app/[locale]/(app)/projects/[id]/page.tsx`, không đổi logic/quyền.
  Thứ tự mới: Header → KPI → Timeline KH/TT → Các mốc chính → Chuỗi giá trị + Timeline 7 giai đoạn → Nguồn lực → Theo dõi
  tuần → Chart ca → Chart tuần → Gantt → S-curve/SPI-CPI → What-if → Lịch sử mã/SAP → Alert/Tài chính → Ảnh.
  tsc sạch, npm test 1109/1109.
- **Ảnh `after-*.png` được chụp lại** (không đổi code) sau commit `c61fa61` ở trên: 4 ảnh cũ trong `84b6760` chụp
  trước khi trang đổi thứ tự nên không còn khớp bố cục hiện tại. Quy trình chụp lại: `npm install`/`npm ci` +
  `npx prisma generate` (khôi phục `node_modules`/Prisma client sạch sau sự cố nêu ở "Lệch/rủi ro" #2) → khởi động
  lại `npm run dev -- -p 3001` → đăng nhập `admin@daidung.com.vn` qua form (không có bypass auth cho Playwright) →
  chụp `/vi/projects/1` ở `1440×1000` và `390×900`, cả full page lẫn crop riêng thẻ "Chuỗi giá trị"
  (`.valueChainCard`). Ảnh mới xác nhận: thẻ rộng hết hàng, 2 cột đúng thứ tự, chip "Khâu nghẽn: Lắp dựng" +
  thanh Lắp dựng tô cam, dòng chân "Σ trọng số 100% · %TT = Σ(...)" / 79,0%, và ở 390px xuống đúng 1 cột không bị
  che — khớp bố cục trang đã sắp xếp lại theo `c61fa61`.

## Debugger vòng 1 (sau `.bangiao/ket-qua-test.md` ĐỎ, commit `102a467`)

**Lỗi:** thanh tiến độ `.stage .fill` trong thẻ "Chuỗi giá trị" (và mọi nơi khác dùng chung class,
gồm wizard `DataEntryForm.tsx`) không bao giờ hiện chiều rộng/màu theo %, hàng "khâu nghẽn" không tô
cam — vi phạm mục 4(a)/(d) của `danh-gia.md`.

**Root cause (đã tự xác minh độc lập, không chỉ tin theo gợi ý của tester):**
`app/[locale]/(app)/projects/[id]/page.tsx:579` (hàm `StageRow`) và
`src/components/form/DataEntryForm.tsx:520` **cùng** render
`<div className="bar"><i className="fill" style={{ width: ... }} /></div>` — dùng thẻ `<i>`, mặc
định `display:inline` trong HTML. Rule CSS `app/globals.css:469-471` (`.stage .fill{height:100%;...}`,
`.stage.bt .fill{background:linear-gradient(90deg,#ffb340,var(--warn))}`) không khai báo `display:`
nào. Theo chuẩn CSS, `width`/`height` không có tác dụng trên phần tử `display:inline` (không phải bug
trình duyệt) → `.fill` luôn `getBoundingClientRect()={width:0,height:0}` dù `style.width` đúng %, nên
người dùng chỉ thấy nền xám cố định của `.bar`, không bao giờ thấy gradient xanh/cam.
Mock-up gốc `mockup-apple-glass.html:1364` dùng đúng `<div class="fill" ...>` (mặc định `display:block`)
— bản chuyển sang React đã đổi tag sang `<i>` mà không bù `display:block` trong CSS. Đây là 1 root
cause dùng chung cho cả `page.tsx` và `DataEntryForm.tsx` (2 nơi cùng dùng class `.stage`/`.fill`), có
từ trước Vòng sửa 1 (xem `git show cdd5733`, `.bangiao/anh-test/before-desktop-*.png`).

**Cách sửa (tối thiểu, ở CSS — không đổi tag JSX để 1 lần sửa fix cả 2 nơi dùng chung class):**
`app/globals.css`, rule `.stage .fill{...}` — thêm `display:block;` (dòng 469, ngay đầu khai báo).
Không đụng `.stage .bar`, `.stage.bt .fill`, `.stagegrid`, `.stagecol`, không đổi `page.tsx` hay
`DataEntryForm.tsx`. Vì `width` inline style trước đó cũng vô tác dụng do cùng lý do `display:inline`,
`DataEntryForm.tsx` (wizard nhập liệu) trước đây bị đúng lỗi này và giờ cũng được sửa theo — không có
rủi ro "vỡ" vì trước đó thanh của nó cũng không hiện đúng, kiểm bằng mắt xác nhận đây là cải thiện.

**Kiểm chứng:**
- `src/server/projects-detail-page-render.test.ts`, describe `Vong sua 1 muc 4 - the "Chuoi gia tri"
  ...` (test cuối cùng, đọc thật `app/globals.css` + HTML render thật) — từ FAIL sang **PASS**.
- `npx tsc --noEmit`: sạch.
- `npm test`: chạy 2 lần độc lập, tổng số test pass đầy đủ cả 2 lần (1108/1108 rồi 1110/1110 khi loại
  trừ 2 file "failed" khác nhau ở mỗi lần do timeout/`afterAll rmSync` — tải song song trên Windows,
  không liên quan thay đổi CSS, không lặp lại cùng 1 file ở 2 lần chạy). Không nới hay sửa test nào.

**Commit:** `fix(p2b): the Chuoi gia tri thanh tien do khong hien mau - .stage .fill thieu display`.
