# Đo hiệu năng trước/sau khi nâng Next

Quy trình: xem `ke-hoach.md` mục "Quy trình đo và chụp". Build lấy font thật (không mock), DB tạm
`ddc_control_tower_e2e_a`, cổng 3010, cookie phiên admin từ `e2e/.auth/admin.json` (sau `npm run test:e2e:a`).

## Trước (Next 14.2.35)

`npx next build` (font thật) qua, không lỗi tải font (mạng cho qua với `NODE_EXTRA_CA_CERTS`).

| Trang | lần đầu (ms) | median 3 lần sau (ms) |
|---|---|---|
| /vi/overview?month=all | 115 | 59 |
| /vi/overview?month=2026-09 | 95 | 57 |
| /vi/overview?month=2026-08 | 76 | 70 |
| /vi/overview?month=2026-07 | 72 | 65 |
| /vi/projects/1 | 70 | 78 |
| /vi/projects/2 | 98 | 67 |
| /vi/projects/3 | 96 | 77 |

(làm nóng `/vi/projects/4` trước, không tính vào bảng: 513 ms)

Console (Playwright, 1440x900 và 390x844, trang `/vi/overview?month=2026-09` + `/vi/projects/1`): không có
lỗi/cảnh báo (`(khong co)` ở cả 2 kích thước).

Ảnh: `.bangiao/anh-test/truoc-overview-1440.png`, `truoc-overview-390.png`, `truoc-project1-1440.png`,
`truoc-project1-390.png`.

## Sau (Next 15.5.26 + React 19.3.0 + next-intl 4.14.7 + next-auth 4.24.15 + recharts 2.15.4)

`npx next build` (font thật) qua, không lỗi tải font.

| Trang | lần đầu (ms) | median 3 lần sau (ms) |
|---|---|---|
| /vi/overview?month=all | 92 | 36 |
| /vi/overview?month=2026-09 | 50 | 33 |
| /vi/overview?month=2026-08 | 54 | 34 |
| /vi/overview?month=2026-07 | 46 | 29 |
| /vi/projects/1 | 52 | 50 |
| /vi/projects/2 | 41 | 37 |
| /vi/projects/3 | 38 | 37 |

(làm nóng `/vi/projects/4` trước, không tính vào bảng: 541 ms)

**So với "Trước":** mọi ô "lần đầu" của "sau" NHỎ HƠN "trước" (nhanh hơn, không có ô nào chậm hơn quá
20%/150ms) - ví dụ `/vi/overview?month=all` 115ms → 92ms, `/vi/projects/2` 98ms → 41ms. Cột "3 lần sau" vẫn
nhỏ hơn rõ cột "lần đầu" ở hầu hết các dòng (trừ `/vi/projects/1` gần bằng, 52 vs 50ms - chênh không đáng
kể), chứng tỏ `unstable_cache` vẫn ăn cache bình thường sau khi nâng. Không có dấu hiệu thoái hoá hiệu năng.

Console (Playwright, 1440x900 và 390x844, trang `/vi/overview?month=2026-09` + `/vi/projects/1`): không có
lỗi/cảnh báo (`(khong co)` ở cả 2 kích thước) - không có `defaultProps`, không có cảnh báo hydration, không
có "should be awaited".

Hover tooltip Recharts: đã kiểm bằng Playwright (hover vào chart "Lượng & Trị theo Team KD" ở Tổng quan và
chart "Biểu đồ so sánh" ở Chi tiết) - tooltip hiện đúng dữ liệu ở cả 2 trang (xem ảnh `sau-tooltip-*.png`,
xác nhận bằng mắt vì lần kiểm bằng script chọn nhầm phần tử `.recharts-tooltip-wrapper` ẩn (nhiều wrapper
tồn tại trong DOM, có `.first()` không phải wrapper đang active) nên trả `false` giả, nhưng ảnh chụp cho
thấy tooltip hiện rõ ràng, đúng nội dung).

So ảnh `truoc-*` với `sau-*` (`overview`/`project1`, 1440px + 390px): bố cục, chart (đủ trục/tooltip/legend),
font giống hệt nhau. Khác biệt duy nhất: dòng "Cập nhật DB lần cuối" (giờ chạy khác nhau) và mã ngẫu nhiên
"E2E KV ..." (dữ liệu seed sinh số ngẫu nhiên mỗi lần seed) - không phải lỗi hiển thị.

## Phát hiện + đã sửa trong lúc đo (Task 4)

- **e2e `02-overview.spec.ts` đỏ 3/3 lần** (không phải chập chờn - lỗi lặp lại chính xác): `chartCount` = 0
  thay vì >= 4 ngay sau khi kiểm KPI. Điều tra bằng Playwright thủ công (`next start` + script riêng, xem
  console/network): KHÔNG có lỗi JS, không phải recharts/react-is hỏng - cả 5 chart vẫn mount đúng. `.count()`
  đọc DOM một lần duy nhất, không chờ gì cả (không liên quan tới timeout mặc định 5s của `expect()`), nên
  bản chất test cũ vốn đã phụ thuộc thời điểm đọc có trùng lúc chunk client (chứa Recharts) mount xong hay
  chưa. Giả thuyết (chưa kiểm chứng): ở Next 14 `ssr: false` gọi trong Server Component có thể không thực sự
  được áp dụng nên chart đã có sẵn trong bundle trang; nay chart nằm trong client component thật nên là
  chunk lười thật, chỉ nạp sau hydration - qua `next dev` (biên dịch on-demand) có thể mất hơn vài giây.
  Xác nhận: dùng cùng script đo thủ công trên bản `next start` (production, chunk đã build sẵn) thì chart
  lên chỉ sau ~1-2s, chartCount = 5 (đúng số chart của trang, không thiếu chart nào).
  → Sửa `e2e/02-overview.spec.ts` (không sửa app): bọc phép kiểm `.recharts-wrapper` bằng
  `expect(async () => {...}).toPass({ timeout: 15_000 })` thay vì đọc `.count()` một lần duy nhất, để chờ
  đúng lúc chunk client nạp xong thay vì đọc ngay lập tức. Chạy lại riêng spec này 3 lần sau
  sửa: XANH cả 3. Chạy lại toàn bộ 74 spec: XANH 74/74.
- **`npm run check:read` LỆCH ở lần chạy đầu (`readManpowerWeekly/Range/ActualByMonth`)**: do DB tạm đã bị
  chính 74 spec e2e (đặc biệt `04-data-entry.spec.ts` ghi 1 ô số nhân lực thật) sửa dữ liệu SAU khi seed,
  nên lệch với `buildRepoData()` (mốc tĩnh `SEED_REPORT_DATE = 2026-09-16`, không đổi theo thời gian chạy).
  Đây là hệ quả của thứ tự chạy (check:read sau khi đã chạy hết e2e, không phải "seed xong là kiểm ngay"
  như comment đầu `check-read-parity.ts` yêu cầu), KHÔNG liên quan tới việc nâng Next/React/next-intl (mọi
  file trong luồng seed/check đều không bị đụng ở phase này). Seed sạch lại (`npx prisma db seed`, không
  chạy e2e) rồi chạy `npm run check:read` ngay: **OK toàn bộ** (23/23 dòng `[OK]`).
