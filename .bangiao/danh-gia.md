PHAN QUYET: CAN SUA

# P1A — Đánh giá cuối (chặng REVIEWER) — vòng 2

> Reviewer không có công cụ ghi file; chặng điều phối (ship) ghi nguyên văn nội dung reviewer trả về. Bản vòng 1 nằm trong git ở commit `02b77c7`.

Nhánh `feature/p1a-du-lieu-dung`, HEAD `41c30cd`. Vòng sửa 1: `4c22bce..6b725e9`. Toàn phase: `git diff main...HEAD` (merge-base `01e82cf`). Skill: `ddc-tower:code-review`.

- Tự chạy lại: `npx tsc --noEmit` sạch; `npm test` 65 file / 828 test xanh; không có `.only`/`.skip`.
- Không chạy `npm run build` (ghi vào `.next/`). `npm audit` không chạy được từ phiên reviewer (TLS) → F10–F12 dựa audit của security-reviewer.

## 1. Code có khớp kế hoạch không? — CÓ. Riêng mục 2 chưa đạt "Xong khi" vì test giả xanh

| # | Mục vòng 1 | Code | Test / bằng chứng | Kết luận |
|---|---|---|---|---|
| 1 | F1 SVG/file giả ảnh | `photo-service.ts:34-36` đọc 12 byte thật; `uploads.ts:33-39` đủ 4 định dạng có kiểm độ dài; đuôi theo `EXT_BY_KIND` (`uploads.ts:69`); bỏ `.svg`/`.bmp`; `/api/photos` có `nosniff` + CSP `sandbox` | `photoFileSchema` nhận mọi `image/*` (`validation.ts:165`) nên test SVG → 400 rơi đúng nhánh magic-byte; `x.svg` chứa PNG → `.png`; HTML khai `image/png` → 400; có test header; test `addPhotoAction` dùng byte PNG thật | ĐẠT |
| 2 | F2a nhập liệu tự kiểm quyền | `nhap-lieu/page.tsx:18-21` guard theo mẫu `admin/page.tsx`; dòng 47-48 chỉ nạp, dòng 79 chỉ truyền `financial` khi `canViewFinance` | Test viewer/bod/chưa đăng nhập/admin có giá trị thật. **Test data-entry `canViewFinance:false` giả xanh** (mục 2) | CHƯA ĐẠT (test) |
| 3 | F2b nâng Next | `package.json:16` = 14.2.35; lockfile chỉ đổi `next`/`@next/env` 14.2.35 và `@next/swc-*` 14.2.33 (đúng optionalDependencies), không kéo gói khác; `phien-A.md` có lưu ý cho B | Grep toàn `next/dist`: 0 file chứa `middleware-subrequest` (đối chứng `x-middleware-next`: 32 file). Phép thử động của tester (gửi `middleware` 1 lần) không phân biệt được (14.2.15 cũng trả 307 với payload đó). Build chỉ có lời coder, `.next/` đã bị dev server xoá | ĐẠT (tester vòng 3 chạy lại build) |
| 4 | F3 giới hạn body | Kiểm `content-length` sau Origin + đăng nhập, trước `formData()`; thiếu/không số/vượt → 413 | 6MB → 413; thiếu → 413; PNG hợp lệ → 200 | ĐẠT |
| 5 | Lỗi server hiện chữ | `DataEntryForm.tsx:241-245` `catch` → `setSaveErr`, hiện qua `dataGuard.save.generic` (dòng 686) | Không yêu cầu test React | ĐẠT |
| 6 | Test `saveFinancial` nhánh tạo mới | — | `prisma-repo-save.test.ts:99-121`: `where` trong mock khớp code (`prisma-repo.ts:901-903`, `941-944`); tính sai là đỏ | ĐẠT |

Phạm vi vòng sửa: chỉ đụng file của 6 mục. Hai dòng đổi kèm trong `nhap-lieu/page.tsx` (`canLock` bỏ `?.`, `canEditFinance` bỏ `bod`) là hệ quả trực tiếp của guard, không đổi hành vi với user còn vào được trang; bod vốn chưa bao giờ lưu được (`requireProject` `actions.ts:28-34`).

## 2. Test có giá trị thật không? — PHẦN LỚN CÓ, còn 1 test giả xanh và 1 lỗ

**Test giả xanh (lý do chưa chốt): `src/server/nhap-lieu-page-guard.test.ts:106-110`**
- Helper `user()` (dòng 50-51) tạo email `data-entry@daidung.com.vn`; seed mock không gán dự án nào cho email này (chỉ `pm@`, `admin@`, `viewer@` — `src/data/seed/history.ts:286,294`). `repo.getAssignmentsForUser('data-entry@daidung.com.vn')` → 0.
- Hệ quả: `projects.length === 0` → trang render `common.noData`; `DataEntryForm` không được gọi → `formProps` rỗng → `formProps.at(-1)?.financial` luôn `undefined`.
- Test vẫn xanh khi xoá điều kiện chặn tài chính ở `page.tsx:48` và `:79` — đúng tiêu chí "Xong khi" của F2a (High).

**Lỗ: chưa test JPEG/GIF/WebP** — mọi test upload dùng byte PNG. JPEG là ảnh chụp điện thoại; nhánh JPEG hỏng thì hiện trường không tải được ảnh mà test vẫn xanh. Đọc code hiện đúng.

**Tốt:** test route F1/F3 (401/403/400/413/200), header `/api/photos`, `saveFinancial` nhánh `created`, redirect của guard. `photo-upload-route.test.ts:167` dùng `.at(-1)` trên danh sách giảm dần — hiện đúng nhưng dễ vỡ.

## 3. Bảo mật, hiệu năng, tính đúng đắn

- Vòng sửa không sinh lỗ hổng mới; đồng ý security-reviewer về F1–F3.
- Mô phỏng gộp với P1B (`git merge-tree`, chỉ đọc): chỉ xung đột cuối `vi.json`/`en.json` (giữ cả `dataGuard` lẫn `resourceKpi`/`valueChainAbs`/`logPaging`); `projects/[id]/page.tsx` tự gộp; KPI nhân lực P1B vẫn đúng vì `getDailyManpower` P1A cộng ca thành tổng ngày (`prisma-repo.ts:292-298`); test P1B truyền `canViewFinance` tường minh.
- Luật 2 tài khoản: ĐẠT (file nóng khớp "Đang giữ"; không đụng `PROGRESS.md`, `.serena/`, `globals.css`, `queries.ts`, `project-queries.ts`; i18n nhóm `dataGuard` cuối file; P1B không sửa `package.json`).

### Quyết định F10 / F11 / F12

| # | Quyết định | Lý do |
|---|---|---|
| F10 Next 14.x RCE khi host Windows | **Không chặn P1A.** Giảm thiểu ngay bằng mục 4.2 (dev chỉ nghe 127.0.0.1); nâng major ở task riêng | Có từ trước (14.2.15 cũng dính), 14.x không có bản vá; F2b đạt "14.2.x mới nhất". `next dev` mặc định nghe `0.0.0.0` → 3000/3001 mở ra LAN. Giảm thiểu 1 dòng, cả 2 launch (A/B) gọi `npm run dev`; không đổi `start`. Chỉ chặn LAN — trang web độc trong trình duyệt máy dev vẫn gửi tới localhost được |
| F11 next-auth 4.24.7 | Ghi nợ, gộp task nâng nền tảng | Low; advisory Critical chỉ EmailProvider |
| F12 next-intl 3.26.3 open redirect | Ghi nợ, gộp task nâng nền tảng. **Hạn chót: trước go-live** | Medium, cần 4.x, đi cùng Next 15 |

Không nên giữ P1A vì F10: `main` hiện còn Next 14.2.15 dính CVE-2025-29927; gộp P1A thì `main` an toàn hơn.

## 4. Danh sách PHẢI SỬA (vòng sửa 2 — làm đúng phạm vi, không đổi code sản xuất ngoài mục 2)

1. **Sửa test F2a giả xanh** — `src/server/nhap-lieu-page-guard.test.ts`
   - Hai test data-entry (dòng 101-104 và 106-110) dùng user data-entry có dự án: `{ role: 'data-entry', email: 'pm@daidung.com.vn', canViewFinance: false }` (seed gán dự án 1,2,3,5,7,11; dự án 1 có tài chính `2026-09`). Có thể thêm tham số email cho helper `user()` (dòng 50-51).
   - Test dòng 101: thêm `expect(formProps).toHaveLength(1)`.
   - Test dòng 106: thêm `expect(formProps).toHaveLength(1)`; đặt `vi.spyOn(mockRepo, 'getFinancial')` trước `visit()` và kiểm spy không được gọi khi render (chứng minh `page.tsx:47-48` không nạp); sau đó kiểm tiền đề `(await mockRepo.getFinancial(formProps[0].projectId)).find((f) => f.yearMonth === '2026-09')` defined; kiểm `expect(formProps[0].financial).toBeUndefined()`; `mockRestore()` spy.
   - **Xong khi:** test xanh; thử đột biến cục bộ (không commit): `page.tsx:79` → `financial={financial}` và bỏ `&& user.canViewFinance` ở dòng 48 → test dòng 106 **đỏ**; hoàn nguyên → xanh. Ghi kết quả đột biến vào `thay-doi.md`.

2. **F10 — dev server chỉ nghe loopback** — `package.json:6`
   - `"dev": "next dev"` → `"dev": "next dev -H 127.0.0.1"`. Không đổi `"start"` (container P5 cần `0.0.0.0`).
   - **Xong khi:** chạy launch `ddc-control-tower`, `netstat -ano | findstr LISTENING | findstr :3000` chỉ còn `127.0.0.1:3000` (không `0.0.0.0:3000`/`[::]:3000`); `npm run dev -- -p 3002` (thư mục A, không dùng 3001) nghe `127.0.0.1:3002`; đăng nhập admin qua `http://localhost:3000`, mở `/vi/overview` và `/vi/nhap-lieu` bình thường; tắt dev server. Ghi vào `phien-A.md` "Lưu ý cho B": sau khi kéo `main`, dev 3001 cũng chỉ nghe 127.0.0.1; muốn mở LAN có chủ đích thì `npm run dev -- -H 0.0.0.0`, chỉ trên mạng tin cậy.
   - Nếu công cụ preview/launch không kết nối được khi chỉ nghe 127.0.0.1: không ép — hoàn nguyên, ghi lý do vào `thay-doi.md`, chuyển mục này sang "Chủ dự án cần quyết" (dùng tường lửa thay thế).

3. **Test nhận diện JPEG/GIF/WebP**
   - `src/lib/uploads.test.ts`: `describe('detectImageKind')` dạng bảng. Đúng loại: `FF D8 FF E0 00 10 4A 46 49 46 00 01` → `'jpg'`; `89 50 4E 47 0D 0A 1A 0A` → `'png'`; `GIF89a` → `'gif'`; `RIFF`+4 byte+`WEBP` → `'webp'`. Ra `null`: `<svg`, `<!DOCTYPE html>`, Buffer rỗng, `FF D8` (2 byte), `RIFF`+4 byte+`WAVE`.
   - `src/server/photo-upload-route.test.ts`: 1 test byte JPEG thật (`type=image/jpeg`) → 200, url qua `repo.getPhotoById(body.id)` kết thúc `.jpg`. Được đổi dòng 167 sang `getPhotoById(body.id)`.
   - **Xong khi:** test mới xanh, `npm test` xanh toàn bộ.

Hồ sơ: `thay-doi.md` mục "Vòng sửa 1" điểm 3 đang ghi commit `<xem git log>` → điền `6b725e9`.

**Cho tester vòng 3 (chỉ kiểm):** tự làm lại đột biến mục 1; chạy `npm run build` với `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`; kiểm `netstat` như mục 2; bằng chứng động CVE-2025-29927 dùng `x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware`.

Sau khi sửa: `tsc` + `npm test` xanh; security-reviewer soát mục 2; rồi reviewer. Theo luật ship đây là vòng sửa cuối (2/2).

## 5. Ghi nợ (không sửa ở P1A)

**Task nâng nền tảng** (đề xuất ngay sau merge P1A, trước khi tách P2A/P2B; hạn chót trước go-live P5/P6; chủ dự án quyết — mục 6):
- F10: `next` ≥ 15.5.24 (hoặc 16.x mới nhất) + `react`/`react-dom` 19; `params`/`searchParams`/`cookies()`/`headers()` async; chạy lại `npm audit --omit=dev`.
- F12: `next-intl` ≥ 4.9.1. F11: `next-auth` 4.24.15.
- Nếu tới P5A (Docker) còn Next 14: đánh giá GHSA-2xp9-vwfh-vxw4 (Image Optimization/AVIF) — app dùng `next/image` (`app/[locale]/login/page.tsx`, `src/components/layout/AppShell.tsx`).

**P2A:** F4 `xlsx 0.18.5` → SheetJS 0.20.3 (CDN chính thức) hoặc `exceljs`.

**P3A:**
- F6 bản nháp chứa số tài chính, key không gắn email, không xoá khi logout (`dataEntryState.ts:212-214`).
- [nit] `formsEqual` so chuỗi thô (`12.50` ≠ `12.5`).
- Hai người cùng lưu lần đầu một tháng: server bắt P2002 ở `saveMonthlyFact`/`saveFinancial` → `'conflict'`; UI báo "Có người vừa lưu, tải lại trang".
- [nit] `dataGuard.save.financeReadonly` ghi "Chỉ Admin/BOD..." nhưng trang nhập liệu giờ chỉ admin sửa tài chính.
- [nit] `precheckPhotos` (`src/lib/photo-upload.ts:17`) nhận mọi `image/*` → thu hẹp JPG/PNG/GIF/WebP để báo sớm.

**P5B:**
- F5 xlsx dùng `quotePrefix`, `safeCell` chỉ CSV (`src/lib/excel-safe.ts:4`).
- F7 `resolveAccess` suy `canViewFinance` từ role (`src/lib/auth.ts:36,43`).
- F9: `/api/export` bỏ cột tài chính khi `!canViewFinance`; rate-limit theo email gồm upload (`rateLimit('photo:' + user.email)` sau kiểm đăng nhập ở `app/api/photo-upload/route.ts` — phần Low còn lại F3); `/api/photos` kiểm quyền đọc dự án (BOLA); proxy ghi đè `x-forwarded-host`; gom `canWriteProject` với `requireProject`; CSP/header toàn app.
- `/overview`, `/import` chưa tự kiểm role ở page.
- [nit] `addPhotoAction` (`src/server/actions.ts:369`) không còn UI gọi → gỡ hoặc ghi chú giữ có chủ đích.
- T17/P6: reverse proxy cho body ≥ 6MB ở `/api/photo-upload` (Nginx mặc định `client_max_body_size 1m`).

**Chờ chủ dự án:** F8 (mục 6).

## 6. Chủ dự án cần quyết

1. **Task nâng nền tảng (F10/F11/F12): làm lúc nào, ai làm.** Đề xuất ngay sau merge P1A, trước tách P2A/P2B; B đang rảnh chờ P1A có thể nhận; A chờ task này merge mới code P2A (trong lúc đó chỉ lập kế hoạch). Lợi: P2–P4 viết thẳng trên Next 15/React 19. Dời tới P5: chuyển đổi nhiều file hơn, máy dev chỉ được che bằng mục 4.2. Chọn xong cập nhật `lo-trinh.md`.
2. **Dev server chỉ nghe 127.0.0.1** (mục 4.2): mặc định coi là đồng ý; cần thử trên điện thoại/máy khác thì `npm run dev -- -H 0.0.0.0` có chủ đích. Khuyến nghị thêm (Claude không được đổi cài đặt hệ thống): chặn inbound TCP 3000/3001 trong Windows Firewall.
3. **Hệ điều hành VPS ở P6.** Windows → F10 áp thẳng production. Linux vẫn phải nâng Next trước go-live (còn advisory Critical/High khác).
4. **F8:** import lộ mã SAP có tồn tại hay không (`actions.ts:474`). Treo từ vòng 1.

## 7. Ghi chú merge (khi đã CHỐT)

- Chuyển `.bangiao/*.md` vào `.bangiao/archive/p1a-du-lieu-dung-2026-09-24/`.
- `git merge main`, giải xung đột cuối `vi.json`/`en.json` (giữ cả hai nhóm), `tsc` + `npm test` trên kết quả gộp.
- `npx prisma migrate deploy`. Cập nhật `PROGRESS.md` + `.serena/` trong lượt merge. Bỏ file nóng khỏi "Đang giữ" của `phien-A.md`.
- Báo B: `git merge main`, `npm install` (Next 14.2.35), `npx prisma migrate deploy` + seed trên `ddc_control_tower_b`.

## 8. Nhận xét tích cực

Hai đường upload cùng qua `addPhotoForUser` nên chỉ vá magic-byte một chỗ; đuôi lấy từ `kind` chứ không từ tên file; guard nhập liệu fail-closed hai lớp; test F3 chú thích rõ undici không tự đặt `content-length`; nâng Next không tắt kiểm TLS và không kéo gói ngoài `next`.
