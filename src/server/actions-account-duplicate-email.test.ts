import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * P3E Task 3 - kiểm ĐỘC LẬP (file mới, không dùng lại test của coder) việc chặn trùng email khi
 * tạo tài khoản: khác hoa/thường phải bị chặn trùng; email có khoảng trắng thừa được TRIM tự động
 * (vòng sửa bảo mật 1, ghi chú tester) nhưng vẫn không lách được qua kiểm trùng bằng biến thể đó.
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { createAccountAction } from '@/server/actions';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  login(ADMIN);
});

describe('createAccountAction - chan trung email khac hoa/thuong', () => {
  it('duong chay thuan loi: tao tai khoan moi hop le -> ok', async () => {
    const res = await createAccountAction('nguoi-moi@daidung.com.vn', 'Nguoi Moi', 'viewer', 'MatKhauDu8');
    expect(res).toEqual({ ok: true });
  });

  it('bien: email VIET HOA toan bo trung voi email da co (chu thuong) -> duplicate, khong tao ban ghi thu 2', async () => {
    await createAccountAction('trunghoa@daidung.com.vn', 'Nguoi Cu', 'viewer', 'MatKhauDu8');

    const res = await createAccountAction('TRUNGHOA@DAIDUNG.COM.VN', 'Nguoi Moi', 'admin', 'KhacMatKhau1');

    expect(res).toEqual({ ok: false, error: 'duplicate' });
    expect(repo.getUserRoles().filter((u) => u.email === 'trunghoa@daidung.com.vn')).toHaveLength(1);
  });

  it('bien: email Hoa/thuong xen ke (Mixed-Case) cung bi coi la trung', async () => {
    await createAccountAction('hoathuong@daidung.com.vn', 'A', 'viewer', '');

    const res = await createAccountAction('HoaThuong@DaiDung.Com.Vn', 'B', 'viewer', '');

    expect(res).toEqual({ ok: false, error: 'duplicate' });
  });

  it('email co khoang trang dau/cuoi duoc TRIM tu dong (khong con bi tu choi vi khoang trang) - van chan trung duoc', async () => {
    await createAccountAction('trunghoa@daidung.com.vn', 'Nguoi Cu', 'viewer', 'MatKhauDu8');

    const res = await createAccountAction('  trunghoa@daidung.com.vn  ', 'Nguoi Khoang Trang', 'viewer', 'MatKhauDu8');

    expect(res).toEqual({ ok: false, error: 'duplicate' });
    expect(repo.getUserRoles().filter((u) => u.email === 'trunghoa@daidung.com.vn')).toHaveLength(1);
  });
});
