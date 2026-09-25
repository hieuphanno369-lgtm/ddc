'use server';

import { revalidateTag } from 'next/cache';
import { logActivity } from '@/lib/activity';
import { requireRoleUser } from './action-guards';
import { profileTag } from './cache';
import { repo } from './repo';

/**
 * Q6 (2026-09-25, chủ dự án chốt): bật/tắt quyền xem tài chính (`user_roles.canViewFinance`) cho TỪNG
 * tài khoản - chỉ admin, độc lập với role. Admin luôn xem được (không đọc cột này) - xem `resolveAccess()`
 * (src/lib/auth.ts). Có hiệu lực ở lần đăng nhập/refresh JWT kế tiếp của người bị đổi quyền.
 */
export async function setUserCanViewFinanceAction(
  email: string,
  canViewFinance: boolean,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'DataEntryLocked' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalized || !normalized.includes('@')) return { ok: false, error: 'Invalid input' };

  // T-1 (danh-gia-bao-mat.md, phương án b tạm thời tới khi P3A gate form nhập liệu): role data-entry
  // luôn canViewFinance=true (xem resolveAccess trong auth.ts) - từ chối tắt ở đây để không tạo "cảm
  // giác an toàn giả" (nút tắt được nhưng /nhap-lieu vẫn lộ số tiền).
  if (!canViewFinance) {
    const target = await repo.findAccount(normalized);
    if (target?.role === 'data-entry') return { ok: false, error: 'DataEntryLocked' };
  }

  const ok = await repo.setUserCanViewFinance(normalized, canViewFinance, user.email);
  if (!ok) return { ok: false, error: 'Not found' };

  await logActivity(user, 'set_can_view_finance', `${normalized} -> ${canViewFinance}`);
  revalidateTag(profileTag);
  return { ok: true };
}
