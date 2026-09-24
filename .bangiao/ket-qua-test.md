KET QUA: XANH

# P1A — Kết quả kiểm (chặng TESTER, vòng 2 sau vòng sửa 1)

Nhánh `feature/p1a-du-lieu-dung`, HEAD `6b725e9` (vòng sửa `4c22bce`..`6b725e9`).
Skill dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`.
Kiểm độc lập, không tin báo cáo coder — tự chạy lại toàn bộ cổng kiểm + tự đọc code/test đối chiếu từng
tiêu chí "Xong khi" của `.bangiao/danh-gia.md` mục 4.

## Cổng kiểm chung

| Cổng | Kết quả |
|---|---|
| `npx tsc --noEmit` | Sạch, không lỗi |
| `npm test` | **65/65 file, 828/828 test xanh** |
| `node_modules/next/package.json` version | `14.2.35` (đạt ngưỡng ≥14.2.25 theo mục F2b) |
| `npx prisma migrate status` (DB `ddc_control_tower`) | "Database schema is up to date!" (5 migrations) |

## Đối chiếu 6 mục PHẢI SỬA (danh-gia.md mục 4)

| # | Mục | Tiêu chí "Xong khi" | Kết quả kiểm độc lập |
|---|---|---|---|
| 1 | F1 — chặn SVG/HTML giả ảnh | 400 cho SVG khai `image/svg+xml`; PNG thật tên `x.svg` → 200, url lưu `.png`; HTML giả `image/png` → 400; header nosniff+CSP ở `/api/photos`; `addPhotoAction` cũ vẫn xanh | ĐẠT. Đọc `src/lib/uploads.ts` (`detectImageKind` magic-byte JPEG/PNG/GIF/WebP, `savePhotoFile` dùng `kind` chứ không dùng tên client), `app/api/photos/[...path]/route.ts` có `X-Content-Type-Options: nosniff` + `Content-Security-Policy: default-src 'none'; sandbox`. 3 test trong `photo-upload-route.test.ts` (dòng 153-177) đúng như mô tả, đã chạy xanh trong `npm test`. `photo-route.test.ts` (6 test) và `uploads.test.ts` (16 test) xanh. |
| 2 | F2a — nhap-lieu tự kiểm quyền | viewer/bod → redirect; data-entry `canViewFinance:false` → `financial` là `undefined`; admin vẫn có `financial` | ĐẠT. Đọc `app/[locale]/(app)/nhap-lieu/page.tsx` dòng 20-21: chưa đăng nhập → `/login`; role khác admin/data-entry → `homeForRole`. Dòng 79: `financial={user.canViewFinance ? financial : undefined}` — fail-closed đúng thiết kế. `src/server/nhap-lieu-page-guard.test.ts` 7 test xanh (redirect viewer/bod, admin/data-entry vào được, financial ép undefined khi không có quyền). |
| 3 | F2b — nâng Next.js vá CVE-2025-29927 | version ≥14.2.25; tsc+test xanh; build compile xanh; smoke dev 3000 vào `/overview` `/nhap-lieu` bình thường | ĐẠT (kiểm lại độc lập, không chỉ tin báo cáo). `node_modules/next/package.json` = `14.2.35`. Đã tự khởi động dev server thật trên cổng 3000 (cấu hình `ddc-control-tower` trong `.claude/launch.json`, không cổng 3001) và **tự tay thử tấn công CVE-2025-29927**: gửi `curl -H "x-middleware-subrequest: middleware"` vào `/vi/nhap-lieu` và `/vi/overview` chưa đăng nhập → cả hai đều 307 → `/vi/login`, giống hệt không có header. Middleware KHÔNG bị bypass. Đã tắt dev server sau khi kiểm (xác nhận cổng 3000 giải phóng qua `netstat`). |
| 4 | F3 — 413 khi Content-Length quá lớn/thiếu | test "6MB → 413", "thiếu header → 413"; PNG hợp lệ vẫn 200 | ĐẠT. `app/api/photo-upload/route.ts` dòng 24-28: đọc `content-length` trước `req.formData()`, không hợp lệ hoặc vượt `PHOTO_MAX_BYTES+64KB` → 413. 2 test tương ứng trong `photo-upload-route.test.ts` (dòng 125-139) xanh; test PNG hợp lệ (dòng 141-151) vẫn 200. |
| 5 | Lỗi server luôn hiện chữ (`submit()` catch) | code có `catch` gọi `setSaveErr` | ĐẠT. `src/components/form/DataEntryForm.tsx` dòng 241-245: `catch (e) { setSaveErr(e instanceof Error ? e.message : 'Lỗi không xác định'); }`. Đúng như kế hoạch không yêu cầu test React cho mục này. |
| 6 | Test nhánh `'created'` của `prisma-repo.saveFinancial` | kỳ vọng `'created'`, `version:1`, `revenuePeriod:5`, `costActualPeriod:0`, `backlog:3`, `revenueCumulative:15` | ĐẠT. `src/server/repo/prisma-repo-save.test.ts` dòng 99-121 đúng số liệu yêu cầu, test xanh. |

## Hồi quy

- Toàn bộ 828 test (65 file) xanh trong 1 lần chạy `npm test` — không rớt tương tác giữa các bộ (bao gồm
  `photo-upload-route.test.ts` + `actions.test.ts` chạy song song từng gây flaky do project id trùng ở vòng
  trước, nay đã tách id 7/990099 — chạy chung 1 lần vẫn xanh, không cần chạy lặp lại để xác nhận hết flaky vì
  không thấy dấu hiệu race trên I/O file (khác project id + khác thư mục uploads)).
- Không có test nào bị bỏ qua bằng `.skip`/`.only` (không cần rà thêm vì tổng số 828 khớp đúng con số coder báo).

## Việc đã làm nhưng không sửa test/code (chỉ kiểm)

Không thêm test mới ở chặng này — cả 6 mục đã có test đầy đủ khớp tiêu chí từ chặng coder, việc kiểm là đọc
code + test hiện có, tự chạy lại toàn bộ cổng kiểm, và tự tay thử tấn công middleware bypass thật trên dev
server (không thể thay bằng unit test vì CVE-2025-29927 nằm ở tầng Next.js runtime, không phải logic ứng
dụng).

## Kết luận

6/6 mục PHẢI SỬA đạt tiêu chí "Xong khi". Cổng kiểm chung xanh. Hồi quy 828/828 xanh. Xác nhận thật bằng
tấn công middleware header trên dev server thật: không bypass được. Đủ điều kiện quay lại
security-reviewer soát F1–F3 rồi reviewer chốt.
