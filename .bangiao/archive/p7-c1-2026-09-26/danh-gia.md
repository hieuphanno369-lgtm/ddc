PHAN QUYET: CHOT

# Đánh giá cuối P7-C1 (nhánh feature/p7-c-task-bo-sung)

> Ghi chú điều phối: reviewer không có công cụ ghi file; bên điều phối lưu nguyên văn báo cáo vào file này.

Skill đã dùng: `ddc-tower:code-review`.

## Vòng 2 (diff 7d7cc77..HEAD: a29d2db, 4e528a1, 896217b, 743f841, 42ab7f6, 293aefd)

Nguồn đối chiếu:
- Mục CẦN SỬA #1 và NÊN SỬA #2 của vòng 1 (bên dưới).
- `.bangiao/thay-doi.md` mục "Vòng CẦN SỬA #1" và "Debugger vòng 1".
- `.bangiao/ket-qua-test.md` mục "Vong 2" và "Vong 3".
- `.bangiao/danh-gia-bao-mat.md` vòng 2 (DAT).

### Tự kiểm (reviewer tự chạy lại, qua PowerShell tại D:\_project\DDC_Control_Tower-C)

- `npx tsc --noEmit`: sạch, exit 0.
- `npm test`: 203 file / 2212 test passed, exit 0.
  Số này khớp hồ sơ: 2193 + 6 (vòng CẦN SỬA #1) + 6 (tester vòng 2) + 7 (tester vòng 3) = 2212.
- Không chạy lại e2e.
  Kết quả e2e dựa trên hồ sơ: debugger chạy spec 09 được 44/44 ở lần thứ 3 (2 lần đầu timeout webServer do máy tải nặng), tester vòng 3 chạy trọn bộ được 70/70 và kiểm DB bằng mcp__postgres ra `ddc_control_tower_c` có 17 dự án.
- Em dash và en dash: 0 trong các dòng thêm của diff, 0 trong message 6 commit.
- File đổi: chỉ `e2e/helpers/env.ts`, `e2e/helpers/env.test.ts` và `.bangiao/` (`thay-doi.md`, `ket-qua-test.md`, `danh-gia-bao-mat.md`).
  Không đụng file nóng nào, không đụng `PROGRESS.md` hay `.serena/`.
  Đúng giới hạn "không sửa file nào khác ngoài 2 file trên và hồ sơ".

### 1. Mục CẦN SỬA #1 (L-1) đã sửa đúng chưa? Rồi, và chặt hơn đề xuất gốc.

- `e2e/helpers/env.ts` dòng 86-90 (hàm `isExpectedDbUrl` dòng 79) hiện chặn:
  - khi có hash (`u.hash !== ''`);
  - khi query có hơn 1 cặp;
  - khi query có 1 cặp nhưng không phải `['schema','public']`.
- Đoạn gợi ý của reviewer vòng 1 (`.every(k === 'schema')` + `.get('schema')`) có lỗ: `?schema=public&schema=evil` lọt qua.
  Lý do là `.get()` đọc giá trị đầu, còn engine Prisma lấy giá trị cuối (security-reviewer đã xác nhận bằng chạy thật: search_path = `evil`).
  Lỗi này nằm ở đề xuất của reviewer, không phải ở coder.
  Tester vòng 2 bắt được bằng test đỏ, debugger sửa bằng cách đếm tổng số cặp query.
  Cách đếm tổng số cặp đúng và đơn giản hơn đếm riêng key `schema`.
- Việc thêm điều kiện chặn hash là mở rộng phạm vi hợp lý.
  Nó nằm trong đúng hàm đó, đối xứng với `parseE2eBaseUrl` ở dòng 51 của cùng file, và fail-closed.
- Test (`e2e/helpers/env.test.ts`, describe `isExpectedDbUrl`) có đủ 6 case reviewer yêu cầu.
  Ngoài ra có 6 case biên của tester vòng 2 và 7 case của tester vòng 3.
  Đây là test hành vi thật: có ghi nhận đỏ trước sửa (vòng CẦN SỬA #1: 4 failed/21 passed; vòng 2: 4 failed/27 passed), rồi xanh sau sửa.
  Các case "true" (không query, `?`, `&` thừa, khoảng trắng hai đầu) khoá luôn chiều ngược lại, để guard không chặt quá mức làm vỡ `.env` thật.
- `.env` thật của C (`?schema=public`) vẫn qua guard: spec 09 được 44/44, trọn bộ được 70/70.

### 2. Mục NÊN SỬA #2 đã sửa chưa? Rồi.

`ket-qua-test.md` mục 1 đổi thành `0/9`, mục 5 đổi thành `1/62 (~1.6%)`.
Hai số này khớp với `thay-doi.md` Bước 1 (61 passed / 1 failed) và với 3 lần chạy trọn bộ cộng 6 lần lặp `--repeat-each`.

### 3. Bảo mật, hiệu năng, tính đúng đắn

- Security vòng 2 là DAT.
  Security-reviewer đã kiểm bằng chạy thật trên engine Prisma 6.19.3:
  - `?host=`, key lặp, `options`, fragment đều bị chặn;
  - biến PG* trong môi trường không phải đường vòng;
  - `%xx`, `;` và `+` không tạo chỗ lệch giữa WHATWG URL và engine Prisma.
- Case tab giữa hostname (`loca\tlhost`) ra true.
  Chuỗi thô có tab vẫn được truyền cho Prisma, nhưng bộ parse URL phía Rust cũng theo chuẩn WHATWG nên bỏ tab giống vậy, và tên DB vẫn phải khớp chính xác.
  Chấp nhận được.
- I-3 (không kiểm `u.protocol`): không bắt buộc.
  Provider postgresql của Prisma tự từ chối mọi scheme khác `postgresql:`/`postgres:`.
  `prisma://` và `prisma+postgres://` cần `?api_key=`, mà guard đã chặn query này.
  Không có đường khai thác, nên ghi sổ nợ là N-P7-5 (tuỳ chọn, 1 dòng).
- Hiệu năng: không liên quan (guard chạy 1 lần lúc khởi động e2e).

### 4. Điểm nhỏ (không chặn, không bắt sửa)

- `e2e/helpers/env.ts` dòng 69-77: JSDoc kể lại lịch sử bản vá cũ (`.every` + `.get()`) mà code không còn dùng.
  Nó cũng nhắc "Prisma/pg" trong khi repo không có `pg`.
  Lịch sử nên nằm ở commit message; JSDoc chỉ cần nói quy tắc hiện tại: 0 cặp hoặc đúng 1 cặp `schema=public`, không có hash.
  Nên gọn lại khi có dịp đụng file này.
- `e2e/helpers/env.test.ts` dòng 125: tên test nói "guard chi doc gia tri dau qua .get()", đã cũ so với code hiện tại.
- Commit `896217b` cố ý để 4 test đỏ trên nhánh (TDD của tester), rồi `743f841` làm xanh lại.
  Không sao với nhánh phase, chỉ lưu ý khi dùng `git bisect`.

### Kết luận vòng 2

Mục bắt buộc đã vá đúng gốc, test có giá trị thật (có đỏ trước sửa), cổng kiểm xanh, không vượt phạm vi, không đụng file nóng, không có dấu gạch dài.
CHỐT nhánh P7-C1.
Trước khi merge vào `main`: chuyển `.bangiao/*.md` vào `.bangiao/archive/p7-c1-<yyyy-mm-dd>/` theo CLAUDE.md mục 4, và chép SỔ NỢ KỸ THUẬT bên dưới vào `phien-C.md` hoặc `lo-trinh.md`.

## Vòng 1 (diff 984b509..HEAD) - giữ nguyên để tra cứu

Phán quyết vòng 1: CAN SUA (đã xử lý ở vòng 2).

Nguồn đối chiếu: `D:\_project\DDC_dieu-phoi\lenh-cho-C-2026-09-27.md` PHẦN C-0 và C-1, các chốt của chủ dự án (7.1, 7.3, 7.6), và `.bangiao/ke-hoach.md`, `thay-doi.md`, `ket-qua-test.md`, `danh-gia-bao-mat.md`.

### Tự kiểm vòng 1

- `npx tsc --noEmit`: sạch, exit 0.
- `npm test`: 203 file / 2193 test passed, exit 0.
- Không chạy lại e2e.
  Kết quả e2e dựa trên hồ sơ: coder 70/70, tester 3 lần 70/70.
- Tìm em dash và en dash trong mọi dòng thêm của diff và trong message của 7 commit: không có.
- File nóng không được giữ: `git diff --name-only 984b509..HEAD` với `prisma/`, `app/globals.css`, `app/tokens.css`, `src/server/queries.ts`, `src/server/project-queries.ts`, `PROGRESS.md`, `.serena/`, `CLAUDE.md` ra rỗng, tức là không đụng.
  File nóng có đụng (`vi.json`, `en.json`, `actions.ts`, `prisma-repo.ts`) đều nằm trong danh sách C được giữ theo kế hoạch.

### 1. Code có khớp kế hoạch không? Có.

- **C-0.**
  `E2E_TARGETS` chỉ có 2 cặp `_b`+3001 và `_c`+3003.
  `isExpectedDbUrl` so khớp chính xác hostname, port và pathname, không dùng `includes()`.
  Cùng một hàm `resolveE2eTarget` được gọi ở cả `playwright.config.ts` (trước khi webServer khởi động) và `global-setup.ts` (trước khi seed).
  `webServer.env` truyền `DATABASE_URL` đã kiểm, spec 09 hết gõ cứng 3001, thông báo lỗi không lộ mật khẩu.
  Có test đỏ trước (6 fail rồi 19 pass).
- **7.1.**
  Đã xoá hẳn component, khối trên `/admin`, `resetDataAction`, `resetAllData` ở cả prisma-repo lẫn mock-repo, 2 key i18n, và test cũ.
  Giữ `activity.reset_data` để nhật ký cũ vẫn hiển thị (K7), lý do đúng.
  `git grep` không còn tham chiếu nào trong code sản phẩm.
- **7.3.**
  vi: dòng đậm "BÁO CÁO QUẢN TRỊ", dòng mờ "Danh Mục Dự Án".
  en: "MANAGEMENT REPORTS" / "Project Portfolio".
  Tiêu đề tab theo locale qua `generateMetadata`, h1 trang đăng nhập dùng key, `testNotice` đổi theo K6.
  Đổi giá trị, không đổi tên key (K1), hợp lý.
- **7.6.** `detail.tl.gap` vi = "Chênh lệch KH vs TT", en = "Plan vs Actual variance". Đúng.
- **7.2 và 7.4** đúng là không làm, theo lệnh.

### 2. Test có giá trị thật không? Có, đa số là test hành vi thật.

- `e2e/helpers/env.test.ts`: phủ đủ các biên quan trọng (DB A với mọi cổng, cặp lệch, tên gần giống, host/port khác, URL hỏng, lộ mật khẩu).
- `ActivityViewer-legacy-action.test.ts` của tester: render thật với bản dịch thật.
  Có case tự kiểm chứng (bỏ key thì thấy chuỗi thô), không phải test chạy suông.
- `e2e/10-ten-app.spec.ts`: đo thật scrollWidth, chiều cao 1 dòng, vị trí dòng đậm/mờ, thu gọn, drawer mobile, title theo locale.
  Chính test này đã bắt được lỗi EN xuống 2 dòng ở 13px, chứng minh nó có giá trị.
- `reset-data-removed.test.ts` và `messages-p7-c1.test.ts` là test tĩnh (đọc file, so chuỗi).
  Chúng chấp nhận được vì mục đích là khoá hồi quy "đã gỡ" và "đúng chữ chủ dự án chốt".
- Điểm trừ nhỏ: selector `header.topbar button` với `.first()` trong spec 10 hơi giòn, nếu thêm nút trước nút menu thì sai.
  Không bắt sửa.

### 3. Bảo mật, hiệu năng, tính đúng đắn

- **L-1 (đã vá ở vòng 2).**
  `isExpectedDbUrl` bỏ qua query string, nên `?host=<máy khác>` lọt qua guard.
  Tầng kết nối của Prisma cho tham số `host` trong query ưu tiên hơn host trong URL, nên kết nối thực đi nơi khác trong khi guard vẫn thấy `localhost`.
  Rủi ro thực tế thấp (tên DB vẫn bị khoá, không trỏ được vào `ddc_control_tower`).
  Nhưng đây là tuyến chặn duy nhất giữa e2e (seed, xoá dữ liệu) và các DB cùng server, cách sửa chỉ 1-2 dòng, nằm trong đúng file của phạm vi C-0, và chủ dự án ưu tiên độ bền.
  Vì vậy vá ngay trong nhánh, không đẩy sang nợ.
  Đã kiểm `.env` của cả B lẫn C chỉ có `?schema=public`, nên allowlist chặt không làm vỡ e2e của B.
- **L-2 (không vá trong nhánh này, ghi nợ).**
  `reuseExistingServer: true` ở `playwright.config.ts` dòng 32 không kiểm server đang chạy dùng DB nào.
  Rủi ro này có từ trước diff, và mặc định an toàn vì `launch.json` không đặt `DATABASE_URL`.
  Cách vá đúng (endpoint dev trả `current_database()`, hoặc chỉ tái dùng server khi đặt biến `E2E_REUSE`) thay đổi luồng làm việc của cả B và C.
  Nên làm ở phase riêng, có hỏi chủ dự án (P5 hạ tầng hoặc qa-gate).
- **Fallback 12px dòng đậm sidebar: chấp nhận được.**
  Vùng chữ rộng khoảng 151px: 236 trừ padding 20, trừ brand padding 16, trừ logo 38, trừ gap 11.
  "MANAGEMENT REPORTS" in hoa, đậm 650, ở 13px rộng hơn vùng này nên xuống dòng; ở 12px còn dư khoảng 6%.
  Phân cấp vẫn rõ: 12px đậm 650 so với 11px nặng 500 màu `label3`.
  Áp cho cả 2 locale để nhất quán là đúng.
  Hai điểm cần ghi nợ:
  (a) Style đang viết inline trong `AppShell.tsx` dòng 111, chỉ vì `globals.css` là file nóng không giữ.
  Chỗ đúng là `.brand .nm b` trong `app/globals.css` dòng 56.
  Khi merge xong nên chuyển vào CSS và bỏ inline.
  (b) Biên 6% khá mỏng: font dự phòng lúc chưa tải xong Inter (display: swap), hay cách render chữ trên máy khác, có thể làm xuống dòng lại.
  Nên thêm `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` cho `.brand .nm b` cùng lượt chuyển vào CSS.
  Không chặn nhánh này, vì e2e đo thật đang xanh ở cả vi lẫn en.
- **Test chập chờn 02-overview: chưa tìm ra gốc, không chặn, nhưng phải ghi nợ kèm giả thuyết cụ thể.**
  Giả thuyết reviewer thấy mạnh nhất (chưa chứng minh): cache dữ liệu `unstable_cache` của Next (`src/server/cache.ts`, TTL 1800s) được lưu trên đĩa trong `.next/cache`, và còn nguyên qua các lần dev server khởi động lại.
  `global-setup.ts` seed lại DB nhưng không làm mất hiệu lực cache đó.
  Nếu trước lần chạy e2e đầu tiên có người mở `/vi/overview` trên 3003 lúc DB `_c` đang trống hoặc đang seed (ví dụ giữa lúc migrate và seed ngày 2026-09-26), danh sách rỗng bị giữ tới 30 phút.
  Điều này khớp với việc chỉ lần đầu đỏ, các lần sau xanh, và xanh khi xoá `.next`.
  Cách xác nhận khi tái diễn: xem `.next/cache/fetch-cache` trước khi chạy.
  Cách vá tiềm năng: e2e dùng `distDir` riêng, hoặc xoá Data Cache trước khi webServer chạy.
  Cần kiểm thứ tự webServer và globalSetup của Playwright 1.63; mục 5 của `ket-qua-test.md` giả định seed chạy trước webServer mà chưa kiểm.
  Việc này đụng `cache.ts`/`queries.ts` hoặc cấu hình e2e, nên làm ở lượt riêng.
- **Hiệu năng.**
  `generateMetadata` gọi `getTranslations` mỗi request, rẻ, không có vấn đề.
  Xoá hàm hàng loạt chỉ làm giảm bề mặt tấn công.
- **Tính đúng đắn.**
  `AppShell.tsx` dòng 79 giữ `t('app.headerTitle')` làm fallback tiêu đề trang (K5), hợp lý.
  Không còn chỗ nào dùng `app.name` hay `headerTitle` với nghĩa cũ.
  Comment "DDC Control Tower" ở `src/components/icons/index.tsx` dòng 4 được giữ theo kế hoạch.

### CẦN SỬA vòng 1 (ĐÃ XỬ LÝ ở vòng 2)

1. Vá L-1 ở `e2e/helpers/env.ts`, hàm `isExpectedDbUrl`: chỉ cho query `schema=public`, kèm test đỏ trước.
   Đã xong qua commit a29d2db và 743f841 (743f841 vá thêm key lặp và hash), test ở commit 896217b và 42ab7f6.

### NÊN SỬA vòng 1 (ĐÃ XỬ LÝ ở vòng 2)

2. `.bangiao/ket-qua-test.md`: sửa số liệu tự mâu thuẫn (0/79 thành 0/9, 3/64 thành 1/62).
   Đã xong qua commit 4e528a1.

## SỔ NỢ KỸ THUẬT (ghi vào phien-C.md hoặc lo-trinh khi merge, không làm trong nhánh này)

- N-P7-1 (L-2): `reuseExistingServer` không kiểm DB của server đang chạy (`playwright.config.ts` dòng 32).
  Hỏi chủ dự án chọn cách vá (endpoint dev trả `current_database()`, hay biến `E2E_REUSE`).
- N-P7-2: chuyển `fontSize: var(--t-caption1)` từ inline `src/components/layout/AppShell.tsx` dòng 111 vào `.brand .nm b` trong `app/globals.css` dòng 56.
  Thêm `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
  Chỉ làm khi C giữ được khoá `globals.css`.
- N-P7-3: test chập chờn `e2e/02-overview.spec.ts`, với giả thuyết cache `unstable_cache` trên đĩa không bị làm mất hiệu lực sau khi global-setup seed lại (xem vòng 1 mục 3).
  Kiểm thứ tự webServer và globalSetup của Playwright 1.63 trước khi chọn cách vá.
- N-P7-4 (I-1): guard chưa gắn cặp DB/cổng với tên thư mục worktree.
  Tuỳ chọn.
- N-P7-5 (I-3, mới): `isExpectedDbUrl` (`e2e/helpers/env.ts` dòng 79-92) chưa kiểm `u.protocol`.
  Thêm `if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') return false;` cho chặt.
  Tuỳ chọn, hiện chưa có đường khai thác.
- N-P7-6 (mới, dọn dẹp): gọn JSDoc `e2e/helpers/env.ts` dòng 65-77 về quy tắc hiện tại, bỏ phần kể lịch sử và chữ "Prisma/pg".
  Sửa tên test ở `e2e/helpers/env.test.ts` dòng 125 (bỏ nhắc `.get()`).
  Làm khi có dịp đụng file này.
