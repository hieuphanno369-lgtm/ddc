/**
 * L2 (bao-mat.md, quyết định chủ dự án 2026-09-27, thay cho ghi chú K13) - `X-Forwarded-For` do
 * client tự gửi được, phần tử ĐẦU không đáng tin (giả IP để né giới hạn). Chỉ tin đúng
 * `TRUSTED_PROXY_HOPS` tầng proxy tin cậy ở CUỐI chuỗi: mặc định 1 (1 reverse proxy trực tiếp phía
 * trước app) thì IP thật là phần tử CUỐI CÙNG; đặt N thì lấy phần tử thứ N tính từ phải.
 * Không xác định được IP (thiếu header, hoặc rỗng) -> khoá chung `'unknown'`, KHÔNG bỏ giới hạn
 * (khác hành vi K13 cũ là trả '' rồi các module gọi tự bỏ qua giới hạn IP).
 * Reverse proxy lúc deploy PHẢI ghi đè đúng `X-Forwarded-For`/`X-Real-Ip` theo đúng số tầng khai ở
 * `TRUSTED_PROXY_HOPS`, nếu không IP thật sẽ lẫn với `'unknown'` hoặc bị giả mạo.
 */
function trustedProxyHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(n) && n >= 1 ? n : 1;
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
  return 'unknown';
}
