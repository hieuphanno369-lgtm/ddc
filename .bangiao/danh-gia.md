PHAN QUYET: CHOT

# Đánh giá cuối Bước 11 (P2B) T1 hiệu năng — `feature/p2b-t1-hieu-nang`, `git diff 4991f1b..HEAD`

> Nội dung do subagent reviewer (vai chỉ đọc) trả về; điều phối viên lưu vào file này.

Skill: `ddc-tower:code-review`. Reviewer tự chạy qua PowerShell: `tsc` sạch; `npm test` 119/119 file · 1394/1394 xanh.

## 1. Khớp kế hoạch — Có
- Quy trình 4b (archive `p2b-bieu-do-2026-09-25/hieu-nang.md`) làm đủ: URL làm nóng ngoài `/overview` (`measure-pages.ts:92-95`), `month=all` đo trước tiên (`:97-100`), bench tách từng hàm nhánh `'all'` (`bench-data.ts:81-104`).
- L-1/L-2/L-3 vá trước seed (`perf-guard.ts:22-79`, `seed-perf.ts:28-41`); N-2 vá (`overview/page.tsx:53-54`).
- Không migration (`prisma/` không đổi); file cấm không đổi; file nóng duy nhất `queries.ts` có giữ/nhả khoá.
- Không trùng với A (`feature/p3a-form-tao-sua` chưa có commit ngoài `main`). `main` có 3 commit mới (`964ecd7`, `d5f02ea`, `cfc1945`) chỉ chạm `.serena/` + `erd-doc.test.ts` → merge sạch.
- Lệch hợp lý: không EXPLAIN hàm chậm nhất vì đã chứng minh chi phí ở `summarize()` (JS), 3 câu SQL nền < 20 ms.

## 2. Bằng chứng T1 (≤ ~1,5 s) — Đủ
| Kịch bản | Coder | Tester (độc lập, seed + build lại) |
|---|---|---|
| Quy trình 4b, 12 request, cache-miss thật, `month=all` đầu tiên | max 819 ms | max 833 ms |
| Cold-start thật (restart, gọi `/overview?month=all` ngay, không làm nóng) | — | 941 ms |
| Tháng mới chưa gọi, tiến trình ấm | max 741 ms | — |
| Chi tiết dự án nhiều dòng nhất (17.520 dòng) | 226–398 ms | 350–441 ms |
| Cache hit (đối chứng) | max 319 ms | — |
- 10.046.500 dòng, 517 dự án; 2 lần seed khớp. Admin + viewer đồng thời 5 vòng, khác tháng: KPI khớp tham chiếu, không trộn.
- Khắc phục đủ 3 điểm vòng trước bác (1 lượt đo, 1/12 vượt 1635 ms, không tách cold-start/cache chéo tháng).

## 3. `requestMemo` — Đúng
- `react@18.3.1` npm không có `exports.cache`; `next/dist/compiled/react` (RSC) có → `typeof reactCache === 'function'` phân biệt đúng; fallback trả hàm gốc (`queries.ts:153-155`).
- Không memo vượt request; hàm không nhận tham số user/role, vốn nằm dưới `unstable_cache` dùng chung.
- Khoá memo: `filters` cùng tham chiếu từ `page.tsx:57`; khác tham chiếu chỉ miss, không sai.
- Mảng dùng chung không bị sửa (`queries.ts:196, 254, 269, 296, 348, 390`).
- Không đổi số: `queries-independent.test.ts` (14) + `queries-n1.test.ts` xanh.

## 4. Test — Có giá trị thật
- `perf-guard.test.ts` kiểm cả từ chối lẫn cho qua; tester tự kích hoạt 3 đường từ chối (thiếu `PERF_CONFIRM`, `PERF_BASE` xa, L-2 không xoá nhầm `PERF-X`).
- Đo HTTP độc lập + 2 kịch bản ngoài kế hoạch.

## 5. Bảo mật — ĐẠT (reviewer đồng ý). Guard chạy trước mọi DELETE; SQL bind `Prisma.sql`.

## Mục chặn merge
Không có.

## Đã xử lý thêm sau CHOT (điều phối viên)
- Mục "Để sau" 5(b): thêm `src/server/queries-request-memo.test.ts` (giả lập `React.cache`) khoá nhánh memo — cùng tham số → 1 lần đọc repo, khác tham số → đọc lại.
- Mục "Để sau" 6: sửa "+22 test" → "+16 test" ở `thay-doi.md:16,66`, `hieu-nang.md:22`.

## Để sau (không chặn merge)
1. **R-1** (`perf-guard.ts:38-45`): `localhost` là SSH tunnel tới server khác có DB trùng tên + `PERF_CONFIRM` đúng vẫn qua → bắt thêm `PERF_ALLOW_REMOTE_DB=1` khi `inet_server_addr` không loopback.
2. **R-2** (`perf-guard.ts:22`): IPv6 `hostname` ra `'[::1]'` không khớp `'::1'` (chỉ từ chối nhầm) → thêm `'[::1]'`.
3. **R-3** (`perf-guard.ts:68-79`, `measure-pages.ts:21-26`): `PERF_ALLOW_REMOTE=1` + host không loopback → bắt buộc `https:`.
4. **N-2b** (`overview/page.tsx:57-66`): `status`/`priority`/`market`/`type`/`groupBy`/`groupKey` chưa kiểm danh sách trắng; `team`/`customer` `Number()` có thể `NaN` → vẫn vào khoá `unstable_cache` (TTL 1800 s). Kiểm theo enum/`dims`.
5. **Memo trên `next start`** (a): chưa đếm số lần gọi `getProjectSummariesUncached` trong 1 request thật; mức giảm (864–1173 → 644–833 ms) nhỏ hơn dự đoán 300–800 ms — "đã sửa bằng React.cache" là suy luận; T1 vẫn đạt nhờ số đo trực tiếp. (b) đã làm — xem trên.
6. `hieu-nang.md` mục 7: gộp `getSpiCpiTrend`/`getPortfolioSCurve`; tối ưu `summarize()` (parse ngày 1 lần) khi số dự án lên nhiều nghìn.

## Kết luận
CHỐT. T1 ĐẠT có số đo lặp lại được từ 2 bên độc lập, kể cả cold-start thật. Trước merge: archive `.bangiao/` → `.bangiao/archive/p2b-t1-hieu-nang-2026-09-25/`, `git merge main`.
