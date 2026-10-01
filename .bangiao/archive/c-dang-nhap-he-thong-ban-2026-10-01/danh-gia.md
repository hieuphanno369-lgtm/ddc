PHAN QUYET: CHOT

# Đánh giá cuối: sửa lỗi P2028 và thông báo "Hệ thống đang bận"

Nhánh `feature/c-dang-nhap-he-thong-ban`, commit cuối `6b7f5af`, phạm vi `git diff main..HEAD`.
Skill đã dùng: `ddc-tower:code-review`.
Đã đọc: `.bangiao/ke-hoach.md`, `.bangiao/thay-doi.md` (mục "Vòng sửa 1"), `.bangiao/ket-qua-test.md` (mục "Vòng 2", XANH), `.bangiao/danh-gia-bao-mat.md` (KET LUAN: DAT, S2b đã vá).

## Vòng 2

Phạm vi soi: `git diff 07b82f0..HEAD`, gồm 2 commit `a4ec946` và `6b7f5af`.
Diff chỉ chạm 3 file: `src/server/repo/auth-tx.ts` (thêm 3 dòng JSDoc), `src/server/repo/prisma-repo-auth-tx-real-db.test.ts` (sửa 1 dòng comment), `.bangiao/thay-doi.md` (thêm 12 dòng).
Không đổi logic, không đổi test, không chạm file nóng, không có gì ngoài phạm vi vòng sửa.

### Đối chiếu từng mục vòng 1

1. `src/server/repo/prisma-repo-auth-tx-real-db.test.ts:4`: đã thay mật khẩu bằng `<mat-khau>`. Đạt.
2. `.bangiao/ke-hoach.md` dòng 133 và 235: đã sửa, grep mật khẩu trong `.bangiao/` (trừ archive) ra 0 kết quả, kể cả `ket-qua-test.md` (S2b của security). Đạt.
3. `src/server/repo/auth-tx.ts:8-10`: JSDoc ghi rõ hạn 20s không cắt câu đang chạy, giao dịch chờ `pg_advisory_xact_lock` chờ tới khi bên giữ lock nhả, `lock_timeout` để task sau (S1). Nội dung khớp code hiện tại. Đạt.
4. `.bangiao/thay-doi.md` mục "Các commit": đã có `ab92c3d`, `07b82f0`, `a4ec946`. Đạt.

### Grep mật khẩu Postgres (lấy từ `.env`)

- Các file nhánh đã đổi so với `main`: 0 kết quả.
- `.bangiao/` (trừ archive): 0 kết quả.
- Còn 2 chỗ cũ có sẵn trên `main`, không do nhánh này thêm: `src/server/repo/prisma-repo-auth-real-db.test.ts:6`, `.vscode/settings.json:12`. Thuộc task sau.
- Lịch sử nhánh: mật khẩu còn trong commit `3f59e02` (đã gỡ ở `a4ec946`). Khi merge, lịch sử này vào `main`. Không chặn vì mật khẩu đã có sẵn trên `main` ở 2 chỗ trên, merge không làm lộ thêm. Nếu muốn sạch hẳn thì đổi mật khẩu DB local, việc này không cần viết lại lịch sử.

### Kiểm thử

Dựa vào số đo vòng 2 của Tester, vòng này tôi không chạy lại.
- `npm test`: `Test Files 305 passed | 8 skipped (313)`, `Tests 3699 passed | 75 skipped (3774)`, exit 0.
- Real-db: `Tests 21 passed (21)`, vẫn in P2028 thật `timeout 20000 ms`.
- E2E 42 và 01 trên cổng 3003: `9 passed (2.3m)`.
- Vòng sửa chỉ đổi comment, nên các số này đủ tin.

## Vòng 1 (tóm tắt, commit `07b82f0`)

### 1. Code có khớp kế hoạch không

Có.
- `AUTH_TX_OPTIONS` (maxWait 10s, timeout 20s) ở `src/server/repo/auth-tx.ts`, truyền đủ cho 6 giao dịch ở `prisma-repo-auth.ts` và 2 giao dịch ở `prisma-repo-signup.ts`.
- Thân giao dịch không đổi: advisory lock, N2, R5-1, L3 giữ nguyên, không thử lại (Q2).
- `src/lib/auth.ts:124-126`: kiểm nguyên văn `locked`/`ip_limited` trước, lỗi khác log `errorFields(e)` rồi ném `new Error(LOGIN_SYSTEM_BUSY)`, không mang `e.message`.
- `LoginForm.tsx` chỉ đổi ánh xạ `loginErrorKey`, không đổi giao diện.
- i18n: nhóm riêng `loginBusy` ở cuối `vi.json`/`en.json`.
- Lệch có lý do: e2e đổi số 41 thành 42 vì số 41 đã có người dùng.

### 2. Test có giá trị thật không

Có giá trị thật.
- Real-db đỏ trước sửa với P2028 "timeout 5000 ms" thật, sau sửa in "timeout 20000 ms".
- Unit so `toBe(AUTH_TX_OPTIONS)` cho cả 8 giao dịch.
- `auth-authorize.test.ts` kiểm email thật và email lạ, log không chứa `postgresql://`.
- E2E 42 đi đúng đường lỗi thật: giữ lock trên DB e2e, có `finally` nhả lock, kiểm 0 dòng `auth_throttle`.
- 4 test chập chờn sửa đúng gốc, không làm yếu kiểm tra.

### 3. Bảo mật, hiệu năng, tính đúng đắn

Không có lỗi chặn merge.
Đồng ý KET LUAN: DAT của security: không thành oracle email, không lộ chi tiết kỹ thuật.

## Task sau

- S1: `SET LOCAL lock_timeout` cho `reserveThrottle`/`reserveAccountGuess` (`src/server/repo/prisma-repo-auth.ts:165`, `:189`), kèm test real-db.
- Dọn mật khẩu ở 2 chỗ cũ trên `main`: `src/server/repo/prisma-repo-auth-real-db.test.ts:6`, `.vscode/settings.json:12`.
- Cân nhắc đổi mật khẩu Postgres local, vì mật khẩu cũ nằm trong lịch sử git.

## Câu hỏi nghiệp vụ cho chủ dự án

Câu hỏi này đang chờ chủ dự án quyết, không phải mục phải sửa trước merge.
Thông báo bận xuống 2 dòng ở bản vi 390px (dòng 2 chỉ còn "ít phút.") và cả bản en 1440 (dòng 2 chỉ còn "minutes.").
Khung, màu, cỡ chữ giống hệt thông báo sai mật khẩu, không tràn khung.
Phương án A (đề xuất): rút gọn thành "Hệ thống đang bận, vui lòng thử lại sau." / "The system is busy, please try again later.", hiện 1 dòng ở 1440 và gọn hơn ở 390.
Phương án B: giữ câu đã chốt, chấp nhận 2 dòng.
Nếu chọn A thì sửa `vi.json`, `en.json` và `src/i18n/messages-login-busy.test.ts:158-159`.
