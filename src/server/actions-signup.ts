'use server';

import { headers } from 'next/headers';
import { clientIpFrom } from '@/lib/client-ip';
import { routing, type Locale } from '@/i18n/routing';
import { signupMailer } from './auth-mail';
import { getAuthStore } from './auth-store';
import { getSignupStore } from './signup-store';
import { requestSignup, type SignupResult } from './signup';

function toLocale(raw: string): Locale {
  return (routing.locales as readonly string[]).includes(raw) ? (raw as Locale) : routing.defaultLocale;
}

/**
 * P3F-3 - trang công khai `/dang-ky`. KHÔNG cần đăng nhập. Lỗi hạ tầng (store/Prisma) trả GIỐNG HỆT
 * phản hồi bình thường (không lộ cho người gọi), chỉ log tên lỗi (khuôn `requestPasswordResetAction`).
 */
export async function submitSignupAction(input: {
  name: string;
  departmentId: number | null;
  email: string;
  locale: string;
}): Promise<SignupResult> {
  try {
    // S1: không gửi được link đặt mật khẩu thì không nhận đăng ký (giống trang Quên mật khẩu khi thiếu SMTP).
    if (!process.env.NEXTAUTH_URL || !(await signupMailer.getSmtp())) return { status: 'smtp_missing' };
    const ip = clientIpFrom(await headers());
    return await requestSignup(getSignupStore(), getAuthStore(), {
      name: input.name,
      departmentId: input.departmentId,
      email: input.email,
      locale: toLocale(input.locale),
      ip,
    });
  } catch (e) {
    console.error('[submitSignupAction]', e instanceof Error ? e.name : String(e));
    return { status: 'accepted' };
  }
}
