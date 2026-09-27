import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * D1 (P3E) - createAccountAction cho phép tạo tài khoản chỉ đăng nhập Google (password rỗng),
 * chặn mật khẩu ngắn, và không cho trùng email.
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
const VIEWER: CurrentUser = { name: 'V', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('createAccountAction - tai khoan chi Google + chan trung email', () => {
  it('tao khong mat khau -> passwordHash rong (tai khoan chi dang nhap Google)', async () => {
    login(ADMIN);

    const res = await createAccountAction('moi-google@gmail.com', 'Nguoi Moi', 'viewer', '');

    expect(res).toEqual({ ok: true });
    const account = repo.findAccount('moi-google@gmail.com');
    expect(account?.passwordHash).toBe('');
  });

  it('mat khau 1-7 ky tu -> loi, khong tao tai khoan', async () => {
    login(ADMIN);

    const res = await createAccountAction('ngan@daidung.com.vn', 'Ngan', 'viewer', '1234567');

    expect(res.ok).toBe(false);
    expect(repo.findAccount('ngan@daidung.com.vn')).toBeUndefined();
  });

  it('trung email -> duplicate, khong ghi de tai khoan cu', async () => {
    login(ADMIN);
    await createAccountAction('trung@daidung.com.vn', 'Nguoi Cu', 'viewer', 'MatKhauDu8');

    const res = await createAccountAction('trung@daidung.com.vn', 'Nguoi Moi', 'admin', 'KhacMatKhau1');

    expect(res).toEqual({ ok: false, error: 'duplicate' });
    expect(repo.findAccount('trung@daidung.com.vn')?.name).toBe('Nguoi Cu');
  });

  it('viewer goi -> Forbidden', async () => {
    login(VIEWER);

    const res = await createAccountAction('khac@daidung.com.vn', 'Khac', 'viewer', 'MatKhauDu8');

    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });
});
