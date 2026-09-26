import { redirect } from 'next/navigation';
import { getCurrentUser, homeForRole, type CurrentUser } from '@/lib/session';
import type { Role } from '@/server/repo/types';

/**
 * P3D-B (S-1): chốt chặn đăng nhập ở tầng page, không phó mặc middleware/layout.
 * Layout và page render song song nên redirect ở layout KHÔNG chặn được page stream dữ liệu;
 * mọi page (app) phải gọi hàm này là lệnh await đầu tiên (sau getLocale nếu cần),
 * trước mọi lệnh đọc dữ liệu và trước khi trả JSX có Suspense.
 * - Chưa đăng nhập (hoặc phiên bị vô hiệu) -> /{locale}/login.
 * - Có `roles` mà vai không nằm trong đó -> trang chủ theo vai (homeForRole).
 * Không gọi trong try/catch: redirect() ném NEXT_REDIRECT.
 */
export async function requireUser(locale: string, roles?: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (roles && !roles.includes(user.role)) redirect(`/${locale}${homeForRole(user.role)}`);
  return user;
}
