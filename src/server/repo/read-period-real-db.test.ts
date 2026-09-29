/**
 * P4 (Task A3) - 7 hàm đọc theo mốc/kỳ của `readRepoPrisma` chạy CÙNG bộ ca với read-mock
 * (`read-period-contract.ts`) trên Postgres THẬT (chỉ DB thật mới chứng minh được LATERAL/index và kiểu cột).
 * Bỏ qua khi `npm test` bình thường (không có `DATABASE_URL`); chạy tay bằng:
 *   $env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'
 *   npx vitest run src/server/repo/read-period-real-db.test.ts
 * Dữ liệu test có tiền tố `test-p4-` (masterCode, tên nhà thầu/thiết bị) và tự dọn.
 */
import { afterAll, describe } from 'vitest';
import { runReadPeriodContract, TEST_PREFIX, type PeriodFixture, type PeriodHarness } from './read-period-contract';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('read-prisma tren Postgres that (DB _c)', () => {
  let prisma: typeof import('@/server/db').prisma;

  async function clean() {
    // Xoá dự án trước (fact/ngày xoá dây chuyền), sau đó mới xoá nhà thầu/thiết bị (onDelete: Restrict).
    await prisma.project.deleteMany({ where: { masterCode: { startsWith: TEST_PREFIX } } });
    await prisma.contractor.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
    await prisma.equipment.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  }

  afterAll(async () => {
    if (!hasDb) return;
    await clean();
    await prisma.$disconnect();
  });

  runReadPeriodContract('readRepoPrisma: hàm đọc theo mốc/kỳ (P4)', async (): Promise<PeriodHarness> => {
    ({ prisma } = await import('@/server/db'));
    const { readRepoPrisma } = await import('./read-prisma');
    return {
      repo: readRepoPrisma,
      async seed(fx: PeriodFixture) {
        await clean();
        const [customer, team, factory] = await Promise.all([
          prisma.customer.findFirstOrThrow(), prisma.teamKd.findFirstOrThrow(), prisma.factory.findFirstOrThrow(),
        ]);
        const ids: number[] = [];
        for (let i = 0; i < 3; i++) {
          const p = await prisma.project.create({
            data: {
              masterCode: `${TEST_PREFIX}${i}`, currentAliasCode: `${TEST_PREFIX}alias-${i}`, projectName: `${TEST_PREFIX}${i}`,
              customerId: customer.id, teamKdId: team.id, marketCode: 'TN', projectType: 'EPC', priority: 'P2',
              contractValue: 1, tonnage: 1, currencyCode: 'VND', isActive: i !== 2, factoryId: factory.id,
              createdBy: 'test', updatedBy: 'test',
            },
          });
          ids.push(p.id);
        }
        const contractor = await prisma.contractor.create({ data: { name: `${TEST_PREFIX}nha-thau` } });
        const equipment = await prisma.equipment.create({ data: { name: `${TEST_PREFIX}thiet-bi` } });

        await prisma.factProgressMonthly.createMany({
          data: fx.facts.map((f) => ({
            projectId: ids[f.p], yearMonth: f.ym, version: f.version, isLatest: f.isLatest, pctPlan: 0, pctActual: f.pct,
            pv: f.pv, ev: f.ev, ac: f.ac, equipmentActual: 0,
          })),
        });
        await prisma.factFinancial.createMany({
          data: fx.financial.map((f) => ({
            projectId: ids[f.p], yearMonth: f.ym, isLatest: f.isLatest, revenuePeriod: f.revenue, revenueCumulative: 0,
            costActualPeriod: 0, costActualCumulative: 0, grossProfit: 0, grossMarginPct: 0, backlog: 0,
            arCollected: 0, arOutstanding: 0, arOverdue: f.arOverdue,
          })),
        });
        await prisma.factVolume.createMany({
          data: fx.volumes.map((v) => ({ projectId: ids[v.p], yearMonth: v.ym, factoryId: factory.id, tonnageProcessed: v.tonnage })),
        });
        await prisma.factDailyManpower.createMany({
          data: fx.manpowerDays.map((m) => ({
            projectId: ids[m.p], contractorId: contractor.id, workDate: new Date(`${m.day}T00:00:00Z`), shiftCode: 'morning',
            plannedHeadcount: 1, actualHeadcount: 1,
          })),
        });
        await prisma.factDailyEquipmentUsage.createMany({
          data: fx.equipmentDays.map((e) => ({
            projectId: ids[e.p], contractorId: contractor.id, equipmentId: equipment.id, workDate: new Date(`${e.day}T00:00:00Z`),
            qtyPlanned: 1, qtyActual: 1,
          })),
        });
        await prisma.valueChainProgress.createMany({
          data: fx.valueChain.map((v) => ({
            projectId: ids[v.p], stageCode: v.stage, yearMonth: v.ym, pctComplete: v.pct, applicable: true,
          })),
        });
        return ids as [number, number, number];
      },
    };
  });
});
