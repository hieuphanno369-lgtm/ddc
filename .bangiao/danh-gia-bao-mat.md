PHAN QUYET BAO MAT: DAT

# Đánh giá bảo mật P7-C1 (nhánh feature/p7-c-task-bo-sung)

Skill đã dùng: `ddc-tower:security-review`, `ddc-tower:security-audit` (chế độ guidance, rà tập trung vào diff).
Kiểm DB thật qua `mcp__postgres` và PrismaClient của repo, chỉ chạy `SELECT`, không ghi dữ liệu.

> Ghi chú điều phối: security-reviewer không có công cụ ghi file; bên điều phối lưu nguyên văn báo cáo vào file này.

## Vòng 2 (diff 42d543c..HEAD: 7d7cc77, a29d2db, 4e528a1, 896217b, 743f841, 42ab7f6)

Phạm vi: bản vá L-1 trong e2e/helpers/env.ts (`isExpectedDbUrl`, dòng 79-92), test mới trong e2e/helpers/env.test.ts, và các đường vòng ngoài query string.
Code sản phẩm (`src/`, `app/`, `prisma/`) không đổi trong vòng này, chỉ đổi e2e/helpers và `.bangiao/`.

### 1. L-1 đã đóng - đã kiểm bằng chạy thật

Logic hiện tại (env.ts dòng 86-91): host đúng `localhost`, cổng đúng `5433`, không có hash, query chỉ được có 0 cặp hoặc đúng 1 cặp `schema=public`, tên DB khớp chính xác cặp theo cổng.

Chạy thật từng query string trên engine Prisma 6.19.3 (thư viện native `query_engine-windows.dll.node`, không dùng driver adapter `pg`), nối vào DB `_c` bằng câu `SELECT current_database(), inet_server_port(), current_setting('search_path')`:

| Query thêm vào DATABASE_URL | Prisma thực sự làm gì | Guard hiện tại |
|---|---|---|
| `?host=db.invalid` | Nối tới `db.invalid:5433`, tức host trong query thắng host trong URL. Vòng 1 mới là giả thuyết, nay đã xác nhận L-1 có thật. | Từ chối |
| `?schema=public&schema=evil` | Lấy giá trị **cuối**: search_path = `evil`. Bản vá đầu `a29d2db` dùng `.get()` đọc giá trị **đầu** nên bị lọt, và commit `743f841` đã đóng đúng chỗ này. | Từ chối (hơn 1 cặp) |
| `?options=-c search_path=evil` | Đổi được search_path | Từ chối |
| `#x` | Bỏ qua fragment, vẫn nối `_c` | Từ chối (fail-closed) |

Kết luận: bộ đọc dùng để kiểm (WHATWG URL/URLSearchParams) và bộ đọc dùng để kết nối (engine Prisma) không còn chỗ lệch nào mở được đường vòng.
Chỉ còn đúng 1 dạng query được chấp nhận là `schema=public`, và cả hai bộ đọc hiểu dạng này giống nhau.
Key hoặc value viết bằng mã `%xx` (ví dụ `%73chema`, `pub%6Cic`) được cả hai bên giải mã giống nhau, nên vẫn là `schema=public`.
Tách cặp bằng `;` không được engine hỗ trợ, nó chỉ tách bằng `&`.
Dấu `+` được cả hai hiểu là khoảng trắng, nên giá trị không còn bằng `public` và bị từ chối.

### 2. Biến môi trường PG* không phải đường vòng - đã kiểm bằng chạy thật

Chạy PrismaClient với DATABASE_URL thật của C, kèm `PGHOST=db.invalid PGPORT=1 PGDATABASE=ddc_control_tower PGUSER=nobody PGOPTIONS="-c search_path=evil" PGAPPNAME=pgenv PGSSLMODE=require PGSERVICE=x`.
Kết quả giống hệt khi không đặt biến nào: `db=ddc_control_tower_c, port=5433, search_path="public", user=postgres, application_name=""`.
Engine Rust của Prisma dựng cấu hình kết nối chỉ từ URL và không đọc libpq env, kể cả `PGSSLMODE` và `PGSERVICE`.
Repo không có `pg`, `@prisma/adapter-pg` hay `previewFeatures = driverAdapters` (schema.prisma dòng 5-7), nên cũng không có tầng node-postgres nào đọc PG*.
Vì vậy dù shell của người chạy e2e có PG* trỏ vào DB của A, `global-setup.ts` (seed + `deleteMany`) và `next dev` vẫn nối đúng `_c`.

Các đường khác đã rà lại:
- `DIRECT_URL`: không có luồng e2e nào dùng. `prisma db seed` chạy `prisma/seed.ts` với `new PrismaClient()` (dòng 8), tức theo DATABASE_URL đã kiểm và truyền tường minh (global-setup.ts dòng 19).
- Userinfo có nhiều dấu `@` (`u:p@evil@localhost`): WHATWG và engine đều lấy `@` cuối làm ranh giới, nên host vẫn là `localhost`.
- Nhiều host kiểu `localhost:5433,evil:5432`: `new URL` không parse được cổng, trả `false`.
- Tab hoặc khoảng trắng: WHATWG bỏ ký tự tab hoặc xoá khoảng trắng ở hai đầu trước khi kiểm. Chuỗi gốc có tab được truyền cho Prisma, nhưng tên DB vẫn phải khớp chính xác. Chưa ghi nhận đường nào đổi được DB đích.

### 3. Không làm vỡ gì

- `npx vitest run e2e/helpers/env.test.ts`: 38/38 xanh.
- `.env` thật của C qua guard: cổng 3003, pathname `/ddc_control_tower_c`, query `?schema=public`. Đã kiểm mà không in URL hay mật khẩu.
- Chỉ các URL có query lạ, key lặp hoặc hash mới bị chặn. Đây là fail-closed đúng ý, và thông báo lỗi vẫn là chuỗi tĩnh (env.ts dòng 104, 108-110).

### 4. Điểm còn lại

- **L-2 (Thấp, có sẵn từ trước, chưa vá):** `reuseExistingServer: true` (playwright.config.ts dòng 32) vẫn tái dùng một dev server đã chạy sẵn mà không kiểm server đó dùng DB nào. Giữ nguyên mô tả và đề xuất ở vòng 1, đưa vào sổ nợ kỹ thuật, không chặn merge.
- **I-3 (Thông tin, mới):** `isExpectedDbUrl` không kiểm `u.protocol`.
  - `mysql:`, `http:`, `file:` đều bị engine từ chối vì provider là postgresql, hoặc có hostname rỗng, nên kết quả vẫn fail-closed.
  - `prisma+postgres://` và `prisma://` cần `?api_key=`, mà query này đã bị guard chặn.
  - Chưa ghi nhận đường khai thác nào. Có thể thêm `['postgresql:', 'postgres:'].includes(u.protocol)` cho chặt, tuỳ chọn.
- I-1, I-2: như vòng 1, không đổi.

## Vòng 1 (diff 984b509..42d543c) - giữ nguyên phần còn đúng

Phạm vi: e2e/helpers/env.ts, e2e/global-setup.ts, playwright.config.ts, 7.1 (gỡ xoá toàn bộ dữ liệu), 7.3 (generateMetadata, notify-message), i18n, AppShell.
`current_database = ddc_control_tower_c`, cổng 5433. Cùng server có `ddc_control_tower`, `ddc_control_tower_b`, `ddc_control_tower_c`.
Tức là DB thật của A nằm cùng host và cổng, nên guard e2e là tuyến chặn duy nhất.

### 1. Guard e2e (C-0, L-5)

Không có đường nào seed hoặc xoá được `ddc_control_tower` (DB của A):
- `isExpectedDbUrl` so khớp chính xác `hostname === 'localhost'`, `port === '5433'`, `pathname === '/' + dbName` với cặp có cổng trùng NEXTAUTH_URL.
- `E2E_TARGETS` (env.ts dòng 32-35) chỉ có `_b` với 3001 và `_c` với 3003.
- Các biến thể sau đều bị từ chối: tên gần giống (`_c2`, `_c/`), chữ hoa (`LOCALHOST`, `DDC_...`), IPv6 `[::1]`, `127.0.0.1`, percent-encoding tên DB.
  Lý do: với scheme không đặc biệt, WHATWG URL không hạ chữ thường opaque host và không giải mã `%xx` trong path.
- Comment inline trong `.env` làm pathname có `%20` ở cuối, nên bị từ chối (fail-closed).
- Nhiều dòng `DATABASE_URL` trong `.env`: `loadDotEnv` lấy dòng cuối. Dù vậy giá trị đã kiểm được truyền tường minh cho seed, cho PrismaClient ở global-setup và cho `webServer.env`.
- Biến shell: playwright.config.ts và global-setup.ts đều cho `.env` thắng shell, hai nơi nhất quán.
- Thông báo lỗi là chuỗi tĩnh, không chèn URL hay mật khẩu, và đã có test.

### L-1 (Thấp): query string của DATABASE_URL không bị giới hạn - ĐÃ ĐÓNG ở vòng 2 (commit a29d2db + 743f841)

Mô tả gốc: `isExpectedDbUrl` bỏ qua `u.search`, nên `?host=<host khác>` lọt qua guard.
Tên DB vẫn cố định là `_b`/`_c`, nên không trỏ được vào DB của A.
Xem mục Vòng 2 để biết kết quả kiểm chạy thật.

### L-2 (Thấp, có sẵn từ trước): `reuseExistingServer: true` không kiểm server đang chạy dùng DB nào - CHƯA VÁ

- File/dòng: playwright.config.ts dòng 28-35.
- Kịch bản:
  - Trên cổng 3003 (hoặc 3001) đã có `next dev` được khởi động với `DATABASE_URL` của shell trỏ vào `ddc_control_tower`.
  - Playwright tái dùng server đó, nên `webServer.env` không có tác dụng.
  - Global-setup seed `_c`, nhưng thao tác UI trong spec lại ghi vào DB của A.
- Điều kiện: phải có người tự khởi động dev server với biến shell sai. `launch.json` không đặt `DATABASE_URL`, nên mặc định an toàn.
- Đề xuất, chọn một trong hai:
  - Chỉ tái dùng server khi đặt biến `E2E_REUSE=1`.
  - Trong global-setup, gọi một endpoint chỉ có ở dev (không có ở production) để lấy `current_database()` và so với DB đã kiểm.

### I-1 (Thông tin): guard không gắn cặp DB và cổng với worktree

Nếu `.env` của worktree A bị sửa thành 3003 + `_c`, e2e sẽ seed đè DB của C.
Có thể thêm điều kiện `basename(process.cwd())` phải khớp cặp. Tuỳ chọn.

### I-2 (Thông tin): `loadDotEnv` khác dotenv ở vài chỗ

`loadDotEnv` không hỗ trợ `export`, `${VAR}` và comment inline.
Mọi khác biệt đều dẫn tới fail-closed, hoặc giá trị đã kiểm vẫn được truyền tường minh.

### 2. 7.1: gỡ chức năng xoá toàn bộ dữ liệu - Đạt

- Không còn `resetAllData`, `resetDataAction`, `ResetDataButton`, `admin.resetData`, `admin.resetConfirm`.
- Không còn `deleteMany()` không điều kiện, `TRUNCATE`, hay `$executeRaw` xoá hàng loạt trong `src/` và `app/`.
- `$executeRaw` còn lại chỉ là advisory lock có tham số hoá.
- `app/api/*` không có route tương đương.
- `src/server/reset-data-removed.test.ts` khoá hồi quy.

### 3. 7.3: generateMetadata và notify-message - Đạt

- `generateMetadata` truyền `locale`; `src/i18n/request.ts` kiểm whitelist trước khi import động.
- Không có path traversal, XSS hay injection.
- `testNotice` chỉ đổi hằng chuỗi.

### 4. Khác

- Không có secret mới trong diff; `.env` không bị commit.
- Test đổi tên vẫn mock `@/server/db`, không chạm DB thật.

## Tổng kết

| Mã | Mức | Trạng thái | Chặn merge |
|---|---|---|---|
| L-1 query string DATABASE_URL | Thấp | Đã đóng (743f841), kiểm chạy thật | Không |
| L-2 reuseExistingServer không kiểm DB của server | Thấp (có sẵn) | Mở, sổ nợ kỹ thuật | Không |
| I-1 guard không gắn worktree | Thông tin | Mở, tuỳ chọn | Không |
| I-2 loadDotEnv khác dotenv | Thông tin | Chấp nhận | Không |
| I-3 không kiểm `u.protocol` | Thông tin | Mở, tuỳ chọn | Không |
| Biến PG* môi trường | - | Đã kiểm, engine Prisma bỏ qua, không phải đường vòng | - |
