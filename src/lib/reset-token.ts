import { createHash, randomBytes } from 'node:crypto';

/**
 * K2 (ke-hoach.md) - token đặt lại mật khẩu: 32 byte `crypto.randomBytes`, mã hoá `base64url`
 * (43 ký tự). DB CHỈ lưu SHA-256 hex của token (64 ký tự) - token đủ entropy nên không cần bcrypt.
 */
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const RESET_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Kiểm dạng token trước khi hash/tra DB - chặn chuỗi rác sớm, không tốn 1 lượt đọc DB. */
export function isWellFormedResetToken(token: unknown): token is string {
  return typeof token === 'string' && RESET_TOKEN_RE.test(token);
}
