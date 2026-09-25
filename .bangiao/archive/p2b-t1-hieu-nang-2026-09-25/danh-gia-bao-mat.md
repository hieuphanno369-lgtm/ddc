PHÁN QUYẾT BẢO MẬT: ĐẠT

# Rà bảo mật Bước 11 T1 (`git diff 4991f1b..HEAD`, nhánh `feature/p2b-t1-hieu-nang`)

> Nội dung do subagent security-reviewer (vai chỉ đọc) trả về; điều phối viên lưu vào file này.

Skill: `ddc-tower:security-review`. Soi tĩnh commit ad972e1, 9a39ed7, a7ea068, f6a5840. MCP postgres (chỉ đọc) nối DB của A: `masterCode LIKE 'PERF-%'` = 0 dòng → seed chưa từng chạm DB của A; `host(inet_server_addr())` = `'::1'`.

## Trạng thái phát hiện cũ

| Mã | Trạng thái | Chứng cứ |
|---|---|---|
| L-1 guard chỉ kiểm tên DB | **ĐÃ ĐÓNG** | `perf-guard.ts` có `assertPerfHost`, `assertPerfConfirm`; `seed-perf.ts:28-34` gọi confirm → db → host trước DELETE đầu tiên. |
| L-2 xoá theo tiền tố + cascade | **ĐÃ ĐÓNG** | `seed-perf.ts:38-40` `"masterCode" LIKE 'PERF-%' AND "createdBy" = 'perf-seed'` (bind qua `Prisma.sql`); audit/activity lọc `changedBy='perf-seed'`, `userEmail='perf@seed.local'`. |
| L-3 `PERF_BASE` gửi mật khẩu tới host bất kỳ | **ĐÃ ĐÓNG** | `measure-pages.ts:21-26` `assertPerfLocalBase(BASE, PERF_ALLOW_REMOTE==='1')` trước `login()`; fetch đầu tiên (dòng 48) sau chốt; login `redirect: 'manual'`. |
| N-2 `month` ở /overview không validate | **ĐÃ ĐÓNG** | `overview/page.tsx:53-54` khác `'all'` phải qua `isValidYearMonth`, sai → `currentMonth()`; không còn rác vào khoá `unstable_cache`. |

## 1. Chốt chặn perf
- `PERF_CONFIRM` so khớp chặt; thiếu/sai → ném lỗi.
- Host loopback: `inet_server_addr ∈ {null, 127.0.0.1, ::1}` HOẶC hostname `DATABASE_URL` ∈ {localhost, 127.0.0.1} (chủ ý cho Docker/tunnel, có test). Prisma runtime dùng `DATABASE_URL` nên chốt kiểm đúng biến.
  - **R-1 (thấp, chấp nhận):** `localhost` là SSH tunnel tới server khác có DB trùng tên + `PERF_CONFIRM` đúng → vẫn qua. Muốn chặt hơn: khi `inet_server_addr` không loopback thì bắt thêm `PERF_ALLOW_REMOTE_DB=1`.
  - **R-2 (ghi nhận, lỗi về phía an toàn):** `new URL('postgresql://u@[::1]:5433/db').hostname` = `'[::1]'` nên `'::1'` trong `PERF_LOOPBACK_HOSTS` không khớp → từ chối nhầm, không cho qua nhầm. Tương tự `::ffff:127.0.0.1`. Sửa: thêm `'[::1]'`.
- Chỉ xoá dòng perf-seed: cả 3 DELETE có điều kiện định danh perf; `--clean-only` qua cùng chốt.
- `PERF_BASE` chỉ localhost/127.0.0.1/::1; URL hỏng → ném lỗi.
  - **R-3 (thấp):** với `PERF_ALLOW_REMOTE=1` vẫn nhận `http://` → gửi email/mật khẩu admin dạng rõ (`measure-pages.ts:53-58`). Vá: host không loopback thì bắt buộc `https:`.

## 2. `requestMemo` / React.cache cho `getProjectSummaries` (`src/server/queries.ts:153-168`)
- **Không thể trả dữ liệu user A cho user B:** `getProjectSummariesUncached(yearMonth, filters)` không đọc định danh/role/scope; `DashboardFilters` chỉ gồm status, team, customer, priority, market, type, groupBy, groupKey; vốn đã nằm trong `unstable_cache` dùng chung ("KHÔNG phụ thuộc user"). Phần theo role (`canViewFinance`, admin-only) gate ở page, ngoài memo.
- Khoá memo: `Object.is` từng tham số; `filters` khác tham chiếu → miss, gọi lại hàm gốc; không thể filters khác mà trả cùng kết quả.
- Phạm vi: React.cache chỉ trong 1 lần render RSC (1 request); ngoài render (server action, route handler, tsx, Vitest) gọi thẳng `fn`. Không cache vượt request.
- Fallback không có `cache`: trả chính hàm gốc — không có cache toàn cục tự chế, an toàn.
- Mảng memo dùng chung trong request: các chỗ gọi (dòng 196, 254, 269, 296, 348, 390) chỉ `.filter`/`.map`/`[...rows].sort`; `getWatchlist` sort sau filter (mảng mới). Không sửa mảng/phần tử cache.

## 3. Phần khác
- `bench-data.ts` chỉ đọc + in thời gian; `measure-pages.ts` URL làm nóng `/vi/projects/1` không ảnh hưởng bảo mật.
- Không secret mới, không `dangerouslySetInnerHTML`, không SQL nối chuỗi; `$executeRaw` đều `Prisma.sql` bind.

## 4. Ghi chú có từ trước (không tính vào phán quyết)
- **N-2b (thấp):** các tham số khác của /overview (`status`, `priority`, `market`, `type`, `groupBy`, `groupKey`, `team`/`customer` → `Number()` có thể `NaN`) chưa kiểm danh sách trắng, vẫn vào khoá `unstable_cache` (TTL 1800s) → còn vector phình cache. Vá: kiểm theo enum và `dims`, sai → `'all'`/`undefined`.
- N-1 (next@14.2.35 RCE khi host Windows), N-3 (S-curve/What-if khi không có `canViewFinance`) chờ chủ dự án. `getProjectSummary` còn TODO BOLA (che bởi `requireProjectRead`).

## Kết luận
**ĐẠT.** L-1, L-2, L-3, N-2 đã đóng; `requestMemo` không rò dữ liệu giữa user/request, fallback an toàn. R-1, R-2, R-3, N-2b thấp/ghi nhận, không chặn merge. Nên vá R-3 và N-2b trong lượt dọn tiếp theo.
