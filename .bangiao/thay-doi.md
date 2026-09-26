# P7-C1 - nhật ký thay đổi (coder)

> Ghi theo tiến độ từng Bước của `ke-hoach.md`. Lệnh chạy từ `D:\_project\DDC_Control_Tower-C` (PowerShell/Bash tương đương).

## Bước 1 - C-0: e2e tham số hoá theo `.env` của worktree

**File đổi:**
- `e2e/helpers/env.ts`: thêm `E2E_TARGETS`, `parseE2eBaseUrl`, `isExpectedDbUrl` (đổi chữ ký sang 2 tham số `(dbUrl, port)`), `resolveE2eTarget`. Giữ nguyên `loadDotEnv`, `need`.
- `e2e/helpers/env.test.ts`: viết lại toàn bộ theo chữ ký mới, đủ case theo kế hoạch (19 case).
- `e2e/global-setup.ts`: bỏ 2 khối kiểm cũ (`isExpectedDbUrl` 1 tham số + so `NEXTAUTH_URL === 'http://localhost:3001'`), thay bằng `resolveE2eTarget(process.env)`; seed + `PrismaClient` dùng `databaseUrl` trả về từ hàm này.
- `playwright.config.ts`: `baseURL`/`webServer.command`/`webServer.url`/`webServer.env` lấy từ `resolveE2eTarget({ ...process.env, ...loadDotEnv() })` thay vì gõ cứng `3001`.
- `e2e/09-chan-chua-dang-nhap.spec.ts`: `BASE` lấy từ `resolveE2eTarget(...).baseURL` thay vì hằng số `'http://localhost:3001'`.

**1.2 - Test đỏ trước khi cài đặt hàm mới** (`npx vitest run e2e/helpers/env.test.ts`):
kết quả: `6 failed | 13 passed (19)` - lỗi `TypeError: parseE2eBaseUrl is not a function`, `resolveE2eTarget is not a function`, `E2E_TARGETS` undefined (đúng như kỳ vọng, vì hàm mới chưa cài).

**1.8 - Cổng kiểm sau khi cài đặt:**
- `npx vitest run e2e/helpers/env.test.ts` → `19 passed (19)`.
- `npx tsc --noEmit` → sạch, không output.
- `npm test` → `200 passed (files) | 2181 passed (tests)`.

**1.7 - Rà gõ cứng cổng/DB:** grep `3001|ddc_control_tower_b` trong `e2e/` và `playwright.config.ts` → chỉ còn trong `e2e/helpers/env.ts` (định nghĩa `E2E_TARGETS`) và `e2e/helpers/env.test.ts` (dữ liệu test). Không đụng `src/lib/notify-message.test.ts` dòng có `'http://localhost:3001/'` (dữ liệu test thuần, đúng kế hoạch).

**1.9 - Kết quả e2e nền (Bước 1)** (`npx playwright test`, cổng 3003, DB `ddc_control_tower_c`, globalSetup seed lại 17 dự án):

- Lần chạy đầu (`npx playwright test`): **61 passed, 1 failed** trong ~1.5 phút.
  - Test đỏ: `e2e/02-overview.spec.ts:7 - 02 - Tong quan (admin) - hien KPI/chart/bang du an; doi sort; bam dong -> sang chi tiet`
    Lỗi: `expect(locator('table.tbl tbody tr').first().locator('a[href*="/projects/"]').first())).toBeVisible()` timeout - bảng "Danh sách dự án" hiện "Không có dữ liệu" (0 dự án) dù DB có đủ 17 dự án cho tháng hiện tại (`2026-09`, kiểm bằng `mcp__postgres` `fact_progress_monthly` isLatest=true → 17 dòng đúng tháng).
  - **Đây là test đỏ có sẵn, KHÔNG do thay đổi ở Bước 1 gây ra** (không đụng tới `queries.ts`, `cache.ts`, trang overview). Đã điều tra gốc: khởi động 1 dev server thủ công riêng trên cổng 3003 (tắt ngay sau khi xong) sau khi DB đã seed xong, gọi `/vi/overview` bằng cookie phiên admin (lấy từ `e2e/.auth/admin.json`) → trả về đủ 17 dòng dự án, đúng dữ liệu. Chạy lại riêng `npx playwright test e2e/02-overview.spec.ts` (seed lại từ đầu) → **4 passed, 0 failed**, cùng test xanh.
    Kết luận: đây là **test chập chờn (flaky) có sẵn**, nhiều khả năng do lần dev-server khởi động lạnh đầu tiên compile trang overview (nhiều chart RSC) trùng thời điểm dữ liệu vừa seed xong, không lặp lại ổn định. Nguyên nhân gốc nằm ở `src/server/queries.ts`/`src/server/cache.ts` (cache `unstable_cache`, TTL 1800s) hoặc chính `app/[locale]/(app)/overview/page.tsx` - **cả 3 đều NGOÀI phạm vi file được sửa ở Bước 1** (và `queries.ts` nằm trong danh sách file KHÔNG được sửa của cả kế hoạch này). Không sửa. Báo lại chủ dự án/tester để theo dõi thêm nếu tái diễn ở CI/máy khác.
  - Không dùng biến shell để thử "cố tình sai cặp" (theo kế hoạch, `.env` luôn thắng biến shell) - đã chứng minh đủ qua 19 case ở `env.test.ts` (gồm case DB A + mọi cổng → false, cặp lệch → false).

**1.10 - Commit:** `feat(p7-c1): e2e chay theo cap DB + cong trong .env, chan DB cua A (C-0)`.
