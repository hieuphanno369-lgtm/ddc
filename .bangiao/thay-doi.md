# Bước 11 (P2B) — T1 hiệu năng — tóm tắt thay đổi

Nhánh `feature/p2b-t1-hieu-nang` (từ `main` @ `4991f1b`). 3 commit code + 1 doc (file này +
`hieu-nang.md`).

## Commit 1 — `ad972e1` fix(perf): vá L-1/L-2/L-3 bảo mật script perf

- `src/lib/perf-guard.ts`: thêm `isLoopbackDatabaseUrl`, `assertPerfHost` (L-1 — kiểm
  `inet_server_addr()`/host `DATABASE_URL` phải loopback), `assertPerfConfirm` (L-1 — bắt buộc
  `PERF_CONFIRM=ddc_control_tower_b`), `assertPerfLocalBase` (L-3 — `PERF_BASE` chỉ localhost trừ
  khi `PERF_ALLOW_REMOTE=1`).
- `scripts/perf/seed-perf.ts`: gọi `assertPerfConfirm`/`assertPerfHost` trước mọi DELETE/INSERT;
  lệnh xoá `dim_project` cũ thêm `AND "createdBy" = 'perf-seed'` (L-2 — trước đây chỉ lọc theo tiền
  tố `masterCode LIKE 'PERF-%'`, có thể xoá nhầm dự án thật nếu trùng tiền tố).
- `scripts/perf/measure-pages.ts`: gọi `assertPerfLocalBase` trước khi đăng nhập.
- `src/lib/perf-guard.test.ts`: +22 test (tổng 26/26 xanh).

**Tester nên soi kỹ:** `assertPerfHost` cho phép "loopback theo `DATABASE_URL`" NGAY CẢ KHI
`inet_server_addr()` trả về IP xa — có chủ đích (dùng khi kết nối qua SSH tunnel/port-forward tới
DB local nhưng Postgres nhìn thấy peer là địa chỉ khác), xem test
`'inet_server_addr xa nhung DATABASE_URL localhost -> khong nem'`.

## Commit 2 — `9a39ed7` perf(t1): đo riêng từng hàm nhánh 'all' của perf:bench

- `scripts/perf/bench-data.ts`: thêm `benchOverviewBreakdown()` — chạy TUẦN TỰ (không `Promise.all`)
  12 hàm dùng ở `/overview` cho `month='all'`, in median/max riêng từng hàm. Dùng để định vị nút cổ
  chai thật (mục 2-3 `hieu-nang.md`) trước khi quyết định sửa gì.

## Commit 3 — `a7ea068` perf(t1): dedupe getProjectSummaries + validate month ở /overview

- **`src/server/queries.ts`** (file nóng — đã giữ khoá trong lúc sửa, nhả sau commit, xem
  `phien-B.md`): thêm `requestMemo()` bọc `getProjectSummaries` bằng `React.cache()` khi chạy
  trong Next.js thật, fallback về hàm gốc (không memo) khi chạy qua `tsx`/Vitest (2 runtime đó
  `react` không có export `cache` thật — đã thực nghiệm xác nhận, xem mục 4 `hieu-nang.md`).
  **Tester nên soi kỹ:** đây là điểm dễ hiểu lầm nhất — `perf:bench` (chạy qua `tsx`) sẽ KHÔNG cho
  thấy tác dụng của thay đổi này (số liệu bench-data không đổi trước/sau), phải kiểm bằng
  `perf:pages` (HTTP thật qua `next start`). Đã xác nhận `queries-n1.test.ts` (đếm số lần gọi
  `getDims`) và `queries-independent.test.ts` (đối chiếu số liệu cũ/mới) vẫn xanh — số liệu hiển
  thị không đổi, chỉ giảm số lần gọi lặp trong 1 request thật.
- **`app/[locale]/(app)/overview/page.tsx`**: validate `month` bằng `isValidYearMonth` (N-2,
  `danh-gia-bao-mat.md`), theo đúng pattern đã dùng ở trang Chi tiết dự án.
- **`scripts/perf/measure-pages.ts`**: thêm 1 request làm nóng `/vi/projects/1` (không tính điểm)
  trước khi đo, và đổi thứ tự `overview?month=all` lên ĐẦU danh sách thay vì cuối — đúng quy trình
  mục 4b của `hieu-nang.md` cũ (P2B). Đây là thay đổi HÀNH VI của script đo (không chỉ thêm), nên
  nếu người sau chạy lại và so với số liệu `perf:pages` TRƯỚC commit này, thứ tự trang trong bảng
  kết quả sẽ khác.

## `.bangiao/hieu-nang.md` (mới)

Ghi đầy đủ môi trường/quy trình/số đo trước-sau/chẩn đoán/kết luận. Tóm tắt: **T1 ĐẠT** — HTTP thật
trên 10 triệu dòng, MAX 819 ms (lượt cache-miss đầu tiên, đúng quy trình mục 4b) — dưới 1500 ms.
Không cần migration/index (nút cổ chai ở tầng ứng dụng — gọi lặp `getProjectSummaries`, đã sửa
bằng cache tầng request — không phải SQL chậm).

## Việc đã làm nhưng KHÔNG để lại trong diff (minh bạch cho tester)

Để định vị nút cổ chai (mục 3 `hieu-nang.md`), đã tạo và XOÁ 5 file chẩn đoán tạm
(`scripts/perf/__diag*.ts`) và tạm thời chèn `console.log`/`performance.now()` vào
`getProjectSummaries` rồi revert lại NGUYÊN VẸN trước khi commit (đã kiểm `git diff --stat` rỗng
trước commit `ad972e1`). Không ảnh hưởng lịch sử/diff cuối cùng.

## Cổng kiểm (chạy qua PowerShell, thư mục `D:\_project\DDC_Control_Tower-B`)

- `npx tsc --noEmit`: sạch (sau cả 3 commit).
- `npm test`: **119 file / 1394 test xanh** (không đổi so với trước Bước 11 — không có test nào
  thêm/bớt số lượng, chỉ thêm 22 test perf-guard đã tính trong tổng này).
- `npm run check:read`: **OK** (17/17 mục khớp) — chạy SAU khi `npm run perf:clean` +
  `npx prisma db seed` để trả DB về seed mặc định 17 dự án (đã xác nhận `dim_project` count=17,
  perf-prefix count=0 trước khi chạy).

## Lệch kế hoạch / quyết định tự đưa ra (không có câu hỏi cần chủ dự án quyết)

1. **EXPLAIN ANALYZE BUFFERS không được thực hiện cho hàm chậm nhất** như kế hoạch gợi ý, vì đã
   chứng minh (mục 3 `hieu-nang.md`) hàm chậm nhất trong bench (`getTonnageValueByGroup` 219ms)
   chậm do gọi `getProjectSummaries` (chi phí nằm trong `summarize()` — JS thuần, không phải SQL);
   3 câu SQL nền tảng vẫn <20ms như EXPLAIN cũ của P2B, không đổi trên bộ dữ liệu mới. EXPLAIN thêm
   sẽ không cho thông tin mới.
2. **Đổi thứ tự URL trong `measure-pages.ts`** (đưa `month=all` lên đầu) là thay đổi hành vi cố ý,
   theo đúng yêu cầu quy trình mục 4b của kế hoạch (không phải lỗi/lệch).
3. Không có mục "Đề xuất migration" trong `hieu-nang.md` vì T1 đã ĐẠT mà không cần — đúng nguyên
   tắc "chỉ đề xuất index khi có bằng chứng cần" của kế hoạch.

## CÂU HỎI CHO CHỦ DỰ ÁN

Không có — mọi quyết định trong phạm vi Bước 11 đều suy ra được từ kế hoạch + tài liệu nền có sẵn.
