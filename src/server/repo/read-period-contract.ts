/**
 * Bộ ca hợp đồng cho 7 hàm đọc theo mốc/kỳ của P4 (`readFactSnapshotsAsOf`, `readFinancialAsOf`, `readRevenueInRange`,
 * `readVolumeInRange`, `readFactSeries`, `readValueChainAsOf`, `readLastDailyDate`).
 * Chạy CÙNG bộ ca trên read-mock (`read-mock.test.ts`) và Postgres thật (`read-period-real-db.test.ts`).
 * File này KHÔNG phải `.test.ts` nên Vitest không tự chạy.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { ReadRepo } from './read-types';

export const TEST_PREFIX = 'test-p4-';

export interface PeriodFixture {
  /** Chỉ số dự án: 0 = P, 1 = Q, 2 = R (không hoạt động). */
  facts: { p: number; ym: string; version: number; isLatest: boolean; pct: number; pv: number; ev: number; ac: number }[];
  financial: { p: number; ym: string; isLatest: boolean; revenue: number; arOverdue: number }[];
  volumes: { p: number; ym: string; tonnage: number }[];
  manpowerDays: { p: number; day: string }[];
  equipmentDays: { p: number; day: string }[];
  valueChain: { p: number; ym: string; stage: 'design' | 'shop'; pct: number }[];
}

export const PERIOD_FIXTURE: PeriodFixture = {
  facts: [
    { p: 0, ym: '2026-06', version: 1, isLatest: true, pct: 0.4, pv: 40, ev: 40, ac: 40 },
    { p: 0, ym: '2026-07', version: 1, isLatest: false, pct: 0.1, pv: 1, ev: 1, ac: 1 },
    { p: 0, ym: '2026-07', version: 2, isLatest: true, pct: 0.45, pv: 50, ev: 45, ac: 50 },
    { p: 0, ym: '2026-08', version: 1, isLatest: false, pct: 0.99, pv: 99, ev: 99, ac: 99 },
    { p: 0, ym: '2026-09', version: 1, isLatest: true, pct: 0.7, pv: 70, ev: 60, ac: 65 },
    { p: 1, ym: '2026-06', version: 1, isLatest: true, pct: 1, pv: 10, ev: 5, ac: 12 },
    { p: 2, ym: '2026-07', version: 1, isLatest: true, pct: 0.2, pv: 2, ev: 2, ac: 2 },
  ],
  financial: [
    { p: 0, ym: '2026-05', isLatest: false, revenue: 100, arOverdue: 50 },
    { p: 0, ym: '2026-06', isLatest: true, revenue: 5, arOverdue: 1 },
    { p: 0, ym: '2026-07', isLatest: true, revenue: 7, arOverdue: 2 },
    { p: 1, ym: '2026-06', isLatest: true, revenue: 3, arOverdue: 9 },
  ],
  volumes: [
    { p: 0, ym: '2026-06', tonnage: 100 },
    { p: 0, ym: '2026-07', tonnage: 50 },
    { p: 1, ym: '2026-06', tonnage: 10 },
  ],
  manpowerDays: [{ p: 0, day: '2026-09-01' }, { p: 0, day: '2026-09-10' }],
  equipmentDays: [{ p: 0, day: '2026-09-05' }],
  valueChain: [
    { p: 0, ym: '2026-06', stage: 'design', pct: 0.8 },
    { p: 0, ym: '2026-07', stage: 'design', pct: 1 },
    { p: 0, ym: '2026-07', stage: 'shop', pct: 0.5 },
  ],
};

export interface PeriodHarness {
  repo: ReadRepo;
  /** Nạp PERIOD_FIXTURE, trả id thật của 3 dự án [P, Q, R]. */
  seed(fx: PeriodFixture): Promise<[number, number, number]>;
}

export function runReadPeriodContract(name: string, makeHarness: () => Promise<PeriodHarness>) {
  describe(name, () => {
    let repo: ReadRepo;
    let P = 0;
    let Q = 0;
    let R = 0;

    beforeAll(async () => {
      const h = await makeHarness();
      repo = h.repo;
      [P, Q, R] = await h.seed(PERIOD_FIXTURE);
    });

    // DB thật có thể chứa dự án khác: chỉ xét 3 dự án của fixture.
    const mine = <T extends { projectId: number }>(rows: T[]) => rows.filter((r) => [P, Q, R].includes(r.projectId));

    it('readFactSnapshotsAsOf: mang dòng isLatest gần nhất <= tháng, bỏ dòng isLatest=false và dự án ngừng hoạt động', async () => {
      const rows = mine(await repo.readFactSnapshotsAsOf('2026-08'));
      const byId = new Map(rows.map((r) => [r.projectId, r]));
      expect(rows).toHaveLength(2);
      expect(byId.get(P)).toMatchObject({ yearMonth: '2026-07', pctActual: 0.45, pv: 50, ev: 45, ac: 50 });
      expect(byId.get(Q)).toMatchObject({ yearMonth: '2026-06', pctActual: 1 });
      expect(byId.has(R)).toBe(false);
    });

    it('readFactSnapshotsAsOf: đúng tháng thì lấy tháng đó; tháng trước dòng đầu tiên thì không trả dự án', async () => {
      const at09 = new Map(mine(await repo.readFactSnapshotsAsOf('2026-09')).map((r) => [r.projectId, r]));
      expect(at09.get(P)?.yearMonth).toBe('2026-09');
      expect(at09.get(Q)?.yearMonth).toBe('2026-06');
      expect(mine(await repo.readFactSnapshotsAsOf('2026-05'))).toEqual([]);
    });

    it('readFinancialAsOf: số tồn công nợ theo tháng gần nhất <= mốc, bỏ isLatest=false', async () => {
      const rows = new Map(mine(await repo.readFinancialAsOf('2026-08')).map((r) => [r.projectId, r]));
      expect(rows.get(P)).toMatchObject({ yearMonth: '2026-07', arOverdue: 2 });
      expect(rows.get(Q)).toMatchObject({ yearMonth: '2026-06', arOverdue: 9 });
      expect(mine(await repo.readFinancialAsOf('2026-05'))).toEqual([]);
    });

    it('readRevenueInRange: cộng revenuePeriod isLatest trong khoảng tháng, tháng thiếu tính 0', async () => {
      const rows = new Map(mine(await repo.readRevenueInRange('2026-06', '2026-07')).map((r) => [r.projectId, r.revenue]));
      expect(rows.get(P)).toBe(12);
      expect(rows.get(Q)).toBe(3);
      expect(mine(await repo.readRevenueInRange('2026-08', '2026-09'))).toEqual([]);
    });

    it('readVolumeInRange: cộng tonnageProcessed theo (dự án, nhà máy)', async () => {
      const rows = new Map(mine(await repo.readVolumeInRange('2026-06', '2026-07')).map((r) => [r.projectId, r.tonnage]));
      expect(rows.get(P)).toBe(150);
      expect(rows.get(Q)).toBe(10);
      expect(mine(await repo.readVolumeInRange('2026-07', '2026-07')).map((r) => r.tonnage)).toEqual([50]);
    });

    it('readFactSeries: dòng trong khoảng CỘNG dòng cuối trước khoảng, sắp projectId + yearMonth tăng', async () => {
      const rows = await repo.readFactSeries('2026-08', '2026-09', [P, Q]);
      const expected = [
        { projectId: P, yearMonth: '2026-07' }, { projectId: P, yearMonth: '2026-09' }, { projectId: Q, yearMonth: '2026-06' },
      ].sort((a, b) => a.projectId - b.projectId || a.yearMonth.localeCompare(b.yearMonth));
      expect(rows.map((r) => ({ projectId: r.projectId, yearMonth: r.yearMonth }))).toEqual(expected);
      expect(rows.find((r) => r.projectId === P && r.yearMonth === '2026-07')).toMatchObject({ pctActual: 0.45, pv: 50 });
    });

    it('readFactSeries: mang cả dòng trước khoảng khi khoảng có dòng; projectIds rỗng thì []', async () => {
      const rows = await repo.readFactSeries('2026-07', '2026-07', [P]);
      expect(rows.map((r) => r.yearMonth)).toEqual(['2026-06', '2026-07']);
      expect(await repo.readFactSeries('2026-06', '2026-09', [])).toEqual([]);
    });

    it('readValueChainAsOf: chuỗi của tháng lớn nhất <= mốc; không có thì []', async () => {
      const rows = await repo.readValueChainAsOf(P, '2026-08');
      expect(rows.map((r) => r.yearMonth)).toEqual(['2026-07', '2026-07']);
      expect(rows.map((r) => r.stageCode).sort()).toEqual(['design', 'shop']);
      expect(await repo.readValueChainAsOf(P, '2026-05')).toEqual([]);
    });

    it('readLastDailyDate: MAX(workDate) <= ngày chặn, riêng nhân lực và thiết bị', async () => {
      expect(await repo.readLastDailyDate(P, 'manpower', '2026-09-09')).toBe('2026-09-01');
      expect(await repo.readLastDailyDate(P, 'manpower', '2026-09-10')).toBe('2026-09-10');
      expect(await repo.readLastDailyDate(P, 'manpower', '2026-08-31')).toBeNull();
      expect(await repo.readLastDailyDate(P, 'equipment', '2026-09-16')).toBe('2026-09-05');
      expect(await repo.readLastDailyDate(Q, 'equipment', '2026-09-16')).toBeNull();
    });
  });
}
