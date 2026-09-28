/**
 * P3E (Task 7, D2) - server action cho trang quên/đặt lại mật khẩu. Dùng kho bộ nhớ thật
 * (`createMemoryAuthStore`) qua `@/server/auth-store` (mock) + `resetMailer` giả (mock
 * `@/server/auth-mail`) để kiểm luồng end-to-end thuần TypeScript (không cần DB/SMTP thật).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/lib/password';
import { createMemoryAuthStore } from '@/server/repo/mock-repo-auth';
import type { UserAccount } from '@/server/repo/types';
import { checkCredentials } from '@/server/login-guard';
import { __resetRequestQueueIdleForTest } from '@/server/password-reset';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '1.2.3.4']]) as unknown as Headers,
}));

let store: ReturnType<typeof createMemoryAuthStore>;
const getAuthStoreMock = vi.fn(() => store);
vi.mock('@/server/auth-store', () => ({ getAuthStore: () => getAuthStoreMock() }));

let lastLink = '';
const queueSpy = vi.fn();
const smtpConfigured = vi.fn(async () => ({ host: 'smtp.x.com', port: 587, secure: false, user: null, pass: null, from: 'noreply@daidung.com.vn' }));
vi.mock('@/server/auth-mail', () => ({
  resetMailer: {
    getSmtp: () => smtpConfigured(),
    async compose(_locale: string, _email: string, link: string) {
      lastLink = link;
      return { subject: 'Dat lai mat khau', text: `Mo link: ${link}` };
    },
    queue: (...args: unknown[]) => queueSpy(...args),
  },
}));

import { requestPasswordResetAction, submitPasswordResetAction } from '@/server/actions-password-reset';

const OLD_PW = 'MatKhauCu1';
let accounts: UserAccount[];

function tokenFromLastLink(): string {
  const m = lastLink.match(/token=([^&]+)/);
  if (!m) throw new Error('chua co token trong link');
  return m[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  lastLink = '';
  process.env.NEXTAUTH_URL = 'https://app.example.com';
  accounts = [
    {
      email: 'nguoi@daidung.com.vn', name: 'Nguoi Dung', passwordHash: hashPassword(OLD_PW), role: 'viewer',
      canViewFinance: false, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedAt: null,
    },
  ];
  store = createMemoryAuthStore({
    findAccount: (email) => accounts.find((a) => a.email === email.toLowerCase()),
    changePassword: (email, hash) => {
      const a = accounts.find((x) => x.email === email.toLowerCase());
      if (a) a.passwordHash = hash;
    },
  });
  smtpConfigured.mockResolvedValue({ host: 'smtp.x.com', port: 587, secure: false, user: null, pass: null, from: 'noreply@daidung.com.vn' });
});

describe('requestPasswordResetAction', () => {
  it("locale 'fr' (khong thuoc routing.locales) -> link dung /vi/", async () => {
    const res = await requestPasswordResetAction('nguoi@daidung.com.vn', 'fr');
    await __resetRequestQueueIdleForTest();
    expect(res).toEqual({ status: 'accepted' });
    expect(lastLink).toContain('/vi/dat-lai-mat-khau?token=');
  });

  it('NEXTAUTH_URL rong -> smtp_missing', async () => {
    process.env.NEXTAUTH_URL = '';
    const res = await requestPasswordResetAction('nguoi@daidung.com.vn', 'vi');
    expect(res).toEqual({ status: 'smtp_missing' });
  });

  it('(G5) getAuthStore nem loi bat ky -> van tra accepted, khong nem lai, console.error khong chua message goc', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getAuthStoreMock.mockImplementationOnce(() => {
      throw new Error('bi mat ket noi DB chi tiet nhay cam');
    });

    const res = await requestPasswordResetAction('nguoi@daidung.com.vn', 'vi');

    expect(res).toEqual({ status: 'accepted' });
    for (const call of consoleSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('bi mat ket noi DB chi tiet nhay cam');
    }
    consoleSpy.mockRestore();
  });
});

describe('submitPasswordResetAction', () => {
  it('mat khau va xac nhan khac nhau -> mismatch (kiem TRUOC khi dung toi token)', async () => {
    const res = await submitPasswordResetAction('token-bat-ky', 'MatKhauMoi1', 'KhacDi123');
    expect(res).toEqual({ ok: false, error: 'mismatch' });
  });

  it('luong du: xin link -> lay token tu link -> dat lai -> dang nhap mat khau moi ok, mat khau cu invalid', async () => {
    await requestPasswordResetAction('nguoi@daidung.com.vn', 'vi');
    await __resetRequestQueueIdleForTest();
    const token = tokenFromLastLink();

    const res = await submitPasswordResetAction(token, 'MatKhauMoi1', 'MatKhauMoi1');

    expect(res).toEqual({ ok: true, locked: false });

    const okNew = await checkCredentials(store, { email: 'nguoi@daidung.com.vn', password: 'MatKhauMoi1', ip: '9.9.9.9' });
    expect(okNew.ok).toBe(true);

    const okOld = await checkCredentials(store, { email: 'nguoi@daidung.com.vn', password: OLD_PW, ip: '9.9.9.9' });
    expect(okOld).toEqual({ ok: false, reason: 'invalid' });
  });

  it('(G5) resetPasswordWithToken nem loi bat ky -> tra { ok: false, error: invalid_token }, khong nem lai', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getAuthStoreMock.mockImplementationOnce(() => {
      throw new Error('loi ha tang nhay cam');
    });

    const res = await submitPasswordResetAction('token-bat-ky-du-43-ky-tu-1234567890123', 'MatKhauMoi1', 'MatKhauMoi1');

    expect(res).toEqual({ ok: false, error: 'invalid_token' });
    for (const call of consoleSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('loi ha tang nhay cam');
    }
    consoleSpy.mockRestore();
  });
});
