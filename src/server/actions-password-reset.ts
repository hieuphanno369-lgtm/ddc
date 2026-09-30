'use server';

import { headers } from 'next/headers';
import { clientIpFrom } from '@/lib/client-ip';
import { errorFields, logger } from '@/lib/logger';
import { routing, type Locale } from '@/i18n/routing';
import { getAuthStore } from './auth-store';
import { resetMailer } from './auth-mail';
import { requestPasswordReset, resetPasswordWithToken } from './password-reset';

function toLocale(raw: string): Locale {
  return (routing.locales as readonly string[]).includes(raw) ? (raw as Locale) : routing.defaultLocale;
}

/**
 * P3E (Task 7, D2) - trang `/quen-mat-khau`. Không đặt tên `resetPasswordAction` (đã có hàm admin
 * trùng tên trong `actions.ts`).
 */
export async function requestPasswordResetAction(email: string, locale: string): Promise<{ status: 'accepted' | 'smtp_missing' }> {
  const loc = toLocale(locale);
  try {
    const ip = clientIpFrom(await headers());
    return await requestPasswordReset(getAuthStore(), resetMailer, { email, ip, locale: loc, baseUrl: process.env.NEXTAUTH_URL });
  } catch (e) {
    // G5 - lỗi hạ tầng (store/Prisma) KHÔNG được lộ ra ngoài: trả GIỐNG HỆT phản hồi bình thường
    // (S3/K8 - không lộ cho người gọi biết có lỗi hạ tầng), chỉ log tên lỗi (không log `message`).
    logger.error('password_reset.request_failed', errorFields(e));
    return { status: 'accepted' };
  }
}

/** Trang `/dat-lai-mat-khau`. */
export async function submitPasswordResetAction(
  token: string,
  newPassword: string,
  confirm: string,
): Promise<{ ok: true; locked: boolean } | { ok: false; error: 'invalid_token' | 'too_short' | 'mismatch' }> {
  if (newPassword !== confirm) return { ok: false, error: 'mismatch' };
  try {
    const ip = clientIpFrom(await headers());
    return await resetPasswordWithToken(getAuthStore(), { token, newPassword, ip });
  } catch (e) {
    // G5 - phản hồi chung, không lộ chi tiết lỗi hạ tầng.
    logger.error('password_reset.submit_failed', errorFields(e));
    return { ok: false, error: 'invalid_token' };
  }
}
