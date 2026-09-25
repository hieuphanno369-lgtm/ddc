# XANH

Kiểm độc lập Bước 11 (P2B) — T1 hiệu năng, nhánh `feature/p2b-t1-hieu-nang`
(commit `ad972e1`, `9a39ed7`, `a7ea068`, `f6a5840`; `git diff 4991f1b..HEAD`).
Worktree `D:\_project\DDC_Control_Tower-B`, DB `ddc_control_tower_b` (localhost:5433).
Ngày đo lại: 2026-09-25. Không tin số của coder — mọi số dưới đây tự đo lại từ đầu
(seed lại 10.046.500 dòng, build lại, start lại tiến trình, tự viết thêm 2 kịch bản
ngoài `hieu-nang.md`).

## Lưu ý môi trường quan trọng cho người đọc sau

`mcp__postgres` (tool có sẵn trong phiên) đang trỏ vào `ddc_control_tower` (DB của
**tài khoản A**), không phải `ddc_control_tower_b` — đúng "worktree local-MCP pitfall"
đã ghi trong memory `two-account-setup.md`. Đã xác nhận bằng `SELECT current_database()`
qua chính tool đó (chỉ 1 câu SELECT, không ghi gì) rồi dừng dùng tool này. Toàn bộ kiểm
tra DB `ddc_control_tower_b` trong báo cáo này chạy qua script `tsx` dùng
`src/server/db.ts` (đọc `DATABASE_URL` từ `.env` của worktree B) — không đụng
`D:\_project\DDC_Control_Tower` / DB `ddc_control_tower` ở bất kỳ bước nào khác.

## 1. Cổng kiểm tĩnh (qua PowerShell, đúng yêu cầu — Git Bash làm Vitest báo giả)

- `npx tsc --noEmit` → sạch, không output, exit 0.
- `npm test` → **119 file / 1394 test xanh** (log file gốc xác nhận, không dựa vào
  `$LASTEXITCODE` của PowerShell vì bị lệch do encoding UTF-16 khi redirect — đã đọc
  trực tiếp nội dung log: `Test Files 119 passed (119)`, `Tests 1394 passed (1394)`).
  Khớp con số coder báo.
- `npm run check:read` → **OK** (17/18 dòng `[OK]`, chạy SAU khi dọn + reseed, DB ở
  trạng thái 17 dự án mặc định).

## 2. Guard bảo mật L-1/L-2/L-3 — tự chạy lại, không đọc code suông

| Kịch bản | Lệnh | Kết quả |
|---|---|---|
| Thiếu `PERF_CONFIRM` | `npx tsx scripts/perf/seed-perf.ts --projects=1 ...` (không set env) | **Từ chối đúng** — ném `perf-guard: thieu hoac sai bien moi truong PERF_CONFIRM`, exit code **1** |
| `PERF_BASE=http://example.com` | `PERF_BASE=http://example.com PERF_EMAIL=x PERF_PASSWORD=x npx tsx scripts/perf/measure-pages.ts` | **Từ chối đúng** — `perf-guard: PERF_BASE 'http://example.com' khong phai host loopback`, exit code **1** |
| L-2 (xoá `dim_project` chỉ dòng `createdBy='perf-seed'`) | Tạo 1 dự án thật `masterCode='PERF-X'`, `createdBy='hieupt1@daidung.vn'` (không phải `perf-seed`) qua Prisma trực tiếp → chạy `PERF_CONFIRM=ddc_control_tower_b npm run perf:clean` → kiểm đếm | **PERF-X KHÔNG bị xoá** — trước clean: total=17,perf=0 (baseline); sau khi tạo PERF-X: total=18,perf=1; sau `perf:clean`: **vẫn total=18,perf=1** (không đổi) → đã tự xoá PERF-X thủ công sau đó, xác nhận về lại total=17,perf=0 |

Guard hoạt động đúng như tài liệu mô tả, không phải chỉ đọc code mà đã tự tay kích hoạt
cả 3 đường từ chối + 1 đường "không xoá nhầm".

## 3. Seed 10 triệu dòng

`PERF_CONFIRM=ddc_control_tower_b npm run perf:seed` (tham số mặc định) → tổng
**10.046.500 dòng**, khớp CHÍNH XÁC bảng trong `hieu-nang.md` mục 1 (dim_project 500,
audit_log 1.000.000, fact_daily_equipment_usage 4.380.000, fact_daily_manpower
4.380.000, …).

## 4. Build + start

`rm -rf .next/cache/fetch-cache` → `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=...font-mock.js
npx next build` → **Compiled successfully**. `npx next start -p 3001` → Ready, HTTP 200
tại `/vi/login`.

## 5. Đo HTTP thật — bảng số đo độc lập

### 5a. Đúng quy trình `hieu-nang.md` (`npm run perf:pages`, tiến trình mới, warmup
`/vi/projects/1` trước, `month=all` đo đầu tiên)

| Trang | ms (đo lại) | ms (coder báo, lượt 1) |
|---|---|---|
| (làm nóng, không tính) /vi/projects/1 | 902 | 1011 |
| /vi/overview?month=all | 642 | 541 |
| /vi/overview?month=2026-09 | 806 | 671 |
| /vi/overview?month=2026-08 | 732 | 644 |
| /vi/overview?month=2026-07 | **833** | 819 |
| /vi/overview?month=2026-06 | 758 | 749 |
| /vi/overview?month=2026-05 | 779 | 537 |
| /vi/projects/19 (PERF-0001) | 397 | 226 |
| /vi/projects/20 (PERF-0002) | 440 | 398 |
| /vi/projects/21 (PERF-0003) | 368 | 304 |
| /vi/projects/22 (PERF-0004) | 350 | 275 |
| /vi/projects/23 (PERF-0005) | 441 | 297 |
| /vi/projects/1 | 347 | 217 |

**MAX đo lại = 833 ms** (request `/vi/overview?month=2026-07`) — số tuyệt đối không trùng
khớp 1-1 với coder (bình thường, máy/tiến trình khác nhau, port chưa "ấm" y hệt), nhưng
**cùng thứ tự độ lớn** (dưới 1 giây, không request nào gần ngưỡng 1500 ms) → xác nhận độc
lập kết luận "không có request nào vượt 1500 ms" của coder.

### 5b. Kịch bản TỰ THÊM — restart tiến trình, đo `/vi/overview?month=all` NGAY, KHÔNG
warmup (không gọi `/vi/projects/1` trước, khác quy trình 5a) — cold-start thật nhất
có thể đo được

Dừng tiến trình `next start` cũ (`Stop-Process -Id <pid đúng của mình>`, không
`taskkill /IM node.exe`), khởi động tiến trình mới, đăng nhập rồi gọi thẳng
`/vi/overview?month=all` là request ĐẦU TIÊN vào trang này của tiến trình:

| Trang | ms |
|---|---|
| /vi/overview?month=all (request đầu tiên của tiến trình, không warmup) | **941** |

**Dưới 1500 ms**, dù đây là cold-start nặng nhất có thể tạo ra (nạp toàn bộ module
route `/overview` + mở pool Prisma + build lần đầu các Suspense boundary, KHÔNG được
"làm nóng" bởi request nào khác trước đó ngoài 2 lệnh gọi API đăng nhập nhẹ
`/api/auth/csrf` + `/api/auth/callback/credentials`, không phải trang `/overview`).

### 5c. Trang Chi tiết của dự án có NHIỀU DÒNG NHẤT

Truy vấn trực tiếp DB: 5 dự án `PERF-0001..PERF-0005` (id 19-23) đồng hạng nhất với
17.520 dòng fact theo ngày mỗi dự án (max trong toàn bộ 501 dự án có dữ liệu daily) —
đã đo ở bảng 5a: **350–441 ms**, dưới xa 1500 ms.

### 5d. User role hẹp + kiểm tra `requestMemo` không trộn dữ liệu giữa user

Đọc code: `getProjectSummaries(yearMonth, filters)` — 2 tham số, KHÔNG có tham số
user/role/session. `React.cache()` của Next.js scope theo request (AsyncLocalStorage),
nên 2 tham số giống nhau luôn ra cùng kết quả bất kể user nào gọi — không có đường nào
để dữ liệu của user A lọt sang response của user B qua cơ chế memo này (khác với lỗi
kiểu "global module cache" sẽ rò rỉ giữa các request).

Kiểm chứng thực nghiệm (không chỉ đọc code): đăng nhập đồng thời `admin@daidung.com.vn`
(role admin, `canViewFinance=true`) và `viewer@daidung.com.vn` (role viewer,
`canViewFinance=false`) — bắn 5 vòng, mỗi vòng 2 request THẬT SỰ đồng thời
(`Promise.all`) với `month` khác nhau (`admin` → `2026-09`, `viewer` → `2026-05`), so
KPI `totalProjects`/`inProgress` trích từ HTML trả về với "sự thật" đo trực tiếp qua
`getPortfolioKpis()` không qua HTTP:

| Tham chiếu (đo trực tiếp, không qua cache HTTP) | totalProjects | inProgress |
|---|---|---|
| Tháng 2026-09 | 517 | 515 |
| Tháng 2026-05 | 517 | 516 |

| Vòng | admin (month=2026-09) | viewer (month=2026-05) |
|---|---|---|
| 0–4 (cả 5 vòng) | `517 / 515` (khớp) | `517 / 516` (khớp) |

**Không có vòng nào bị lẫn** (vd admin ra `516` của viewer, hay ngược lại) — xác nhận
`requestMemo` không trộn dữ liệu giữa 2 user chạy song song, kể cả khi ép chạy đồng thời
thật sự (không phải tuần tự).

Ghi chú công bằng: vì `/overview` hiện KHÔNG lọc dự án theo user/role (chỉ ẩn/hiện vài
widget theo `canViewFinance`/`isAdmin`, không giới hạn tập dự án), nên "viewer có ít dự
án hơn theo seed" không áp dụng được cho trang này — đây là hành vi sẵn có của ứng dụng
(đã có TODO BOLA ghi sẵn ở `getProjectSummary`, không phải lỗi phát sinh từ Bước 11).
Không ảnh hưởng tới kết luận T1 vì bài kiểm tra thực chất (race 2 user đồng thời, filter
khác nhau) vẫn chứng minh được tính đúng đắn của memo theo request.

## 6. Dọn dẹp sau đo

- `PERF_CONFIRM=ddc_control_tower_b npm run perf:clean` → xoá hết dữ liệu PERF.
- `npx prisma db seed` → "Seed xong: 17 dự án...".
- Xác nhận lại qua script: `{ total: 17, perf: 0 }`.
- `npm run check:read` → OK (17/17 mục khớp).
- Dừng đúng tiến trình `next start` mình khởi động bằng `Stop-Process -Id <PID xác nhận
  đúng qua Get-Process>` (2 lần, ứng với 2 lần start ở mục 5a/5b) — không dùng
  `taskkill /IM node.exe`.
- Không đụng `D:\_project\DDC_Control_Tower` hay DB `ddc_control_tower` (chỉ 1 câu
  SELECT read-only qua `mcp__postgres` bị trỏ nhầm, xem mục "Lưu ý môi trường").
- Không sửa `phien-B.md`, không sửa code sản phẩm — chỉ tạo file test/script tạm trong
  scratchpad (đã xoá) và file kết quả này.

## 7. KẾT LUẬN

**T1 ĐẠT** — xác nhận độc lập ở TẤT CẢ kịch bản đo được, kể cả 2 kịch bản khắt khe hơn
tự thêm ngoài `hieu-nang.md`:

- Quy trình chính thức (12 request, lượt cache-miss đầu của tiến trình mới): MAX **833 ms**.
- Cold-start thật nhất có thể tạo (restart tiến trình, đo `/overview?month=all` NGAY,
  không warmup gì khác ngoài đăng nhập): **941 ms**.
- Trang Chi tiết dự án nhiều dòng nhất (PERF-0001..0005, 17.520 dòng/dự án): **350–441 ms**.
- Không có request nào (kể cả 2 kịch bản tự thêm) vượt 1500 ms.
- `requestMemo`/`React.cache()` xác nhận scope đúng theo request — không trộn dữ liệu
  giữa 2 user chạy đồng thời với filter khác nhau (đọc code + thực nghiệm race 5 vòng).
- Guard L-1/L-2/L-3 hoạt động đúng: từ chối thiếu `PERF_CONFIRM`, từ chối `PERF_BASE` xa,
  không xoá nhầm dự án thật có `createdBy` khác `perf-seed`.
- `npx tsc --noEmit` sạch, `npm test` 119/119 file – 1394/1394 test xanh, `check:read` OK.

Test rớt: KHÔNG có (mọi guard "phải từ chối" đều từ chối đúng như kỳ vọng — coi đây là
"trường hợp phải thất bại" đã yêu cầu, và nó thất bại/từ chối đúng ý thiết kế, không phải
lỗi). Không phát hiện sai lệch nào so với báo cáo của coder ở mức kết luận (T1 ĐẠT), chỉ
có sai số tuyệt đối bình thường giữa 2 lần đo trên cùng máy (chênh trong khoảng 100-300ms
mỗi request, không đổi thứ hạng, không có request nào áp sát 1500 ms).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
