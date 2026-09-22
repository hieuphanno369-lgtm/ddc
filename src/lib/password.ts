import { hashSync, compareSync } from 'bcryptjs';

export function hashPassword(password: string): string {
  return hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

/** Độ mạnh mật khẩu: 0 = quá ngắn, 1 = yếu, 2 = trung bình, 3 = mạnh. */
export function passwordStrength(password: string): number {
  if (password.length < 8) return 0;
  let s = 0;
  if (/[a-z]/.test(password)) s++;
  if (/[A-Z]/.test(password)) s++;
  if (/\d/.test(password)) s++;
  if (/[^A-Za-z0-9]/.test(password)) s++;
  if (s <= 1) return 1;
  if (s === 2) return 2;
  return 3;
}
