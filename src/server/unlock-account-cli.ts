import { normalizeEmail } from '@/lib/login-policy';
import type { AuthStore } from './repo/types';

/**
 * P3E (Task 6) - lệnh server mở khoá tài khoản (dùng cho `scripts/unlock-account.ts`, admin tự
 * khoá mình thì không vào được UI để bấm nút). Tách hàm thuần khỏi phần I/O (đọc argv, in ra
 * console, ghi activity log qua Prisma trực tiếp) để test được bằng kho bộ nhớ.
 */
export async function unlockAccountCli(
  store: AuthStore,
  rawEmail: string,
  log: (email: string) => Promise<void>,
): Promise<{ code: 0 | 1 | 2; message: string }> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { code: 2, message: `Email khong hop le: "${rawEmail}"` };

  const unlocked = await store.unlockAccount(email);
  if (!unlocked) return { code: 1, message: `Khong tim thay tai khoan: ${email}` };

  await log(email);
  return { code: 0, message: `Da mo khoa tai khoan: ${email}` };
}
