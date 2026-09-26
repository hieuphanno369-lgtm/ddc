import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  sapQueueDeleteMany, transactionCalls,
  projectFindUnique, projectFindFirst, projectDelete, customerDeleteMany, teamDeleteMany,
} = vi.hoisted(() => ({
  sapQueueDeleteMany: vi.fn(async () => ({ count: 0 })),
  transactionCalls: [] as unknown[][],
  projectFindUnique: vi.fn(async () => ({ id: 1, customerId: 10, teamKdId: 20 })),
  projectFindFirst: vi.fn(async () => null), // mặc định: không còn dự án nào khác dùng customer/team này
  projectDelete: vi.fn(async () => ({ id: 1 })),
  customerDeleteMany: vi.fn(async () => ({ count: 0 })),
  teamDeleteMany: vi.fn(async () => ({ count: 0 })),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    project: { findUnique: projectFindUnique, findFirst: projectFindFirst, delete: projectDelete },
    sapQueue: { deleteMany: sapQueueDeleteMany },
    customer: { deleteMany: customerDeleteMany },
    teamKd: { deleteMany: teamDeleteMany },
    $transaction: vi.fn(async (ops: unknown[]) => {
      transactionCalls.push(ops);
      return Promise.all(ops);
    }),
  },
}));

import { prisma } from '@/server/db';
import { repo } from './prisma-repo';

beforeEach(() => {
  sapQueueDeleteMany.mockClear();
  projectFindUnique.mockClear();
  projectFindFirst.mockClear();
  projectDelete.mockClear();
  customerDeleteMany.mockClear();
  teamDeleteMany.mockClear();
  transactionCalls.length = 0;
});

/**
 * N-2 (danh-gia.md, vòng 2) - nửa còn lại của A-5: `removeProject()` chỉ xoá đúng project qua FK
 * Cascade, nhưng `sap_queue.projectId` là `ON DELETE SET NULL` (không phải Cascade) nên dòng SAP
 * queue của dự án vừa xoá còn nguyên `sapCode`/`projectNameHint` (tên dự án đã xoá), hiện lại ở
 * `/import` như mục chờ ghép "ma". `mock-repo.removeProject` đã lọc `d.sapQueue` từ trước (dòng
 * 444) nên mock/prisma lệch nhau, không test nào dùng mock bắt được.
 */
describe('prisma-repo.removeProject - N-2 (vòng 2, nửa còn lại của A-5)', () => {
  it('đường chạy thuận lợi: gọi removeProject(id) phải xoá cả sap_queue của ĐÚNG project đó', async () => {
    await repo.removeProject(1);

    expect(prisma.sapQueue.deleteMany).toHaveBeenCalledWith({ where: { projectId: 1 } });
    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('biên: xoá sap_queue và xoá project nằm CHUNG một $transaction (atomic)', async () => {
    await repo.removeProject(1);

    const txWithBoth = transactionCalls.find((ops) => ops.length === 2);
    expect(txWithBoth).toBeDefined();
  });

  it('biên: project không tồn tại -> không gọi bất kỳ lệnh xoá nào (giữ nguyên hành vi cũ)', async () => {
    projectFindUnique.mockResolvedValueOnce(null as never);

    await repo.removeProject(999_999);

    expect(prisma.sapQueue.deleteMany).not.toHaveBeenCalled();
    expect(prisma.project.delete).not.toHaveBeenCalled();
  });
});
