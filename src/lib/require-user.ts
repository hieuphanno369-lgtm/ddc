import { redirect } from 'next/navigation';
import { getCurrentUser, homeForRole, type CurrentUser } from '@/lib/session';
import type { Role } from '@/server/repo/types';

/**
 * P3D-B (S-1): chot chan dang nhap o tang page, khong pho mac middleware/layout.
 * Layout va page render song song nen redirect o layout KHONG chan duoc page stream du lieu;
 * moi page (app) phai goi ham nay la lenh await dau tien (sau getLocale neu can),
 * truoc moi lenh doc du lieu va truoc khi tra JSX co Suspense.
 * - Chua dang nhap (hoac phien bi vo hieu) -> /{locale}/login.
 * - Co `roles` ma vai khong nam trong do -> trang chu theo vai (homeForRole).
 * Khong goi trong try/catch: redirect() nem NEXT_REDIRECT.
 */
export async function requireUser(locale: string, roles?: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (roles && !roles.includes(user.role)) redirect(`/${locale}${homeForRole(user.role)}`);
  return user;
}
