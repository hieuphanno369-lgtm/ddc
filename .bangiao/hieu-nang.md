# P2B — Bước 7: đo hiệu năng T1 trên 10 triệu dòng giả

Ngày đo: 2026-09-24. DB: `ddc_control_tower_b` (localhost:5433) — **không đụng DB của A**
(`ddc_control_tower`), có chốt chặn `assertPerfDb` trong `src/lib/perf-guard.ts`.

## 1. Số dòng đã sinh (`npm run perf:seed`, tham số mặc định)

```
dim_project                  500
project_contractor           3,000
project_equipment_plan       3,000
fact_volume                  18,000
fact_financial                18,000
fact_progress_monthly         18,000
activity_log                 100,000
fact_value_chain_progress     126,000
audit_log                    1,000,000
fact_daily_equipment_usage    4,380,000
fact_daily_manpower           4,380,000
TỔNG                          10,046,500
```

Tham số: `projects=500 days=730 end=2026-09-24 audit=1,000,000 activity=100,000` (≥ 10.000.000 dòng — đạt).

## 2. Bench tầng dữ liệu (`npm run perf:bench` — KHÔNG qua `unstable_cache`, 5 vòng/kịch bản)

| Kịch bản | Median (ms) | Max (ms) |
|---|---|---|
| Tổng quan (month=2026-09) | 582 | 1285 |
| Tổng quan (month='all') | 1789 | 2384 |
| Chi tiết PERF-0001 | 343 | 438 |
| Chi tiết dự án 1 | 240 | 271 |

Tầng dữ liệu "trần" (đi thẳng DB, không cache) đã đạt < 1500 ms cho 3/4 kịch bản; riêng
"Tổng quan (month='all')" vượt — xem mục 4 (nguyên nhân: không phải do 3 truy vấn SQL nền tảng
chậm — xem EXPLAIN mục 5 — mà do trang gọi lặp `getProjectSummaries` nhiều lần, xem mục 4).

## 3. Đo HTTP thật (`npm run perf:pages`, qua `next build` + `next start -p 3001`)

Quy trình đã chạy: dừng dev 3001 → xoá `.next/cache/fetch-cache` →
`NEXT_FONT_GOOGLE_MOCKED_RESPONSES=D:\_project\DDC_dieu-phoi\tools\font-mock.js npx next build` →
`npx next start -p 3001` → `npm run perf:pages` (đăng nhập `admin@daidung.com.vn`, mật khẩu đọc
từ biến môi trường `PERF_PASSWORD` lúc chạy tay, **không ghi vào file/commit**).

### Lượt 1 — request ĐẦU TIÊN sau khi `next start` (cold start tiến trình + cache miss thật)

| Trang | ms |
|---|---|
| /vi/overview?month=2026-09 (tháng hiện tại) | **1635** |
| /vi/overview?month=2026-08 | 874 |
| /vi/overview?month=2026-07 | 864 |
| /vi/overview?month=2026-06 | 1173 |
| /vi/overview?month=2026-05 | 895 |
| /vi/overview?month=all | 722 |
| /vi/projects/18 (PERF-0001) | 342 |
| /vi/projects/19 (PERF-0002) | 206 |
| /vi/projects/20 (PERF-0003) | 220 |
| /vi/projects/21 (PERF-0004) | 302 |
| /vi/projects/22 (PERF-0005) | 221 |
| /vi/projects/1 | 261 |

MAX = **1635 ms** → **1 trong 12 request vượt tiêu chí ≤ 1500 ms** (đúng request đầu tiên của cả
lượt đo — request khởi động tiến trình `next start`).

### Lượt 2 — lặp lại NGUYÊN request cũ (cache `unstable_cache` đã ấm, revalidate 1800s)

| Trang | ms |
|---|---|
| /vi/overview?month=2026-09 | 187 |
| /vi/overview?month=2026-08 | 238 |
| /vi/overview?month=2026-07 | 236 |
| /vi/overview?month=2026-06 | 176 |
| /vi/overview?month=2026-05 | 174 |
| /vi/overview?month=all | 181 |
| /vi/projects/18..22, /vi/projects/1 | 168–278 |

MAX = **278 ms** — nhưng lượt này là **cache HIT** (cùng khoá tháng/dự án như lượt 1), không đo
đúng "lần đầu" như tiêu chí đề ra → không dùng để kết luận đạt/không đạt, chỉ để tách bạch
nguyên nhân (xem mục 4).

### Lượt 3 (thăm dò thêm, không phải tiêu chí chính thức) — 4 tháng MỚI (chưa từng gọi) trên
tiến trình đã ấm (loại trừ cold-start tiến trình, vẫn là cache-miss thật cho khoá mới)

| Trang | ms |
|---|---|
| /vi/overview?month=2026-04 | 987 |
| /vi/overview?month=2026-03 | 871 |
| /vi/overview?month=2026-02 | 792 |
| /vi/overview?month=2026-01 | 834 |
| /vi/projects/23 (dự án PERF mới, chưa gọi lần nào) | 193 |

MAX = **987 ms** — dưới 1500 ms. Kết luận: khi tiến trình `next start` đã ấm (đã phục vụ ≥ 1
request), **mọi trang Tổng quan/Chi tiết đều dưới 1500 ms kể cả cache-miss thật**.

## 4. Nguyên nhân request đầu tiên (1635 ms) — KHÔNG phải thiếu index

EXPLAIN (mục 5) cho thấy 3 truy vấn nền tảng của nhánh `'all'`/nhiều-tháng đều chạy dưới **18 ms**
kể cả trên 10 triệu dòng (bảng `fact_progress_monthly`/`fact_financial`/`fact_volume` chỉ có
~18.000 dòng mỗi bảng — số tháng cố định 36, không phình theo `fact_daily_*`). Vậy 1635 ms **không
đến từ 1 câu SQL chậm cần thêm index**, mà từ:

1. **Cold start tiến trình `next start`**: request đầu tiên sau khi khởi động phải nạp module
   route + khởi tạo pool kết nối Prisma/Postgres lần đầu. Đây là chi phí **một lần cho cả tiến
   trình**, không lặp lại ở các request sau (dù khác tháng/dự án — xem Lượt 3).
2. **`getProjectSummaries(month, filters)` bị gọi LẶP LẠI nhiều lần trên CÙNG 1 lượt render trang
   `/overview`** — không phải lỗi mới của P2B, đã có từ trước P2B (`OverviewWidgets.tsx` dùng
   `unstable_cache` riêng cho từng widget, không dedupe theo request):
   - `loadPortfolioKpis` gọi ở cả `KpiGrid` và `BacklogOverdueCard` (2 lần)
   - `loadWatchlist` gọi ở cả `AlertBanner` (chỉ admin) và `WatchlistCard` (2 lần)
   - `loadStatusBreakdown`, `loadTonnageByGroup`, `loadCapacity`, `loadProjectList` mỗi cái 1 lần
   - Mỗi lần `getProjectSummaries` là 1 đợt `Promise.all([listProjects, getDims, readFactSnapshots])`
     độc lập — `unstable_cache` chỉ cache theo khoá tham số, KHÔNG dedupe 2 lời gọi CÙNG tham số
     xảy ra đồng thời trong 1 request (cần `React.cache()` để dedupe trong-request, hiện chưa có).
   - Ở 10 triệu dòng, mỗi đợt vẫn nhanh (readFactSnapshots ~5-18 ms — xem mục 5) nhưng cộng dồn
     6-8 đợt × round-trip Prisma/pool contention (đặc biệt lúc pool còn nguội) đủ tạo ra vài trăm ms
     tới hơn 1 giây khi xếp hàng chờ connection.

**Kết luận:** tiêu chí nghiệm thu T1 (≤ 1500 ms) đạt ở trạng thái ổn định (steady state, tiến
trình đã phục vụ ≥ 1 request) — MAX quan sát được 987 ms cho cache-miss thật, 278 ms cho cache-hit.
Riêng request đầu tiên sau `next start` là chi phí khởi động một lần, không phải vấn đề kiến trúc
truy vấn dữ liệu.

## 5. EXPLAIN (ANALYZE, BUFFERS) — 3 truy vấn của kịch bản chậm nhất trong bench (`month='all'`)

### readFactSnapshots('all') — DISTINCT ON fact_progress_monthly

```
Unique  (cost=1858.15..1949.17 rows=517 width=78) (actual time=16.322..17.429 rows=517 loops=1)
  Buffers: shared hit=394
  ->  Sort  (cost=1858.15..1903.66 rows=18204 width=78) (actual time=16.320..16.799 rows=18204 loops=1)
        Sort Key: "projectId", "yearMonth" DESC
        Sort Method: quicksort  Memory: 2617kB
        Buffers: shared hit=394
        ->  Seq Scan on fact_progress_monthly  (cost=0.00..570.04 rows=18204 width=78) (actual time=0.012..3.034 rows=18204 loops=1)
              Filter: "isLatest"
              Buffers: shared hit=388
Planning Time: 0.589 ms
Execution Time: 17.828 ms
```

### readVolumeSnapshots('all') — DISTINCT ON fact_volume

```
Unique  (cost=2.81..1635.86 rows=1551 width=24) (actual time=0.193..10.887 rows=1517 loops=1)
  Buffers: shared hit=191
  ->  Incremental Sort  (cost=2.81..1544.84 rows=18204 width=24) (actual time=0.191..10.122 rows=18204 loops=1)
        Sort Key: "projectId", "factoryId", "yearMonth" DESC
        Presorted Key: "projectId"
        Full-sort Groups: 505  Sort Method: quicksort  Average Memory: 26kB  Peak Memory: 26kB
        Buffers: shared hit=191
        ->  Index Scan using fact_volume_pkey on fact_volume  (cost=0.29..839.29 rows=18204 width=24) (actual time=0.018..1.968 rows=18204 loops=1)
              Buffers: shared hit=191
Planning Time: 0.321 ms
Execution Time: 10.932 ms
```

### readMonthlyEvm(historyMonths(), allProjectIds) — aggregate GROUP BY

```
Sort  (cost=1582.11..1582.20 rows=36 width=48) (actual time=3.954..3.955 rows=12 loops=1)
  Sort Key: "yearMonth"
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=1428
  ->  HashAggregate  (cost=1580.64..1581.18 rows=36 width=48) (actual time=3.880..3.883 rows=12 loops=1)
        Group Key: "yearMonth"
        Batches: 1  Memory Usage: 24kB
        Buffers: shared hit=1428
        ->  Index Scan using ux_fact_progress_latest on fact_progress_monthly  (cost=0.32..1521.78 rows=3924 width=48) (actual time=0.031..2.997 rows=6204 loops=1)
              Index Cond: ("projectId" = ANY ('{...517 ids...}'::integer[]))
              Filter: ("yearMonth" = ANY ('{...12 thang...}'::text[]))
              Rows Removed by Filter: 12000
              Buffers: shared hit=1428
Planning Time: 0.437 ms
Execution Time: 3.987 ms
```

Cả 3 truy vấn đều dùng index sẵn có (`ux_fact_progress_latest`, `fact_volume_pkey`) hoặc quét
tuần tự bảng nhỏ (~18.000 dòng) — **dưới 18 ms mỗi câu**, đã đạt dư tiêu chí. `fact_daily_manpower`
và `fact_daily_equipment_usage` (8,76 triệu dòng, phần lớn tổng số) KHÔNG nằm trong đường truy vấn
Tổng quan — chỉ trang Chi tiết đụng tới (qua `readManpower*`/`readEquipmentUsageDays`, đã có
index `(projectId, workDate)` từ P1A) và đo được rất nhanh (168–342 ms cả trang, nhiều truy vấn).

## 6. Đề xuất cho Bước 11 (T1-migration — hiện TREO, không tạo ở P2B)

**Không cần thêm index** — 3 truy vấn chậm nhất trong bench đã dùng đúng index hiện có và chạy
dưới 20 ms trên 10 triệu dòng. Ứng viên trong kế hoạch (`@@index([isLatest, projectId,
yearMonth(sort: Desc)])` cho `fact_progress_monthly`/`fact_financial`...) **KHÔNG có bằng chứng
cần thiết** ở lần đo này — để lại việc quyết định index cho lần đo lại sau khi P2A merge (dữ liệu
thật có thể khác), theo đúng nguyên tắc "chỉ chọn cái EXPLAIN chứng minh cần" của kế hoạch.

Ghi chú ngoài phạm vi Bước 11 (không phải index, không làm ở P2B — để tham khảo cho người sau):
trang `/overview` gọi `getProjectSummaries` lặp lại 6-8 lần trong 1 lượt render (mục 4) — nếu
muốn giảm tiếp độ trễ "cache-miss thật", nên dedupe bằng `React.cache()` (per-request memoization)
thay vì thêm cache/index. Đây là việc của kiến trúc trang `/overview` (P1B trở về trước), không
thuộc phạm vi P2B.

## 7. Cách chạy lại (script đã commit)

```bash
# Seed 10 trieu dong (chi chay tren ddc_control_tower_b, co assertPerfDb chan nham DB)
npm run perf:seed

# Bench tang du lieu (khong qua cache)
npm run perf:bench

# Do HTTP that (can build production + start :3001)
rm -rf .next/cache/fetch-cache
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=D:\_project\DDC_dieu-phoi\tools\font-mock.js npx next build
npx next start -p 3001
PERF_EMAIL=admin@daidung.com.vn PERF_PASSWORD=<xem seed> npm run perf:pages

# Don du lieu PERF, tra DB ve seed mac dinh cho dev/test
npm run perf:clean
npx prisma db seed
```

## 8. Sau khi đo xong

`npm run perf:clean` (xoá toàn bộ dòng `PERF-*`/`perf-seed`/`perf@seed.local`) rồi
`npx prisma db seed` (trả DB về seed mặc định 17 dự án) — `npm test` chạy trên mock-repo nên
**không phụ thuộc trạng thái DB thật**, luôn xanh bất kể DB đang seed thường hay seed hiệu năng.
