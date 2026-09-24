import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock thang @/server/db (giong prisma-repo-reset.test.ts) - khong dung DB Postgres dev that.
 */
const { auditLogCount, auditLogFindMany } = vi.hoisted(() => ({
  auditLogCount: vi.fn(async () => 0),
  auditLogFindMany: vi.fn(async () => [] as unknown[]),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    auditLog: { count: auditLogCount, findMany: auditLogFindMany },
  },
}));

import { getAuditLogPage } from './audit-log-page';

const NOW = new Date('2026-09-24T00:00:00Z');

beforeEach(() => {
  auditLogCount.mockClear();
  auditLogFindMany.mockClear();
});

describe('getAuditLogPage', () => {
  it('count=45, page=2, range 14d: goi findMany dung where.changedAt.gte, orderBy, skip 20 take 20', async () => {
    auditLogCount.mockResolvedValueOnce(45);
    auditLogFindMany.mockResolvedValueOnce([]);

    const r = await getAuditLogPage({ page: 2, range: '14d', now: NOW });

    expect(auditLogCount).toHaveBeenCalledWith({ where: { changedAt: { gte: new Date('2026-09-10T00:00:00Z') } } });
    expect(auditLogFindMany).toHaveBeenCalledWith({
      where: { changedAt: { gte: new Date('2026-09-10T00:00:00Z') } },
      orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
      skip: 20,
      take: 20,
    });
    expect(r.total).toBe(45);
    expect(r.page).toBe(2);
    expect(r.totalPages).toBe(3);
    expect(r.pageSize).toBe(20);
  });

  it('count=45, page=99 (vuot qua) -> kep ve page 3, skip 40', async () => {
    auditLogCount.mockResolvedValueOnce(45);
    auditLogFindMany.mockResolvedValueOnce([]);

    const r = await getAuditLogPage({ page: 99, range: '14d', now: NOW });

    expect(r.page).toBe(3);
    expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40 }));
  });

  it('count=0 -> page 1, totalPages 1', async () => {
    auditLogCount.mockResolvedValueOnce(0);
    auditLogFindMany.mockResolvedValueOnce([]);

    const r = await getAuditLogPage({ page: 1, range: '14d', now: NOW });

    expect(r.page).toBe(1);
    expect(r.totalPages).toBe(1);
  });

  it('range "all" -> where rong (khong loc theo changedAt)', async () => {
    auditLogCount.mockResolvedValueOnce(0);
    auditLogFindMany.mockResolvedValueOnce([]);

    await getAuditLogPage({ page: 1, range: 'all', now: NOW });

    expect(auditLogCount).toHaveBeenCalledWith({ where: {} });
    expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});
