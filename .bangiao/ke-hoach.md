# Ke hoach T1 (P3F): Quen mat khau khong huy link loi moi

## Muc tieu
- Yeu cau "Quen mat khau" khong duoc xoa token loi moi (72 gio) con han, chua dung; chi thay token quen mat khau cu.
- Admin bat (loi moi) van thay moi token cu.
- Dat mat khau thanh cong bang 1 token bat ky -> moi token con lai cua email het hieu luc (da co san o `consumeResetToken` cua ca 2 kho, chi them test khoa lai).
- Khong migration, khong dong file nong, khong doi giao dien cua `replaceResetToken`.

## Cach lam
- Loai token moi suy tu han (`resetTokenKindOf(now, expiresAt)`), khong them tham so.
- Loai 'invite': xoa moi token cua email (nhu cu). Loai 'reset': giu cac dong con han + chua dung + loai 'invite', xoa phan con lai.
- Kho Prisma: khoa tu van `pg_advisory_xact_lock` theo email trong transaction, `findMany` roi `deleteMany({ email, id: { notIn } })`, roi `create`.
- Kho bo nho: cung luat, tren mang `resetTokens`.
- Don nit reviewer: sua comment `resetTokenKindOf`, `peekResetToken` = `peekResetTokenKind !== null` o ca 2 kho (khong con `this`), bo `isResetTokenUsable` (khong con noi goi that).
