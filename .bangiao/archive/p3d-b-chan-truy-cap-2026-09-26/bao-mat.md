PHAN QUYET BAO MAT: DAT

# P3D-B - Rà soát bảo mật: chặn truy cập khi chưa đăng nhập (vá S-1)

Phạm vi: `git diff main...HEAD` trên nhánh `feature/p3d-b-chan-truy-cap`.
Skill security-reviewer dùng: `ddc-tower:security-review`.
Đã thử vượt rào thật trên dev server http://localhost:3001, dò mỗi response bằng `M-0000|10626-|SVĐ|contractValue|tonnage`.

## Kết luận

S-1 đã đóng: không còn đường nào lấy được tên, mã dự án hay số liệu dự án khi chưa đăng nhập.
Không có lỗ hổng mức CAO hoặc TRUNG.
3 điểm mức THẤP; L-1 đã vá trong phase (xem dưới), L-2 và L-3 ghi nhận.

## Kiểm chứng động (không có phiên hợp lệ)

| Kịch bản | Kết quả |
|---|---|
| `/vi/overview`, `/vi/projects`, `/vi/projects/1`, `/en/report` | 307 về `/{locale}/login`, không có dữ liệu |
| Header `RSC: 1`, `Next-Router-State-Tree`, `Next-Router-Prefetch`, `x-middleware-prefetch` | 307 về login |
| `x-middleware-subrequest` (kiểu CVE-2025-29927) | 307 về login, không bypass |
| Cookie giả hoặc hỏng (`next-auth.session-token=abc`, JWE rác, `__Secure-...`) | 307 về login |
| Đổi dạng đường dẫn: `/VI/`, `/vi//overview`, `/vi/%6Fverview`, dấu `/` cuối, `/vi/Overview` | chuẩn hoá hoặc 307 về login |
| `/_next/data/.../overview.json`, `/vi/overview.json`, `/vi/report.txt` | 404 hoặc 307 |
| Locale lạ `/fr/overview`, không locale `/overview` | về login hoặc 404 |
| Traversal `/vi/login/../overview`, `..%2F` | 404 |
| POST có `Next-Action` | 307 về login |
| `/vi/projects/1.0`, `/vi/projects/1.x` kèm `RSC: 1` (lọt khỏi middleware) | chỉ có từ điển i18n + `NEXT_REDIRECT` về login, không có dữ liệu dự án |
| `/api/export` / `/api/report/export` / `/api/photos/x.jpg` | 401 / 403 / 401 |
| `/api/templates/daily-resources?project=1` và `?project=99999` | 403 như nhau, không dò được id |
| `/api/cron/*` khi chưa đặt `CRON_SECRET` | 503 |
| `/api/health` | chỉ `{status, time}` |

## Kiểm chứng tĩnh

- `middleware.ts`: phiên chỉ tính khi `token !== null && token.invalid !== true`; `getToken` ném lỗi thì coi như chưa đăng nhập; thiếu `NEXTAUTH_SECRET` trả 500; role thiếu mặc định `viewer`.
- `src/lib/require-user.ts` gọi phiên server; callback `session` (`src/lib/auth.ts`) xoá email khi `token.invalid` nên người bị khoá về login.
- `requireUser` gọi ở `(app)/layout.tsx` và cả 13 page `(app)`, là lệnh await đầu tiên (chỉ sau `getLocale`); page giới hạn vai truyền `roles`; không có `generateMetadata` đọc tên dự án.
- Route API đều tự kiểm phiên hoặc secret (riêng `auth/[...nextauth]` của next-auth).
- Mọi server action (`actions*.ts`) gọi `requireRole`/`requireProject`/`requireWriteProject`/`requireRoleUser` ngay đầu hàm.

## Phát hiện

### L-1 (THẤP): matcher middleware bỏ qua mọi đường dẫn có dấu chấm - ĐÃ VÁ

- `middleware.ts` matcher `'/((?!api|_next|_vercel|.*\\..*).*)'`: `/vi/projects/1.0` đi thẳng vào page, `Number('1.0') === 1` nên vẫn khớp dự án 1.
  Người chưa đăng nhập vẫn bị `requireUser` chặn; người đã đăng nhập lọt khỏi RBAC `DENIED` ở middleware nhưng page vẫn tự kiểm vai + B-4, nên chỉ mất lớp phòng thủ thứ hai.
- **Đã vá (điều phối B, 2026-09-26):** `projects/[id]/page.tsx` sau `requireUser` kiểm `params.id` khớp `^[1-9]\d*$`, sai thì `notFound()` trước khi đọc dữ liệu.
  Test đỏ trước: `app-pages-auth-guard.test.ts` 9 ca (`1.0`, `1.x`, `1e0`, `0x1`, `01`, `0`, `-1`, ` 1`, `abc`) đều NOT_FOUND và không gọi `getProject`.
  Curl admin thật: `/vi/projects/1` 200, `/vi/projects/1.0` 404, `/vi/projects/abc` 404.
- Không thu hẹp matcher trong phase này (rủi ro chặn nhầm file tĩnh); để P5 xem cùng CSP.

### L-2 (THẤP): payload RSC của redirect trả kèm cả từ điển i18n

- `app/[locale]/layout.tsx` truyền toàn bộ messages cho client; người lạ đọc được nhãn giao diện, không có dữ liệu dự án. Trang `/login` công khai vốn đã lộ tương đương.
- Chấp nhận được; nếu muốn giảm thì chỉ truyền namespace cần dùng. Ghi nợ cho P5.

### L-3 (THẤP, có từ trước): rate-limit `/api/health` né được bằng `X-Forwarded-For`

- `app/api/health/route.ts`: mỗi `X-Forwarded-For` khác là một bucket mới. Route chỉ trả trạng thái.
- Khi deploy sau reverse proxy chỉ tin IP do proxy đặt. Chuyển cho A ở P5 (rate limit + deploy).

### Ghi nhận, không chặn (chủ dự án chốt A gỡ code ảnh ở P3E)

- `app/api/photos/[...path]`: chưa đăng nhập trả 401; phân quyền ảnh theo dự án để P3E gỡ.
- `deletePhotoAction`: để P3E gỡ.

### Môi trường

- Response dev có stack `webpack-internal` trong payload `NEXT_REDIRECT`; bản production không có.
- MCP postgres đang trỏ DB `ddc_control_tower` (của A), chỉ dùng đọc mẫu chuỗi để dò rò rỉ.
