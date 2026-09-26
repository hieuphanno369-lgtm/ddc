PHAN QUYET BAO MAT: DAT

# Đánh giá bảo mật P7-C1 (nhánh feature/p7-c-task-bo-sung, diff 984b509..HEAD)

Skill đã dùng: `ddc-tower:security-review`, `ddc-tower:security-audit` (chế độ guidance, rà tập trung vào diff).
Phạm vi: e2e/helpers/env.ts, e2e/global-setup.ts, playwright.config.ts, 7.1 (gỡ xoá toàn bộ dữ liệu), 7.3 (generateMetadata, notify-message), i18n, AppShell.
Kiểm DB thật qua `mcp__postgres` (chỉ đọc).
`current_database = ddc_control_tower_c`, cổng 5433, và cùng server có `ddc_control_tower`, `ddc_control_tower_b`, `ddc_control_tower_c`.
Tức là DB thật của A nằm cùng host và cổng, nên guard e2e là tuyến chặn duy nhất.

> Ghi chú điều phối: security-reviewer không có công cụ ghi file; bên điều phối lưu nguyên văn báo cáo vào file này.

## 1. Guard e2e (C-0, L-5)

Đã kiểm, **không có đường nào seed hoặc xoá được `ddc_control_tower` (DB của A)**:
- `isExpectedDbUrl` (e2e/helpers/env.ts dòng 64-74) so khớp chính xác `hostname === 'localhost'`, `port === '5433'`, `pathname === '/' + dbName` với cặp có cổng trùng NEXTAUTH_URL.
- `E2E_TARGETS` (dòng 32-35) chỉ có `_b` với 3001 và `_c` với 3003.
- Tên gần giống (`_c2`, `_c/`), chữ hoa (`LOCALHOST`, `DDC_...`), IPv6 `[::1]`, `127.0.0.1`, percent-encoding tên DB (`ddc_control_tower_%63`) đều bị từ chối.
  Lý do: với scheme không đặc biệt (`postgresql:`), WHATWG URL không hạ chữ thường opaque host và không giải mã `%xx` trong path.
  Guard fail-closed với các trường hợp này.
- Comment inline trong `.env` (`...ddc_control_tower_c # ghi chu`) làm pathname thành `/ddc_control_tower_c%20`, bị từ chối, vẫn fail-closed.
- Nhiều dòng `DATABASE_URL` trong `.env`: `loadDotEnv` lấy dòng cuối, trùng cách dotenv của Prisma/Next.
  Dù vậy giá trị đã kiểm được truyền tường minh (`execSync(... env: { DATABASE_URL: databaseUrl })` ở global-setup.ts dòng 19, `new PrismaClient({ datasourceUrl })` ở dòng 21, `webServer.env.DATABASE_URL` ở playwright.config.ts dòng 34).
  Prisma và Next không ghi đè biến môi trường đã có, nên giá trị đã kiểm luôn được dùng.
- Biến shell: cả playwright.config.ts (dòng 13) và global-setup.ts (dòng 12) đều cho `.env` thắng shell, hai nơi nhất quán.
  `.env` thiếu `DATABASE_URL` thì lấy từ shell, nhưng vẫn phải qua cùng guard.
- `DIRECT_URL` (prisma/schema.prisma dòng 12) chỉ được `migrate`/`introspect` dùng.
  e2e không chạy migrate; `prisma/seed.ts` dùng `new PrismaClient()`, tức là theo `DATABASE_URL`.
  Không có đường nào đi vòng qua `DIRECT_URL`.
- Thông báo lỗi (env.ts dòng 86-92) là chuỗi tĩnh, không chèn URL hay mật khẩu; env.test.ts có test cho điều này.

### L-1 (Thấp): query string của DATABASE_URL không bị giới hạn

- File/dòng: e2e/helpers/env.ts dòng 64-74 (`isExpectedDbUrl` bỏ qua `u.search`).
- Bằng chứng: kế hoạch cố ý cho phép `?schema=public` (ke-hoach.md dòng 101).
  Nhưng mọi tham số khác cũng lọt qua, ví dụ `postgresql://u:p@localhost:5433/ddc_control_tower_c?host=<host khac>`.
  Tầng kết nối PostgreSQL của Prisma nhận tham số `host` trong query (tài liệu ghi là thư mục socket, còn engine dùng giá trị này làm host).
  Theo hiểu biết của reviewer, host trong query được ưu tiên hơn host trong URL; điều này chưa kiểm chứng bằng chạy thật.
  Khi đó guard kiểm `localhost` nhưng kết nối thực đi nơi khác.
- Tác động: tên DB vẫn cố định là `_b`/`_c` (Prisma lấy dbname từ path, không cho ghi đè qua query), nên **không thể trỏ vào `ddc_control_tower` của A**.
  Rủi ro chỉ là seed hoặc xoá một DB tên `_c` trên server khác, và chỉ xảy ra khi tự cấu hình sai `.env`.
- Đề xuất: chỉ cho phép `schema` và yêu cầu `schema === 'public'`, từ chối mọi key khác.
  Ví dụ: `[...u.searchParams.keys()].every(k => k === 'schema') && (u.searchParams.get('schema') ?? 'public') === 'public'`.
  Thêm test cho `?host=`, `?options=`, `?schema=khac`.

### L-2 (Thấp, có sẵn từ trước, cần kiểm chứng): `reuseExistingServer: true` không kiểm server đang chạy dùng DB nào

- File/dòng: playwright.config.ts dòng 31-35.
- Kịch bản: trên cổng 3003 (hoặc 3001) đã có `next dev` được khởi động với `DATABASE_URL` của shell trỏ vào `ddc_control_tower`.
  Next không ghi đè biến shell bằng `.env`, nên server đó chạy trên DB của A.
  Playwright tái dùng server này; `webServer.env` không có tác dụng vì Playwright không khởi động lại.
  Kết quả: global-setup seed `_c`, nhưng mọi thao tác UI trong spec (tạo kênh thông báo, sửa user, nhập liệu...) ghi vào DB của A.
- Điều kiện: phải có người tự khởi động dev server với biến shell sai.
  launch.json (`ddc-control-tower-C`) không đặt `DATABASE_URL` nên mặc định an toàn.
  Rủi ro này đã có trước diff (khi cổng còn cố định 3001).
- Đề xuất:
  - Cách 1: `reuseExistingServer: false` khi chạy e2e (hoặc chỉ tái dùng khi đặt biến `E2E_REUSE=1`).
  - Cách 2: trong global-setup, gọi một endpoint chỉ bật ở dev/test (ví dụ mở rộng `/api/health` trả `current_database()` khi `NODE_ENV !== 'production'`).
    Nếu DB đó khác `databaseUrl` đã kiểm thì dừng.

### I-1 (Thông tin): guard không gắn cặp DB và cổng với worktree

- Từ worktree A, nếu `.env` bị sửa thành 3003 + `_c`, e2e sẽ seed đè DB của C.
- Không đụng dữ liệu thật của A, nhưng lấn sang bên khác.
- Có thể thêm điều kiện `basename(process.cwd())` khớp cặp (A thì không có cặp, `-B` đi với `_b`, `-C` đi với `_c`).
  Việc này tuỳ chọn, không bắt buộc.

### I-2 (Thông tin): `loadDotEnv` khác dotenv ở vài chỗ

- Không hỗ trợ tiền tố `export`, `${VAR}` expansion và comment inline.
- Đã kiểm: mọi khác biệt đều dẫn tới fail-closed (throw), hoặc giá trị đã kiểm vẫn được truyền tường minh. Không mở đường vòng.

## 2. 7.1: gỡ chức năng xoá toàn bộ dữ liệu

Đạt:
- `git grep` toàn repo không còn `resetAllData`, `resetDataAction`, `ResetDataButton`, `admin.resetData`, `admin.resetConfirm`.
- Không còn `deleteMany()` không điều kiện, `TRUNCATE`, hay `$executeRaw` xoá hàng loạt trong `src/` và `app/`.
  `$executeRaw` còn lại chỉ là advisory lock có tham số hoá, ở prisma-repo.ts dòng 1080 và prisma-repo-form.ts dòng 98.
- `app/api/*` (auth, cron, export, health, photo-upload, photos, report, templates) không có route tương đương.
- mock-repo và prisma-repo đều đã bỏ hàm.
- `deleteMany()` hàng loạt chỉ còn trong `prisma/seed.ts`, là công cụ CLI, không lộ qua HTTP hay server action.
- Key `activity.reset_data` được giữ đúng mục đích hiển thị nhật ký cũ; DB `_c` hiện có 0 dòng `reset_data`.
- `src/server/reset-data-removed.test.ts` khoá hồi quy.

## 3. 7.3: generateMetadata và notify-message

Đạt:
- `generateMetadata` (app/[locale]/layout.tsx dòng 12-18) truyền `locale` cho `getTranslations`.
  `src/i18n/request.ts` kiểm `routing.locales.includes(locale)` rồi mới `import(\`./messages/${locale}.json\`)`; locale lạ rơi về `defaultLocale`.
  Vì vậy không có path traversal hay dynamic import tuỳ ý, và `LocaleLayout` vẫn `notFound()` với locale lạ.
- Title lấy từ file bản dịch tĩnh, không có dữ liệu người dùng; Next escape khi render. Không có XSS hay injection.
- `testNotice` (src/lib/notify-message.ts dòng 65, 69) chỉ đổi hằng chuỗi, không nhận input.
- login/page.tsx và AppShell.tsx chỉ đổi text dịch và inline style hằng. Không có vấn đề.

## 4. Khác

- Không có secret mới trong diff; `.env` không bị commit (đã kiểm chỉ tên key).
- Test đổi tên `prisma-repo-reset.test.ts` thành `prisma-repo-remove-project.test.ts` vẫn mock `@/server/db`, không chạm DB thật.

## Tổng kết

| Mã | Mức | Chặn merge |
|---|---|---|
| L-1 query string DATABASE_URL không giới hạn | Thấp | Không |
| L-2 reuseExistingServer không kiểm DB của server | Thấp (có sẵn) | Không |
| I-1 guard không gắn worktree | Thông tin | Không |
| I-2 loadDotEnv khác dotenv | Thông tin | Không |

Đề xuất đưa L-1 và L-2 vào sổ nợ kỹ thuật.
L-1 sửa rất nhỏ, nên vá luôn trong nhánh nếu còn vòng sửa.
