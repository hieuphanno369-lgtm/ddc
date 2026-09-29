/**
 * P4 tester - tầng queries chạy trên Postgres THẬT (DB _c): ngày dự án từ Prisma/Postgres là Date/ISO đầy đủ
 * ("...T00:00:00.000Z"), mock chỉ có "YYYY-MM-DD". Ca này chứng minh ngày thực tế ĐÚNG BẰNG ngày mốc được tính đúng
 * trên đường chạy thật (repo -> queries), không chỉ trên bản bọc ISO của queries-period-iso.test.ts.
 * Bỏ qua khi không có `DATABASE_URL`. Chạy tay:
 *   $env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'
 *   npx vitest run src/server/queries-period-real-db.test.ts
 * Dữ liệu có tiền tố `test-p4-qr-` (masterCode) và tự dọn.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Period } from '@/lib/period';

const hasDb = Boolean(process.env.DATABASE_URL);
const CODE = 'test-p4-qr-1';
const NAME = 'test-p4-qr-du-an';
const per = (from: string, to: string): Period => ({ from, to });

describe.skipIf(!hasDb)('queries (P4) tren Postgres that: ngay ISO day du, ngay thuc te = ngay moc', () => {
  let prisma: typeof import('@/server/db').prisma;
  let getProjectSummaries: typeof import('./queries').getProjectSummaries;
  let getPortfolioKpis: typeof import('./queries').getPortfolioKpis;
  let getProjectSummary: typeof import('./queries').getProjectSummary;
  let projectId = 0;

  async function clean() {
    await prisma.project.deleteMany({ where: { masterCode: { startsWith: 'test-p4-qr-' } } });
  }

  beforeAll(async () => {
    ({ prisma } = await import('@/server/db'));
    ({ getProjectSummaries, getPortfolioKpis, getProjectSummary } = await import('./queries'));
    await clean();
    const [customer, team, factory] = await Promise.all([
      prisma.customer.findFirstOrThrow(), prisma.teamKd.findFirstOrThrow(), prisma.factory.findFirstOrThrow(),
    ]);
    const p = await prisma.project.create({
      data: {
        masterCode: CODE, currentAliasCode: `${CODE}-alias`, projectName: NAME, customerId: customer.id, teamKdId: team.id,
        marketCode: 'TN', projectType: 'EPC', priority: 'P2', contractValue: 10, tonnage: 1, currencyCode: 'VND',
        contractDate: new Date('2026-01-02T00:00:00Z'),
        plannedStartDate: new Date('2026-01-05T00:00:00Z'), plannedFinishDate: new Date('2026-06-30T00:00:00Z'),
        actualStartDate: new Date('2026-01-05T00:00:00Z'), actualFinishDate: new Date('2026-06-20T00:00:00Z'),
        isActive: true, factoryId: factory.id, createdBy: 'test', updatedBy: 'test',
      },
    });
    projectId = p.id;
    await prisma.factProgressMonthly.createMany({
      data: [
        { projectId, yearMonth: '2026-03', version: 1, isLatest: true, pctPlan: 0, pctActual: 0.5, pv: 5, ev: 5, ac: 5, equipmentActual: 0 },
        { projectId, yearMonth: '2026-06', version: 1, isLatest: true, pctPlan: 0, pctActual: 1, pv: 10, ev: 10, ac: 10, equipmentActual: 0 },
      ],
    });
  });

  afterAll(async () => {
    if (!hasDb) return;
    await clean();
    await prisma.$disconnect();
  });

  const mine = async (period: Period) => (await getProjectSummaries(period)).find((r) => r.projectName === NAME);

  it('Postgres trả ngày dạng ISO đầy đủ (điều kiện của ca này)', async () => {
    const { repo } = await import('@/server/repo');
    const p = await repo.getProject(projectId);
    expect(String(p!.actualFinishDate)).toMatch(/^2026-06-20T00:00:00\.000Z$/);
  });

  it('mốc = đúng ngày kết thúc thực tế (2026-06-20): Hoan_thanh, mang số 06', async () => {
    const s = await mine(per('2026-06-01', '2026-06-20'));
    expect(s?.status).toBe('Hoan_thanh');
    expect(s?.dataState).toEqual({ kind: 'completed', month: '2026-06' });
  });

  it('mốc trước 1 ngày (2026-06-19): chưa hoàn thành', async () => {
    expect((await mine(per('2026-06-01', '2026-06-19')))?.status).toBe('Dang_trien_khai');
  });

  it('kỳ bắt đầu đúng ngày kết thúc (06-20) vẫn thuộc kỳ; 06-21 thì không', async () => {
    expect(await mine(per('2026-06-20', '2026-06-30'))).toBeDefined();
    expect(await mine(per('2026-06-21', '2026-06-30'))).toBeUndefined();
  });

  it('không mang số từ tương lai: kỳ kết thúc 2026-02-28 (trước số 03) thì %TT = 0, dataState none', async () => {
    const s = await mine(per('2026-01-01', '2026-02-28'));
    expect(s?.pctActual).toBe(0);
    expect(s?.dataState.kind).toBe('none');
  });

  it('Chi tiết dự án: getProjectSummary tại tháng 06 trả Hoan_thanh (mốc = min(cuối tháng, hôm nay))', async () => {
    const s = await getProjectSummary(projectId, '2026-06');
    expect(s?.status).toBe('Hoan_thanh');
    const early = await getProjectSummary(projectId, '2026-03');
    expect(early?.status).toBe('Dang_trien_khai');
  });

  it('KPI trên toàn DB thật không ném lỗi với kỳ cắt ngang tháng, kỳ tương lai và kỳ trước dữ liệu', async () => {
    for (const p of [per('2026-06-15', '2026-08-10'), per('2027-01-01', '2027-03-31'), per('2020-01-01', '2020-01-31')]) {
      const k = await getPortfolioKpis(p);
      expect(Number.isFinite(k.projectsInPeriod)).toBe(true);
      expect(Number.isFinite(k.revenueInPeriod)).toBe(true);
    }
  });
});
