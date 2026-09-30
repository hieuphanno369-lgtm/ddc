/**
 * P4 (F2) - `backfillRepoPrisma` chạy CÙNG bộ ca với bản mock (`backfill-contract.ts`) trên Postgres THẬT.
 * Bỏ qua khi `npm test` bình thường (không có `DATABASE_URL`); chạy tay bằng:
 *   $env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'
 *   npx vitest run src/server/repo/prisma-repo-backfill-real-db.test.ts
 * Dự án test có mã tiền tố `test-p4-backfill-`; khoảng và audit tự dọn.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { runBackfillContract, type BackfillHarness } from './backfill-contract';

const hasDb = Boolean(process.env.DATABASE_URL);
const CODE = 'test-p4-backfill-du-an';

describe.skipIf(!hasDb)('backfillRepoPrisma tren Postgres that (DB _c)', () => {
  let prisma: typeof import('@/server/db').prisma;
  let projectId = 0;

  async function clean() {
    const ids = (await prisma.projectBackfillWindow.findMany({ where: { projectId }, select: { id: true } })).map((r) => String(r.id));
    if (ids.length) await prisma.auditLog.deleteMany({ where: { tableName: 'project_backfill_window', recordId: { in: ids } } });
    await prisma.projectBackfillWindow.deleteMany({ where: { projectId } });
  }

  afterAll(async () => {
    if (!hasDb || !prisma) return;
    await clean();
    await prisma.project.deleteMany({ where: { masterCode: CODE } });
    await prisma.$disconnect();
  });

  runBackfillContract('backfill repo (Prisma)', async (): Promise<BackfillHarness> => {
    ({ prisma } = await import('@/server/db'));
    const { backfillRepoPrisma } = await import('./prisma-repo-backfill');
    if (!projectId) {
      const customer = await prisma.customer.findFirstOrThrow();
      const team = await prisma.teamKd.findFirstOrThrow();
      const created = await prisma.project.create({
        data: {
          masterCode: CODE, currentAliasCode: `${CODE}-alias`, projectName: CODE, customerId: customer.id, teamKdId: team.id,
          marketCode: 'TN', projectType: 'EPC', priority: 'P2', contractValue: 1, tonnage: 1, currencyCode: 'VND',
          createdBy: 'test', updatedBy: 'test',
        },
      });
      projectId = created.id;
    }
    return {
      repo: backfillRepoPrisma,
      projectId,
      async auditCount(windowId) {
        return prisma.auditLog.count({ where: { tableName: 'project_backfill_window', recordId: String(windowId) } });
      },
      async reset() {
        // Audit của các khoảng đã xoá cũng dọn (recordId là id khoảng).
        await clean();
      },
    };
  });

  it('2 admin bat cung luc cung khoang: dung 1 cai thanh cong, cai con lai overlap (khoa dong du an)', async () => {
    const { backfillRepoPrisma } = await import('./prisma-repo-backfill');
    await clean();
    const mk = (by: string) =>
      backfillRepoPrisma.createBackfillWindow(
        { projectId, fromDate: '2026-01-01', toDate: '2026-03-31', note: 'dong thoi test-p4', expiresAt: null },
        by,
      );
    const results = await Promise.all([mk('a@x.vn'), mk('b@x.vn'), mk('c@x.vn')]);
    expect(results.filter((r) => typeof r === 'object')).toHaveLength(1);
    expect(results.filter((r) => r === 'overlap')).toHaveLength(2);
  });
});
