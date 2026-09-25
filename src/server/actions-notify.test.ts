import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SECRET_KEY_ENV, openSecret } from '@/lib/secret-box';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
const { sendWebhookMock } = vi.hoisted(() => ({
  sendWebhookMock: vi.fn(async (_url: string, _body: string) => ({ ok: true }) as { ok: true }),
}));
vi.mock('@/server/notify/webhook', () => ({ sendWebhook: (url: string, body: string) => sendWebhookMock(url, body) }));

import { getCurrentUser } from '@/lib/session';
import {
  deleteNotifyChannelAction, deleteNotifyRecipientAction, saveNotifyChannelAction, saveNotifyRecipientAction,
  setNotifyChannelEnabledAction, testNotifyChannelAction,
} from '@/server/actions-notify';

const KEY_32 = Buffer.from('a'.repeat(32), 'utf8').toString('base64');

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  process.env[SECRET_KEY_ENV] = KEY_32;
});

afterEach(() => {
  delete process.env[SECRET_KEY_ENV];
});

describe('actions-notify - Forbidden cho khong phai admin', () => {
  it.each([['data-entry', dataEntry('pm@daidung.com.vn')], ['bod', BOD], ['viewer', VIEWER], ['chua dang nhap', null]] as const)(
    '%s -> Forbidden cho ca 6 action',
    async (_label, user) => {
      login(user);
      expect(await saveNotifyChannelAction({ kind: 'webhook', name: 'X', isEnabled: true, minSeverity: 'Red', secret: 'https://x.com' })).toEqual({
        ok: false,
        error: 'Forbidden',
      });
      expect(await setNotifyChannelEnabledAction(1, true)).toEqual({ ok: false, error: 'Forbidden' });
      expect(await deleteNotifyChannelAction(1)).toEqual({ ok: false, error: 'Forbidden' });
      expect(await saveNotifyRecipientAction({ channelId: 1, email: 'a@x.com', minSeverity: 'Red', isEnabled: true })).toEqual({
        ok: false,
        error: 'Forbidden',
      });
      expect(await deleteNotifyRecipientAction(1)).toEqual({ ok: false, error: 'Forbidden' });
      expect(await testNotifyChannelAction(1)).toEqual({ ok: false, error: 'Forbidden' });
    },
  );
});

describe('saveNotifyChannelAction - webhook', () => {
  it("admin tao webhook secret 'https://hooks.example.com/abcd1234' bat -> ok, khong lo URL goc", async () => {
    login(ADMIN);
    const res = await saveNotifyChannelAction({
      kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://hooks.example.com/abcd1234',
    });
    expect(res.ok).toBe(true);

    const list = await repo.listNotifyChannels();
    const ch = list.find((c) => c.id === (res as { ok: true; id: number }).id)!;
    expect(ch.secretHint).toBe('••••1234');
    expect(ch.settings.webhookHost).toBe('hooks.example.com');
    expect(JSON.stringify(list)).not.toContain('hooks.example.com/abcd1234');

    const store = (globalThis as unknown as { __ddcNotifyMock: { channels: Array<{ id: number; secretEnc: string | null }> } }).__ddcNotifyMock;
    const stored = store.channels.find((c) => c.id === ch.id)!;
    expect(stored.secretEnc).toMatch(/^v1:/);
    expect(openSecret(stored.secretEnc!)).toBe('https://hooks.example.com/abcd1234');
  });

  it("secret 'https://127.0.0.1/x' -> blocked_ip", async () => {
    login(ADMIN);
    const res = await saveNotifyChannelAction({ kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://127.0.0.1/x' });
    expect(res).toEqual({ ok: false, error: 'blocked_ip' });
  });

  it("secret 'http://x.com' -> bad_protocol", async () => {
    login(ADMIN);
    const res = await saveNotifyChannelAction({ kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'http://x.com' });
    expect(res).toEqual({ ok: false, error: 'bad_protocol' });
  });

  it('bat kenh webhook khong bi mat -> secret_required', async () => {
    login(ADMIN);
    const res = await saveNotifyChannelAction({ kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: '' });
    expect(res).toEqual({ ok: false, error: 'secret_required' });
  });

  it('thieu env khoa -> secret_key_missing', async () => {
    login(ADMIN);
    delete process.env[SECRET_KEY_ENV];
    const res = await saveNotifyChannelAction({ kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://hooks.example.com/x' });
    expect(res).toEqual({ ok: false, error: 'secret_key_missing' });
  });

  it("sua kenh voi secret='' -> bi mat giu nguyen", async () => {
    login(ADMIN);
    const created = (await saveNotifyChannelAction({
      kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://hooks.example.com/abcd1234',
    })) as { ok: true; id: number };

    const res = await saveNotifyChannelAction({ id: created.id, kind: 'webhook', name: 'Doi ten', isEnabled: true, minSeverity: 'Red', secret: '' });
    expect(res).toEqual({ ok: true, id: created.id });
    const ch = (await repo.listNotifyChannels()).find((c) => c.id === created.id)!;
    expect(ch.name).toBe('Doi ten');
    expect(ch.secretHint).toBe('••••1234');
  });

  it("doi kind khi sua -> Invalid input", async () => {
    login(ADMIN);
    const created = (await saveNotifyChannelAction({
      kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://hooks.example.com/x',
    })) as { ok: true; id: number };

    const res = await saveNotifyChannelAction({
      id: created.id, kind: 'email', name: 'W', isEnabled: false, minSeverity: 'Red', smtpHost: 'smtp.x.com', smtpPort: 587, smtpSecure: false, smtpUser: '', fromAddress: 'a@x.com',
    });
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('id 999 (khong ton tai) -> Not found', async () => {
    login(ADMIN);
    const res = await saveNotifyChannelAction({ id: 999, kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://x.com/y' });
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });
});

describe('saveNotifyChannelAction - email', () => {
  it("smtpUser 'u' khong mat khau + bat -> secret_required", async () => {
    login(ADMIN);
    const res = await saveNotifyChannelAction({
      kind: 'email', name: 'E', isEnabled: true, minSeverity: 'Red', secret: '',
      smtpHost: 'smtp.example.com', smtpPort: 587, smtpSecure: false, smtpUser: 'u', fromAddress: 'a@daidung.com.vn',
    });
    expect(res).toEqual({ ok: false, error: 'secret_required' });
  });

  it("co mat khau 'Pa55word' -> hint '••••••' (khong chua 'word')", async () => {
    login(ADMIN);
    const res = await saveNotifyChannelAction({
      kind: 'email', name: 'E', isEnabled: true, minSeverity: 'Red', secret: 'Pa55word',
      smtpHost: 'smtp.example.com', smtpPort: 587, smtpSecure: false, smtpUser: 'u', fromAddress: 'a@daidung.com.vn',
    }) as { ok: true; id: number };

    const ch = (await repo.listNotifyChannels()).find((c) => c.id === res.id)!;
    expect(ch.secretHint).toBe('••••••');
    expect(ch.secretHint).not.toContain('word');
  });

  it("smtpHost 'localhost' -> blocked_ip", async () => {
    login(ADMIN);
    const res = await saveNotifyChannelAction({
      kind: 'email', name: 'E', isEnabled: false, minSeverity: 'Red', secret: '',
      smtpHost: 'localhost', smtpPort: 587, smtpSecure: false, smtpUser: '', fromAddress: 'a@daidung.com.vn',
    });
    expect(res).toEqual({ ok: false, error: 'blocked_ip' });
  });
});

describe('saveNotifyRecipientAction', () => {
  it('them vao kenh webhook -> wrong_kind', async () => {
    login(ADMIN);
    const ch = (await saveNotifyChannelAction({ kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://x.com/y' })) as {
      ok: true;
      id: number;
    };
    const res = await saveNotifyRecipientAction({ channelId: ch.id, email: 'a@x.com', minSeverity: 'Red', isEnabled: true });
    expect(res).toEqual({ ok: false, error: 'wrong_kind' });
  });

  it('trung email -> duplicate', async () => {
    login(ADMIN);
    const ch = (await saveNotifyChannelAction({
      kind: 'email', name: 'E', isEnabled: false, minSeverity: 'Red', secret: '',
      smtpHost: 'smtp.x.com', smtpPort: 587, smtpSecure: false, smtpUser: '', fromAddress: 'a@x.com',
    })) as { ok: true; id: number };
    await saveNotifyRecipientAction({ channelId: ch.id, email: 'a@x.com', minSeverity: 'Red', isEnabled: true });
    const res = await saveNotifyRecipientAction({ channelId: ch.id, email: 'a@x.com', minSeverity: 'Red', isEnabled: true });
    expect(res).toEqual({ ok: false, error: 'duplicate' });
  });

  it('email sai dinh dang -> Invalid input', async () => {
    login(ADMIN);
    const res = await saveNotifyRecipientAction({ channelId: 1, email: 'khong-phai-email', minSeverity: 'Red', isEnabled: true });
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });
});

describe('testNotifyChannelAction', () => {
  it('ok, sender duoc goi 1 lan voi payload co TEST', async () => {
    login({ ...ADMIN, email: 'admin-test1@daidung.com.vn' });
    const ch = (await saveNotifyChannelAction({ kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://x.com/y' })) as {
      ok: true;
      id: number;
    };
    sendWebhookMock.mockClear();

    const res = await testNotifyChannelAction(ch.id);

    expect(res).toEqual({ ok: true });
    expect(sendWebhookMock).toHaveBeenCalledTimes(1);
    expect(sendWebhookMock.mock.calls[0][1]).toContain('TEST');
  });

  it('goi 6 lan lien tiep -> lan 6 rate_limited', async () => {
    // Email rieng (moi test dung 1 bucket rate-limit rieng - bo nho trong tien trinh, khong reset).
    login({ ...ADMIN, email: 'admin-test2@daidung.com.vn' });
    const ch = (await saveNotifyChannelAction({ kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://x.com/y' })) as {
      ok: true;
      id: number;
    };
    for (let i = 0; i < 5; i++) await testNotifyChannelAction(ch.id);
    const res = await testNotifyChannelAction(ch.id);
    expect(res).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('kenh khong ton tai -> Not found', async () => {
    // Email rieng de khong dung chung bucket rate-limit voi test "goi 6 lan lien tiep" o tren
    // (rateLimit la bo nho trong tien trinh, khong reset theo repo.reset()).
    login({ ...ADMIN, email: 'admin2@daidung.com.vn' });
    const res = await testNotifyChannelAction(999);
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });
});

describe('khong action nao lo bi mat (v1:) trong ket qua tra ve', () => {
  it('saveNotifyChannelAction khong lo v1: trong response', async () => {
    login(ADMIN);
    const res = await saveNotifyChannelAction({ kind: 'webhook', name: 'W', isEnabled: true, minSeverity: 'Red', secret: 'https://hooks.example.com/x' });
    expect(JSON.stringify(res)).not.toContain('v1:');
  });
});
