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
