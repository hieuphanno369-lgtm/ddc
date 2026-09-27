/**
 * P3E Task 4 - kiểm ĐỘC LẬP tích hợp giữa `checkCredentials` (login-guard) và
 * `resetPasswordWithToken`/`requestPasswordReset` (password-reset) trên CÙNG một `AuthStore`
 * (kho bộ nhớ), việc mà 2 file test riêng của coder không kiểm (mỗi file chỉ tự test module của
 * mình). Coi đây là hợp đồng giữa 2 module: sau khi đặt lại mật khẩu, mật khẩu MỚI phải đăng nhập
 * được và mật khẩu CŨ không còn dùng được; token dùng một lần; token hết hạn không dùng được;
 * tài khoản đang khoá thì đặt lại xong vẫn khoá (K10) - checkCredentials phải tiếp tục báo `locked`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '@/lib/password';
import { LOGIN_LOCK_THRESHOLD, RESET_TOKEN_TTL_MS } from '@/lib/login-policy';
import { createMemoryAuthStore, type MemoryAccountSource } from './repo/mock-repo-auth';
import type { UserAccount } from './repo/types';
import type { SmtpConfig } from './notify/email';
import { checkCredentials } from './login-guard';
import { requestPasswordReset, resetPasswordWithToken, type ResetMailer } from './password-reset';

vi.mock('@/lib/activity', () => ({ logActivity: vi.fn() }));

const OLD_PW = 'MatKhauCu12';
const NEW_PW = 'MatKhauMoi12';
const SMTP: SmtpConfig = { host: 'smtp.x.com', port: 587, secure: false, user: null, pass: null, from: 'a@daidung.com.vn' };
const BASE_URL = 'https://app.example.com';

function makeSource(accounts: UserAccount[]): MemoryAccountSource {
  return {
    findAccount: (email) => accounts.find((a) => a.email === email.toLowerCase()),
    changePassword: (email, hash) => {
      const a = accounts.find((x) => x.email === email.toLowerCase());
      if (a) a.passwordHash = hash;
    },
  };
}

function makeMailer(): { mailer: ResetMailer; tokenOf: () => string } {
  let lastLink = '';
  const mailer: ResetMailer = {
    async getSmtp() {
      return SMTP;
    },
    async compose(_locale, _email, link) {
      lastLink = link;
      return { subject: 's', text: link };
    },
    queue() {
      /* khong lam gi, chi can khong throw */
    },
  };
  return {
    mailer,
    tokenOf: () => {
      const m = lastLink.match(/token=([^&]+)/);
      if (!m) throw new Error('chua co token');
      return m[1];
    },
  };
}

function account(over: Partial<UserAccount> = {}): UserAccount {
  return {
    email: 'nguoi@daidung.com.vn',
    name: 'Nguoi Dung',
    passwordHash: hashPassword(OLD_PW),
    role: 'viewer',
    canViewFinance: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    ...over,
  };
}

const T0 = new Date('2026-09-27T00:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

beforeEach(() => vi.clearAllMocks());

describe('duong chay thuan loi: dat lai mat khau roi dang nhap bang mat khau moi', () => {
  it('mat khau moi dang nhap duoc, mat khau cu bi tu choi', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const { mailer, tokenOf } = makeMailer();

    await requestPasswordReset(store, mailer, { email: 'nguoi@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
    const reset = await resetPasswordWithToken(store, { token: tokenOf(), newPassword: NEW_PW }, at(1000));
    expect(reset).toEqual({ ok: true, locked: false });

    const withNew = await checkCredentials(store, { email: 'nguoi@daidung.com.vn', password: NEW_PW, ip: '' }, at(2000));
    expect(withNew.ok).toBe(true);

    const withOld = await checkCredentials(store, { email: 'nguoi@daidung.com.vn', password: OLD_PW, ip: '' }, at(3000));
    expect(withOld).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('bien: token dung 1 lan, het han, tai khoan dang khoa van giu khoa sau khi dat lai', () => {
  it('dung token lan 2 -> invalid_token (khong doi duoc mat khau lan nua)', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const { mailer, tokenOf } = makeMailer();
    await requestPasswordReset(store, mailer, { email: 'nguoi@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
    const token = tokenOf();

    expect(await resetPasswordWithToken(store, { token, newPassword: NEW_PW }, at(1000))).toEqual({ ok: true, locked: false });
    const second = await resetPasswordWithToken(store, { token, newPassword: 'MatKhauKhac99' }, at(2000));
    expect(second).toEqual({ ok: false, error: 'invalid_token' });
  });

  it('token qua han (30 phut + 1ms) -> invalid_token, mat khau cu van dang nhap duoc binh thuong', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const { mailer, tokenOf } = makeMailer();
    await requestPasswordReset(store, mailer, { email: 'nguoi@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(0));
    const token = tokenOf();

    const result = await resetPasswordWithToken(store, { token, newPassword: NEW_PW }, at(RESET_TOKEN_TTL_MS + 1));
    expect(result).toEqual({ ok: false, error: 'invalid_token' });

    const stillOld = await checkCredentials(store, { email: 'nguoi@daidung.com.vn', password: OLD_PW, ip: '' }, at(RESET_TOKEN_TTL_MS + 100));
    expect(stillOld.ok).toBe(true);
  });

  it('tai khoan dang bi khoa (5 lan sai): dat lai mat khau xong van tra locked khi dang nhap bang mat khau moi (K10, khong tu mo khoa)', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    for (let i = 1; i <= LOGIN_LOCK_THRESHOLD; i++) {
      await checkCredentials(store, { email: 'nguoi@daidung.com.vn', password: 'sai-hoai', ip: '' }, at(i * 10));
    }
    const locked = await checkCredentials(store, { email: 'nguoi@daidung.com.vn', password: OLD_PW, ip: '' }, at(1000));
    expect(locked).toEqual({ ok: false, reason: 'locked' });

    const { mailer, tokenOf } = makeMailer();
    await requestPasswordReset(store, mailer, { email: 'nguoi@daidung.com.vn', ip: '', locale: 'vi', baseUrl: BASE_URL }, at(2000));
    const reset = await resetPasswordWithToken(store, { token: tokenOf(), newPassword: NEW_PW }, at(3000));
    expect(reset).toEqual({ ok: true, locked: true });

    // Sau khi dat lai, mat khau MOI dung nhung tai khoan van dang khoa -> checkCredentials phai
    // van tra 'locked' (khong duoc tu mo khoa qua duong dat lai mat khau).
    const afterReset = await checkCredentials(store, { email: 'nguoi@daidung.com.vn', password: NEW_PW, ip: '' }, at(4000));
    expect(afterReset).toEqual({ ok: false, reason: 'locked' });
  });
});

describe('phai that bai: khong the dat lai mat khau bang token bia dat / khong ton tai', () => {
  it('token dung dinh dang nhung khong ton tai trong kho -> invalid_token', async () => {
    const store = createMemoryAuthStore(makeSource([account()]));
    const fakeToken = 'A'.repeat(43);

    const result = await resetPasswordWithToken(store, { token: fakeToken, newPassword: NEW_PW }, at(0));

    expect(result).toEqual({ ok: false, error: 'invalid_token' });
    const stillOld = await checkCredentials(store, { email: 'nguoi@daidung.com.vn', password: OLD_PW, ip: '' }, at(100));
    expect(stillOld.ok).toBe(true);
  });
});
