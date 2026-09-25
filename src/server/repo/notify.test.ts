import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from './mock-repo';
import type { NewEngineAlert, NotifyChannelInput } from './types';

/**
 * Task 4 (P3B) - repo kênh/người nhận thông báo (mock). Kho ở `globalThis.__ddcNotifyMock`
 * (tách khỏi RepoData - K10), `repo.reset()` phải xoá luôn.
 */

// projectId gia (khong ton tai trong seed) de tranh dedupe trung voi alert seed co san.
const candidate = (over: Partial<NewEngineAlert> = {}): NewEngineAlert => ({
  projectId: 999001,
  ruleCode: 'spi_low',
  alertType: 'Red',
  ruleTriggered: 'SPI thấp',
  message: 'SPI 0.8',
  dedupeKey: `spi_low:${Math.random()}`,
  owner: 'BOD',
  deadline: '2026-09-30',
  openedAt: new Date().toISOString(),
  ...over,
});

const WEBHOOK_INPUT: NotifyChannelInput = {
  kind: 'webhook',
  name: 'Webhook 1',
  isEnabled: true,
  minSeverity: 'Red',
  settings: { webhookFormat: 'generic' },
  secret: { enc: 'v1:a:b:c', hint: '••••1234' },
};

const EMAIL_INPUT: NotifyChannelInput = {
  kind: 'email',
  name: 'Email 1',
  isEnabled: true,
  minSeverity: 'Amber',
  settings: { smtpHost: 'smtp.example.com', smtpPort: 587, fromAddress: 'noreply@daidung.com.vn' },
};

beforeEach(() => repo.reset());

describe('saveNotifyChannel / listNotifyChannels - bi mat khong lo qua repo', () => {
  it('tao kenh webhook co secret -> hasSecret true, secretHint dung, KHONG co secretEnc, khong lo v1:', () => {
    const res = repo.saveNotifyChannel(WEBHOOK_INPUT, 'admin@daidung.com.vn');
    expect(res).not.toBe('not_found');

    const list = repo.listNotifyChannels();
    expect(list).toHaveLength(1);
    expect(list[0].hasSecret).toBe(true);
    expect(list[0].secretHint).toBe('••••1234');
    expect('secretEnc' in list[0]).toBe(false);
    expect(JSON.stringify(list)).not.toContain('v1:');
  });

  it("sua kenh voi secret=undefined (khong dua vao input) -> giu bi mat cu", () => {
    const created = repo.saveNotifyChannel(WEBHOOK_INPUT, 'admin@daidung.com.vn') as { id: number };
    repo.saveNotifyChannel({ ...WEBHOOK_INPUT, id: created.id, name: 'Doi ten', secret: undefined }, 'admin@daidung.com.vn');

    const ch = repo.listNotifyChannels().find((c) => c.id === created.id)!;
    expect(ch.name).toBe('Doi ten');
    expect(ch.hasSecret).toBe(true);
    expect(ch.secretHint).toBe('••••1234');
  });

  it('sua kenh voi secret=null -> xoa bi mat (hasSecret false)', () => {
    const created = repo.saveNotifyChannel(WEBHOOK_INPUT, 'admin@daidung.com.vn') as { id: number };
    repo.saveNotifyChannel({ ...WEBHOOK_INPUT, id: created.id, secret: null }, 'admin@daidung.com.vn');

    const ch = repo.listNotifyChannels().find((c) => c.id === created.id)!;
    expect(ch.hasSecret).toBe(false);
  });

  it('sua kenh id khong ton tai -> not_found', () => {
    expect(repo.saveNotifyChannel({ ...WEBHOOK_INPUT, id: 999 }, 'admin@daidung.com.vn')).toBe('not_found');
  });

  it('audit co dong notify_channel/secret voi newValue la hint, khong dong nao chua v1:', () => {
    repo.saveNotifyChannel(WEBHOOK_INPUT, 'admin@daidung.com.vn');
    const auditLog = repo.getAuditLog();
    const secretRow = auditLog.find((a) => a.tableName === 'notify_channel' && a.field === 'secret');
    expect(secretRow?.newValue).toBe('••••1234');
    expect(auditLog.some((a) => a.newValue.includes('v1:') || a.oldValue.includes('v1:'))).toBe(false);
  });
});

describe('saveNotifyRecipient / deleteNotifyChannel', () => {
  it('email lowercase trim khi luu', () => {
    const ch = repo.saveNotifyChannel(EMAIL_INPUT, 'admin@daidung.com.vn') as { id: number };
    const res = repo.saveNotifyRecipient({ channelId: ch.id, email: 'A@X.COM ', minSeverity: 'Red', isEnabled: true }, 'admin@daidung.com.vn');
    expect(res).not.toBe('not_found');
    expect(repo.getNotifyRecipients(ch.id)[0].email).toBe('a@x.com');
  });

  it('them lai cung email -> duplicate', () => {
    const ch = repo.saveNotifyChannel(EMAIL_INPUT, 'admin@daidung.com.vn') as { id: number };
    repo.saveNotifyRecipient({ channelId: ch.id, email: 'a@x.com', minSeverity: 'Red', isEnabled: true }, 'admin@daidung.com.vn');
    const dup = repo.saveNotifyRecipient({ channelId: ch.id, email: 'a@x.com', minSeverity: 'Red', isEnabled: true }, 'admin@daidung.com.vn');
    expect(dup).toBe('duplicate');
  });

  it('them nguoi nhan vao kenh webhook -> wrong_kind', () => {
    const ch = repo.saveNotifyChannel(WEBHOOK_INPUT, 'admin@daidung.com.vn') as { id: number };
    const res = repo.saveNotifyRecipient({ channelId: ch.id, email: 'a@x.com', minSeverity: 'Red', isEnabled: true }, 'admin@daidung.com.vn');
    expect(res).toBe('wrong_kind');
  });

  it('xoa kenh -> nguoi nhan cua kenh bien mat', () => {
    const ch = repo.saveNotifyChannel(EMAIL_INPUT, 'admin@daidung.com.vn') as { id: number };
    repo.saveNotifyRecipient({ channelId: ch.id, email: 'a@x.com', minSeverity: 'Red', isEnabled: true }, 'admin@daidung.com.vn');
    expect(repo.deleteNotifyChannel(ch.id, 'admin@daidung.com.vn')).toBe(true);
    expect(repo.getNotifyRecipients(ch.id)).toHaveLength(0);
    expect(repo.listNotifyChannels()).toHaveLength(0);
  });
});

describe('claimAlertNotify / finishAlertNotify / getAlertsForNotifyRetry', () => {
  it('claim lan 1 (attempts=0) -> true; lan 2 van goi expected 0 -> false', () => {
    const [id] = repo.insertEngineAlertsReturningIds([candidate()]);
    expect(repo.claimAlertNotify(id, 0)).toBe(true);
    expect(repo.claimAlertNotify(id, 0)).toBe(false); // attempts da tang len 1
  });

  it('alert da dong -> claim false', () => {
    const [id] = repo.insertEngineAlertsReturningIds([candidate()]);
    repo.closeAlert(id, 'Da xu ly', 'tester');
    expect(repo.claimAlertNotify(id, 0)).toBe(false);
  });

  it('finishAlertNotify ghi du 3 cot', () => {
    const [id] = repo.insertEngineAlertsReturningIds([candidate()]);
    repo.claimAlertNotify(id, 0);
    repo.finishAlertNotify(id, { sentChannels: 'webhook:1', sentAt: '2026-09-20T00:00:00.000Z', error: null });
    const [alert] = repo.getAlertsByIds([id]);
    expect(alert).toMatchObject({ notifyChannel: 'webhook:1', notifySentAt: '2026-09-20T00:00:00.000Z', notifyError: null });
  });

  it('getAlertsForNotifyRetry chi tra alert mo, chua gui, attempts 1..maxAttempts-1, trong cua so', () => {
    const since = '2020-01-01T00:00:00.000Z';
    const [okId] = repo.insertEngineAlertsReturningIds([candidate({ dedupeKey: 'retry-ok' })]);
    repo.claimAlertNotify(okId, 0); // attempts=1

    const [maxedId] = repo.insertEngineAlertsReturningIds([candidate({ dedupeKey: 'retry-maxed' })]);
    repo.claimAlertNotify(maxedId, 0);
    repo.claimAlertNotify(maxedId, 1);
    repo.claimAlertNotify(maxedId, 2); // attempts=3 = maxAttempts, khong duoc tra ve

    const [sentId] = repo.insertEngineAlertsReturningIds([candidate({ dedupeKey: 'retry-sent' })]);
    repo.claimAlertNotify(sentId, 0);
    repo.finishAlertNotify(sentId, { sentChannels: 'webhook:1', sentAt: new Date().toISOString(), error: null });

    const [neverQueuedId] = repo.insertEngineAlertsReturningIds([candidate({ dedupeKey: 'retry-never' })]);
    void neverQueuedId; // attempts=0, chua tung xep hang -> khong duoc tra ve

    const retry = repo.getAlertsForNotifyRetry(3, since, 10);
    const ids = retry.map((a) => a.id);
    expect(ids).toContain(okId);
    expect(ids).not.toContain(maxedId);
    expect(ids).not.toContain(sentId);
    expect(ids).not.toContain(neverQueuedId);
  });
});

describe('repo.reset() xoa kho kenh thong bao', () => {
  it('sau reset() khong con kenh nao', () => {
    repo.saveNotifyChannel(WEBHOOK_INPUT, 'admin@daidung.com.vn');
    expect(repo.listNotifyChannels().length).toBeGreaterThan(0);
    repo.reset();
    expect(repo.listNotifyChannels()).toHaveLength(0);
  });
});

describe('insertEngineAlertsReturningIds', () => {
  it('tra mang id co trong getAlerts(), goi lai lan 2 tra []', () => {
    // 2 du an khac nhau de khong dinh luat "dang co alert MO cung (projectId, ruleCode)" (K6).
    const rows = [candidate({ dedupeKey: 'ids-test-1' }), candidate({ dedupeKey: 'ids-test-2', projectId: 999002 })];
    const ids = repo.insertEngineAlertsReturningIds(rows);
    expect(ids).toHaveLength(2);
    const allIds = repo.getAlerts().map((a) => a.id);
    for (const id of ids) expect(allIds).toContain(id);

    const second = repo.insertEngineAlertsReturningIds(rows); // dedupeKey trung -> khong tao them
    expect(second).toEqual([]);
  });
});
