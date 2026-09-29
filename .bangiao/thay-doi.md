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
