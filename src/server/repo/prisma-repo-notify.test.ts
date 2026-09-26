import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  notifyChannelFindMany, notifyChannelFindUnique, notifyChannelUpdateMany, alertLogUpdateMany, auditCreate,
} = vi.hoisted(() => ({
  notifyChannelFindMany: vi.fn(async (): Promise<unknown[]> => []),
  notifyChannelFindUnique: vi.fn(async (): Promise<unknown> => null),
  notifyChannelUpdateMany: vi.fn(async () => ({ count: 0 })),
  alertLogUpdateMany: vi.fn(async () => ({ count: 0 })),
  auditCreate: vi.fn(async (_args: unknown) => ({})),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    notifyChannel: { findMany: notifyChannelFindMany, findUnique: notifyChannelFindUnique, updateMany: notifyChannelUpdateMany },
    alertLog: { updateMany: alertLogUpdateMany },
    auditLog: { create: auditCreate },
  },
}));

import { notifyRepoPrisma, parseSettings } from './prisma-repo-notify';

beforeEach(() => {
  notifyChannelFindMany.mockClear();
  notifyChannelFindUnique.mockReset();
  notifyChannelUpdateMany.mockClear();
  alertLogUpdateMany.mockClear();
  auditCreate.mockClear();
});

describe('claimAlertNotify - updateMany dung where/data (K5 - gianh quyen gui)', () => {
  it('goi alertLog.updateMany voi where/data dung nhu ke hoach, count=1 -> true', async () => {
    alertLogUpdateMany.mockResolvedValueOnce({ count: 1 });

    const ok = await notifyRepoPrisma.claimAlertNotify(7, 2);

    expect(ok).toBe(true);
    expect(alertLogUpdateMany).toHaveBeenCalledWith({
      where: { id: 7, notifyAttempts: 2, notifySentAt: null, closedAt: null },
      data: { notifyAttempts: { increment: 1 } },
    });
  });

  it('count=0 (khong con dung dieu kien) -> false', async () => {
    alertLogUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await notifyRepoPrisma.claimAlertNotify(7, 2)).toBe(false);
  });
});

describe('listNotifyChannels - khong bao gio lo secretEnc', () => {
  it('ket qua khong co khoa secretEnc du DB co cot nay', async () => {
    notifyChannelFindMany.mockResolvedValueOnce([
      {
        id: 1, kind: 'webhook', name: 'X', isEnabled: true, minSeverity: 'Red', settings: {},
        secretHint: '••••1234', secretEnc: 'v1:a:b:c', updatedAt: new Date('2026-09-20T00:00:00.000Z'), updatedBy: 'admin',
      },
    ]);

    const list = await notifyRepoPrisma.listNotifyChannels();

    expect(list).toHaveLength(1);
    expect('secretEnc' in list[0]).toBe(false);
    expect(JSON.stringify(list)).not.toContain('v1:');
    expect(list[0].hasSecret).toBe(true);
  });
});

describe('parseSettings - chi lay dung 7 khoa da khai, sai kieu thi bo', () => {
  it("{ smtpPort: 'x', evil: 1 } -> {}", () => {
    expect(parseSettings({ smtpPort: 'x', evil: 1 })).toEqual({});
  });

  it('gia tri dung kieu duoc giu', () => {
    expect(parseSettings({ smtpPort: 587, smtpHost: 'smtp.x.com', webhookFormat: 'slack' })).toEqual({
      smtpPort: 587,
      smtpHost: 'smtp.x.com',
      webhookFormat: 'slack',
    });
  });

  it('khong phai object -> {}', () => {
    expect(parseSettings(null)).toEqual({});
    expect(parseSettings('x')).toEqual({});
  });
});
