# P1A — Thay đổi (chặng CODER)

Nhánh `feature/p1a-du-lieu-dung`, từ `main` @ `01e82cf`. 11/11 Task hoàn thành, không lệch kế hoạch,
không có việc dở. Cổng kiểm cuối (Task 11): `tsc --noEmit` sạch, `npm test` **808/808 xanh** (63 file),
`npm run build` (với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`) xanh, `prisma migrate status` → "Database schema
is up to date".

## Danh sách commit theo Task

1. `15cafd4` **Task 1** — migration gộp: `dim_shift`, `dim_date`, `dim_project.factoryId`/`contractValueOriginal`,
   `fact_daily_manpower.shiftCode`, `project_equipment_plan`, index audit_log/alert_log. File: `prisma/schema.prisma`,
   `prisma/migrations/20260924090000_p1a_data_foundation/migration.sql`, `prisma/rollback/*.down.sql`,
   `src/server/repo/types.ts`, `src/lib/shifts.ts` (+test), `src/data/seed/erp.ts`, `src/data/seed/history.ts` (+test),
   `src/server/repo/{prisma-repo,mock-repo}.ts`, `prisma/seed.ts`.
2. `1dd64f2` **Task 2** — seed 6 dòng kế hoạch thiết bị (Gantt T14): `equipmentPlanSeed` trong `erp.ts`,
   `RepoData.equipmentPlans`, `prisma/seed.ts` (createMany + syncSequences), test trong `history.test.ts`.
3. `b0f71b9` **Task 3** — `saveMonthlyFact`/`saveFinancial` (prisma-repo + mock-repo) trả `SaveFactResult`
   (`'created' | 'updated' | 'not_found'`); tháng chưa có dòng → tự tạo carry-forward từ tháng gần nhất trước đó;
   `actions.ts saveMonthlyData` kiểm dự án tồn tại + bắt `'not_found'`. Test: `dim.test.ts`, `actions.test.ts`,
   `prisma-repo-save.test.ts` (mock `@/server/db`).
4. `2594a7d` **Task 4** — import Excel báo lỗi rõ từng dòng thay vì bỏ qua im lặng: `ImportRow` có `rowNo`/`reason`,
   `importExcelAction` phân loại `no_sap`/`no_pct`/`bad_pct`/`not_assigned`; `repo.importMonthlyFacts` trả
   `{ imported, failed[] }`; `commitImportAction` trả `failed[]` thay `skipped`. UI `ImportPanel.tsx` hiện cột "Dòng"
   + badge lỗi + danh sách dòng thất bại. i18n nhóm `dataGuard.import`. Test: `actions-import.test.ts` (mới),
   `valuechain.test.ts` (sửa `n` → `.imported` + thêm case dự án mới).
5. `04f8d6e` **Task 5** — `src/components/form/dataEntryState.ts` (hàm thuần, không React): `buildBaseForm`,
   `stageInputsOf`, `formsEqual`, `buildSavePatch` (chỉ gửi field khác base), bản nháp có dấu phiên bản
   (`draftKey`/`legacyDraftKey`/`makeStamp`/`checkDraft`/`restoreDraft`), `saveErrorKind`. 32 test trong
   `dataEntryState.test.ts`. **Chưa đụng `DataEntryForm.tsx`** ở Task này (đúng bản đồ file).
6. `62ae8ca` **Task 6** — nối `DataEntryForm.tsx` với `dataEntryState`: xoá `loadDraft`/`chainDirty`, banner
   nháp (`Khôi phục`/`Bỏ`, cảnh báo "stale"), lỗi lưu hiện rõ (`sumbar bad` + `dataGuard.save.*`), bước Tài chính
   chỉ xem khi `!canEditFinance`. `nhap-lieu/page.tsx` truyền `canEditFinance`. i18n `dataGuard.draft`/`dataGuard.save`.
   Test thêm 1 case trong `actions-security.test.ts`.
7. `371d056` **Task 7** — `/api/export` bắt đăng nhập (401 chưa login, 403 role sai, chỉ admin/bod) + `safeCell`
   chống chèn công thức Excel (`src/lib/excel-safe.ts`) áp cho cả `/api/export` và `/api/report/export`.
   Test: `excel-safe.test.ts`, `export-route.test.ts` (mới).
8. `5ef40ac` **Task 8** — fail-closed: `src/lib/env.ts` (`requireAuthSecret`, throw rõ khi thiếu/rỗng
   `NEXTAUTH_SECRET`), `auth.ts` secret đổi thành getter (nổ lúc dùng, không nổ lúc import), bỏ hẳn fallback
   `'ddc-local-dev-secret'`; `canViewFinance` mặc định `?? false` ở `auth.ts` + `projects/[id]/page.tsx` dòng 64;
   `middleware.ts` trả 500 rõ khi thiếu secret. Test: `env.test.ts`, `auth-session.test.ts`, `middleware-secret.test.ts`.
9. `08b58ec` **Task 9** — `src/server/authz.ts` thêm `canWriteProject`; `src/server/photo-service.ts` (logic dùng
   chung `addPhotoAction` ⟷ route mới); `app/api/photo-upload/route.ts` (POST, chặn CSRF qua `src/lib/same-origin.ts`,
   401/403 rõ ràng). Test: `same-origin.test.ts`, `photo-upload-route.test.ts` (dùng project id 7/990099 để tránh
   đụng file thật của `actions.test.ts` chạy song song).
10. `6b32e9b` **Task 10** — `src/lib/photo-upload.ts` (`precheckPhotos`, `overallPercent`, hàm thuần), icon
    `IconCloudUpload`, `src/components/form/PhotoDropzone.tsx` (kéo-thả + XHR đo tiến trình, thay thế `<label>` +
    `uploadPhotos`/`photoBusy`/`photoErr` cũ trong `DataEntryForm.tsx`). i18n `dataGuard.photo`.
    Test: `photo-upload.test.ts`.
11. Task 11 (chặng này) — chỉ chạy cổng kiểm, không sửa code; commit `.bangiao/` cùng chặng này.

## Migration + hồi phục đã chạy (Task 1, trên DB `ddc_control_tower`, localhost:5433)

- `npx prisma migrate deploy` → áp `20260924090000_p1a_data_foundation` thành công.
- Trước/sau: tổng `SUM(plannedHeadcount)`/`SUM(actualHeadcount)` của `fact_daily_manpower` không đổi
  (3392 / 3168, 42 dòng); mọi dòng cũ có `shiftCode = 'morning'`; `dim_project.factoryId` backfill đủ cho cả
  17 dự án (0 dòng NULL, vì cả 17 dự án đều có `fact_volume`).
- `npx prisma migrate diff` sau deploy → rỗng (không còn dòng `DROP INDEX ux_fact_*_latest` dương tính giả nào).
- Thử hồi phục 1 vòng: `npx prisma db execute --file prisma/rollback/20260924090000_p1a_data_foundation.down.sql`
  → tổng nhân lực vẫn khớp (3392/3168, 42 dòng, gộp lại đúng) → `npx prisma migrate deploy` lại → `npx prisma db seed`
  xanh (6 dòng `project_equipment_plan`, seed lại 17 dự án + shift + factoryId đúng).

## Lệch khỏi kế hoạch

Không có lệch đáng kể. 1 điều chỉnh kỹ thuật trong lúc làm (không đổi hành vi/kế hoạch):
`src/server/photo-upload-route.test.ts` dùng project id **7** (PIC) + **990099** (giả, không ai được gán) thay vì
1/4 như *actions.test.ts* — vì cả 2 file test đều ghi file thật vào `data/uploads/<projectId>/...` và chạy song
song (Vitest nhiều worker); dùng chung id 1/4 gây `afterAll` (rmSync) của file này xoá nhầm thư mục file kia đang
dùng, test flaky ngẫu nhiên khi chạy `npm test` toàn bộ (không xảy ra khi chạy riêng file). Đã xác minh chạy lại
`npm test` toàn bộ 2 lần liên tiếp xanh sau khi đổi id.

## Việc còn dở

Không có. Task 1–11 đã xong, cổng kiểm cuối phase xanh, không còn TODO nào của P1A.

## Tester nên soi kỹ

- **Migration + hồi phục** (Task 1): thử tự chạy lại `migrate deploy` → rollback → `migrate deploy` → `db seed`
  trên bản sao DB riêng nếu muốn, đối chiếu số liệu nhân lực trước/sau như trong `.bangiao` này.
- **Task 3 carry-forward**: lưu 1 tháng hoàn toàn mới (dự án tạo bằng "Tạo dự án mới") và 1 tháng giữa chừng của
  dự án có sẵn (vd `2026-10` — chưa có dòng) để chắc %TT/luỹ kế không tự về 0.
- **Task 4 import**: thử 1 file có dòng thiếu SAP, % chữ, % trống, và 1 dòng dự án data-entry không được gán —
  xem đúng lý do hiện ra, không silent-skip.
- **Task 6 draft**: sửa 1 field không lưu, F5 lại xem banner nháp bật đúng, bấm Khôi phục/Bỏ đúng hành vi; đổi
  liệu ở tab khác (giả lập version khác) rồi F5 xem có cảnh báo "stale" không.
- **Task 7 bảo mật**: gọi `/api/export` không cookie → 401; role sai → 403; tên dự án có ký tự `=`/`+`/`-`/`@`
  ở đầu → mở file Excel xem ô có tiền tố `'` (Excel hiện dạng text, không chạy công thức).
- **Task 8**: xoá tạm `NEXTAUTH_SECRET` trong `.env`, restart dev, xem app trả 500 rõ ràng (không phải RBAC ngầm
  chạy sai) — nhớ set lại secret sau khi test xong.
- **Task 9/10 upload ảnh**: kéo nhiều ảnh + 1 file không phải ảnh vào vùng thả cùng lúc, xem từng dòng lỗi riêng,
  các ảnh hợp lệ vẫn tải xong (không bị chặn bởi file lỗi đứng trước); thử POST thẳng vào `/api/photo-upload`
  bằng công cụ khác origin (Postman/curl có header `Origin` khác) để xác nhận 403 CSRF.
- File `app/[locale]/(app)/projects/[id]/page.tsx` chỉ đổi đúng 1 dòng (`?? true` → `?? false`) — soát diff để
  chắc không đụng chỗ khác (P1B đang sửa file này song song).

## Vòng sửa 1 (theo danh-gia.md)

Sửa đúng 6 mục ở "4. Danh sách PHẢI SỬA" của `.bangiao/danh-gia.md` (phần "5. Ghi nợ" không đụng vào).
6/6 mục XONG (mục 3 lúc đầu bị chặn bởi lỗi mạng, đã gỡ ở vòng sửa tiếp theo — xem chi tiết bên dưới).
Cổng kiểm sau mỗi mục: `tsc --noEmit` sạch, `npm test` xanh (828/828).

1. **F1 — chặn SVG/HTML giả mạo ảnh (stored XSS)** — commit `4c22bce`.
   - File: `src/lib/uploads.ts` (thêm `detectImageKind` đọc magic-byte JPEG/PNG/GIF/WebP, `savePhotoFile`
     nhận thêm tham số `kind` — đuôi file lưu trên đĩa theo `kind` đã nhận diện, không theo tên client gửi;
     bỏ `.svg`/`.bmp` khỏi `CONTENT_TYPE_BY_EXT`), `src/server/photo-service.ts` (đọc 12 byte đầu file, từ
     chối nếu không nhận diện được định dạng), `app/api/photos/[...path]/route.ts` (thêm header
     `X-Content-Type-Options: nosniff` + `Content-Security-Policy: default-src 'none'; sandbox`).
   - Cập nhật lời gọi `savePhotoFile` (thêm tham số `kind`) ở các test có sẵn: `src/lib/uploads.test.ts`,
     `src/server/photo-route.test.ts`, `src/server/actions.test.ts` (đổi tối thiểu, không đụng logic khác).
   - Test thêm: `src/server/photo-upload-route.test.ts` — SVG khai `type=image/svg+xml` → 400; PNG thật đặt
     tên `x.svg` → 200 và url lưu kết thúc `.png`; HTML giả mạo `type=image/png` → 400.
     `src/server/photo-route.test.ts` — 1 test kiểm 2 header `nosniff`/CSP ở route stream ảnh.
   - **Tester nên soi kỹ**: đuôi file lưu trên đĩa giờ đến từ `kind` (magic-byte), không phải từ tên gốc —
     kiểm ảnh cũ đã lưu trước đây (nếu có phần mở rộng lạ như `.svg`/`.bmp`) vẫn đọc được (rơi về
     `application/octet-stream`, không vỡ app, chỉ không còn suy đúng content-type).

2. **F2a — trang `/nhap-lieu` tự kiểm quyền server-side, fail-closed tài chính** — commit `8106813`.
   - File: `app/[locale]/(app)/nhap-lieu/page.tsx` — thêm guard đầu trang (mẫu `admin/page.tsx`): chưa đăng
     nhập → `/login`; role không phải `admin`/`data-entry` → về trang home của role đó (bod bị đá đi, không
     còn tới trang này). `financial` chỉ được lấy từ repo và truyền xuống `DataEntryForm` khi
     `user.canViewFinance` (fail-closed).
   - Test mới: `src/server/nhap-lieu-page-guard.test.ts` (7 test) — chưa đăng nhập/bod/viewer bị đá đi đúng
     URL; admin/data-entry được vào; data-entry `canViewFinance:false` → prop `financial` là `undefined`;
     admin `canViewFinance:true` → `financial` khớp đúng dữ liệu thật từ repo (không bị ép `undefined`).
   - **Tester nên soi kỹ**: đây là route quan trọng nhất bị lộ bởi CVE-2025-29927 (bypass middleware) —
     xác nhận guard này hoạt động độc lập với middleware (test dùng `renderToStaticMarkup` gọi thẳng
     component, không qua middleware).

3. **F2b — nâng Next.js lên bản đã vá CVE-2025-29927** — commit `6b725e9` (vòng sửa 1, đợt 2).
   - Vòng trước bị chặn bởi `SELF_SIGNED_CERT_IN_CHAIN` (mạng công ty chèn CA riêng khi tải tarball thật
     từ registry.npmjs.org). Đã xử lý bằng cách xuất PEM chứa các CA gốc Windows đang tin, rồi đặt
     `NODE_EXTRA_CA_CERTS` trỏ tới file đó **chỉ cho tiến trình `npm install`** — không tắt kiểm TLS
     (không dùng `NODE_TLS_REJECT_UNAUTHORIZED=0`, không sửa `strict-ssl`/cấu hình npm toàn cục).
   - File: `package.json` (`"next": "14.2.15"` → `"next": "14.2.35"`, giữ nguyên kiểu ghi version chính
     xác không caret như các dependency Next.js liên quan khác trong file — `next-auth`, `next-intl`,
     `react`), `package-lock.json` (đồng bộ lại qua `npm install`).
   - Sau install: `npx prisma generate` chạy lại bình thường (dùng engine local đã trỏ sẵn qua
     `PRISMA_QUERY_ENGINE_LIBRARY`/`PRISMA_SCHEMA_ENGINE_BINARY` trong `.env`, không cần tải engine mới
     qua mạng).
   - Cổng kiểm đã chạy và đạt: `node_modules/next/package.json` version = `14.2.35`; `npx tsc --noEmit`
     sạch; `npm test` → 65 file / 828 test xanh; `npm run build` (với
     `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` trỏ `D:\_project\DDC_dieu-phoi\tools\font-mock.js`) compile
     xanh, sinh đủ route; smoke dev cổng 3000 (`npm run dev`, cấu hình `ddc-control-tower` trong
     `.claude/launch.json`): đăng nhập `admin@daidung.com.vn` qua `/api/auth/callback/credentials` (lấy
     CSRF token trước), `/vi/overview` trả 200 kèm nội dung thật ("Tổng quan"), `/vi/nhap-lieu` trả 200;
     đã tắt dev server sau khi kiểm xong.
   - **Tester/reviewer/chủ dự án cần biết**: CVE-2025-29927 (bypass middleware qua header
     `x-middleware-subrequest`) nay đã được vá bởi bản Next.js 14.2.35. F2a (mục 2, đã xong ở vòng trước)
     vẫn giữ nguyên là lớp phòng thủ độc lập bổ sung cho riêng `/nhap-lieu`; các trang khác (`/overview`,
     `/import`, ...) chỉ dựa vào middleware vẫn còn ghi nợ P5B theo `danh-gia.md` mục 5 (nay rủi ro đã
     giảm đáng kể nhờ bản vá CVE, không còn "rộng hơn dự kiến" như ghi chú vòng trước).

4. **F3 — giới hạn Content-Length trước khi đọc body upload** — commit `aeb22d2`.
   - File: `app/api/photo-upload/route.ts` — đọc header `content-length` trước `req.formData()` (sau kiểm
     Origin + đăng nhập); thiếu header, không phải số, hoặc vượt `PHOTO_MAX_BYTES + 64KB` → 413 ngay.
   - Test thêm ở `src/server/photo-upload-route.test.ts`: "Content-Length 6MB → 413", "không có
     Content-Length → 413"; sửa lại `req()` helper để test tự khai `content-length` (undici/Node's
     `Request` KHÔNG tự tính header này cho body `FormData` như trình duyệt thật vẫn làm — nếu không khai,
     mọi request test sẽ luôn thiếu header).
   - Đổi kỳ vọng 1 test có sẵn: "ảnh vượt 5MB" giờ vẫn là 400 (không phải 413) vì file 5MB+1 byte, cộng dư
     multipart 2KB trong test, vẫn nằm dưới ngưỡng 64KB slack của Content-Length — bị chặn ở bước
     `photoFileSchema` (đúng theo thiết kế: ngưỡng Content-Length rộng hơn `PHOTO_MAX_BYTES` một chút để
     không false-positive với overhead multipart hợp lệ).
   - **Tester nên soi kỹ**: giá trị 64KB overhead là ước lượng — nếu ảnh thật + form field khác vượt hẳn
     64KB overhead (hiếm), request hợp lệ có thể bị 413 oan; theo dõi log nếu gặp báo lỗi 413 bất thường.

5. **Lỗi server phải luôn hiện chữ (T2, "không im lặng")** — commit `d48530d`.
   - File: `src/components/form/DataEntryForm.tsx` (`submit()`) — thêm `catch (e)` gọi
     `setSaveErr(e instanceof Error ? e.message : 'Lỗi không xác định')`, hiện qua nhánh
     `dataGuard.save.generic` sẵn có. Trước đây chỉ có `try/finally`, lỗi ném ra (vd 2 người cùng lưu lần
     đầu 1 tháng, unique index `ux_fact_progress_latest` từ chối bản thứ hai) rơi vào khoảng không.
   - Không thêm test React theo đúng "Xong khi" của kế hoạch.
   - **Tester nên soi kỹ**: thử tái tạo race condition thật (2 tab cùng lưu lần đầu 1 tháng) xem có hiện
     thông báo lỗi thay vì im lặng không.

6. **Test nhánh tạo mới của `prisma-repo.saveFinancial`** — commit `cbeff72`.
   - File: `src/server/repo/prisma-repo-save.test.ts` — thêm case: tháng hiện tại chưa có dòng, tháng trước
     có baseline `{ revenueCumulative: 10, costActualCumulative: 6, backlog: 3 }`, patch
     `{ revenueCumulative: 15 }` → kỳ vọng `'created'`, `version: 1`, `revenuePeriod: 5`,
     `costActualPeriod: 0`, `backlog: 3`, `revenueCumulative: 15`. Không sửa code sản xuất (nhánh này đã
     đúng từ P1A, chỉ thiếu test ở tầng `saveFinancial`, khác `saveMonthlyFact` đã có sẵn).
   - **Tester nên soi kỹ**: không có, thuần bổ sung test khoá hành vi có sẵn.

## Vòng sửa 2 (theo danh-gia.md vòng 2)

Sửa đúng 3 mục ở "4. Danh sách PHẢI SỬA" của `.bangiao/danh-gia.md` (vòng 2). Mục 2 không áp dụng được — xem
chi tiết bên dưới, đã chuyển sang "Chủ dự án cần quyết". Cổng kiểm sau mỗi mục: `tsc --noEmit` sạch, `npm test`
xanh (828 → 838/838 sau mục 3).

1. **Sửa test F2a giả xanh** — commit `d5c933c`.
   - File: `src/server/nhap-lieu-page-guard.test.ts` — helper `user()` thêm tham số `email`; 2 test data-entry
     (trước dùng `data-entry@daidung.com.vn`, không có dự án nào được gán trong seed) đổi sang
     `pm@daidung.com.vn` (PIC dự án 1, 2, 3, 5, 7, 11; dự án 1 có tài chính `2026-09`).
   - Test "data-entry được vào": thêm `expect(formProps).toHaveLength(1)`.
   - Test "canViewFinance:false → `financial` undefined": thêm `expect(formProps).toHaveLength(1)`; đặt
     `vi.spyOn(mockRepo, 'getFinancial')` trước `visit()`, kiểm spy KHÔNG được gọi khi render (chứng minh
     `page.tsx:47-48` không nạp financial chứ không phải nạp rồi ẩn ở UI); sau đó tự gọi
     `mockRepo.getFinancial(...)` để xác nhận tiền đề (dự án 1 thật sự có dòng tài chính `2026-09`, không
     phải test giả xanh vì dữ liệu rỗng); kiểm `formProps[0].financial` là `undefined`; `mockRestore()`.
   - **Kết quả thử đột biến (không commit, đã hoàn nguyên)**: sửa tạm `app/[locale]/(app)/nhap-lieu/page.tsx`
     — dòng 48 bỏ điều kiện `&& user.canViewFinance` (financial luôn được nạp bất kể quyền) và dòng 79 đổi
     `financial={user.canViewFinance ? financial : undefined}` thành `financial={financial}` (luôn truyền
     xuống form) → chạy `npx vitest run src/server/nhap-lieu-page-guard.test.ts`: **1 test ĐỎ** đúng như kỳ
     vọng (`expected "getFinancial" to not be called at all, but actually been called 1 times`), 6 test khác
     vẫn xanh. Hoàn nguyên ngay bằng 2 `Edit` đảo ngược đúng chuỗi cũ; `git diff -- "app/[locale]/(app)/nhap-lieu/page.tsx"`
     sau khi hoàn nguyên: rỗng (không có gì để commit).
   - **Kết quả `npm test` sau mục này**: 65 file / 828 test xanh, `tsc --noEmit` sạch.

2. **F10 — dev server chỉ nghe loopback** — **KHÔNG áp dụng được, chuyển sang "Chủ dự án cần quyết".**
   - Đã thử: `package.json` dòng 6 `"dev": "next dev"` → `"dev": "next dev -H 127.0.0.1"`.
   - **Kết quả netstat**: chạy `npm run dev` (giống launch `ddc-control-tower`, cổng mặc định 3000) →
     `netstat -ano | findstr LISTENING | findstr :3000` **chỉ có** `TCP 127.0.0.1:3000 ... LISTENING` — đúng
     yêu cầu, không còn `0.0.0.0:3000`/`[::]:3000`. Bind đúng.
   - **Nhưng**: mọi request (`curl http://localhost:3000/vi/login`, kể cả `curl http://127.0.0.1:3000/vi/login`)
     đều trả **500**. Log dev server: `Failed to proxy http://localhost:3000/vi/login Error: socket hang up
     ... code: 'ECONNRESET'`. Nguyên nhân: app có `middleware.ts`; cơ chế Next.js 14 dev gọi middleware qua
     1 HTTP request nội bộ của chính dev server, và request nội bộ đó cứng địa chỉ `localhost:3000` bất kể
     server đang bind ở host nào (`-H` không ảnh hưởng tới request nội bộ này) — trong máy này `localhost`
     không route được về đúng socket `127.0.0.1:3000` khi server chỉ bind loopback tường minh qua `-H`, nên
     bị reset. Đã xác nhận đối chứng: tắt server, chạy lại **không có** `-H` (`npx next dev`, bind
     `0.0.0.0:3000`/`[::]:3000`) → `curl http://localhost:3000/vi/login` trả **200** ngay. Vậy lỗi 500 chỉ
     xảy ra khi có `-H 127.0.0.1` + có middleware, không phải do môi trường/DB.
   - Không thử tiếp cổng 3002 vì nguyên nhân đã rõ ràng và không phụ thuộc cổng (bind interface, không phải
     port). Không kịp mở `/vi/overview`/`/vi/nhap-lieu` qua UI vì mọi route qua middleware đều 500.
   - Theo đúng nhánh dự phòng ghi trong `danh-gia.md` mục 2: **không ép** — đã `git diff -- package.json` sạch
     (hoàn nguyên về `"dev": "next dev"`, không commit gì cho mục này). Chuyển mục 2 sang "Chủ dự án cần
     quyết" (`danh-gia.md` mục 6, đã có sẵn khuyến nghị dự phòng: chặn inbound TCP 3000/3001 bằng Windows
     Firewall — Claude không tự đổi cài đặt hệ thống được).
   - **Ghi chú thao tác trong lúc smoke (không liên quan code)**: có 1 lần dùng `taskkill /F /IM node.exe` để
     dọn tiến trình treo — lệnh này kill **toàn bộ** node.exe đang chạy trên máy, không lọc theo PID. Đã kiểm
     tra ngay sau đó: không có tiến trình nào đang nghe cổng 3000–3002 trước hay sau lệnh này ngoài của chính
     phiên này, nhưng đây là lệnh rộng hơn cần thiết — các lần sau trong phiên đã đổi sang `taskkill /F /PID
     <pid>` theo đúng PID lấy từ `netstat`. **Tester/chủ dự án nên biết**: nếu tài khoản B (VS Code, có thể
     cùng máy Windows) đang chạy `npm run dev` cổng 3001 tại đúng thời điểm lệnh trên chạy (~12:04, 2026-09-24),
     tiến trình đó có thể đã bị tắt ngoài ý muốn — không phải do sửa file, chỉ do lệnh dọn tiến trình quá rộng.

3. **Test nhận diện JPEG/GIF/WebP** — commit `cd02f41`.
   - File: `src/lib/uploads.test.ts` — thêm `describe('detectImageKind')` dạng bảng (`it.each`): nhận đúng
     JPEG (`FF D8 FF E0 00 10 4A 46 49 46 00 01`), PNG (`89 50 4E 47 0D 0A 1A 0A`), GIF (`GIF89a`), WebP
     (`RIFF` + 4 byte + `WEBP`); trả `null` cho `<svg`, `<!DOCTYPE html>`, buffer rỗng, JPEG cắt ngắn (2 byte),
     `RIFF` + 4 byte + `WAVE` (không phải WebP).
   - File: `src/server/photo-upload-route.test.ts` — thêm test JPEG thật (`type=image/jpeg`) qua route
     `POST /api/photo-upload` → 200, url lưu (đọc qua `repo.getPhotoById(body.id)`) kết thúc `.jpg`; đổi luôn
     test PNG/`x.svg` có sẵn (dòng 167 cũ) từ `repo.getPhotos(PID_PIC).at(-1)` sang cùng
     `repo.getPhotoById(body.id)` (đúng yêu cầu "đổi dòng 167").
   - **Kết quả**: `npx vitest run src/lib/uploads.test.ts src/server/photo-upload-route.test.ts` → 2 file /
     38 test xanh (25 + 13, tăng thêm 10 test detect + 1 test JPEG route so với trước). `npm test` toàn bộ:
     **65 file / 838 test xanh** (828 + 10 mới), `tsc --noEmit` sạch.

**Cổng kiểm cuối vòng sửa 2**: `tsc --noEmit` sạch, `npm test` 65 file / 838 test xanh. Không có `.only`/`.skip`.
Việc còn treo cho chủ dự án: mục 2 (F10 dev loopback) — xem chi tiết trên; các mục khác ở `danh-gia.md` mục 6
giữ nguyên chưa đổi.
