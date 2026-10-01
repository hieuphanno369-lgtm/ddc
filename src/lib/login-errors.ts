/**
 * Mã lỗi đăng nhập đi qua next-auth (`authorize` ném `new Error(<mã>)`, next-auth đưa vào `res.error` của
 * `signIn(..., { redirect: false })`). File không import gì để dùng được cả server (`src/lib/auth.ts`) lẫn
 * client (`LoginForm.tsx`).
 * `system_busy`: lỗi hệ thống/DB (không phải sai mật khẩu, không phải `locked`/`ip_limited`). Chuỗi cố định,
 * giống hệt ở mọi bước và mọi nhánh, không mang chi tiết kỹ thuật (không thành oracle email nào có tài khoản).
 */
export const LOGIN_SYSTEM_BUSY = 'system_busy' as const;

export type LoginErrorKey = 'authSecurity.locked' | 'authSecurity.ipLimited' | 'loginBusy.systemBusy' | 'auth.invalidCredentials';

/** `res.error` của next-auth -> key i18n hiện trên màn đăng nhập; mã lạ (vd `CredentialsSignin`) là sai email/mật khẩu. */
export function loginErrorKey(code: string): LoginErrorKey {
  if (code === 'locked') return 'authSecurity.locked';
  if (code === 'ip_limited') return 'authSecurity.ipLimited';
  if (code === LOGIN_SYSTEM_BUSY) return 'loginBusy.systemBusy';
  return 'auth.invalidCredentials';
}
