import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';

/**
 * P3E (Task 7, S8, Q2=b) - `resetPasswordAction` (admin đặt lại mật khẩu) phải đặt
 * `passwordChangedAt` (qua `getAuthStore().setPassword(..., bumpChangedAt: true, ...)`) để vô hiệu
 * phiên đăng nhập cũ.
 * S-2 (bao-mat.md vòng 4, chủ dự án chốt 2026-09-28, thay quyết định Q2=b cũ) - `changePasswordAction`
 * (tự đổi trong Cài đặt) NAY CŨNG bump `passwordChangedAt` (vô hiệu các phiên KHÁC), khác biệt duy
 * nhất với `resetPasswordAction` là phiên HIỆN TẠI được server tự cấp lại cookie mới ngay trong action
 * này (`reissueSessionCookie`, mock ở đây - xem test thật của hàm đó ở `auth-reissue-session-cookie.test.ts`)
 * - R2-1 (bao-mat.md vòng 2, CAO): không còn dựa vào client gọi `update()` next-auth nữa.
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

const { reissueSessionCookieMock } = vi.hoisted(() => ({ reissueSessionCookieMock: vi.fn() }));
vi.mock('@/lib/auth', () => ({ reissueSessionCookie: reissueSessionCookieMock }));

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

describe('changePasswordAction (tu doi trong Cai dat) - S-2 CUNG bump passwordChangedAt (khac resetPasswordAction: phien hien tai duoc SERVER tu cap lai cookie moi qua reissueSessionCookie, khong bi dang xuat)', () => {
  it('doi mat khau thanh cong - GOI getAuthStore().setPassword voi bumpChangedAt = true, GOI reissueSessionCookie voi email CHINH phien nay', async () => {
    login(ADMIN);

    const res = await changePasswordAction('Admin@123', 'MatKhauMoiTuDoi1');

    expect(res).toEqual({ ok: true });
    expect(setPasswordMock).toHaveBeenCalledWith('admin@daidung.com.vn', expect.any(String), true, expect.any(String));
    // R2-1 - reissueSessionCookie CHI duoc goi SAU khi setPassword thanh cong, dung email nguoi vua doi.
    expect(reissueSessionCookieMock).toHaveBeenCalledWith('admin@daidung.com.vn');
  });

  it('mat khau hien tai sai -> current, KHONG goi setPassword, KHONG goi reissueSessionCookie', async () => {
    login(ADMIN);

    const res = await changePasswordAction('mat-khau-sai', 'MatKhauMoiTuDoi1');

    expect(res).toEqual({ ok: false, error: 'current' });
    expect(setPasswordMock).not.toHaveBeenCalled();
    expect(reissueSessionCookieMock).not.toHaveBeenCalled();
  });
});
