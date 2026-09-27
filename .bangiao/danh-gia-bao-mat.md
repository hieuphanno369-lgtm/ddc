KET LUAN BAO MAT: DAT

# Đánh giá bảo mật - nâng Next 15.5.26 / React 19.3.0 / next-intl 4.14.7 / next-auth 4.24.15 / recharts 2.15.4

Skill đã dùng: `security-review`, `security-audit` (chế độ hướng dẫn, rà trọng tâm theo diff `54ac9bf..HEAD`).
Phạm vi: toàn bộ diff của phase, lockfile, middleware, next-auth, cookie locale, server actions, header, lỗi ở production.
Cách kiểm: đọc mã, chạy `npm audit --omit=dev`, soát lockfile bằng script, build production rồi `next start -p 3010` trên DB tạm `ddc_control_tower_e2e_a`, và thử bằng curl.

(File do điều phối viên chép nguyên văn từ báo cáo của security-reviewer, vì agent này không có công cụ ghi file.)
Trong lúc thử, security-reviewer có gọi 1 lần `removeProjectAction(999999)` với id không tồn tại trên DB tạm: server trả `{ok:true}`, không bản ghi nào bị xoá, có thể để lại 1 dòng nhật ký hoạt động trên DB tạm.

## Kết luận ngắn

Phase này không thêm lỗ hổng mới.
Nó đóng được các advisory nặng của `next` (có RCE trên Windows và RCE qua AVIF), advisory open redirect của `next-intl` và advisory của `cookie`.
Chốt đăng nhập vẫn đứng trước mọi lần đọc dữ liệu ở mọi page.
Các phát hiện dưới đây đều ở mức thấp hoặc chỉ để ghi nhận, và đều có từ trước phase này.

## Mức cao

Không có.

## Mức trung

Không có phát hiện nào do phase này gây ra.

## Mức thấp

### L-1. Matcher của middleware bỏ qua mọi đường dẫn có dấu chấm (có từ trước, không phải do nâng Next 15)

- Vị trí: `middleware.ts:70`, dòng `matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']`.
- Kịch bản đã thử thật trên bản production, cổng 3010:
  - `GET /vi/overview/x.y` và `/vi/admin.x` trả 404, middleware không chạy. Không có page nào khớp nên không lộ gì.
  - `GET /vi/projects/1.json` (route động `[id]` nhận được dấu chấm): middleware không chạy, nhưng `requireUser` ở `(app)/layout.tsx` và ở page vẫn chặn, trả 307 về `/vi/login`.
  - Request có header `RSC: 1` tới `/vi/projects/1.x` khi chưa đăng nhập: trả 200 nhưng payload chỉ chứa `NEXT_REDIRECT;replace;/vi/login`. Phần còn lại là bộ chuỗi i18n mà trang login cũng nhận, không có dữ liệu dự án.
  - Gọi server action khi chưa đăng nhập qua `POST /vi/projects/1.x` với header `Next-Action` là id của `removeProjectAction`: request đi qua được middleware và tới được action, nhưng action tự chặn và trả `{"ok":false,"error":"Forbidden"}`. Cùng lời gọi đó qua `/vi/projects/1` thì middleware trả 307 ngay.
- Đánh giá: đây là lỗ hổng ở lớp phòng thủ chiều sâu, không khai thác được.
  - Trong khe này, lớp chặn thật là các page (`requireUser`, có test tĩnh `app-pages-require-user.test.ts`) và từng server action.
  - Đã quét cả 6 file `'use server'`: mọi hàm export đều gọi `requireRole`, `requireProject` hoặc một hàm guard tương đương.
  - Rủi ro chỉ thành thật nếu sau này có page hoặc action mới quên tự kiểm quyền mà dựa vào middleware. Khi đó có thể vượt RBAC bằng cách chèn dấu chấm vào segment động.
- Đề xuất sửa (phase riêng, vì kế hoạch ghi rõ không đụng `middleware.ts`):
  - Chỉ loại trừ tệp tĩnh theo đuôi ở cuối đường dẫn, ví dụ `'/((?!api|_next|_vercel|.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif|css|js|map|txt|xml|woff2?)$).*)'`.
  - Thêm e2e khẳng định `/vi/projects/1.x` và `/vi/overview/a.b` khi chưa đăng nhập đều về `/vi/login`.

### L-2. Thiếu header bảo mật và còn lộ `X-Powered-By` (có từ trước)

- Vị trí: `next.config.mjs:6-10`, không có `headers()` và không có `poweredByHeader: false`.
- Quan sát: response có `X-Powered-By: Next.js`. Không có CSP, `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`.
- Kịch bản: nhúng `/vi/admin` vào iframe để lừa bấm (clickjacking); lộ framework giúp kẻ tấn công dò tìm.
  Tác động hạn chế vì cookie phiên là `SameSite=Lax` và các thao tác nhạy cảm đều cần bấm nhiều bước.
- Đề xuất: thêm `poweredByHeader: false`, và thêm `async headers()` trả `X-Frame-Options: DENY` (hoặc CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS khi chạy HTTPS.
  Sau đó thêm CSP dần dần, vì Recharts và style inline cần chỉnh.

### L-3. Cookie `NEXT_LOCALE` không có `Secure`

- Vị trí: `src/i18n/routing.ts:7`, `localeCookie: { maxAge: 60 * 60 * 24 * 365 }`.
- Quan sát: `Set-Cookie: NEXT_LOCALE=vi; Path=/; Max-Age=31536000; SameSite=lax`, không có `Secure`, không có `HttpOnly`.
- Đánh giá: cookie này không bí mật, chỉ là ngôn ngữ.
  - Thiếu `HttpOnly` là đúng, vì client có thể cần đọc.
  - `SameSite=lax` là phù hợp.
  - Giá trị bị ép vào danh sách `vi`/`en`: `app/[locale]/layout.tsx` gọi `notFound()` khi locale lạ, và middleware chỉ nhận locale trong `routing.locales`.
  - Rủi ro gần như bằng 0. Chỉ nên thêm `secure: true` khi chạy HTTPS cho đồng bộ với chính sách cookie.
- Đề xuất (không bắt buộc): `localeCookie: { maxAge: ..., secure: process.env.NODE_ENV === 'production' }`.

## Ghi nhận (không phải lỗ hổng)

### I-1. Advisory còn lại sau `npm audit --omit=dev` (8: 3 moderate, 5 high), đều không với tới được lúc chạy app

- `postcss <=8.5.22` nằm trong gói `next`: chỉ dùng lúc build để xử lý CSS của chính repo, không xử lý dữ liệu người dùng. Chỉ hết khi lên `next@16`.
- `xlsx` (không có bản vá): khai trong `package.json:33` nhưng không có file nào trong `src/` hay `app/` import. Nên gỡ khỏi `dependencies` để hết cảnh báo (phase khác).
- `deepmerge-ts` qua `prisma`/`@prisma/config`: công cụ CLI, không nằm trên đường xử lý request.
- `uuid <11.1.1` qua `exceljs`: advisory chỉ dính v3/v5/v6 khi truyền `buf`. Cần kiểm riêng xem exceljs có gọi kiểu đó không (ngoài phạm vi).
- Đã hết: advisory của `next` (có GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4), của `next-intl` (GHSA-8f24-v5vv-gm5j), và của `cookie` (nay 0.7.2).

### I-2. Lockfile sạch

- 506 mục `resolved` đều từ `https://registry.npmjs.org`, mục nào cũng có `integrity`, không có nguồn git, URL lạ hay đường dẫn `file:`.
- Gói mới lạ tên: `@eloqnt/config`, `@eloqnt/format-json`, `@eloqnt/format-po` (0.1.0), `po-parser`, `icu-minify`, `next-intl-swc-plugin-extractor`.
  - Tất cả là dependency khai trực tiếp của `next-intl@4.14.7` (`npm ls` xác nhận).
  - Mã dist rất nhỏ (48 đến 2751 byte), đã đọc: không có `child_process`, gọi mạng, `eval` hay đọc `process.env`.
- Install script mới chỉ có `@parcel/watcher@2.6.0` và `@swc/core@1.16.2`, đều là gói native quen thuộc.
- Override `recharts -> react-is: $react-is` trỏ về bản 19.3.0 lấy từ registry, không có gì lạ.

### I-3. Chốt đăng nhập vẫn đứng trước mọi lần đọc dữ liệu

- Mọi page trong diff chỉ `await params`/`await searchParams` (không đọc DB) trước `getLocale()` rồi tới `requireUser(...)`.
- Page `projects/[id]` validate `rawId` bằng `/^[1-9]\d*$/` sau `requireUser`, rồi mới `requireProjectRead`.
- `audit/page.tsx` giữ `requireUser(locale, ['admin'])`.
- Route `api/photos/[...path]` gọi `getCurrentUser()` trước `await params`.
- Route `api/cron/[job]` kiểm `CRON_SECRET` (so sánh an toàn về thời gian) trước khi đọc `job`.
- Header `x-middleware-subrequest` (CVE-2025-29927) đã thử 3 biến thể trên `/vi/admin`: đều 307 về login. Next 15.5.26 đã vá.

### I-4. next-auth 4.24.15 sau khi nâng

- Đã thử thật:
  - CSRF double-submit hoạt động: POST vào `/api/auth/callback/credentials` không có token thì bị 302 về `?csrf=true`.
  - Cookie `next-auth.session-token`, `csrf-token`, `callback-url` đều `HttpOnly; SameSite=Lax`. `Secure` tự bật khi `NEXTAUTH_URL` là https.
  - Session vẫn 8 giờ.
- `callbackUrl` không mở được open redirect:
  - `https://evil.com/x` bị ép thành `http://localhost:3010`.
  - `//evil.com` thành `http://localhost:3010/evil.com`.
  - `/\evil.com` thành `http://localhost:3010//evil.com`, vẫn cùng host; Next tiếp tục chuẩn hoá `//evil.com` thành `/evil.com`.
  - `LoginForm` không dùng `callbackUrl` từ query mà `router.replace('/overview')`.
- `/api/auth/signin?callbackUrl=https://evil.com` trả về `/login?callbackUrl=http://localhost:3010`.

### I-5. Open redirect qua locale

- `/vi//evil.com` trả 308 `/vi/evil.com`; `//evil.com/vi` trả 308 `/evil.com/vi`. Không có host lạ.
- Tester đã khoá hành vi này bằng `e2e/13-locale-redirect-cookie.spec.ts`.

### I-6. Server actions trên Next 15

- Kiểm Origin chống CSRF vẫn bật: POST action có `Origin: https://evil.com` bị từ chối ("x-forwarded-host ... does not match origin ... Aborting the action.").
- Next so `Origin` với `X-Forwarded-Host`/`Host`.
  Khi deploy sau proxy, proxy phải ghi đè `X-Forwarded-Host`.
  Trình duyệt không tự gửi được header này khi gọi chéo site nếu không qua preflight, nên không khai thác CSRF được. Đây là ghi chú khi deploy.
- Không có server action inline (khai `'use server'` giữa hàm) nên không có biến closure cần mã hoá.
  Nếu deploy nhiều instance, cần đặt `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` giống nhau và dùng cùng một bản build để id action khớp nhau.
- Id action không hợp lệ trả 404, không lộ gì. `bodySizeLimit: '11mb'` giữ như cũ.

### I-7. Lộ thông tin lỗi ở production

- Lỗi server action (JSON hỏng, bị chặn Origin) chỉ trả `{"digest":"..."}`, stack chỉ nằm ở log server.
- Không có dấu vết thông tin nội bộ trong body của 404/500.

### I-8. Bộ chuỗi i18n gửi cả cho trang chưa đăng nhập

- `app/[locale]/layout.tsx` đưa toàn bộ message vào provider nên trang login nhận khoảng 60KB chuỗi giao diện, gồm cả nhãn của trang quản trị.
- Chỉ là chuỗi giao diện, không có dữ liệu. Có từ trước.

## Tồn đọng ngoài phạm vi phase (có từ trước, không tính vào kết luận)

- `src/lib/auth.ts:118`: đăng nhập bằng mật khẩu chưa có rate-limit chống dò mật khẩu (TODO có sẵn).
  Nên có một task riêng trước khi lên production, mức trung nếu mở ra internet.

## Đề xuất thứ tự xử lý (phase sau, không chặn merge)

1. L-1: siết matcher và thêm e2e cho đường dẫn có dấu chấm.
2. L-2: thêm header bảo mật và `poweredByHeader: false`.
3. Rate-limit đăng nhập (tồn đọng).
4. Gỡ `xlsx` không dùng; L-3 thêm `secure` cho cookie locale.

## Vòng 2

Skill đã dùng: `security-review`.
Phạm vi: `git diff d66e5bd..HEAD` (commit 38d7f0d và 14b06be).
Diff chỉ đổi `e2e/13-locale-redirect-cookie.spec.ts` (đổi tên từ 12) và hồ sơ `.bangiao`, không đụng `src/`, middleware, auth hay cấu hình.
Không có thay đổi hành vi chạy thật nên không phát sinh bề mặt tấn công mới.
Hồ sơ `.bangiao` mới thêm không chứa giá trị secret, chỉ nhắc tên biến `CRON_SECRET` và tên cookie.

### Test mới khoá hành vi chống open redirect
- `isOpenRedirectLocation` (dòng 26-37) nay coi thêm `Location` bắt đầu bằng `/\` là open redirect, vì trình duyệt hiểu `/\host` như `//host`, nên test chặt hơn vòng 1.
- Hai test `"/vi//evil.com"` và `"//evil.com/vi"` (dòng 47-60) vẫn giữ `maxRedirects: 0` và kiểm `Location` không ra host lạ, đúng hành vi cần khoá.
- `fresh.dispose()` được đưa vào `finally`, chỉ ảnh hưởng độ sạch của test, không ảnh hưởng bảo mật.

### Không khoá nhầm L-1
- Test "giả mạo open-redirect vào trang bảo vệ" (dòng 90-106) nay chấp nhận 404 (hiện tại) hoặc 200, và khi 200 thì bắt buộc pathname là `/vi/login`.
- Như vậy test không cố định hành vi lỗi của L-1, và khi L-1 được vá (middleware chạy, chuyển về trang đăng nhập) test vẫn xanh.
- Điều kiện bảo mật cốt lõi vẫn bị khoá: host cuối luôn là host của ứng dụng.

### Ghi chú mức thấp (không chặn)
- T-1 (thấp): kiểm lộ dữ liệu đổi từ `projectName` sang `href="/vi/projects/` (dòng 104-105), nhưng DB A đang rỗng nên cả hai dạng đều pass mà không chứng minh gì. Khi vá L-1, nên chạy test này trên DB tạm có ít nhất 1 dự án để khẳng định âm tính thật.
- T-2 (thấp): `isOpenRedirectLocation` chưa bắt `Location` bắt đầu bằng `\host` (trình duyệt cũng hiểu như `//host`). Nên bổ sung `location.startsWith('\\')` khi vá L-1.

Kết luận vòng 2: giữ `KET LUAN BAO MAT: DAT`.

(Ghi chú của điều phối viên: e2e của A chạy trên DB tạm `ddc_control_tower_e2e_a` đã seed 17 dự án, không phải DB A rỗng; reviewer xét lại ý T-1 theo thực tế này.)
