/**
 * P4 nhom G (G1) - tester: do thoi gian cac ham trang Tong quan / Chi tiet theo ky 1, 12 va 120 thang
 * tren Postgres THAT (DB _c, seed thuong), KHONG qua unstable_cache (goi thang tang queries).
 * (`scripts/perf/bench-data.ts` chi chay khi co du an PERF-0001 tren DB _b va hardcode thang hien tai, khong nhan ky 12/120 thang.)
 * Bo qua khi khong co `DATABASE_URL`. Chay tay:
 *   $env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'
 *   npx vitest run src/server/perf-period-bench.qa.test.ts
 * GIOI HAN: seed `_c` chi 17 du an, ~200 dong fact - CHUA do tren 10 trieu dong (chi `npm run perf:seed` tren DB _b lam duoc).
 * Nguong khang dinh rong (moi ham < 3 giay, ca trang < 5 giay) chi de bat hoi quy nang, khong phai cam ket hieu nang.
 */
import { afterAll, describe, expect, it } from 'vitest';
import type { Period } from '@/lib/period';

const hasDb = Boolean(process.env.DATABASE_URL);
const ROUNDS = 5;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

describe.skipIf(!hasDb)('do hieu nang theo ky 1 / 12 / 120 thang (DB _c, khong qua cache)', () => {
  let prisma: typeof import('@/server/db').prisma;
  const table: string[] = [];

  afterAll(async () => {
    if (!hasDb) return;
    console.log('\n[perf-period] median/max ms, ' + ROUNDS + ' vong, DB _c seed thuong (17 du an), khong qua cache\n' + table.join('\n'));
    await prisma?.$disconnect();
  });

  const periods: { label: string; period: Period }[] = [
    { label: '1 thang (09/2026)', period: { from: '2026-09-01', to: '2026-09-30' } },
    { label: '12 thang (10/2025-09/2026)', period: { from: '2025-10-01', to: '2026-09-30' } },
    { label: '120 thang (10/2016-09/2026)', period: { from: '2016-10-01', to: '2026-09-30' } },
  ];

  for (const { label, period } of periods) {
    it(`Tong quan, ky ${label}: tung ham + ca trang (Promise.all)`, async () => {
      ({ prisma } = await import('@/server/db'));
      const q = await import('./queries');
      const { getOverdueScorecard } = await import('./overdue-scorecard');
      const fns: { name: string; run: () => Promise<unknown> }[] = [
        { name: 'getPortfolioKpis', run: () => q.getPortfolioKpis(period, {}) },
        { name: 'getStatusBreakdown', run: () => q.getStatusBreakdown(period, {}) },
        { name: 'getTonnageValueByGroup', run: () => q.getTonnageValueByGroup(period, 'team', {}) },
        { name: 'getCapacityData', run: () => q.getCapacityData(period, {}) },
        { name: 'getSpiCpiTrend', run: () => q.getSpiCpiTrend(period, {}) },
        { name: 'getPortfolioSCurve', run: () => q.getPortfolioSCurve(period, {}) },
        { name: 'getWatchlist', run: () => q.getWatchlist(period, {}) },
        { name: 'listProjects', run: () => q.listProjects({ period, pageSize: 10 }) },
        { name: 'getOverdueScorecard', run: () => getOverdueScorecard(period, {}) },
      ];
      const time = async (fn: () => Promise<unknown>) => {
        const t0 = performance.now();
        await fn();
        return performance.now() - t0;
      };
      for (const f of fns) {
        const times: number[] = [];
        for (let i = 0; i < ROUNDS; i++) times.push(await time(f.run));
        table.push(`| ${label} | ${f.name} | ${median(times).toFixed(0)} | ${Math.max(...times).toFixed(0)} |`);
        expect(median(times), `${f.name} ${label}`).toBeLessThan(3000);
      }
      const page: number[] = [];
      for (let i = 0; i < ROUNDS; i++) page.push(await time(() => Promise.all(fns.map((f) => f.run()))));
      table.push(`| ${label} | CA TRANG (Promise.all) | ${median(page).toFixed(0)} | ${Math.max(...page).toFixed(0)} |`);
      expect(median(page), `ca trang ${label}`).toBeLessThan(5000);
    }, 120_000);
  }

  it('cac ham doc P4 (LATERAL) tra du lieu dung o ky 120 thang: 17 du an, khong nem loi', async () => {
    ({ prisma } = await import('@/server/db'));
    const { repo } = await import('@/server/repo');
    const snaps = await repo.readFactSnapshotsAsOf('2026-09');
    expect(snaps.length).toBeGreaterThan(0);
    const ids = snaps.map((s) => s.projectId);
    const series = await repo.readFactSeries('2016-10', '2026-09', ids);
    expect(series.length).toBeGreaterThan(0);
    const rev = await repo.readRevenueInRange('2016-10', '2026-09');
    expect(Array.isArray(rev)).toBe(true);
    const last = await repo.readLastDailyDate(1, 'manpower', '2026-09-16');
    expect(last === null || /^\d{4}-\d{2}-\d{2}$/.test(last)).toBe(true);
    // kiem cache khoi dong: chay lai lan 2 khong cham hon 10x lan 1 (bat truong hop mat index)
    const t0 = performance.now();
    await repo.readFactSeries('2016-10', '2026-09', ids);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});
