import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteMany, createMany, findMany, auditCreate, txCalls } = vi.hoisted(() => ({
  deleteMany: vi.fn(async () => ({ count: 0 })),
  createMany: vi.fn(async () => ({ count: 0 })),
  findMany: vi.fn(async () => []),
  auditCreate: vi.fn(async () => ({})),
  txCalls: [] as unknown[][],
}));
vi.mock('@/server/db', () => ({
  prisma: {
    projectKeyMilestone: { deleteMany, createMany, findMany },
    auditLog: { create: auditCreate },
    $transaction: vi.fn(async (ops: unknown[]) => { txCalls.push(ops); return Promise.all(ops); }),
  },
}));
import { repo } from './prisma-repo';

beforeEach(() => {
  deleteMany.mockClear();
  createMany.mockClear();
  findMany.mockClear();
  auditCreate.mockClear();
  txCalls.length = 0;
});

describe('prisma-repo.replaceKeyMilestones', () => {
  it('xoa het roi tao lai trong 1 transaction, ghi audit dung', async () => {
    await repo.replaceKeyMilestones(7, [
      { name: 'A', plannedDate: '2026-09-20', actualDate: null },
      { name: 'B', plannedDate: '2026-10-01', actualDate: '2026-10-03' },
    ], 'admin@x');

    expect(txCalls).toHaveLength(1);
    expect(txCalls[0]).toHaveLength(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: { projectId: 7 } });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { projectId: 7, name: 'A', sortOrder: 1, plannedDate: new Date('2026-09-20T00:00:00Z'), actualDate: null },
        { projectId: 7, name: 'B', sortOrder: 2, plannedDate: new Date('2026-10-01T00:00:00Z'), actualDate: new Date('2026-10-03T00:00:00Z') },
      ],
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tableName: 'project_key_milestone', recordId: '7', field: 'replace', changedBy: 'admin@x' }),
    });
  });

  it('mang rong -> transaction chi co 1 op, KHONG goi createMany', async () => {
    await repo.replaceKeyMilestones(7, [], 'admin@x');

    expect(txCalls).toHaveLength(1);
    expect(txCalls[0]).toHaveLength(1);
    expect(createMany).not.toHaveBeenCalled();
  });
});
