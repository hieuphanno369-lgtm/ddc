/**
 * L2 (bao-mat.md, quyết định chủ dự án 2026-09-27, thay cho ghi chú K13) - `X-Forwarded-For` do
 * client tự gửi được, phần tử ĐẦU không đáng tin (giả IP để né giới hạn). Chỉ tin đúng
 * `TRUSTED_PROXY_HOPS` tầng proxy tin cậy ở CUỐI chuỗi: mặc định 1 (1 reverse proxy trực tiếp phía
 * trước app) thì IP thật là phần tử CUỐI CÙNG; đặt N thì lấy phần tử thứ N tính từ phải.
 * Không xác định được IP (thiếu header, hoặc rỗng) -> khoá chung `'unknown'`, KHÔNG bỏ giới hạn
 * (khác hành vi K13 cũ là trả '' rồi các module gọi tự bỏ qua giới hạn IP).
 *
 * R5 (bao-mat.md vòng 2) - reverse proxy lúc deploy BẮT BUỘC tự NỐI THÊM (append) IP khách vào CUỐI
 * `X-Forwarded-For` (ví dụ `proxy_add_x_forwarded_for` của Nginx, không phải `proxy_set_header
 * X-Forwarded-For $remote_addr` - lệnh đó GHI ĐÈ, xoá mất phần client tự gửi rồi mới đáng tin).
 * Chỉ đặt `X-Real-Ip` mà KHÔNG xử lý `X-Forwarded-For` là KHÔNG ĐỦ: hàm này ưu tiên đọc XFF trước,
 * nên 1 client tự thêm header `X-Forwarded-For` giả (dù proxy có set `X-Real-Ip` thật) vẫn thắng,
 * bỏ qua luôn `X-Real-Ip` đáng tin phía sau. Đã cân nhắc thêm biến `CLIENT_IP_HEADER` để chọn hẳn
 * 1 trong 2 header, nhưng KHÔNG làm: thêm 1 biến cấu hình chỉ để né 1 rủi ro mức Thấp (chỉ xảy ra
 * khi proxy KHÔNG xử lý XFF chút nào) làm phình bề mặt cấu hình; ghi rõ yêu cầu triển khai (Task 8
 * checklist deploy + `.env.example`) là đủ giảm rủi ro thực tế - deploy đúng cách thì XFF luôn do
 * proxy ghi (client không còn tự thêm được phần tử đáng tin) nên lỗ hổng không còn tồn tại.
 */
function trustedProxyHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * R4 (bao-mat.md vòng 2, quyết định chủ dự án = phương án a) - production mà không xác định được IP
 * (thiếu/rỗng cả 2 header) nghĩa là reverse proxy chưa nối `X-Forwarded-For` đúng cách (K13/R5),
 * mọi người dùng chung khoá `'unknown'` có thể tự khoá lẫn nhau. Cảnh báo `console.warn` TỐI ĐA 1
 * LẦN mỗi cửa sổ (không spam log mỗi request); không cảnh báo ở dev/test (NODE_ENV khác 'production').
 */
const UNKNOWN_IP_WARN_WINDOW_MS = 15 * 60_000;
let lastUnknownIpWarnAt = 0;

function warnUnknownIpOnce(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const now = Date.now();
  if (now - lastUnknownIpWarnAt < UNKNOWN_IP_WARN_WINDOW_MS) return;
  lastUnknownIpWarnAt = now;
  console.warn(
    '[client-ip] khong xac dinh duoc IP khach that (thieu X-Forwarded-For/X-Real-Ip) - kiem tra reverse proxy da noi dung header chua (xem TRUSTED_PROXY_HOPS trong .env.example).',
  );
}

export function clientIpFrom(h: Pick<Headers, 'get'>): string {
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const hops = trustedProxyHops();
      const idx = Math.max(0, parts.length - hops);
      const ip = parts[idx];
      if (ip) return ip.slice(0, 64);
    }
  }
  const real = h.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 64);
  warnUnknownIpOnce();
  return 'unknown';
}
