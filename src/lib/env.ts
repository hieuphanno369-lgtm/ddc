/**
 * Đọc biến môi trường bắt buộc - thuần (không import Node API) để middleware (edge runtime)
 * import được.
 */

/** Trả NEXTAUTH_SECRET đã trim; thiếu/rỗng → throw. */
export function requireAuthSecret(): string {
  const raw = (process.env.NEXTAUTH_SECRET ?? '').trim();
  if (!raw) {
    throw new Error('NEXTAUTH_SECRET chưa được cấu hình - đặt biến môi trường trước khi chạy app');
  }
  return raw;
}
