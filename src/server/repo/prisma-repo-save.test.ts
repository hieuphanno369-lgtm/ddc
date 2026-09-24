import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Task 3 (P1A) - saveMonthlyFact/saveFinancial phải tạo được dòng mới (carry-forward từ tháng
 * trước) khi dự án CHƯA có dòng fact/tài chính nào của tháng đang lưu, thay vì bỏ qua im lặng.
 * Mock thẳng `@/server/db` để không đụng DB Postgres dev thật (giống prisma-repo-reset.test.ts).
 */

const CURRENT_YM = '2026-10';
const PREV_YM = '2026-09';

const baselineFact = {
  projectId: 1, yearMonth: PREV_YM, version: 3, isLatest: true,
  pctPlan: 0.4, pctActual: 0.35, actualStartDate: null, actualFinishDate: null,
  bac: 100, pv: 40, ev: 35, ac: 30, spi: null, cpi: null, bottleneckStage: null,
  manpowerPlanned: 10, manpowerActual: 8, equipmentPlanned: 5, equipmentActual: 4,
  snapshotLockedAt: null, lockedBy: null, changedBy: 'system', changedAt: new Date(), changeNote: '',
};

const {
  factFindFirst, factCreate, factUpdateMany, projectFindUnique, projectUpdate, transactionCalls,
  financialFindFirst, financialCreate, financialUpdateMany,
} = vi.hoisted(() => ({
  factFindFirst: vi.fn(),
  factCreate: vi.fn(async (args: unknown) => args),
  factUpdateMany: vi.fn(async () => ({ count: 0 })),
  projectFindUnique: vi.fn(async () => ({ id: 1, contractValue: 100, plannedStartDate: null, plannedFinishDate: null, actualStartDate: null, actualFinishDate: null })),
  projectUpdate: vi.fn(async () => ({})),
  transactionCalls: [] as unknown[][],
  financialFindFirst: vi.fn(),
  financialCreate: vi.fn(async (args: unknown) => args),
  financialUpdateMany: vi.fn(async () => ({ count: 0 })),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    project: { findUnique: projectFindUnique, update: projectUpdate },
    factProgressMonthly: { findFirst: factFindFirst, create: factCreate, updateMany: factUpdateMany },
    factFinancial: { findFirst: financialFindFirst, create: financialCreate, updateMany: financialUpdateMany },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (ops: unknown[]) => {
      transactionCalls.push(ops);
      return Promise.all(ops);
    }),
  },
}));

import { repo } from './prisma-repo';

beforeEach(() => {
  factFindFirst.mockReset();
  factCreate.mockClear();
  factUpdateMany.mockClear();
  projectFindUnique.mockClear();
  projectUpdate.mockClear();
  financialFindFirst.mockReset();
  financialCreate.mockClear();
  financialUpdateMany.mockClear();
  transactionCalls.length = 0;
});

describe('prisma-repo.saveMonthlyFact - Task 3 (carry-forward khi chua co dong)', () => {
  it('thang hien tai chua co dong, co dong thang truoc -> create voi version 1 va pctActual carry-forward', async () => {
    factFindFirst.mockImplementation(async (args: { where: { yearMonth?: string | { lt: string } } }) => {
      if (args.where.yearMonth === CURRENT_YM) return null;
      if (typeof args.where.yearMonth === 'object' && 'lt' in args.where.yearMonth) return baselineFact;
      return null;
    });

    const r = await repo.saveMonthlyFact(1, CURRENT_YM, { ac: 1 }, 'admin@daidung.com.vn');

    expect(r).toBe('created');
    expect(factCreate).toHaveBeenCalledTimes(1);
    const createArgs = factCreate.mock.calls[0][0] as { data: { version: number; pctActual: number } };
    expect(createArgs.data.version).toBe(1);
    expect(createArgs.data.pctActual).toBe(baselineFact.pctActual);
  });

  it('project.findUnique tra null -> not_found, khong goi $transaction', async () => {
    projectFindUnique.mockResolvedValueOnce(null as never);

    const r = await repo.saveMonthlyFact(999999, CURRENT_YM, { ac: 1 });

    expect(r).toBe('not_found');
    expect(transactionCalls).toHaveLength(0);
  });
});

describe('prisma-repo.saveFinancial - Task 3 (carry-forward khi chua co dong)', () => {
  it('project khong ton tai -> not_found, khong goi $transaction', async () => {
    projectFindUnique.mockResolvedValueOnce(null as never);

    const r = await repo.saveFinancial(999999, CURRENT_YM, { revenueCumulative: 5 });

    expect(r).toBe('not_found');
    expect(transactionCalls).toHaveLength(0);
  });
});
