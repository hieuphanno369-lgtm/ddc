# Bước 11 (P2B) — T1 hiệu năng: đo lại có kiểm soát + tối ưu

Ngày đo: 2026-09-25. Nhánh `feature/p2b-t1-hieu-nang` (từ `main` @ `4991f1b`, đã có P2A+P2B).
DB: `ddc_control_tower_b` (localhost:5433) — **không đụng DB của A** (`ddc_control_tower`).
Tài liệu nền: `.bangiao/archive/p2b-bieu-do-2026-09-25/hieu-nang.md` mục 4b (chưa kết luận, chờ đo
lại ở Bước 11 này).

## 0. Vá bảo mật script perf trước khi seed (bắt buộc theo kế hoạch)

`src/lib/perf-guard.ts` + `scripts/perf/seed-perf.ts` + `scripts/perf/measure-pages.ts`:

- **L-1** (chốt chặn chỉ kiểm tên DB, không kiểm host): thêm `assertPerfHost()` — kiểm
  `host(inet_server_addr())` phải loopback (127.0.0.1/::1/unix socket) HOẶC host trong
  `DATABASE_URL` là localhost/127.0.0.1; thêm `assertPerfConfirm()` — bắt buộc env
  `PERF_CONFIRM=ddc_control_tower_b` mới cho seed/xoá chạy tiếp.
- **L-2** (lệnh xoá `dim_project` chỉ theo tiền tố `masterCode`): thêm điều kiện
  `AND "createdBy" = 'perf-seed'` — dự án thật có mã bắt đầu `PERF-` (nếu có) sẽ không bị xoá nhầm.
  Lệnh xoá `audit_log`/`activity_log` vốn đã lọc theo `changedBy`/`userEmail` của perf-seed, không
  đụng dữ liệu người thật — giữ nguyên.
- **L-3** (`PERF_BASE` gửi mật khẩu admin tới bất kỳ URL nào): thêm `assertPerfLocalBase()` — chặn
  host khác localhost/127.0.0.1/::1 trừ khi có `PERF_ALLOW_REMOTE=1`.
- Thêm 22 test mới cho `perf-guard.ts` (tổng 26/26 xanh).

Commit: `ad972e1`.

## 1. Seed 10 triệu dòng (`npm run perf:seed`, tham số mặc định)

```
PERF_CONFIRM=ddc_control_tower_b npm run perf:seed
```

```
dim_project                  500
project_contractor           3,000
project_equipment_plan       3,000
fact_volume                  18,000
fact_financial               18,000
fact_progress_monthly        18,000
activity_log                 100,000
fact_value_chain_progress    126,000
audit_log                    1,000,000
fact_daily_equipment_usage   4,380,000
fact_daily_manpower          4,380,000
TỔNG                          10,046,500
```

Tham số: `projects=500 days=730 end=2026-09-25 audit=1,000,000 activity=100,000` (≥ 10.000.000 —
đạt). Guard mới chạy đúng: `[perf-seed] DB = ddc_control_tower_b (OK, host=::1)`.

## 2. Bench tầng dữ liệu TRƯỚC tối ưu (`npm run perf:bench`, KHÔNG qua `unstable_cache`, 5 vòng/kịch bản)

| Kịch bản | Median (ms) | Max (ms) |
|---|---|---|
| Tổng quan (month=2026-09) | 537 | 612 |
| Tổng quan (month='all') | 1213 | 1539 |
| Chi tiết PERF-0001 | 241 | 499 |
| Chi tiết dự án 1 | 196 | 209 |

### Phân rã từng hàm của nhánh `'all'` (tuần tự, KHÔNG `Promise.all`, 5 vòng/hàm — mới thêm ở
`bench-data.ts`, commit `9a39ed7`)

| Hàm | Median (ms) | Max (ms) |
|---|---|---|
| getTonnageValueByGroup | 219 | 391 |
| getCapacityData | 198 | 205 |
| listProjects | 194 | 486 |
| repo.readLastAuditAt | 194 | 203 |
| getPortfolioKpis | 189 | 198 |
| getWatchlist | 189 | 211 |
| getStatusBreakdown | 189 | 193 |
| getOverdueScorecard | 50 | 56 |
| getPortfolioSCurve | 40 | 51 |
| getSpiCpiTrend | 40 | 49 |
| getMissingMonth | 34 | 43 |
| repo.getDims | 2 | 7 |

**Quan sát:** 6/7 hàm chậm nhất (getTonnageValueByGroup, getCapacityData, listProjects,
getPortfolioKpis, getWatchlist, getStatusBreakdown) đều gọi `getProjectSummaries('all', filters)`
nội bộ — quy về CÙNG MỘT chi phí lặp lại nhiều lần. `repo.readLastAuditAt` (194ms) không gọi
`getProjectSummaries` nhưng vẫn chậm tương đương — xem mục 3 (không phải SQL chậm, xem giải thích).

## 3. Chẩn đoán trực tiếp (script chẩn đoán tạm thời, không commit — đã dùng để định vị nút cổ
chai rồi xoá) — thay cho EXPLAIN vì gốc rễ KHÔNG phải SQL

Đo tách bạch từng phần bên trong `getProjectSummaries('all', {})` (đã revert khỏi `queries.ts` sau
khi lấy số, không có trong diff commit):

| Phần | ms (ổn định sau vòng 1) |
|---|---|
| fetch (`Promise.all(listProjects, getDims, readFactSnapshots)`) | ~20 |
| `byId` (dựng `Map`) | ~0.1 |
| **`summarize()` (map 517 dự án)** | **~50–100** |
| `filterSummaries` | ~0 |

Đối chứng riêng từng repo call (không qua `getProjectSummaries`): `repo.listProjects()` ~15–20ms,
`repo.readFactSnapshots('all')` ~16–20ms, `repo.getDims()` ~1–2ms sau lần gọi đầu (khớp EXPLAIN
mục 5 của tài liệu P2B trước — dưới 20ms mỗi câu, không đổi trên bộ dữ liệu mới). Vậy phần SQL vẫn
nhanh như cũ; chi phí ~50–100ms nằm HOÀN TOÀN trong `summarize()` (JS thuần — `deriveStatus`,
`penaltyState`, `calcDurationPctComplete`, nhiều lần `new Date()`/parse chuỗi ngày cho 517 dự án),
và **KHÔNG giảm dần qua nhiều lần gọi trong cùng tiến trình** (không phải "cache nguội" một lần) —
đây là chi phí THẬT của mỗi lần gọi `getProjectSummaries`, và trang `/overview` gọi lại hàm này
6–8 lần/lần render (không dedupe) → cộng dồn 300–800ms chỉ riêng phần `summarize()`.

**Kết luận: không cần EXPLAIN ANALYZE BUFFERS / không cần index hay bảng tổng hợp mới** — nút cổ
chai nằm ở tầng ứng dụng (gọi lặp lại hàm tổng hợp), không phải ở SQL.

## 4. Tối ưu tầng code (không migration) — commit `a7ea068`

1. **`src/server/queries.ts`**: bọc `getProjectSummaries` bằng `requestMemo()` — dùng
   `React.cache()` khi module chạy trong runtime Next.js thật (dev/build/start, đã qua webpack của
   Next nên `import { cache } from 'react'` trỏ đúng bản có `cache`), **fallback về hàm gốc** (không
   memo, giữ nguyên hành vi cũ) khi chạy qua `tsx` (scripts/perf) hoặc Vitest — ở 2 runtime đó
   `react` (bản cài npm thường) KHÔNG có export `cache` thật, đã kiểm chứng bằng thực nghiệm
   (`cache is not a function` nếu gọi thẳng không có fallback). Scope theo user/role: hàm này không
   nhận tham số user/role (không lọc theo `canViewFinance`), nên dedupe trong 1 request không trộn
   dữ liệu giữa các vai trò — mọi câu gọi trong CÙNG 1 request `/overview` đều dùng chung `filters`
   object (cùng tham chiếu, truyền từ `page.tsx` xuống mọi widget), nên khoá cache của `React.cache`
   (so theo tham chiếu/giá trị đối số) khớp đúng, không cache chéo giữa 2 request khác nhau (mỗi
   request Next.js có instance cache riêng).
2. **N-2** (`danh-gia-bao-mat.md`): `app/[locale]/(app)/overview/page.tsx` — validate `month` bằng
   `isValidYearMonth` (như trang Chi tiết đã làm), giá trị khác `'all'`/sai định dạng rơi về
   `currentMonth()`. Trước đây giá trị rác lọt thẳng vào khoá `unstable_cache`
   (`src/server/cache.ts`), mỗi giá trị rác khác nhau phình thêm 1 khoá cache mới.
3. **`scripts/perf/measure-pages.ts`**: theo đúng quy trình mục 4b của tài liệu P2B trước — gọi 1
   URL làm nóng KHÔNG thuộc `/overview` (`/vi/projects/1`) trước tiên, không tính vào kết quả; đổi
   thứ tự đo `overview?month=all` **TRƯỚC TIÊN** (khoá cache `loadSpiCpiTrend`/`loadSCurve` khoá
   theo `filters` không theo `month` — đo `all` trước để không bị "ăn theo" cache của tháng gọi
   trước).

Cổng kiểm sau tối ưu: `npx tsc --noEmit` sạch; `npm test` **119 file / 1394 test xanh**;
`queries-independent.test.ts` (14 test) + `queries-n1.test.ts` (5 test) xanh riêng — xác nhận
`requestMemo` không đổi số liệu, `getDims` vẫn gọi đúng 1 lần/lời gọi như test N+1 đã khoá.

### Bench tầng dữ liệu SAU tối ưu (`npm run perf:bench` qua `tsx`)

Số liệu KHÔNG đổi so với trước tối ưu (537/1213/241/196 ms — xem mục 2) — **đúng như dự kiến**:
`perf:bench` chạy qua `tsx` (không qua webpack Next.js) nên `requestMemo` luôn rơi vào nhánh
fallback (không memo gì) ở runtime này. Bench tầng dữ liệu KHÔNG có khả năng đo được lợi ích của
`React.cache()` — phải đo bằng HTTP thật qua `next start` (mục 5). Đây là giới hạn của công cụ,
không phải tối ưu không có tác dụng.

## 5. Đo HTTP thật SAU tối ưu (`npm run perf:pages`, `next build` + `next start -p 3001`, quy trình mục 4b)

```
rm -rf .next/cache/fetch-cache
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=D:\_project\DDC_dieu-phoi\tools\font-mock.js npx next build
npx next start -p 3001
PERF_EMAIL=admin@daidung.com.vn PERF_PASSWORD=<xem src/data/seed/history.ts> npm run perf:pages
```

### Lượt 1 — tiến trình MỚI (`next start` vừa khởi động), làm nóng bằng `/vi/projects/1` trước
(không tính điểm), sau đó đo `overview?month=all` TRƯỚC TIÊN

| Trang | ms |
|---|---|
| (làm nóng, không tính) /vi/projects/1 | 1011 |
| /vi/overview?month=all | **541** |
| /vi/overview?month=2026-09 (tháng hiện tại) | 671 |
| /vi/overview?month=2026-08 | 644 |
| /vi/overview?month=2026-07 | 819 |
| /vi/overview?month=2026-06 | 749 |
| /vi/overview?month=2026-05 | 537 |
| /vi/projects/18 (PERF-0001) | 226 |
| /vi/projects/19 (PERF-0002) | 398 |
| /vi/projects/20 (PERF-0003) | 304 |
| /vi/projects/21 (PERF-0004) | 275 |
| /vi/projects/22 (PERF-0005) | 297 |
| /vi/projects/1 | 217 |

**MAX = 819 ms** trên toàn bộ 12 request được tính điểm (script `perf:pages` tự thoát mã 0 vì
≤ 1500 ms mọi request) — bao gồm cả `overview?month=all` đo NGAY LẦN ĐẦU (cache-miss thật, không bị
"ăn theo" cache tháng trước).

### Lượt 2 — lặp lại NGUYÊN request cũ trên CÙNG tiến trình (cache `unstable_cache` đã ấm)

| Trang | ms |
|---|---|
| /vi/overview?month=all | 276 |
| /vi/overview?month=2026-09 | 285 |
| /vi/overview?month=2026-08 | 253 |
| /vi/overview?month=2026-07 | 270 |
| /vi/overview?month=2026-06 | 226 |
| /vi/overview?month=2026-05 | 274 |
| /vi/projects/18..22, /vi/projects/1 | 216–319 |

MAX = **319 ms** (cache hit, không dùng để kết luận đạt/không đạt — chỉ đối chứng).

### Lượt 3 — 4 tháng MỚI HOÀN TOÀN (chưa từng gọi) trên tiến trình đã ấm (loại cold-start tiến
trình, vẫn là cache-miss thật cho khoá mới — đối chứng thêm ngoài 12 request chính thức)

| Trang | ms |
|---|---|
| /vi/overview?month=2026-05 (đã gọi ở lượt 1, đối chứng cache hit) | 264 |
| /vi/overview?month=2026-04 (mới) | 733 |
| /vi/overview?month=2026-03 (mới) | 741 |
| /vi/overview?month=2026-02 (mới) | 701 |

MAX = **741 ms** — dưới 1500 ms.

## 6. KẾT LUẬN: T1 ĐẠT

Tiêu chí (`lo-trinh.md` mục 5, T1): trang Tổng quan và Chi tiết mở ≤ ~1,5 giây trên 10 triệu dòng
giả. **ĐẠT** ở mọi kịch bản đo được:
- Cache-miss thật đầu tiên sau khi tiến trình đã ấm (lượt 1, 12 request chính thức): MAX **819 ms**.
- Cache-miss thật cho khoá hoàn toàn mới (lượt 3, đối chứng thêm): MAX **741 ms**.
- Cache hit (lượt 2): MAX **319 ms**.
- Chỉ request làm nóng tiến trình (`/vi/projects/1` ngay sau `next start`, KHÔNG tính vào tiêu chí
  vì đây là chi phí một lần của tiến trình, không phải của trang `/overview`) mất 1011 ms — vẫn
  dưới 1500 ms dù có tính vào.

So với lần đo trước (P2B, `.bangiao/archive/p2b-bieu-do-2026-09-25/hieu-nang.md` mục 4b — 1/12
request vượt 1500 ms, "chưa kết luận"): lần này KHÔNG có request nào vượt 1500 ms, kể cả đã đo
đúng quy trình có kiểm soát (làm nóng tách bạch cold-start, đo `month=all` trước tiên khi cache
`loadSpiCpiTrend`/`loadSCurve` hoàn toàn nguội).

**Không có đề xuất migration** — nút cổ chai được xác định là ở tầng ứng dụng (gọi lặp hàm tổng hợp
`getProjectSummaries` 6–8 lần/request), đã sửa bằng `React.cache()`/`requestMemo`, không phải do
thiếu index hay cần bảng tổng hợp. 3 truy vấn SQL nền tảng của nhánh `'all'` vẫn dưới 20ms trên 10
triệu dòng (khớp EXPLAIN đã có từ P2B, không đổi trên bộ dữ liệu mới).

## 7. Việc để sau (không chặn, ghi nhận cho người sau)

- `getSpiCpiTrend`/`getPortfolioSCurve` (`src/server/queries.ts`) gọi CÙNG một cặp
  `getScopedProjectIds(filters)` + `repo.readMonthlyEvm(historyMonths(), ids)` với CÙNG tham số —
  có thể gộp thành 1 lần gọi nếu cần giảm thêm, nhưng KHÔNG cần thiết để đạt tiêu chí (mỗi câu chỉ
  ~40ms, xem mục 2).
- `summarize()` (`src/lib/evm.ts`/`queries.ts`) tự thân hơi nặng cho 500+ dự án (nhiều `new Date()`
  parse chuỗi mỗi dự án) — nếu sau này danh mục dự án tăng lên nhiều nghìn, có thể cần tối ưu thêm
  (vd tính `today()` một lần bên ngoài `map`, tránh parse lại ngày dạng chuỗi nhiều lần) — chưa cần
  ở quy mô hiện tại (500 dự án giả, 10 triệu dòng fact) vì đã đạt tiêu chí dư.
- `perf:bench` (tầng dữ liệu, chạy qua `tsx`) không đo được lợi ích của `React.cache()` do giới hạn
  runtime (mục 4) — nếu cần bench nhanh không qua HTTP trong tương lai, cân nhắc chạy bench đó
  trong 1 process giả lập request Next.js (vd qua `next dev` với 1 route API nội bộ) thay vì `tsx`
  trần.

## 8. Cách chạy lại (script đã commit)

```bash
# Vá bảo mật đã có sẵn trong repo (perf-guard.ts) - bắt buộc PERF_CONFIRM
PERF_CONFIRM=ddc_control_tower_b npm run perf:seed

npm run perf:bench   # tầng dữ liệu, khong qua cache, KHONG do duoc loi ich React.cache (xem muc 4)

rm -rf .next/cache/fetch-cache
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=D:\_project\DDC_dieu-phoi\tools\font-mock.js npx next build
npx next start -p 3001
PERF_EMAIL=admin@daidung.com.vn PERF_PASSWORD=<xem src/data/seed/history.ts> npm run perf:pages

PERF_CONFIRM=ddc_control_tower_b npm run perf:clean
npx prisma db seed
```
