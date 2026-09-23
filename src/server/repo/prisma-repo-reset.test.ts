import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Vòng CAN SUA #1 - A-5 (thay-doi.md): `resetAllData()` của `prisma-repo.ts` từng chỉ xoá
 * `project`/`auditLog` trong `$transaction`. `sap_queue.projectId` là FK `ON DELETE SET NULL`
 * (không phải Cascade) nên xoá hết dự án để lại dòng sap_queue mồ côi - khác hành vi
 * `mock-repo.resetAllData()` (gán `d.sapQueue = []`). Fix thêm `prisma.sapQueue.deleteMany()`
 * vào transaction.
 *
 * Test này mock thẳng `@/server/db` (nguồn duy nhất export `prisma` mà prisma-repo.ts dùng)
 * để không đụng DB Postgres dev thật (DB dev đang ở trạng thái seed đầy đủ ERP v2 - chạy
 * resetAllData() thật sẽ xoá sạch 17 dự án, tốn công seed lại, rủi ro không cần thiết cho một
 * assertion có thể chứng minh bằng cách bắt đúng lệnh Prisma được gọi).
 */

const {
  projectDeleteMany, auditLogDeleteMany, sapQueueDeleteMany, transactionCalls,
  projectFindUnique, projectFindFirst, projectDelete, customerDeleteMany, teamDeleteMany,
} = vi.hoisted(() => ({
  projectDeleteMany: vi.fn(async () => ({ count: 0 })),
  auditLogDeleteMany: vi.fn(async () => ({ count: 0 })),
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
    project: { deleteMany: projectDeleteMany, findUnique: projectFindUnique, findFirst: projectFindFirst, delete: projectDelete },
    auditLog: { deleteMany: auditLogDeleteMany },
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
  projectDeleteMany.mockClear();
  auditLogDeleteMany.mockClear();
  sapQueueDeleteMany.mockClear();
  projectFindUnique.mockClear();
  projectFindFirst.mockClear();
  projectDelete.mockClear();
  customerDeleteMany.mockClear();
  teamDeleteMany.mockClear();
  transactionCalls.length = 0;
});

describe('prisma-repo.resetAllData - A-5 (vòng CAN SUA #1)', () => {
  it('đường chạy thuận lợi: gọi resetAllData() phải xoá cả sap_queue (không chỉ project/auditLog)', async () => {
    await repo.resetAllData();

    expect(prisma.sapQueue.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.project.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('biên: cả 3 lệnh xoá nằm CHUNG một $transaction (atomic) - không phải 3 lệnh rời rạc', async () => {
    await repo.resetAllData();

    expect(transactionCalls).toHaveLength(1);
    expect(transactionCalls[0]).toHaveLength(3);
  });

  it('phải thất bại: nếu $transaction ném lỗi (vd deadlock/constraint), resetAllData() phải propagate lỗi thay vì nuốt im lặng', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('DB lỗi giả lập'));

    await expect(repo.resetAllData()).rejects.toThrow('DB lỗi giả lập');
  });
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
