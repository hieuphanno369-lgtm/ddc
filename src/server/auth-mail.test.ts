import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotifyChannelForSend } from '@/server/repo/types';

const { getChannelsForSendMock } = vi.hoisted(() => ({ getChannelsForSendMock: vi.fn() }));
vi.mock('@/server/repo', () => ({ repo: { getChannelsForSend: getChannelsForSendMock } }));

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock('./notify/email', () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

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
