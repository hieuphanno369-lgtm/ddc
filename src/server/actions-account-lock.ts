'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import { normalizeEmail } from '@/lib/login-policy';
import { hashPassword } from '@/lib/password';
import { requireRoleUser } from './action-guards';
import { profileTag } from './cache';
import { getAuthStore } from './auth-store';

// I-3 (bao-mat.md vòng 4) - `tempPassword` thêm `.max(72)` (bcrypt cắt ở 72 byte, mật khẩu dài hơn
// vô nghĩa - không nên âm thầm bị cắt mà không báo).
const unlockAccountSchema = z.object({
  email: z.string().email(),
  tempPassword: z.string().min(8).max(72).optional(),
});

/**
 * P3E (Task 6, D3) - admin mở khoá tài khoản bị khoá sau 5 lần sai mật khẩu; `tempPassword` (tuỳ
 * chọn) đặt luôn mật khẩu tạm cùng lúc (Q2 = phương án b: admin đặt mật khẩu tạm thì đăng xuất mọi
 * phiên cũ, `setPassword(..., bumpChangedAt: true, ...)`).
 */
export async function unlockAccountAction(
  email: string,
  tempPassword?: string,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'too_short' | 'Not found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };

  // I-3 (bao-mat.md vòng 4) - kiểm KIỂU của đầu vào THÔ TRƯỚC khi gọi `.trim()`: trước đây gọi
  // `email.trim()` ngay trên tham số hàm rồi mới đưa vào `safeParse`, nên đầu vào không phải chuỗi
  // (ai đó gọi thẳng server action với kiểu khác, không qua UI có kiểm TypeScript) làm `.trim()` ném
  // TypeError TRƯỚC KHI zod kịp kiểm - lộ lỗi 500 thay vì phản hồi `Invalid input` bình thường.
  if (typeof email !== 'string') return { ok: false, error: 'Invalid input' };

  const parsed = unlockAccountSchema.safeParse({ email: email.trim(), tempPassword });
  if (!parsed.success) {
    const isPasswordIssue = parsed.error.issues.some((i) => i.path[0] === 'tempPassword');
    return { ok: false, error: isPasswordIssue ? 'too_short' : 'Invalid input' };
  }

  const normEmail = normalizeEmail(parsed.data.email);
  if (!normEmail) return { ok: false, error: 'Invalid input' };

  const store = getAuthStore();
  const unlocked = await store.unlockAccount(normEmail);
  if (!unlocked) return { ok: false, error: 'Not found' };

  if (parsed.data.tempPassword) {
    await store.setPassword(normEmail, await hashPassword(parsed.data.tempPassword), true, new Date().toISOString());
  }

  await logActivity(user, 'account_unlock', normEmail);
  revalidateTag(profileTag);
  return { ok: true };
}
