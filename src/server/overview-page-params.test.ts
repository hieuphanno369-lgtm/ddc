import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

/**
 * P4 tester - trang Tổng quan: tham số URL (rác hoặc hợp lệ) -> `period`/`filters` đã validate, và CÙNG MỘT object
 * được truyền xuống mọi widget (React `cache` so theo tham chiếu; tạo object mới ở widget làm mất memo).
 * Bộ widget được thay bằng thẻ đánh dấu, không render (widget là server component async).
 */
const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/require-user', () => ({ requireUser: requireUserMock }));
vi.mock('@/server/repo', () => ({
  repo: { readLastAuditAt: vi.fn(async () => null), getDims: vi.fn(async () => ({ teams: [], customers: [] })) },
}));
vi.mock('@/components/dashboard/OverviewWidgets', () => {
  const mk = (name: string) => Object.assign(() => null, { displayName: name });
  return {
    BacklogOverdueCard: mk('BacklogOverdueCard'), CapacityCard: mk('CapacityCard'), FilterBarSection: mk('FilterBarSection'),
    GroupBarCard: mk('GroupBarCard'), KpiGrid: mk('KpiGrid'), ProjectListCard: mk('ProjectListCard'),
    SCurveCard: mk('SCurveCard'), SpiCpiCard: mk('SpiCpiCard'), StatusDonutCard: mk('StatusDonutCard'),
    TopPriorityCard: mk('TopPriorityCard'),
  };
});

(globalThis as unknown as { React: typeof React }).React = React;

import OverviewPage from '../../app/[locale]/(app)/overview/page';

type Props = Record<string, unknown>;

/** Duyệt cây element, gom props của mọi widget đã mock (theo displayName). */
function widgets(node: unknown, out: Record<string, Props> = {}): Record<string, Props> {
  if (Array.isArray(node)) {
    for (const n of node) widgets(n, out);
  } else if (React.isValidElement(node)) {
    const type = node.type as unknown as { displayName?: string };
    const props = node.props as Props & { children?: unknown };
    if (type.displayName) out[type.displayName] = props;
    widgets(props.children, out);
    if (props.fallback) widgets(props.fallback, {});
  }
  return out;
}

const render = async (sp: Record<string, string | string[] | undefined>) =>
  widgets(await OverviewPage({ searchParams: Promise.resolve(sp) }));

const ADMIN = { name: 'A', email: 'a@x', role: 'admin', canViewFinance: true };
const VIEWER = { name: 'V', email: 'v@x', role: 'viewer', canViewFinance: false };

beforeEach(() => {
  requireUserMock.mockReset();
  requireUserMock.mockResolvedValue(ADMIN);
});

describe('P4 trang Tổng quan: tham số URL -> kỳ và bộ lọc đã validate', () => {
  it('không tham số: kỳ mặc định 12 tháng gần nhất tới hôm nay (2026-09-16 ghim), lọc "all"', async () => {
    const w = await render({});
    expect(w.KpiGrid.period).toEqual({ from: '2025-10-01', to: '2026-09-16' });
    expect(w.KpiGrid.filters).toMatchObject({ status: 'all', teamKdId: 'all', customerId: 'all' });
  });

  it.each([
    ['month=all', { month: 'all' }],
    ['month=abc', { month: 'abc' }],
    ['month=9999-12', { month: '9999-12' }],
    ['from/to rác', { from: 'rác', to: 'rác' }],
    ['ngày 30/02', { from: '2026-02-30', to: '2026-02-31' }],
  ] as [string, Record<string, string>][])('%s: mở được và rơi về kỳ mặc định', async (_n, sp) => {
    const w = await render(sp);
    expect(w.KpiGrid.period).toEqual({ from: '2025-10-01', to: '2026-09-16' });
  });

  it('from/to hợp lệ được dùng nguyên; month=YYYY-MM = trọn tháng', async () => {
    expect((await render({ from: '2026-07-15', to: '2026-09-10' })).KpiGrid.period).toEqual({ from: '2026-07-15', to: '2026-09-10' });
    expect((await render({ month: '2026-02' })).KpiGrid.period).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('kỳ đảo được đổi chỗ (from > to)', async () => {
    expect((await render({ from: '2026-09-10', to: '2026-07-15' })).KpiGrid.period).toEqual({ from: '2026-07-15', to: '2026-09-10' });
  });

  it('cùng MỘT object period và filters cho mọi widget (giữ memo của React cache)', async () => {
    const w = await render({ from: '2026-07-01', to: '2026-08-31', status: 'Hoan_thanh' });
    const names = ['KpiGrid', 'StatusDonutCard', 'GroupBarCard', 'SpiCpiCard', 'CapacityCard', 'SCurveCard', 'BacklogOverdueCard', 'TopPriorityCard', 'ProjectListCard', 'FilterBarSection'];
    for (const n of names) expect(w[n], n).toBeDefined();
    for (const n of names) {
      expect(w[n].period, n).toBe(w.KpiGrid.period);
      expect(w[n].filters, n).toBe(w.KpiGrid.filters);
    }
  });

  it('bộ lọc rác (status=hack, team=-1) rơi về "all", không lọt vào widget', async () => {
    const w = await render({ status: 'hack', team: '-1', customer: 'abc', priority: 'P9' });
    expect(w.KpiGrid.filters).toMatchObject({ status: 'all', teamKdId: 'all', customerId: 'all', priority: 'all' });
  });
});

describe('P4 trang Tổng quan: người không xem tiền', () => {
  it('viewer (canViewFinance=false): KHÔNG render S-curve và thẻ HĐ chưa khởi công & công nợ; KpiGrid nhận canViewFinance=false', async () => {
    requireUserMock.mockResolvedValue(VIEWER);
    const w = await render({});
    expect(w.SCurveCard).toBeUndefined();
    expect(w.BacklogOverdueCard).toBeUndefined();
    expect(w.KpiGrid.canViewFinance).toBe(false);
    expect(w.TopPriorityCard.canViewFinance).toBe(false);
    expect(w.ProjectListCard.canViewFinance).toBe(false);
  });

  it('viewer thêm ?sort=value: ép về sort không lộ tiền (priority)', async () => {
    requireUserMock.mockResolvedValue(VIEWER);
    expect((await render({ sort: 'value' })).ProjectListCard.sort).toBe('priority');
  });

  it('user thiếu trường canViewFinance (undefined) coi như KHÔNG được xem tiền (fail-closed)', async () => {
    requireUserMock.mockResolvedValue({ name: 'X', email: 'x@x', role: 'viewer' });
    const w = await render({});
    expect(w.SCurveCard).toBeUndefined();
    expect(w.KpiGrid.canViewFinance).toBe(false);
  });

  it('admin (canViewFinance=true): có S-curve và thẻ HĐ chưa khởi công (đối chứng)', async () => {
    const w = await render({});
    expect(w.SCurveCard).toBeDefined();
    expect(w.BacklogOverdueCard).toBeDefined();
    expect(w.KpiGrid.canViewFinance).toBe(true);
  });
});
