import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sealSecret, SECRET_KEY_ENV } from '@/lib/secret-box';
import { testNotice } from '@/lib/notify-message';
import type { NewEngineAlert, NotifyChannelForSend, NotifyChannelInput } from '@/server/repo/types';
import type { SendResult } from './types';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
// runAlertEngine (khong tiem duoc deps) dung sendWebhook mac dinh cua module - mock tha de kiem
// tich hop hang doi ma khong ra mang that.
const sendWebhookModuleMock = vi.fn(async (): Promise<SendResult> => ({ ok: true }));
vi.mock('@/server/notify/webhook', () => ({ sendWebhook: (...args: unknown[]) => sendWebhookModuleMock(...(args as [])) }));

import { repo } from '@/server/repo/mock-repo';
import {
  dispatchAlertNotifications, retryPendingNotifications, sendToChannel, smtpConfigFromChannel, queueAlertNotifications, __notifyQueueIdleForTest,
} from './dispatch';
import { runAlertEngine, runAlertEngineSafe } from '@/server/alert-engine';

const KEY_32 = Buffer.from('a'.repeat(32), 'utf8').toString('base64');
const KEY_32_OTHER = Buffer.from('b'.repeat(32), 'utf8').toString('base64');

let projectSeq = 900000;
function candidate(over: Partial<NewEngineAlert> = {}): NewEngineAlert {
  projectSeq += 1;
  return {
    projectId: projectSeq,
    ruleCode: 'spi_low',
    alertType: 'Red',
    ruleTriggered: 'SPI thấp',
    message: 'SPI 0.8',
    dedupeKey: `spi_low:${projectSeq}`,
    owner: 'BOD',
    deadline: '2026-09-30',
    openedAt: new Date().toISOString(),
    ...over,
  };
}

const webhookChannel = (over: Partial<NotifyChannelInput> = {}): NotifyChannelInput => ({
  kind: 'webhook',
  name: 'Webhook',
  isEnabled: true,
  minSeverity: 'Red',
  settings: {},
  secret: { enc: sealSecret('https://hooks.example.com/x'), hint: '••••x' },
  ...over,
});

beforeEach(() => {
  repo.reset();
  process.env[SECRET_KEY_ENV] = KEY_32;
  sendWebhookModuleMock.mockClear();
  sendWebhookModuleMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  delete process.env[SECRET_KEY_ENV];
  vi.clearAllMocks();
});

describe('dispatchAlertNotifications', () => {
  it('webhook OK -> sent 1, ghi day du notify*; goi lai cung id -> skipped, sender khong goi them', async () => {
    const ch = repo.saveNotifyChannel(webhookChannel({ minSeverity: 'Amber' }), 'admin@daidung.com.vn') as { id: number };
    const [alertId] = repo.insertEngineAlertsReturningIds([candidate({ alertType: 'Red' })]);
    const sendWebhookFake = vi.fn(async (): Promise<SendResult> => ({ ok: true }));

    const stats = await dispatchAlertNotifications([alertId], { sendWebhook: sendWebhookFake });
    expect(stats).toEqual({ sent: 1, failed: 0, skipped: 0 });

    const [alert] = repo.getAlertsByIds([alertId]);
    expect(alert.notifySentAt).not.toBeNull();
    expect(alert.notifyChannel).toBe(`webhook:${ch.id}`);
    expect(alert.notifyAttempts).toBe(1);
    expect(alert.notifyError).toBeNull();

    const stats2 = await dispatchAlertNotifications([alertId], { sendWebhook: sendWebhookFake });
    expect(stats2).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(sendWebhookFake).toHaveBeenCalledTimes(1);
  });

  it("kenh minSeverity 'Red' + alert Amber -> skipped, attempts van 0", async () => {
    repo.saveNotifyChannel(webhookChannel({ minSeverity: 'Red' }), 'admin@daidung.com.vn');
    const [alertId] = repo.insertEngineAlertsReturningIds([candidate({ alertType: 'Amber' })]);
    const sendWebhookFake = vi.fn(async (): Promise<SendResult> => ({ ok: true }));

    const stats = await dispatchAlertNotifications([alertId], { sendWebhook: sendWebhookFake });

    expect(stats).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(sendWebhookFake).not.toHaveBeenCalled();
    expect(repo.getAlertsByIds([alertId])[0].notifyAttempts).toBe(0);
  });

  it('alert da dong truoc khi gui -> skipped, sender khong goi', async () => {
    repo.saveNotifyChannel(webhookChannel(), 'admin@daidung.com.vn');
    const [alertId] = repo.insertEngineAlertsReturningIds([candidate({ alertType: 'Red' })]);
    repo.closeAlert(alertId, 'Đã xử lý', 'tester');
    const sendWebhookFake = vi.fn(async (): Promise<SendResult> => ({ ok: true }));

    const stats = await dispatchAlertNotifications([alertId], { sendWebhook: sendWebhookFake });

    expect(stats).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(sendWebhookFake).not.toHaveBeenCalled();
  });

  it('khong kenh nao bat -> {0,0,alertIds.length} ngay, khong doc alert', async () => {
    const [alertId] = repo.insertEngineAlertsReturningIds([candidate({ alertType: 'Red' })]);
    const stats = await dispatchAlertNotifications([alertId]);
    expect(stats).toEqual({ sent: 0, failed: 0, skipped: 1 });
  });

  it('2 kenh: webhook OK + email loi -> notifyChannel chi co webhook, sentAt null', async () => {
    const wh = repo.saveNotifyChannel(webhookChannel(), 'admin@daidung.com.vn') as { id: number };
    const em = repo.saveNotifyChannel(
      { kind: 'email', name: 'Email', isEnabled: true, minSeverity: 'Red', settings: { smtpHost: 'smtp.x.com', fromAddress: 'a@daidung.com.vn' } },
      'admin@daidung.com.vn',
    ) as { id: number };
    repo.saveNotifyRecipient({ channelId: em.id, email: 'r@x.com', minSeverity: 'Red', isEnabled: true }, 'admin@daidung.com.vn');
    const [alertId] = repo.insertEngineAlertsReturningIds([candidate({ alertType: 'Red' })]);

    const sendWebhookFake = vi.fn(async (): Promise<SendResult> => ({ ok: true }));
    const sendEmailFake = vi.fn(async (): Promise<SendResult> => ({ ok: false, error: 'smtp_auth' }));

    const stats = await dispatchAlertNotifications([alertId], { sendWebhook: sendWebhookFake, sendEmail: sendEmailFake });

    expect(stats).toEqual({ sent: 0, failed: 1, skipped: 0 });
    const [alert] = repo.getAlertsByIds([alertId]);
    expect(alert.notifyChannel).toBe(`webhook:${wh.id}`);
    expect(alert.notifySentAt).toBeNull();
    expect(alert.notifyError).toBe(`email:${em.id}=smtp_auth`);

    sendWebhookFake.mockClear();
    sendEmailFake.mockClear();
    await retryPendingNotifications({ sendWebhook: sendWebhookFake, sendEmail: sendEmailFake });
    expect(sendWebhookFake).not.toHaveBeenCalled();
    expect(sendEmailFake).toHaveBeenCalledTimes(1);
  });

  it('secretEnc hong (doi khoa sau khi seal) -> notifyError chua secret_decrypt_failed, khong lo v1:', async () => {
    repo.saveNotifyChannel(webhookChannel(), 'admin@daidung.com.vn');
    const [alertId] = repo.insertEngineAlertsReturningIds([candidate({ alertType: 'Red' })]);
    process.env[SECRET_KEY_ENV] = KEY_32_OTHER;

    const stats = await dispatchAlertNotifications([alertId], { sendWebhook: vi.fn() });

    expect(stats).toEqual({ sent: 0, failed: 1, skipped: 0 });
    const [alert] = repo.getAlertsByIds([alertId]);
    expect(alert.notifyError).toContain('secret_decrypt_failed');
    expect(alert.notifyError).not.toContain('v1:');
  });
});

describe('retryPendingNotifications - toi da 3 lan thu', () => {
  it('webhook timeout lien tuc: 3 lan thu roi dung, lan 4 sender khong bi goi', async () => {
    const ch = repo.saveNotifyChannel(webhookChannel(), 'admin@daidung.com.vn') as { id: number };
    const [alertId] = repo.insertEngineAlertsReturningIds([candidate({ alertType: 'Red' })]);
    const sendWebhookFake = vi.fn(async (): Promise<SendResult> => ({ ok: false, error: 'timeout' }));

    await dispatchAlertNotifications([alertId], { sendWebhook: sendWebhookFake });
    let [alert] = repo.getAlertsByIds([alertId]);
    expect(alert.notifyAttempts).toBe(1);
    expect(alert.notifyError).toBe(`webhook:${ch.id}=timeout`);

    await retryPendingNotifications({ sendWebhook: sendWebhookFake });
    await retryPendingNotifications({ sendWebhook: sendWebhookFake });
    [alert] = repo.getAlertsByIds([alertId]);
    expect(alert.notifyAttempts).toBe(3);

    sendWebhookFake.mockClear();
    await retryPendingNotifications({ sendWebhook: sendWebhookFake });
    expect(sendWebhookFake).not.toHaveBeenCalled();
  });
});

describe('smtpConfigFromChannel', () => {
  const baseChannel = (over: Partial<NotifyChannelForSend> = {}): NotifyChannelForSend => ({
    id: 1, kind: 'email', name: 'E', isEnabled: true, minSeverity: 'Red',
    settings: { smtpHost: 'smtp.x.com', fromAddress: 'a@daidung.com.vn' },
    secretHint: '', hasSecret: false, updatedAt: '', updatedBy: '', secretEnc: null, recipients: [],
    ...over,
  });

  it('thieu smtpHost hoac fromAddress -> bad_config', () => {
    expect(smtpConfigFromChannel(baseChannel({ settings: { fromAddress: 'a@daidung.com.vn' } }))).toEqual({ ok: false, error: 'bad_config' });
    expect(smtpConfigFromChannel(baseChannel({ settings: { smtpHost: 'smtp.x.com' } }))).toEqual({ ok: false, error: 'bad_config' });
  });

  it('secretEnc thieu khoa giai ma -> secret_key_missing', () => {
    const ch = baseChannel({ secretEnc: sealSecret('mat-khau-smtp') });
    delete process.env[SECRET_KEY_ENV];
    expect(smtpConfigFromChannel(ch)).toEqual({ ok: false, error: 'secret_key_missing' });
  });

  it('secretEnc hong (doi khoa) -> secret_decrypt_failed', () => {
    const ch = baseChannel({ secretEnc: sealSecret('mat-khau-smtp') });
    process.env[SECRET_KEY_ENV] = KEY_32_OTHER;
    expect(smtpConfigFromChannel(ch)).toEqual({ ok: false, error: 'secret_decrypt_failed' });
  });

  it('du cau hinh -> cfg dung, port mac dinh 587, secure mac dinh false', () => {
    const ch = baseChannel();
    const res = smtpConfigFromChannel(ch);
    expect(res).toEqual({
      ok: true,
      cfg: { host: 'smtp.x.com', port: 587, secure: false, user: null, pass: null, from: 'a@daidung.com.vn' },
    });
  });
});

describe('sendToChannel', () => {
  it('email khong co nguoi nhan hop le -> no_recipients', async () => {
    const ch: NotifyChannelForSend = {
      id: 1, kind: 'email', name: 'E', isEnabled: true, minSeverity: 'Red',
      settings: { smtpHost: 'smtp.x.com', fromAddress: 'a@daidung.com.vn' },
      secretHint: '', hasSecret: false, updatedAt: '', updatedBy: '', secretEnc: null, recipients: [],
    };
    const res = await sendToChannel(ch, testNotice(undefined), {});
    expect(res).toEqual({ ok: false, error: 'no_recipients' });
  });

  it("severityFilter=false: nguoi nhan minSeverity 'Red' + notice 'Amber' -> van gui", async () => {
    const sendEmailFake = vi.fn(async (): Promise<SendResult> => ({ ok: true }));
    const ch: NotifyChannelForSend = {
      id: 1, kind: 'email', name: 'E', isEnabled: true, minSeverity: 'Red',
      settings: { smtpHost: 'smtp.x.com', fromAddress: 'a@daidung.com.vn' },
      secretHint: '', hasSecret: false, updatedAt: '', updatedBy: '', secretEnc: null,
      recipients: [{ id: 1, channelId: 1, email: 'r@x.com', minSeverity: 'Red', isEnabled: true }],
    };
    const notice = testNotice(undefined); // severity 'Amber'

    const res = await sendToChannel(ch, notice, { sendEmail: sendEmailFake }, false);

    expect(res).toEqual({ ok: true });
    expect(sendEmailFake).toHaveBeenCalledTimes(1);
  });
});

describe('Tich hop voi alert-engine + hang doi nen', () => {
  const LAST_SEED_DAY = '2026-09-16'; // = today (DDC_FAKE_TODAY)

  it('runAlertEngine tao alert moi -> queueAlertNotifications gui nen -> alert co notifySentAt sau khi hang doi xong', async () => {
    // manpower_low la Amber (src/lib/alert-rules.ts) - kenh phai nhan ca Amber.
    repo.saveNotifyChannel(webhookChannel({ minSeverity: 'Amber' }), 'admin@daidung.com.vn');

    // Ha manpower ngay cuoi seed cua du an 1 xuong ~50% de chac chan co alert manpower_low moi (Amber).
    const rows = repo.getDailyManpowerByShift(1, LAST_SEED_DAY, LAST_SEED_DAY);
    repo.saveDailyResources(
      1, LAST_SEED_DAY,
      { manpower: rows.map((r) => ({ contractorId: r.contractorId, shiftCode: r.shiftCode, plannedHeadcount: r.plannedHeadcount, actualHeadcount: Math.round(r.actualHeadcount / 2) })), equipment: [] },
      'system', '',
    );

    const result = await runAlertEngine({ projectIds: [1] });
    expect(result.createdIds.length).toBeGreaterThan(0);

    await __notifyQueueIdleForTest();

    const sent = repo.getAlertsByIds(result.createdIds).filter((a) => a.notifySentAt != null);
    expect(sent.length).toBeGreaterThan(0);
  });

  it('runAlertEngineSafe van resolve du sender nem loi', async () => {
    repo.saveNotifyChannel(webhookChannel({ minSeverity: 'Amber' }), 'admin@daidung.com.vn');
    sendWebhookModuleMock.mockRejectedValue(new Error('boom'));

    await expect(runAlertEngineSafe(1)).resolves.toBeUndefined();
    await __notifyQueueIdleForTest();
  });
});

describe('queueAlertNotifications', () => {
  it('mang rong -> khong lam gi', () => {
    expect(() => queueAlertNotifications([])).not.toThrow();
  });
});
