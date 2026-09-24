import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('@/server/db', () => ({
  prisma: {
    factDailyManpower: { findMany },
    shift: { findMany: vi.fn() },
  },
}));

import { entryPrismaRepo } from './prisma-repo-entry';

beforeEach(() => {
  findMany.mockReset();
});

describe('prisma-repo-entry.getDailyManpowerByShift', () => {
  it('goi findMany voi workDate gte/lte 00:00Z va map workDate ve YYYY-MM-DD', async () => {
    findMany.mockResolvedValueOnce([
      {
        projectId: 1, contractorId: 1, workDate: new Date('2026-09-16T00:00:00.000Z'),
        shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4,
      },
    ]);

    const rows = await entryPrismaRepo.getDailyManpowerByShift(1, '2026-09-16', '2026-09-16');

    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: 1, workDate: { gte: new Date('2026-09-16T00:00:00.000Z'), lte: new Date('2026-09-16T00:00:00.000Z') } },
      orderBy: [{ workDate: 'asc' }, { contractorId: 'asc' }, { shift: { sortOrder: 'asc' } }],
    });
    expect(rows).toEqual([
      { projectId: 1, contractorId: 1, workDate: '2026-09-16', shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
    ]);
  });
});
