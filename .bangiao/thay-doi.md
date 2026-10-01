# Thay đổi: sửa lỗi đăng nhập đúng mật khẩu bị báo sai khi hệ thống chậm (Prisma P2028)

Nhánh `feature/c-dang-nhap-he-thong-ban`, worktree `D:\_project\DDC_Control_Tower-C`.
Skill đã dùng: `coding-standards`, `backend-patterns`, `frontend-patterns`.
Kế hoạch: `.bangiao/ke-hoach.md`.

## Điểm lệch so với kế hoạch

- E2E đổi tên thành `e2e/42-dang-nhap-he-thong-ban.spec.ts` (số 41 đã dùng ở nhánh `feature/c-ui-form-du-an` cho `41-ho-so-khoang-cach-the.spec.ts`), theo ghi chú điều phối.
  Mọi chỗ nhắc "e2e 41" trong code mới (tên test real-db thứ 3, tên describe e2e) đổi thành 42.

## Task 1: giao dịch auth không bị huỷ khi máy chậm

### File đã đổi

| File | Việc |
|---|---|
| `src/server/repo/auth-tx.ts` (mới) | Hằng `AUTH_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const`, JSDoc lý do chọn hạn và 3 lý do không thử lại (Q1, Q2). File không import gì. |
| `src/server/repo/prisma-repo-auth.ts` | Import hằng, truyền làm tham số 2 cho 6 giao dịch: `setPassword`, `setPasswordIfHash`, `reserveAccountGuess`, `reserveThrottle`, `replaceResetToken`, `consumeResetToken`. Thân giao dịch không đổi. |
| `src/server/repo/prisma-repo-signup.ts` | Import hằng, truyền cho 2 giao dịch `deleteDepartment`, `approveRequest`. |
| `src/server/repo/prisma-repo-auth-tx-real-db.test.ts` (mới) | 3 test DB thật (chạy tay): chặn event loop 6s giữa `reserveThrottle` và giữa `reserveAccountGuess`; giữ advisory lock lâu hơn `AUTH_TX_OPTIONS.timeout` thì `reserveThrottle` ra P2028 và không để lại dòng giữ chỗ (cơ chế e2e 42 dựa vào). |
| `src/server/repo/prisma-repo-auth.test.ts` | Mock `transaction` nhận tham số 2; 6 test mới kiểm mỗi giao dịch nhận đúng `AUTH_TX_OPTIONS` (so `toBe`, cùng tham chiếu). |
| `src/server/repo/prisma-repo-signup-p2003.test.ts` | Mock `$transaction` chuyển tiếp tham số 2, thêm `signupRequest.delete`, `userRole.create` vào `tx`; 2 test mới cho `deleteDepartment`, `approveRequest`. |

### Test đỏ trước sửa

Real-db (`$env:DATABASE_URL` trỏ `ddc_control_tower_c`), `npx vitest run src/server/repo/prisma-repo-auth-tx-real-db.test.ts`:

```
× reserveThrottle: event loop bi chan 6s giua giao dich -> van giu cho thanh cong (truoc sua: P2028)
  PrismaClientKnownRequestError: Invalid `prisma.$executeRaw()` invocation:
  Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction.
  The timeout for this transaction was 5000 ms, however 6011 ms passed since the start of the transaction.
× reserveAccountGuess: event loop bi chan 6s giua giao dich -> van giu cho thanh cong (truoc sua: P2028)
  ... The timeout for this transaction was 5000 ms, however 6004 ms passed since the start of the transaction.
Test Files  1 failed (1)
     Tests  2 failed | 1 passed (3)
  Duration  38.01s
```

Test thứ 3 (giữ lock quá hạn) PASS ngay trước sửa, tức là ra đúng mã P2028: cơ chế e2e 42 dùng được, không phải dừng.

Unit, `npx vitest run src/server/repo/prisma-repo-auth.test.ts src/server/repo/prisma-repo-signup-p2003.test.ts`:

```
× AUTH_TX_OPTIONS - moi giao dich auth dung chung 1 han (sua loi P2028) > setPassword (va 5 giao dich con lai)
  → expected undefined to be { maxWait: 10000, timeout: 20000 } // Object.is equality
× AUTH_TX_OPTIONS - giao dich dang ky dung chung han voi auth (sua loi P2028) > deleteDepartment, approveRequest
  → expected undefined to be { maxWait: 10000, timeout: 20000 } // Object.is equality
Test Files  2 failed (2)
     Tests  8 failed | 49 passed (57)
```

### Sau sửa (xanh)

- Unit 2 file trên: `Test Files 2 passed (2)`, `Tests 57 passed (57)`.
- Real-db mới: `Test Files 1 passed (1)`, `Tests 3 passed (3)`, 37,8s.
- Real-db auth cũ `prisma-repo-auth-real-db.test.ts`: `Test Files 1 passed (1)`, `Tests 18 passed (18)`, 1,8s.
- `npx tsc --noEmit`: exit 0, không lỗi.
- `npm test` (không `DATABASE_URL`): `Test Files 3 failed | 300 passed | 8 skipped (311)`, `Tests 4 failed | 3674 passed | 75 skipped (3753)`, 224,9s.
  4 ca đỏ đều là test phụ thuộc thời gian, ở file không import code đã đổi:
  `daily-import.test.ts` (e) zip bomb "Test timed out in 5000ms",
  `jobs.test.ts` K19 x2 ("expected 86397338 to be greater than or equal to 86399000", tức job chạy chậm hơn 1s so với mốc),
  `report-export-route.test.ts` S-2 rate limit 30 lần/60 giây.
  Chạy riêng 3 file này 3 lần: lần 1 đỏ 2/40, lần 2 đỏ 3/40, lần 3 xanh 40/40.
  Máy lúc đó CPU 68%, còn khoảng 1,7GB RAM trống (các tài khoản khác đang chạy).
  Đây là test chập chờn do tải máy, không do thay đổi này; ngoài phạm vi kế hoạch nên chưa sửa, ghi lại để chủ dự án quyết.
