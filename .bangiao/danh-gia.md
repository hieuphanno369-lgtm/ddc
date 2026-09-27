PHAN QUYET: CHOT

# Đánh giá cuối (reviewer) - nâng Next 15.5.26 / React 19.3.0 / next-intl 4.14.7 / next-auth 4.24.15 / recharts 2.15.4

(File do điều phối viên chép nguyên văn từ báo cáo của reviewer, vì agent này không có công cụ ghi file.)

## Vòng 2

Skill đã dùng: `ddc-tower:code-review` (tải xong ngay, là hướng dẫn soi chuẩn; phần rà diff là rà tay theo checklist của skill).
Phạm vi: `git diff d66e5bd..HEAD` (commit `38d7f0d` sửa theo reviewer, `14b06be` kết quả tester vòng 2).
Đã đọc lại `danh-gia.md` vòng 1, `danh-gia-bao-mat.md` (gồm mục "Vòng 2", giữ DAT), `ket-qua-test.md` mục "Vòng 2", `thay-doi.md` mục "Vòng sửa 1 theo reviewer", `hieu-nang.md`.
Reviewer tự chạy lại: `npx tsc --noEmit` exit 0; `npm test` 210 file / 2409 test xanh.
Reviewer không chạy lại e2e, dựa vào số 79/79 của tester vòng 2.

### Diff vòng này chạm những gì

- Chỉ 1 file code: `e2e/12-locale-redirect-cookie.spec.ts` đổi tên thành `e2e/13-locale-redirect-cookie.spec.ts` (git nhận là rename, similarity 66%).
- Còn lại là hồ sơ `.bangiao/` (`thay-doi.md`, `hieu-nang.md`, `ket-qua-test.md`, `danh-gia.md`, `danh-gia-bao-mat.md`).
- Không đụng `src/`, `app/`, `middleware.ts`, cấu hình, file nóng, `PROGRESS.md`, `.serena/`.
- Không làm ngoài phạm vi.
- Không có em dash hay en dash trong diff (đã đếm bằng grep, kết quả 0).
- 2 commit đều tiếng Việt không dấu, có dòng `Co-Authored-By`.

### Xác nhận từng mục bắt buộc của vòng 1

1. Mục 1 (test khoá nhầm L-1): đã sửa đúng.
   - `e2e/13-locale-redirect-cookie.spec.ts:100` nay là `expect([200, 404]).toContain(res.status())`.
   - Dòng 101-103: khi 200 thì bắt buộc `pathname` là `/vi/login`.
   - Dòng 99 vẫn khoá điều cốt lõi: host cuối luôn là host của ứng dụng.
   - Tên test dòng 90 đổi thành "bien: ... khong ra host la, khong lo du lieu".
   - Comment dòng 91-97 nói rõ 404 là hành vi của L-1 và sẽ đổi khi vá.
   - Dòng 105 đổi kiểm yếu `projectName` thành `not.toContain('href="/vi/projects/')`.
     Chuỗi này đúng là dạng HTML mà `Link` của next-intl render ra ở `TopPriorityList.tsx` và `ProjectTable.tsx`, nên nếu một trang bảo vệ lộ ra thì test bắt được.
   - Tester đã giả lập vá L-1 (đổi matcher theo đề xuất của security, rồi phục hồi `middleware.ts`, `git status` sạch).
     Khi đó spec 13 vẫn 8/8 xanh, nhánh 200 tới `/vi/login` được chạy thật.
     Đây là bằng chứng test không còn đỏ oan khi vá L-1.
2. Mục 2 (đổi số file): đã sửa đúng.
   - File mới là `e2e/13-locale-redirect-cookie.spec.ts`, nhãn describe dòng 39 là `'13 - ...'`.
   - `ket-qua-test.md` mục 4 và `danh-gia-bao-mat.md` mục I-5 đã trỏ tên mới.
   - Các chỗ còn chữ `12-locale-...` (`danh-gia.md` vòng 1, `thay-doi.md:299`, `ket-qua-test.md:167`) đều đang kể lại việc đổi tên, là lịch sử, đúng.
   - Trên nhánh A tạm thời trống số 12 trong `e2e/`, đúng chủ ý: số 12 để cho `e2e/12-chuoi-gia-tri.spec.ts` của nhánh C.

### Xác nhận các mục nên làm của vòng 1

- `isOpenRedirectLocation` (dòng 26-37) đã coi `/\` là open redirect.
- `fresh.dispose()` đã nằm trong `finally` (dòng 70-87).
- Đã bỏ tham chiếu "xem thay-doi.md" ở comment đầu file (dòng 10-13).
- Câu chữ về nguyên nhân `02-overview` trong `thay-doi.md` (mục Bước 3 và bảng test sửa kỳ vọng) và `hieu-nang.md` dòng 65-78 đã bỏ khẳng định sai về mốc 5s.
  Nay ghi đúng là `.count()` đọc DOM một lần, còn nguyên nhân sâu hơn là giả thuyết chưa kiểm chứng.
- Mục nhắc lúc merge (Q2, 10 khối `dynamic({ ssr: false })` của nhánh C) vẫn giữ nguyên giá trị, xem phần lịch sử bên dưới.

### Test có giá trị thật không

- Có.
  Test biên nay khoá đúng bất biến bảo mật (không ra host lạ, không lộ HTML dự án), không khoá mã trạng thái sẽ đổi.
  Tester đã chứng minh test vẫn xanh khi giả lập vá L-1.
- Ý T-1 của security (DB rỗng thì kiểm âm tính không chứng minh gì): e2e của A chạy trên DB tạm `ddc_control_tower_e2e_a` đã seed 17 dự án.
  Trang Tổng quan của DB đó thật sự render `href="/vi/projects/...`, nên kiểm âm tính ở dòng 105 có ý nghĩa.
  Không cần làm thêm.
- Ý T-2 của security (bắt thêm `Location` bắt đầu bằng `\`): đồng ý, mức thấp.
  Đưa vào cùng việc vá L-1 ở phase sau, không chặn.

### Bảo mật, hiệu năng, tính đúng đắn

- Bảo mật: `danh-gia-bao-mat.md` vòng 2 giữ DAT, reviewer đồng ý.
  Vòng này không đổi hành vi chạy thật.
- Hiệu năng: không đổi so với vòng 1.
- Tính đúng đắn: không thấy lỗi logic mới trong spec.
  `api.get` đi theo redirect mặc định nên `res.url()` là URL cuối, kiểm host và pathname là đúng chỗ.

### Việc còn lại trước khi merge (không phải sửa code)

- `.bangiao/danh-gia-bao-mat.md` đang sửa mà chưa commit (mục "Vòng 2" của security): commit cùng `danh-gia.md` này.
- Theo CLAUDE.md mục 4: chuyển toàn bộ hồ sơ `.bangiao/` vào `.bangiao/archive/nang-next15-<yyyy-mm-dd>/` trước khi merge `main`.
- Lúc merge: B và C làm theo hướng dẫn ở cuối `thay-doi.md` (`npm install`, xoá `.next`); bên merge sau giải xung đột `projects/[id]/page.tsx` theo mục nên làm cuối cùng của vòng 1.
- Nợ phase sau (không chặn): L-1 (kèm T-2 và e2e cho đường dẫn có dấu chấm), L-2, rate-limit đăng nhập, gỡ `xlsx`, L-3.

---

## Vòng 1 (lịch sử)

PHAN QUYET vòng 1: CAN SUA

Skill đã dùng: `code-review` (gọi ở mức high trên `54ac9bf..HEAD`, chạy nền, chưa trả kết quả trước lúc chốt; phán quyết dựa trên phần rà tay của reviewer).
Nhánh `feature/nang-next15`, gốc `main` @ `54ac9bf`, HEAD `d66e5bd`.
Đã đọc `ke-hoach.md`, `thay-doi.md`, `hieu-nang.md`, `ket-qua-test.md`, `danh-gia-bao-mat.md` (DAT) và toàn bộ `git diff 54ac9bf..HEAD`.
Reviewer tự chạy lại: `npx tsc --noEmit` exit 0; `npm test` 210 file / 2409 test xanh.
Reviewer không chạy lại e2e (dựa vào số 79/79 của tester).

### 1. Code có khớp kế hoạch không

Có, khớp và đủ.

- Task 1: 2 file `*ChartsLazy.tsx` là `'use client'`, mỗi export đúng là giá trị trả về của `dynamic(...)`, chép nguyên `loading` và đường dẫn import.
  `ssr: false` không còn trong server component nào.
- Task 2: đủ 9 page/layout, 2 route handler, `activity.ts` (`await headers()` vẫn nằm trong `try`).
  Thứ tự kiểm quyền được giữ: cron kiểm secret trước `await params`, photos gọi `getCurrentUser()` trước `await params`, page chỉ `await params/searchParams` rồi mới `getLocale` và `requireUser`.
  Có một chỗ lệch mẫu kế hoạch ở `projects/[id]/page.tsx`: dùng 2 lệnh await riêng thay cho `Promise.all`.
  Cách lệch này hợp lý, có ghi lý do tại chỗ và trong `thay-doi.md`.
  Regex `/^[1-9]\d*$/` và `notFound()` giữ nguyên.
- Đã rà các chỗ khác trong repo: không còn `cookies()`/`headers()` gọi đồng bộ; `app/api/export` và `app/api/templates` đọc `req.nextUrl.searchParams` nên không bị ảnh hưởng.
- Sửa ngoài danh sách dự kiến: `src/components/ui/motion.ts` (nới kiểu `RefObject<HTMLElement | null>`, hệ quả bắt buộc của types React 19, hook đã tự kiểm null) và `src/components/form/ProjectForm.tsx:244` (`?? ''`, next-intl 4 cấm undefined).
  Cả 2 đều có ghi lý do, đúng quy định.
- Task 3: `localeCookie.maxAge` 1 năm; `vitest.config.ts` inline `next-intl` chỉ thêm khi thật sự lỗi; mock `permanentRedirect` chỉ thêm ở 1 file cần.
- Phiên bản ghim chính xác, không dùng `^`/`~`.
  Khối override `next-auth -> nodemailer` giữ nguyên, thêm `recharts -> react-is` đúng phương án dự phòng của kế hoạch.
- Q1 và Q2 đã ghi đúng quyết định của chủ dự án ở `thay-doi.md` mục "Để sau" và "Task 5".
- Luật repo:
  - Không đụng `prisma/schema.prisma`, `prisma/migrations/`, `vi.json`, `en.json`, `actions.ts`, `project-queries.ts`, `PROGRESS.md`, `.serena/`.
  - File nóng `src/server/queries.ts` chỉ sửa comment, có giữ khoá rồi nhả.
  - Không có em dash hay en dash trong diff (trừ lockfile) và trong commit message.
  - 6 commit đều tiếng Việt không dấu, có dòng `Co-Authored-By`.
  - `next-env.d.ts` nằm trong gitignore nên đúng là không commit.

### 2. Test có giá trị thật không

Nhìn chung có giá trị thật.

- 12 file unit test chỉ bọc `Promise.resolve(...)`, không đổi kỳ vọng.
  Các test guard (`app-pages-auth-guard`, `app-pages-require-user`) vẫn khoá thứ tự `requireUser` và danh sách id rác của trang Chi tiết.
- `e2e/02-overview.spec.ts` dòng 14-20 (`toPass` 15s): KHÔNG che lỗi.
  - Test cũ đọc `.count()` một lần ngay sau khi KPI hiện, không chờ gì cả, nên vốn đã phụ thuộc thời điểm.
  - Bản mới vẫn đòi đủ >= 4 chart, chỉ cho thời gian chunk client nạp.
  - Tester đã xác nhận trên `next start` rằng 5/5 chart lên sau 1-2s, console sạch, tooltip có dữ liệu thật.
  - 15s đủ rộng cho dev server (Playwright chạy `next dev`) mà vẫn bắt được lỗi chart không mount.
  - Ghi chú về giải thích: `thay-doi.md` dòng 150-153 và 270, `hieu-nang.md` dòng 67-69 cho rằng nguyên nhân là "chunk nặng hơn do recharts 2.15.4 + React 19", và "`.count()` vượt mốc 5s mặc định".
    `.count()` không chờ 5s nào cả.
    Giả thuyết hợp lý hơn: Next 14 không thực sự áp `ssr: false` khi dùng trong Server Component, nên chart có sẵn trong bundle trang.
    Nay chart nằm trong client component nên là chunk lười thật, chỉ nạp sau hydration.
    Giả thuyết này chưa kiểm chứng.
    Không chặn, nên sửa câu chữ lúc lưu hồ sơ vào archive.
- `e2e/12-locale-redirect-cookie.spec.ts`: test cookie 1 năm có làm RED-GREEN, đây là test có giá trị nhất.
  Test "phải thất bại" thì đang khoá sai điều cần khoá (xem mục cần sửa 1).

### 3. Bảo mật, hiệu năng, tính đúng đắn

- Bảo mật: `danh-gia-bao-mat.md` = DAT.
  Reviewer đồng ý: advisory của `next`, `next-intl`, `cookie` đã hết; chốt đăng nhập đứng trước mọi lần đọc dữ liệu.
  L-1, L-2, L-3 có từ trước, ghi vào phase sau.
- Hiệu năng: mọi ô "lần đầu" đều nhanh hơn trước, `unstable_cache` vẫn ăn.
  Đo 10 triệu dòng đã dời sang P5 theo Q1.
- Tính đúng đắn: comment `requestMemo` ở `queries.ts` đúng với React 19; code không đổi.
  Không thấy lỗi logic trong diff.

### Cần sửa (bắt buộc trước khi CHOT)

1. `e2e/12-locale-redirect-cookie.spec.ts:94` `expect(res.status()).toBe(404);` đang khoá hành vi của lỗ hổng L-1 (middleware bỏ qua đường dẫn có dấu chấm) như một kỳ vọng.
   Bảng bảo mật xếp việc vá L-1 đứng đầu cho phase sau.
   Khi vá, trang này sẽ chuyển về `/vi/login` (200) và test đỏ oan, dù vá là đúng.
   Cách sửa:
   - Bỏ dòng 94.
   - Thay bằng kỳ vọng không phụ thuộc L-1: `expect([200, 404]).toContain(res.status())`, và nếu 200 thì `new URL(res.url()).pathname` phải là `/vi/login`.
   - Sửa comment dòng 87-91 và tên test dòng 86 cho khớp. Chữ "phai that bai" dễ đọc thành "test này đỏ là đúng"; đổi thành "bien: ... khong ra host la, khong lo du lieu".
   Dòng 96 `not.toContain('projectName')` là kiểm yếu: chuỗi này là tên thuộc tính JS, hầu như không bao giờ có trong HTML.
   Nên thay bằng kiểm không chứa tên một dự án seed thật của DB e2e, hoặc không chứa `href="/vi/projects/`.
2. Đổi tên `e2e/12-locale-redirect-cookie.spec.ts` thành `e2e/13-locale-redirect-cookie.spec.ts`, và sửa nhãn describe ở dòng 38 từ `'12 - ...'` thành `'13 - ...'`.
   Nhánh `feature/p7-c2-chuoi-gia-tri` của C đã có `e2e/12-chuoi-gia-tri.spec.ts`.
   Git merge không xung đột (khác tên file), nhưng sau merge sẽ có 2 spec cùng số 12, phá quy ước đánh số tuần tự.
   Kết quả e2e sẽ báo 2 nhóm "12 - ...", còn hồ sơ bàn giao và sổ nợ tham chiếu theo số sẽ bị nhập nhằng.
   Nhánh nào merge `main` trước thì giữ số, nên A đổi ngay bây giờ là rẻ nhất.
   Sau khi đổi, sửa tham chiếu tên file trong `.bangiao/ket-qua-test.md` (mục 1 và 4) và `.bangiao/danh-gia-bao-mat.md` mục I-5.

Sau 2 mục trên: chạy lại riêng spec mới (`npm run test:e2e:a -- e2e/13-locale-redirect-cookie.spec.ts`), rồi `npx tsc --noEmit`.
Không cần chạy lại toàn bộ dây chuyền.

### Nên làm (không chặn)

- `e2e/12-locale-redirect-cookie.spec.ts:26-36` `isOpenRedirectLocation`: coi thêm `location.startsWith('/\\')` là open redirect, vì trình duyệt hiểu `/\host` như `//host`.
- `e2e/12-locale-redirect-cookie.spec.ts:68-83`: đặt `fresh.dispose()` trong `try/finally` để assert đỏ không bỏ lại context.
- Comment dòng 9-12 của spec nói "xem thay-doi.md" nhưng `thay-doi.md` không có mục đó: bỏ tham chiếu hoặc thêm 1 dòng vào `thay-doi.md`.
- Sửa câu chữ về nguyên nhân `02-overview` như đã nêu ở mục 2, lúc chuyển hồ sơ vào `.bangiao/archive/`.
- Lúc merge sau này (Q2, bên merge sau tự giải xung đột): nhánh C vẫn còn 10 khối `dynamic({ ssr: false })` trong `app/[locale]/(app)/projects/[id]/page.tsx` và đã sửa `ProjectForm.tsx`.
  Người giải xung đột phải giữ cách import từ `ProjectDetailChartsLazy`, chuyển mọi `dynamic(...)` mới của C vào file Lazy, rồi chạy `git grep -n "ssr: false" -- app src`, `npx tsc --noEmit`, `npm run build` (font mock) trước khi commit merge.
