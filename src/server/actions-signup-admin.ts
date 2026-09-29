'use server';

import { randomBytes } from 'node:crypto';
import { logActivity } from '@/lib/activity';
import { SIGNUP_INVITE_TTL_MS } from '@/lib/login-policy';
import { hashPassword } from '@/lib/password';
import { generateResetToken } from '@/lib/reset-token';
import { routing, type Locale } from '@/i18n/routing';
import { requireRoleUser } from './action-guards';
import { getAuthStore } from './auth-store';
import { signupMailer } from './auth-mail';
import type { SmtpConfig } from './notify/email';
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
 * S1 - sinh link đặt mật khẩu (hạn 72 giờ, dùng 1 lần, chỉ lưu hash) và gửi tới đúng email đăng ký. Lỗi ở đây KHÔNG hoàn
 * tác việc bật tài khoản (tài khoản đã tạo, người dùng vẫn lấy được link qua "Quên mật khẩu"), chỉ báo `mailed: false`.
 */
async function sendInvite(person: { email: string; locale: 'vi' | 'en' }, smtp: SmtpConfig, baseUrl: string): Promise<boolean> {
  try {
    const locale = toLocale(person.locale);
    const { token, tokenHash } = generateResetToken();
    const expiresAtIso = new Date(Date.now() + SIGNUP_INVITE_TTL_MS).toISOString();
    await getAuthStore().replaceResetToken(person.email, tokenHash, expiresAtIso, '');
    const link = `${baseUrl.replace(/\/$/, '')}/${locale}/dat-lai-mat-khau?token=${token}`;
    const { subject, text } = await signupMailer.compose(locale, person.email, link);
    signupMailer.queue(smtp, person.email, subject, text);
    return true;
  } catch (e) {
    console.error('[approveSignupAction] gui email dat mat khau loi', e instanceof Error ? e.name : String(e));
    return false;
  }
}

/**
 * Admin bật tài khoản cho 1 đăng ký chờ, chọn vai trò. Quyền xem tài chính theo vai trò (khuôn `createAccountAction`).
 * S1: người đăng ký chưa chứng minh sở hữu email nên tài khoản được tạo với mật khẩu ngẫu nhiên không ai biết; chỉ chủ hộp
 * thư đặt được mật khẩu thật qua link. Chưa cấu hình gửi email (SMTP hoặc `NEXTAUTH_URL`) thì KHÔNG bật, trả `smtp_missing`.
 */
export async function approveSignupAction(
  id: number,
  role: Role,
): Promise<
  | { ok: true; mailed: boolean }
  | { ok: false; error: 'Forbidden' | 'Invalid input' | 'not_found' | 'duplicate_account' | 'smtp_missing' }
> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  if (!isId(id) || !ROLES.includes(role)) return { ok: false, error: 'Invalid input' };

  const smtp = await signupMailer.getSmtp();
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!smtp || !baseUrl) return { ok: false, error: 'smtp_missing' };

  // Chuỗi ngẫu nhiên được băm rồi vứt: không ai đăng nhập được bằng mật khẩu cho tới khi đặt qua link. Dùng hash thật (không để
  // rỗng) vì rỗng nghĩa là tài khoản chỉ Google, bị chặn đặt lại mật khẩu (L5), còn "Quên mật khẩu" phải dùng được nếu link hết hạn.
  const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
  const result = await getSignupStore().approveRequest(id, { role, canViewFinance: role !== 'viewer', passwordHash });
  if (result === 'not_found' || result === 'duplicate_account') return { ok: false, error: result };

  await logActivity(user, 'signup_approve', `${result.email}:${role}`);
  return { ok: true, mailed: await sendInvite(result, smtp, baseUrl) };
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
