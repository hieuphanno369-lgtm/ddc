/**
 * K13 - IP khách: lấy phần tử đầu `x-forwarded-for`, rồi `x-real-ip`, cắt 64 ký tự (cùng quy
 * ước `src/lib/activity.ts`). Không lấy được IP thì trả `''` (bỏ qua giới hạn theo IP, không
 * gộp mọi người vào 1 khoá chung).
 * Reverse proxy lúc deploy PHẢI ghi đè `X-Forwarded-For` bằng IP thật.
 */
export function clientIpFrom(h: Pick<Headers, 'get'>): string {
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || h.get('x-real-ip')?.trim() || '';
  return ip.slice(0, 64);
}
