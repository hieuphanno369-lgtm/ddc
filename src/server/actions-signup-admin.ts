'use server';

import { logActivity } from '@/lib/activity';
import { routing, type Locale } from '@/i18n/routing';
import { requireRoleUser } from './action-guards';
import { signupMailer } from './auth-mail';
import { normalizeDepartmentName } from './repo/signup-types';
import type { Role } from './repo/types';
import { getSignupStore } from './signup-store';

const ROLES: readonly Role[] = ['admin', 'bod', 'data-entry', 'viewer'];
const DEPARTMENT_NAME_MAX = 100;

/** Khoá chính là INT4 của Postgres: số lớn hơn sẽ làm truy vấn ném lỗi, chặn ngay ở cửa. */
const INT4_MAX = 2_147_483_647;
const isId = (id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0 && id <= INT4_MAX;
const toLocale = (raw: string): Locale => ((routing.locales as readonly string[]).includes(raw) ? (raw as Locale) : routing.defaultLocale);

/**
 * Gửi email "tài khoản đã sẵn sàng" qua kênh email đầu tiên có đủ SMTP (P3E). Thiếu SMTP hoặc `NEXTAUTH_URL`,
 * hoặc lỗi khi soạn/xếp hàng: KHÔNG làm hỏng việc bật tài khoản, chỉ báo `mailed: false`.
 */
async function notifyApproved(person: { email: string; name: string; locale: 'vi' | 'en' }): Promise<boolean> {
  try {
    const smtp = await signupMailer.getSmtp();
    const baseUrl = process.env.NEXTAUTH_URL;
    if (!smtp || !baseUrl) return false;
    const locale = toLocale(person.locale);
    const link = `${baseUrl.replace(/\/$/, '')}/${locale}/login`;
    const { subject, text } = await signupMailer.compose(locale, person.name, person.email, link);
    signupMailer.queue(smtp, person.email, subject, text);
    return true;
  } catch (e) {
    console.error('[approveSignupAction] gui email loi', e instanceof Error ? e.name : String(e));
    return false;
  }
}

/** Admin bật tài khoản cho 1 đăng ký chờ, chọn vai trò. Quyền xem tài chính theo vai trò (khuôn `createAccountAction`). */
export async function approveSignupAction(
  id: number,
  role: Role,
): Promise<{ ok: true; mailed: boolean } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' | 'duplicate_account' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  if (!isId(id) || !ROLES.includes(role)) return { ok: false, error: 'Invalid input' };

  const result = await getSignupStore().approveRequest(id, { role, canViewFinance: role !== 'viewer' });
  if (result === 'not_found' || result === 'duplicate_account') return { ok: false, error: result };

  await logActivity(user, 'signup_approve', `${result.email}:${role}`);
  return { ok: true, mailed: await notifyApproved(result) };
}

/** Admin từ chối đăng ký: xoá khỏi danh sách chờ, KHÔNG gửi email (quyết định chủ dự án). */
export async function rejectSignupAction(
  id: number,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  if (!isId(id)) return { ok: false, error: 'Invalid input' };

  const result = await getSignupStore().rejectRequest(id);
  if (result === 'not_found') return { ok: false, error: 'not_found' };

  await logActivity(user, 'signup_reject', result.email);
  return { ok: true };
}

export async function saveDepartmentAction(input: {
  id?: number;
  name: string;
}): Promise<{ ok: true; id: number } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'duplicate_name' | 'not_found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const name = typeof input?.name === 'string' ? normalizeDepartmentName(input.name) : '';
  if (name.length < 1 || name.length > DEPARTMENT_NAME_MAX) return { ok: false, error: 'Invalid input' };
  if (input.id !== undefined && !isId(input.id)) return { ok: false, error: 'Invalid input' };

  const result = await getSignupStore().saveDepartment({ id: input.id, name }, user.email);
  if (result === 'duplicate_name' || result === 'not_found') return { ok: false, error: result };

  await logActivity(user, 'save_department', result.name);
  return { ok: true, id: result.id };
}

export async function setDepartmentActiveAction(
  id: number,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  if (!isId(id) || typeof isActive !== 'boolean') return { ok: false, error: 'Invalid input' };

  const found = await getSignupStore().setDepartmentActive(id, isActive, user.email);
  if (!found) return { ok: false, error: 'not_found' };

  await logActivity(user, isActive ? 'show_department' : 'hide_department', String(id));
  return { ok: true };
}

export async function deleteDepartmentAction(
  id: number,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' | 'in_use'; count?: number }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  if (!isId(id)) return { ok: false, error: 'Invalid input' };

  const result = await getSignupStore().deleteDepartment(id);
  if (result === 'not_found') return { ok: false, error: 'not_found' };
  if (typeof result === 'object') return { ok: false, error: 'in_use', count: result.inUse };

  await logActivity(user, 'delete_department', String(id));
  return { ok: true };
}
