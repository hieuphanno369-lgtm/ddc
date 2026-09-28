'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import { normalizeEmail } from '@/lib/login-policy';
import { hashPassword } from '@/lib/password';
import { requireRoleUser } from './action-guards';
import { profileTag } from './cache';
import { getAuthStore } from './auth-store';

const unlockAccountSchema = z.object({
  email: z.string().email(),
  tempPassword: z.string().min(8).optional(),
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
    await store.setPassword(normEmail, hashPassword(parsed.data.tempPassword), true, new Date().toISOString());
  }

  await logActivity(user, 'account_unlock', normEmail);
  revalidateTag(profileTag);
  return { ok: true };
}
