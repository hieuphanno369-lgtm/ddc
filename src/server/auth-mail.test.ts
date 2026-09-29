import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotifyChannelForSend } from '@/server/repo/types';

const { getChannelsForSendMock } = vi.hoisted(() => ({ getChannelsForSendMock: vi.fn() }));
vi.mock('@/server/repo', () => ({ repo: { getChannelsForSend: getChannelsForSendMock } }));

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock('./notify/email', () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

// `getTranslations({ locale })` phu thuoc request config cua Next; test doc thang messages/*.json va noi {bien} don gian.
vi.mock('next-intl/server', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace?: string }) => {
      const all = JSON.parse(readFileSync(join(process.cwd(), `src/i18n/messages/${locale}.json`), 'utf8')) as Record<string, unknown>;
      return (key: string, vars?: Record<string, string>) => {
        const path = (namespace ? `${namespace}.${key}` : key).split('.');
        let cur: unknown = all;
        for (const p of path) cur = (cur as Record<string, unknown>)[p];
        return String(cur).replace(/\{(\w+)\}/g, (_m, k: string) => vars?.[k] ?? '');
      };
    },
  };
});

import { getAuthSmtpConfig, queueAuthEmail, __authMailQueueIdleForTest } from './auth-mail';

const channel = (over: Partial<NotifyChannelForSend>): NotifyChannelForSend => ({
  id: 1, kind: 'email', name: 'E', isEnabled: true, minSeverity: 'Red',
  settings: { smtpHost: 'smtp.x.com', fromAddress: 'a@daidung.com.vn' },
  secretHint: '', hasSecret: false, updatedAt: '', updatedBy: '', secretEnc: null, recipients: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAuthSmtpConfig - Q6(a): kenh email id nho nhat co cau hinh hop le', () => {
  it('chon kenh id nho nhat trong 2 kenh hop le, ke ca kenh dang tat (isEnabled:false)', async () => {
    getChannelsForSendMock.mockResolvedValue([
      channel({ id: 5, isEnabled: false }),
      channel({ id: 2 }),
    ]);
    const cfg = await getAuthSmtpConfig();
    expect(cfg).toEqual({ host: 'smtp.x.com', port: 587, secure: false, user: null, pass: null, from: 'a@daidung.com.vn' });
  });

  it('bo qua kenh cau hinh thieu (bad_config), lay kenh hop le ke tiep', async () => {
    getChannelsForSendMock.mockResolvedValue([
      channel({ id: 1, settings: {} }),
      channel({ id: 2 }),
    ]);
    const cfg = await getAuthSmtpConfig();
    expect(cfg?.host).toBe('smtp.x.com');
  });

  it('khong co kenh email hop le nao -> null', async () => {
    getChannelsForSendMock.mockResolvedValue([channel({ id: 1, kind: 'webhook', settings: {} })]);
    expect(await getAuthSmtpConfig()).toBeNull();
  });
});

describe('queueAuthEmail - gui nen, khong throw, khong lo dia chi/noi dung', () => {
  const cfg = { host: 'smtp.x.com', port: 587, secure: false, user: null, pass: null, from: 'a@daidung.com.vn' };

  it('sendEmail tra ok:false -> khong throw, console.error khong chua dia chi nhan/noi dung', async () => {
    sendEmailMock.mockResolvedValue({ ok: false, error: 'smtp_error' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => queueAuthEmail(cfg, 'nguoi-nhan@daidung.com.vn', 'Chu de bi mat', 'Noi dung bi mat')).not.toThrow();
    await __authMailQueueIdleForTest();

    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      for (const arg of call) {
        const s = String(arg);
        expect(s).not.toContain('nguoi-nhan@daidung.com.vn');
        expect(s).not.toContain('Noi dung bi mat');
      }
    }
  });

  it('sendEmail nem loi -> khong throw', async () => {
    sendEmailMock.mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => queueAuthEmail(cfg, 'x@daidung.com.vn', 'S', 'T')).not.toThrow();
    await expect(__authMailQueueIdleForTest()).resolves.toBeUndefined();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signupMailer - email bao tai khoan da san sang (P3F-3)', () => {
  it('dung getAuthSmtpConfig va queueAuthEmail cua P3E', async () => {
    const { signupMailer } = await import('./auth-mail');
    expect(signupMailer.getSmtp).toBe(getAuthSmtpConfig);
    expect(signupMailer.queue).toBe(queueAuthEmail);
  });

  it('compose lay chu de + noi dung dat mat khau theo locale, co email, link va han 72 gio, KHONG co ho ten (S2)', async () => {
    const { signupMailer } = await import('./auth-mail');
    const vi1 = await signupMailer.compose('vi', 'a@daidung.vn', 'https://app.example.com/vi/dat-lai-mat-khau?token=T');
    expect(vi1.subject).toBe('Đặt mật khẩu cho tài khoản của bạn');
    expect(vi1.text).toContain('a@daidung.vn');
    expect(vi1.text).toContain('https://app.example.com/vi/dat-lai-mat-khau?token=T');
    expect(vi1.text).toContain('72 giờ');
    expect(vi1.text).not.toContain('{name}');
    const en1 = await signupMailer.compose('en', 'a@daidung.vn', 'https://app.example.com/en/dat-lai-mat-khau?token=T');
    expect(en1.subject).toBe('Set a password for your account');
    expect(en1.text).toContain('72 hours');
  });
});
