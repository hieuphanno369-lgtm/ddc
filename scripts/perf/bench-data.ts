/**
 * Chan doan tang du lieu (khong qua unstable_cache) tren du lieu da seed 10 trieu dong (Buoc 7
 * P2B). Do dung cac ham trang goi - danh sach phai khop 100% voi trang /overview va
 * /projects/[id] (xem app/[locale]/(app)/overview/page.tsx va projects/[id]/page.tsx).
 * Usage: npx tsx scripts/perf/bench-data.ts
 */
import { currentMonth, todayIso } from '@/lib/clock';
import { defaultOverviewPeriod, parsePeriod } from '@/lib/period';
import { PERF_PREFIX } from '@/lib/perf-guard';
import { prisma } from '@/server/db';
import { getEquipmentPlanGantt } from '@/server/equipment-plan-gantt-queries';
import { getManpowerMonthChartData, getWeeklyChartData } from '@/server/manpower-queries';
import { getOverdueScorecard } from '@/server/overdue-scorecard';
import {
  getCapacityData, getMissingMonth, getPortfolioKpis, getPortfolioSCurve, getProjectSummary,
  getSpiCpiTrend, getStatusBreakdown, getTonnageValueByGroup, getWatchlist, listProjects,
} from '@/server/queries';
import { getResourceBreakdown, getResourceSnapshot, getWeeklyTracking, getWorkItemComparison } from '@/server/project-queries';
import { repo } from '@/server/repo';

const ROUNDS = 5;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function timeit(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

async function benchOverview(month: string): Promise<number> {
  // Kỳ = trọn tháng `month` (P4: hàm truy vấn nhận Period).
  const period = parsePeriod({ month }, defaultOverviewPeriod(todayIso()));
  return timeit(() =>
    Promise.all([
      getPortfolioKpis(period, {}),
      getStatusBreakdown(period, {}),
      getTonnageValueByGroup(period, 'team', {}),
      getCapacityData(period, {}),
      getSpiCpiTrend(period, {}),
      getPortfolioSCurve(period, {}),
      getWatchlist(period, {}),
      listProjects({ period, pageSize: 10 }),
      getOverdueScorecard(period, {}),
      getMissingMonth(month),
      repo.getDims(),
      repo.readLastAuditAt(),
    ]));
}

/** Đúng danh sách Promise.all ở Bước 6.5 (app/[locale]/(app)/projects/[id]/page.tsx). */
async function benchDetail(projectId: number, month: string): Promise<number> {
  const project = (await repo.getProject(projectId))!;
  return timeit(() =>
    Promise.all([
      getProjectSummary(projectId, month),
      repo.readLastAuditAt(),
      repo.getFacts(projectId),
      repo.getValueChain(projectId, month),
      repo.getFinancial(projectId),
      repo.getAlerts(projectId),
      repo.getAliases(projectId),
      repo.getSapCodes(projectId),
      repo.getDims(),
      getResourceSnapshot(projectId, month),
      getResourceBreakdown(projectId, month),
      getWeeklyTracking(projectId, month),
      repo.getKeyMilestones(projectId),
      repo.getStageWeights(projectId),
      repo.getStageMilestones(projectId),
      getWorkItemComparison(projectId, month),
      repo.listProjects(),
      getManpowerMonthChartData(projectId, 'vi'),
      getWeeklyChartData(projectId, project),
      getEquipmentPlanGantt(projectId, todayIso()),
    ]));
}

/** Do rieng tung ham cua nhanh 'all' (tuan tu, khong Promise.all) de chi ra ham cham nhat. */
async function benchOverviewBreakdown(month: string): Promise<{ label: string; median: number; max: number }[]> {
  const period = parsePeriod({ month }, defaultOverviewPeriod(todayIso()));
  const fns: { label: string; run: () => Promise<unknown> }[] = [
    { label: 'getPortfolioKpis', run: () => getPortfolioKpis(period, {}) },
    { label: 'getStatusBreakdown', run: () => getStatusBreakdown(period, {}) },
    { label: 'getTonnageValueByGroup', run: () => getTonnageValueByGroup(period, 'team', {}) },
    { label: 'getCapacityData', run: () => getCapacityData(period, {}) },
    { label: 'getSpiCpiTrend', run: () => getSpiCpiTrend(period, {}) },
    { label: 'getPortfolioSCurve', run: () => getPortfolioSCurve(period, {}) },
    { label: 'getWatchlist', run: () => getWatchlist(period, {}) },
    { label: 'listProjects', run: () => listProjects({ period, pageSize: 10 }) },
    { label: 'getOverdueScorecard', run: () => getOverdueScorecard(period, {}) },
    { label: 'getMissingMonth', run: () => getMissingMonth(month) },
    { label: 'repo.getDims', run: () => repo.getDims() },
    { label: 'repo.readLastAuditAt', run: () => repo.readLastAuditAt() },
  ];
  const out: { label: string; median: number; max: number }[] = [];
  for (const f of fns) {
    const times: number[] = [];
    for (let i = 0; i < ROUNDS; i++) times.push(await timeit(f.run));
    out.push({ label: f.label, median: median(times), max: Math.max(...times) });
  }
  return out;
}

async function main() {
  const month = currentMonth();
  const perfProject = await prisma.project.findFirst({
    where: { masterCode: `${PERF_PREFIX}0001` },
    select: { id: true },
  });
  if (!perfProject) {
    console.error('[bench-data] Khong tim thay du an PERF-0001 - chay `npm run perf:seed` truoc.');
    process.exit(1);
  }

  const scenarios: { label: string; run: () => Promise<number> }[] = [
    { label: `Tong quan (month=${month})`, run: () => benchOverview(month) },
    { label: "Tong quan (month='all')", run: () => benchOverview('all') },
    { label: 'Chi tiet PERF-0001', run: () => benchDetail(perfProject.id, month) },
    { label: 'Chi tiet du an 1', run: () => benchDetail(1, month) },
  ];

  console.log(`[bench-data] ${ROUNDS} vong moi kich ban, KHONG qua unstable_cache.\n`);
  console.log('| Kich ban | Median (ms) | Max (ms) |');
  console.log('|---|---|---|');
  for (const s of scenarios) {
    const times: number[] = [];
    for (let i = 0; i < ROUNDS; i++) times.push(await s.run());
    console.log(`| ${s.label} | ${median(times).toFixed(0)} | ${Math.max(...times).toFixed(0)} |`);
  }

  console.log(`\n[bench-data] Phan ra tung ham nhanh 'all' (tuan tu, khong Promise.all, ${ROUNDS} vong/ham):\n`);
  console.log('| Ham | Median (ms) | Max (ms) |');
  console.log('|---|---|---|');
  const breakdown = await benchOverviewBreakdown('all');
  for (const b of [...breakdown].sort((a, b) => b.median - a.median)) {
    console.log(`| ${b.label} | ${b.median.toFixed(0)} | ${b.max.toFixed(0)} |`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
