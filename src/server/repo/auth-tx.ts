/**
 * Hạn dùng chung cho MỌI giao dịch interactive (`prisma.$transaction(async (tx) => ...)`) của auth và đăng ký
 * (`prisma-repo-auth.ts`, `prisma-repo-signup.ts`).
 * Mặc định Prisma (timeout 5000ms, maxWait 2000ms) quá ngắn: event loop Node bị chặn hơn 5s giữa giao dịch
 * (next dev dịch code ngay trong cùng tiến trình, máy thiếu RAM) làm Prisma huỷ giao dịch (P2028), đăng nhập
 * đúng mật khẩu bị báo sai. Lần chặn đo được thật khoảng 9,3s nên chọn timeout 20s (biên gấp khoảng 2 lần);
 * maxWait 10s cho lúc pool kết nối bận. Giao dịch kẹt chỉ giữ advisory lock của đúng 1 cặp kind:key tối đa 20s.
 *
 * KHÔNG thử lại khi gặp P2028/P2024:
 * 1. P2028 gồm cả lỗi lúc COMMIT, không biết chắc giao dịch đã ghi hay chưa; thử lại sau 1 lần đã ghi sẽ tạo
 *    thêm dòng giữ chỗ (`reserveThrottle`/`reserveAccountGuess`), dòng đầu mất `id` nên không bao giờ được rút
 *    (đếm trùng lượt).
 * 2. Gốc lỗi là hạn quá ngắn, đã sửa bằng hằng này; quá tải thật thì thử lại chỉ làm người dùng chờ gấp đôi.
 * 3. P2024 (hết chờ pool) chỉ ở truy vấn ngoài giao dịch, không thuộc lỗi đang sửa; nếu xảy ra người dùng
 *    thấy thông báo "Hệ thống đang bận" (`authorize` trong `src/lib/auth.ts`).
 */
export const AUTH_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;
