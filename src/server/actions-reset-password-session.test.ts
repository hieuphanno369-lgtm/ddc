import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';

/**
 * P3E (Task 7, S8, Q2=b) - `resetPasswordAction` (admin đặt lại mật khẩu) phải đặt
 * `passwordChangedAt` (qua `getAuthStore().setPassword(..., bumpChangedAt: true, ...)`) để vô hiệu
 * phiên đăng nhập cũ - khác `changePasswordAction` (tự đổi trong Cài đặt, Q2=b KHÔNG bump).
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

const { setPasswordMock } = vi.hoisted(() => ({ setPasswordMock: vi.fn(async () => true) }));
vi.mock('@/server/auth-store', () => ({ getAuthStore: () => ({ setPassword: setPasswordMock }) }));

import { getCurrentUser } from '@/lib/session';
import { repo } from '@/server/repo/mock-repo';
import { resetPasswordAction, changePasswordAction } from '@/server/actions';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('resetPasswordAction (admin) - Q2=b bump passwordChangedAt', () => {
  it('goi getAuthStore().setPassword voi bumpChangedAt = true (vo hieu phien cu)', async () => {
    login(ADMIN);

    const res = await resetPasswordAction('pm@daidung.com.vn', 'MatKhauMoi1');

    expect(res).toEqual({ ok: true });
    expect(setPasswordMock).toHaveBeenCalledWith('pm@daidung.com.vn', expect.any(String), true, expect.any(String));
  });

  it('mat khau qua ngan -> too_short, khong goi setPassword', async () => {
    login(ADMIN);

    const res = await resetPasswordAction('pm@daidung.com.vn', '1234567');

    expect(res).toEqual({ ok: false, error: 'too_short' });
    expect(setPasswordMock).not.toHaveBeenCalled();
  });
});

describe('changePasswordAction (tu doi trong Cai dat) - Q2=b KHONG bump (chinh phien dang dung khong bi dang xuat)', () => {
  it('doi mat khau thanh cong - KHONG goi getAuthStore().setPassword (dung repo.changePassword nhu cu)', async () => {
    login(ADMIN);

    const res = await changePasswordAction('Admin@123', 'MatKhauMoiTuDoi1');

    expect(res).toEqual({ ok: true });
    expect(setPasswordMock).not.toHaveBeenCalled();
  });
});
