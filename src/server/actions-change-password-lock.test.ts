/**
 * R3-1, R3-2 (bao-mat.md vòng 3, Trung) - `changePasswordAction`:
 * - R3-1: ghi mật khẩu mới bằng compare-and-swap (`setPasswordIfHash`) - 1 request khác ghi đè mật
 *   khẩu xen giữa lúc verify và lúc ghi thì KHÔNG được phép thắng.
 * - R3-2 (chủ dự án chốt 2026-09-28): đoán sai mật khẩu hiện tại tính CHUNG vào bộ đếm khoá 5 lần
 *   của đăng nhập (`registerFailedLogin`); đủ ngưỡng thì khoá tài khoản VÀ đá luôn phiên hiện tại
 *   (`invalidateCurrentSessionCookie`); tài khoản đang khoá thì từ chối TRƯỚC bcrypt; đúng mật khẩu
 *   thì reset bộ đếm. Có giới hạn theo IP (`change_pwd_fail_ip`) trước bcrypt.
 * Mẫu `actions-account-lock.test.ts`/`login-guard.test.ts` (dùng `createMemoryAuthStore` thật, hash
 * bcrypt thật tính 1 lần ở `beforeAll`).
 */
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';
import { hashPassword } from '@/lib/password';
import * as passwordLib from '@/lib/password';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '9.9.9.9']]) as unknown as Headers,
}));

import { createMemoryAuthStore } from '@/server/repo/mock-repo-auth';

let store: ReturnType<typeof createMemoryAuthStore>;
vi.mock('@/server/auth-store', () => ({ getAuthStore: () => store }));

const { reissueSessionCookieMock, invalidateCurrentSessionCookieMock } = vi.hoisted(() => ({
  reissueSessionCookieMock: vi.fn(),
  invalidateCurrentSessionCookieMock: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  reissueSessionCookie: reissueSessionCookieMock,
  invalidateCurrentSessionCookie: invalidateCurrentSessionCookieMock,
}));

import { getCurrentUser } from '@/lib/session';
import { logActivity } from '@/lib/activity';
import { repo } from '@/server/repo/mock-repo';
import { changePasswordAction } from '@/server/actions';

const EMAIL = 'khoa-doi-mk@daidung.com.vn';
const REAL_PW = 'MatKhauThat1';
let REAL_HASH = '';
const USER: CurrentUser = { name: 'Nguoi Dung', email: EMAIL, role: 'viewer', canViewFinance: false };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeAll(async () => {
  REAL_HASH = await hashPassword(REAL_PW);
});

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  repo.createAccount({
    email: EMAIL, name: 'Nguoi Dung', passwordHash: REAL_HASH, role: 'viewer',
    canViewFinance: false, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedAt: null,
  });
  store = createMemoryAuthStore({
    findAccount: (email) => repo.findAccount(email),
    changePassword: (email, hash) => repo.changePassword(email, hash),
  });
  login(USER);
});

describe('changePasswordAction - R3-2 khoa tai khoan sau 5 lan sai mat khau hien tai', () => {
  it('4 lan sai -> current, chua khoa; lan 5 -> locked, khoa tai khoan, dang xuat phien hien tai', async () => {
    for (let i = 0; i < 4; i++) {
      const r = await changePasswordAction('sai-mk', 'MatKhauMoiTuDoi1');
      expect(r).toEqual({ ok: false, error: 'current' });
    }
    expect(invalidateCurrentSessionCookieMock).not.toHaveBeenCalled();

    const r5 = await changePasswordAction('sai-mk', 'MatKhauMoiTuDoi1');
    expect(r5).toEqual({ ok: false, error: 'locked' });

    const state = await store.getAccountState(EMAIL);
    expect(state?.lockedAt).not.toBeNull();
    expect(invalidateCurrentSessionCookieMock).toHaveBeenCalledWith(EMAIL);
    expect(invalidateCurrentSessionCookieMock).toHaveBeenCalledTimes(1);
    expect(logActivity).toHaveBeenCalledWith(USER, 'login_locked', '5');
  });

  it('da khoa -> lan goi tiep theo tu choi TRUOC bcrypt (verifyPassword KHONG duoc goi)', async () => {
    for (let i = 0; i < 5; i++) await changePasswordAction('sai-mk', 'MatKhauMoiTuDoi1');
    const state = await store.getAccountState(EMAIL);
    expect(state?.lockedAt).not.toBeNull();

    const spy = vi.spyOn(passwordLib, 'verifyPassword');
    spy.mockClear();
    invalidateCurrentSessionCookieMock.mockClear(); // lan sai thu 5 o tren da goi 1 lan (luc khoa)

    const r = await changePasswordAction(REAL_PW, 'MatKhauMoiTuDoi1'); // du dung mat khau that
    expect(r).toEqual({ ok: false, error: 'locked' });
    expect(spy).not.toHaveBeenCalled();
    expect(invalidateCurrentSessionCookieMock).not.toHaveBeenCalled(); // khong khoa THEM lan nua
  });

  it('dung mat khau sau vai lan sai (chua cham nguong) -> thanh cong, bo dem ve 0', async () => {
    for (let i = 0; i < 3; i++) await changePasswordAction('sai-mk', 'MatKhauMoiTuDoi1');

    const r = await changePasswordAction(REAL_PW, 'MatKhauMoiTuDoi1');
    expect(r).toEqual({ ok: true });

    const state = await store.getAccountState(EMAIL);
    expect(state?.failedLoginCount).toBe(0);
    expect(state?.lockedAt).toBeNull();
    expect(reissueSessionCookieMock).toHaveBeenCalledWith(EMAIL, expect.any(String));
  });
});

describe('changePasswordAction - R3-2 gioi han theo IP truoc bcrypt', () => {
  it('reserveThrottle het cho (ip_limited) -> tra ip_limited, KHONG goi verifyPassword, KHONG tang bo dem tai khoan', async () => {
    vi.spyOn(store, 'reserveThrottle').mockResolvedValueOnce(null);
    const spy = vi.spyOn(passwordLib, 'verifyPassword');
    spy.mockClear();

    const r = await changePasswordAction('sai-mk', 'MatKhauMoiTuDoi1');

    expect(r).toEqual({ ok: false, error: 'ip_limited' });
    expect(spy).not.toHaveBeenCalled();
    const state = await store.getAccountState(EMAIL);
    expect(state?.failedLoginCount).toBe(0);
  });
});

describe('changePasswordAction - R3-1 compare-and-swap (chong race ghi de mat khau)', () => {
  it('1 request KHAC (vd admin dat mat khau tam) ghi de hash xen giua luc verify va luc ghi -> CAS thua, tra current, KHONG cap lai cookie phien, KHONG mat ban ghi cua request kia', async () => {
    const realVerify = passwordLib.verifyPassword;
    const RACE_HASH = 'hash-tu-admin-khac';
    vi.spyOn(passwordLib, 'verifyPassword').mockImplementationOnce(async (raw: string, hash: string) => {
      const ok = await realVerify(raw, hash);
      // Mo phong 1 request KHAC (vd unlockAccountAction voi tempPassword) ghi de mat khau NGAY SAU
      // khi request nay vua kiem xong currentPassword, TRUOC khi request nay kip ghi.
      await store.setPassword(EMAIL, RACE_HASH, true, new Date().toISOString());
      return ok;
    });

    const r = await changePasswordAction(REAL_PW, 'MatKhauMoiTuDoi1');

    expect(r).toEqual({ ok: false, error: 'current' });
    expect(reissueSessionCookieMock).not.toHaveBeenCalled();
    // Ban ghi cua request kia (RACE_HASH) phai con nguyen - request nay KHONG duoc phep ghi de len.
    const state = await store.getAccountState(EMAIL);
    expect(state?.passwordHash).toBe(RACE_HASH);
  });
});
