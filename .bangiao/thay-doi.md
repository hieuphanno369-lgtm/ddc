# Thay doi T1 (P3F)

## Da sua
- `src/server/repo/prisma-repo-auth.ts`: `replaceResetToken` phan theo loai token moi (invite: xoa het; reset: giu loi moi con han, khoa tu van theo email). `peekResetTokenKind` tach thanh ham module, `peekResetToken` goi lai no.
- `src/server/repo/mock-repo-auth.ts`: cung luat cho kho bo nho; `peekResetTokenKind` la ham noi bo, khong dung `this`.
- `src/server/repo/types.ts`: cap nhat chu thich `replaceResetToken`.
- `src/lib/login-policy.ts`: sua chu thich (createdAt do Prisma gan theo gio app, khong phai DB). Logic khong doi.
- `src/server/password-reset.ts`: bo `isResetTokenUsable` (chi test goi), sua chu thich tham chieu.

## Test
- Do truoc (da xac nhan do khi go bo ban sua): `mock-repo-auth.test.ts` (4 test T1, 2 do), `prisma-repo-auth.test.ts` (replaceResetToken K3/T1, 3 do), `password-reset.test.ts` (luong tich hop, 2 do), `prisma-repo-auth-real-db.test.ts` (T1 tren DB _c, do).
- Sau sua: tat ca xanh. Test cu `isResetTokenUsable` chuyen sang `getResetTokenKind`; fixture `peekResetToken` them `createdAt`.

## Cong kiem
- `npx tsc --noEmit`: sach.
- `npm test`: 266 file pass, 2 skip; 3121 test pass, 28 skip.
- real-db `prisma-repo-auth-real-db.test.ts` tren `ddc_control_tower_c`: 16/16 pass.
- e2e 22/23/28 (Playwright): 22 passed (gom 3 setup).

## Tester/security nen soi
- Race 2 yeu cau Quen mat khau dong thoi (test real-db chung minh con dung 1 token reset song, loi moi con).
- Khong lo them trang thai: phan hoi `requestPasswordReset` khong doi.
- Rate limit P3E, L5 khong dong toi.

## Thêm: rule hiển thị Priority (C làm, commit `93cd961`, chủ dự án chốt 2026-09-29)

- `src/components/ui/Badges.tsx`: `PRIORITY_TONE` P0 = `gold` (class `c-gold` có sẵn trong `globals.css`), P1 = `info` (navy), P2/P3 = `neutral`. Độ ưu tiên không còn dùng đỏ/cam; đỏ/cam chỉ dành cho trễ tiến độ và phạt.
- `src/components/ui/Badge.tsx`: thêm tone `gold` -> `c-gold`.
- `src/components/dashboard/TopPriorityList.tsx`: vẫn là P0 đang triển khai, trễ xếp trước (sắp ở tầng query, không đổi), nhưng bỏ nhãn "Trễ tiến độ"/"Đúng tiến độ" và chấm đỏ/xanh; chấm luôn `var(--gold)`. Trễ/phạt xem ở trang Chi tiết khi bấm vào.
- i18n: subtitle thẻ Top đổi thành "Priority P0 · đang triển khai · bấm để xem chi tiết" (en "tap for details"); bỏ key `topPriority.behind`, `topPriority.onTrack`.
- Test: `PriorityBadge.test.ts` (mới), `TopPriorityList*.test.ts` sửa theo rule mới (đỏ trước 9 ca), e2e `30-priority-mau.spec.ts` (mới, sáng/tối, soi ảnh); `npm test` xanh, e2e 30 + 11 xanh.
- Cột "Đúng tiến độ" trong bảng dự án ở Tổng quan KHÔNG đổi (chưa có quyết định).

## Vá TT-1, TT-2 (security) + nit reviewer (C làm)

- TT-1 `prisma-repo-auth.ts` `replaceResetToken`: khoá tư vấn theo email (`lockResetTokens`) cho CẢ nhánh lời mời lẫn Quên mật khẩu; nhánh Quên mật khẩu xoá đúng các dòng đã đọc (`id: { in }`) thay vì `notIn`, không gọi `deleteMany` khi rỗng.
- TT-2 `consumeResetToken`: đọc email chủ token rồi khoá theo email trước `updateMany`, 2 link cùng email tiêu đồng thời chạy lần lượt thay vì deadlock.
- Test đỏ trên DB thật `_c` trước khi sửa: TT-1 mất lời mời vừa tạo (`expected null to be 'invite'`), TT-2 `40P01 deadlock detected`; sau sửa real-db 18/18. Unit `prisma-repo-auth.test.ts` 46/46 (thêm 4 ca).
- Nit: tên test `getResetTokenKind`, en subtitle "click for details", comment `c-gold` trong `app/globals.css`.
- `npm test`: 277 file, 3228 xanh + 31 skip; tsc sạch.
