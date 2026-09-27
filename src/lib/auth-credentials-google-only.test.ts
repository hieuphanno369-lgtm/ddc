/**
 * P3E Task 3 - kiểm ĐỘC LẬP (không dùng lại test của coder) hành vi `authorize` (Credentials
 * provider) của next-auth với tài khoản chỉ Google (`passwordHash === ''`) và tài khoản bị tắt.
 * Yêu cầu bàn giao: "tài khoản chỉ Google (không mật khẩu) không đăng nhập được bằng mật khẩu rỗng"
 * và không đăng nhập được bằng bất kỳ mật khẩu nào khác (K7 - không lộ tài khoản nào chỉ dùng Google).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/lib/password';

const { findUniqueMock, updateMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn(), updateMock: vi.fn() }));
vi.mock('@/server/db', () => ({ prisma: { userRole: { findUnique: findUniqueMock, update: updateMock } } }));
vi.mock('@/lib/activity');

import { authOptions } from './auth';

type Authorize = (credentials: Record<string, string> | undefined) => Promise<unknown>;

function getAuthorize(): Authorize {
  const provider = authOptions.providers.find((p) => p.id === 'credentials');
  if (!provider) throw new Error('khong tim thay CredentialsProvider');
  // next-auth v4: `provider.authorize` cấp cao nhất chỉ là placeholder `() => null` (chuẩn hoá nội
  // bộ lúc khởi tạo NextAuth thật); hàm `authorize` người dùng khai báo nằm ở `provider.options`.
  return (provider as unknown as { options: { authorize: Authorize } }).options.authorize;
}

const REAL_PW = 'MatKhauThat1';
const row = (over: Partial<Record<string, unknown>> = {}) => ({
  email: 'a@daidung.com.vn',
  name: 'A',
  passwordHash: hashPassword(REAL_PW),
  role: 'viewer',
  canViewFinance: false,
  isActive: true,
  createdAt: new Date(),
  lastLoginAt: null,
  ...over,
});

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  vi.stubEnv('DATABASE_URL', 'postgres://x');
});
afterEach(() => vi.unstubAllEnvs());

describe('CredentialsProvider.authorize - tai khoan chi Google (D1)', () => {
  it('mat khau rong -> null (chan tu truoc khi doc DB)', async () => {
    const authorize = getAuthorize();
    const result = await authorize({ email: 'a@daidung.com.vn', password: '' });
    expect(result).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('tai khoan chi Google (passwordHash rong) + mat khau bat ky khac rong -> null', async () => {
    findUniqueMock.mockResolvedValue(row({ passwordHash: '' }));
    const authorize = getAuthorize();

    const result = await authorize({ email: 'a@daidung.com.vn', password: 'MatKhauBatKy123' });

    expect(result).toBeNull();
  });

  it('tai khoan binh thuong, mat khau dung -> tra ve user', async () => {
    findUniqueMock.mockResolvedValue(row());
    updateMock.mockResolvedValue({});
    const authorize = getAuthorize();

    const result = await authorize({ email: 'a@daidung.com.vn', password: REAL_PW });

    expect(result).toEqual({ id: 'a@daidung.com.vn', email: 'a@daidung.com.vn', name: 'A' });
  });

  it('tai khoan binh thuong, mat khau sai -> null', async () => {
    findUniqueMock.mockResolvedValue(row());
    const authorize = getAuthorize();

    const result = await authorize({ email: 'a@daidung.com.vn', password: 'sai-mat-khau' });

    expect(result).toBeNull();
  });

  it('tai khoan bi tat (isActive=false), mat khau dung -> null (khong duoc vao du dung mat khau)', async () => {
    findUniqueMock.mockResolvedValue(row({ isActive: false }));
    const authorize = getAuthorize();

    const result = await authorize({ email: 'a@daidung.com.vn', password: REAL_PW });

    expect(result).toBeNull();
  });
});
