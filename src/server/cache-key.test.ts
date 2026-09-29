import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P4 tester - khoá `unstable_cache` của Tổng quan không được phình theo tham số URL rác (bài học N-2).
 * Chặn `unstable_cache` để ghi lại keyParts + tags mà mọi loader dùng, rồi đi qua đúng đường page:
 * parsePeriod + parseDashboardFilters (giống app/[locale]/(app)/overview/page.tsx) -> loader.
 */
const { calls } = vi.hoisted(() => ({ calls: [] as { keyParts: string[]; tags: string[] }[] }));

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown, keyParts: string[], opts: { tags: string[] }) => {
    calls.push({ keyParts, tags: opts.tags });
    return fn;
  },
}));
vi.mock('./queries', () => {
  const empty = async () => ({});
  return {
    getCapacityData: empty, getPortfolioKpis: empty, getPortfolioSCurve: empty, getProjectCounts: empty,
    getSpiCpiTrend: empty, getStatusBreakdown: empty, getTonnageValueByGroup: empty, getWatchlist: empty, listProjects: empty,
  };
});
vi.mock('./top-priority-queries', () => ({ getTopPriority: async () => [] }));

import { todayIso } from '@/lib/clock';
import { parseDashboardFilters } from '@/lib/overview-params';
import { defaultOverviewPeriod, parsePeriod } from '@/lib/period';
import {
  loadCapacity, loadPortfolioKpis, loadProjectCounts, loadSCurve, loadSpiCpiTrend, loadStatusBreakdown,
  loadTonnageByGroup, profileTag, trendTag,
} from './cache';

const TEAM_NAMES = ['P.KD 01', 'P.KD 03'];
type Sp = Record<string, string | string[] | undefined>;
const s = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

/** Đúng cách page làm: kỳ + bộ lọc đã validate rồi mới vào loader. */
async function keysFor(sp: Sp): Promise<string[]> {
  calls.length = 0;
  const period = parsePeriod({ from: s(sp.from), to: s(sp.to), month: s(sp.month) }, defaultOverviewPeriod(todayIso()));
  const filters = parseDashboardFilters(sp, TEAM_NAMES);
  await loadPortfolioKpis(period, filters);
  await loadProjectCounts(period, filters);
  await loadStatusBreakdown(period, filters);
  await loadTonnageByGroup(period, filters.groupBy ?? 'team', filters);
  await loadCapacity(period, filters);
  await loadSpiCpiTrend(period, filters);
  await loadSCurve(period, filters);
  return calls.map((c) => c.keyParts.join('~'));
}

beforeEach(() => {
  calls.length = 0;
});

describe('P4 khoá cache: tham số rác không sinh khoá mới', () => {
  it('đường chạy thuận lợi: mỗi loader có khoá và tag trendTag + profileTag + overview:<tháng mốc>', async () => {
    await keysFor({});
    expect(calls).toHaveLength(7);
    for (const c of calls) {
      expect(c.tags).toContain(trendTag);
      expect(c.tags).toContain(profileTag);
      expect(c.tags.some((t) => /^overview:\d{4}-\d{2}$/.test(t))).toBe(true);
    }
  });

  it.each([
    ['month=all (link cũ)', { month: 'all' }],
    ['month rác', { month: 'abc' }],
    ['month năm 9999', { month: '9999-12' }],
    ['from/to rác', { from: 'rác', to: 'rác' }],
    ['ngày không tồn tại 30/02', { from: '2026-02-30', to: '2026-13-40' }],
    ['chuỗi rất dài', { from: 'x'.repeat(5000), to: 'y'.repeat(5000), month: 'z'.repeat(5000) }],
    ['status/priority/market/type rác', { status: 'hack', priority: 'P9', market: 'zz', type: 'zz' }],
    ['team/customer âm hoặc chữ', { team: '-1', customer: 'abc' }],
    ['groupBy rác', { groupBy: 'password' }],
    ['tham số lặp (mảng)', { status: ['Hoan_thanh', 'Chuan_bi'], from: ['2026-01-01', '2026-02-01'] }],
  ] as [string, Sp][])('%s: khoá giống hệt khi không có tham số', async (_name, sp) => {
    const base = await keysFor({});
    const junk = await keysFor(sp);
    expect(junk).toEqual(base);
  });

  it('kỳ hợp lệ khác nhau cho khoá khác nhau (khoá thật sự theo kỳ)', async () => {
    const a = await keysFor({ from: '2026-01-01', to: '2026-03-31' });
    const b = await keysFor({ from: '2026-04-01', to: '2026-06-30' });
    expect(a).not.toEqual(b);
  });

  it('kỳ đảo (from > to) chuẩn hoá về cùng khoá với kỳ đúng thứ tự (không nhân đôi khoá)', async () => {
    const a = await keysFor({ from: '2026-01-01', to: '2026-03-31' });
    const b = await keysFor({ from: '2026-03-31', to: '2026-01-01' });
    expect(b).toEqual(a);
  });

  it('kỳ dài quá 120 tháng bị chặn: from kéo lên, to giữ nguyên, hai kỳ cùng "to" và cùng bị chặn cho cùng khoá', async () => {
    const a = await keysFor({ from: '2000-01-01', to: '2500-01-01' });
    const b = await keysFor({ from: '2100-06-15', to: '2500-01-01' });
    expect(a).toEqual(b);
  });

  it('năm ngoài [2000, 2999] (vd 1900) rơi về kỳ mặc định, không sinh khoá riêng', async () => {
    expect(await keysFor({ from: '1900-01-01', to: '2026-01-01' })).toEqual(await keysFor({}));
  });

  it('groupKey KHÔNG kèm groupBy hợp lệ không ảnh hưởng kết quả (queries bỏ qua) nên không được sinh khoá mới (T-1)', async () => {
    const base = await keysFor({});
    const junk = await keysFor({ groupKey: 'gia-tri-ngau-nhien-123' });
    expect(junk).toEqual(base);
  });

  it('groupKey type/market ngoài enum, team không có thật: cùng khoá với không có groupKey (T-1)', async () => {
    for (const sp of [
      { groupBy: 'team', groupKey: 'team-khong-co' },
      { groupBy: 'type', groupKey: 'kieu-la' },
      { groupBy: 'market', groupKey: 'cho-la' },
    ] as Sp[]) {
      expect(await keysFor(sp)).toEqual(await keysFor({ groupBy: sp.groupBy }));
    }
  });

  it('groupKey đi kèm groupBy=team hợp lệ thì có khoá riêng (drill từ biểu đồ)', async () => {
    const base = await keysFor({ groupBy: 'team' });
    const drill = await keysFor({ groupBy: 'team', groupKey: 'P.KD 01' });
    expect(drill).not.toEqual(base);
  });
});
