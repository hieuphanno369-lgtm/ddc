import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { repo } from '@/server/repo/mock-repo';
import { formatTyd } from '@/lib/format';
import type { CurrentUser } from '@/lib/session';

/**
 * P4 tester - trang Chi tiết dự án với tham số thời gian mới (from/to/month/day):
 * (1) `requireProjectRead` vẫn chặn TRƯỚC mọi lần đọc dữ liệu theo mốc/ngày (không lộ dự án người khác qua URL có kỳ),
 * (2) người không xem tiền không thấy tiền ở các khối mới (S-curve, bảng tài chính theo kỳ, What-if, giá trị HĐ),
 * (3) tham số cực đoan (kỳ tương lai, kỳ 1 ngày, chuỗi dài, id lạ) không gây 500.
 * Dùng chung boilerplate mock với projects-detail-page-month-guard.test.ts.
 */
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));
vi.mock('@/components/ui/Badges', () => ({
  MarketLabel: () => null,
  PriorityBadge: () => null,
  StatusBadge: (p: { status: string }) => React.createElement('span', null, `status:${p.status}`),
  TypeLabel: () => null,
}));
vi.mock('@/components/project/WhatIf', () => ({ WhatIf: () => React.createElement('div', null, 'whatif-rendered') }));
vi.mock('@/components/project/ProjectSwitcher', () => ({ ProjectSwitcher: () => null }));
vi.mock('@/components/project/DetailTimeBar', () => ({ DetailTimeBar: () => null }));
vi.mock('@/components/project/ResourceDayNav', () => ({ ResourceDayNav: () => null }));

import { getCurrentUser } from '@/lib/session';
import ProjectDetailPage from '../../app/[locale]/(app)/projects/[id]/page';

(globalThis as unknown as { React: typeof React }).React = React;

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const PM: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: true };

const PARAMS = { from: '2026-01-01', to: '2026-08-31', month: '2026-06', day: '2026-06-10' };

const render = async (
  searchParams: Record<string, string | string[] | undefined>,
  projectId = '1',
) =>
  renderToStaticMarkup(
    (await ProjectDetailPage({
      params: Promise.resolve({ id: projectId, locale: 'vi' }),
      searchParams: Promise.resolve(searchParams),
    })) as React.ReactElement,
  );

beforeEach(() => {
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Chi tiết P4: requireProjectRead chặn trước mọi lần đọc theo mốc/ngày', () => {
  const READERS = ['getProject', 'getFacts', 'readValueChainAsOf', 'readLastDailyDate', 'getFinancial'] as const;

  it('data-entry không được gán dự án 9, dù URL có from/to/month/day: NOT_FOUND và không hàm đọc nào được gọi', async () => {
    (getCurrentUser as Mock).mockResolvedValue(PM);
    const spies = READERS.map((k) => vi.spyOn(repo as never, k as never));
    await expect(render(PARAMS, '9')).rejects.toThrow('NOT_FOUND');
    for (const [i, s] of spies.entries()) expect(s, READERS[i]).not.toHaveBeenCalled();
  });

  it('viewer không được gán dự án 3: NOT_FOUND, cùng thông điệp với dự án không tồn tại (không lộ id nào có thật)', async () => {
    (getCurrentUser as Mock).mockResolvedValue(VIEWER);
    await expect(render(PARAMS, '3')).rejects.toThrow('NOT_FOUND');
    await expect(render(PARAMS, '99999')).rejects.toThrow('NOT_FOUND');
  });

  it('id không phải số nguyên dương chuẩn (1.0, 1e0, 0x1, 0, -1, rỗng) bị chặn trước khi đọc dữ liệu', async () => {
    const spy = vi.spyOn(repo as never, 'getProject' as never);
    for (const id of ['1.0', '1e0', '0x1', '0', '-1', '01', ' 1']) {
      await expect(render({}, id), id).rejects.toThrow('NOT_FOUND');
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('viewer được gán dự án 1 vẫn xem được (đối chứng đường chạy thuận lợi) và tên dự án hiện ra', async () => {
    (getCurrentUser as Mock).mockResolvedValue(VIEWER);
    await expect(render(PARAMS, '1')).resolves.toContain(repo.getProject(1)!.projectName);
  });
});

describe('Chi tiết P4: che tiền với người không xem tài chính khi có kỳ/mốc', () => {
  it('admin: có S-curve, bảng tài chính, What-if và giá trị HĐ (đối chứng)', async () => {
    const out = await render(PARAMS);
    expect(out).toContain('detail.sCurve12');
    expect(out).toContain('detail.financial');
    expect(out).toContain('whatif-rendered');
    expect(out).toContain('metric.contractValue');
    expect(out).toContain(formatTyd(repo.getProject(1)!.contractValue, 'vi'));
  });

  it('viewer: không có S-curve, bảng tài chính, What-if, giá trị HĐ; số HĐ không rò vào HTML', async () => {
    (getCurrentUser as Mock).mockResolvedValue(VIEWER);
    const out = await render(PARAMS);
    expect(out).not.toContain('detail.sCurve12');
    expect(out).not.toContain('detail.financial');
    expect(out).not.toContain('whatif-rendered');
    expect(out).not.toContain('metric.contractValue');
    expect(out).not.toContain(formatTyd(repo.getProject(1)!.contractValue, 'vi'));
  });

  it('viewer không đọc bảng tài chính từ repo (không gọi getFinancial) dù kỳ trải nhiều tháng', async () => {
    (getCurrentUser as Mock).mockResolvedValue(VIEWER);
    const spy = vi.spyOn(repo as never, 'getFinancial' as never);
    await render({ from: '2025-01-01', to: '2026-09-30' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('viewer: SPI/CPI (không phải tiền) vẫn hiện', async () => {
    (getCurrentUser as Mock).mockResolvedValue(VIEWER);
    expect(await render(PARAMS)).toContain('detail.spiCpi12');
  });
});

describe('Chi tiết P4: tham số cực đoan không gây 500', () => {
  const name = () => repo.getProject(1)!.projectName;

  it.each([
    ['kỳ nằm hẳn trong tương lai', { from: '2027-01-01', to: '2027-06-30' }],
    ['kỳ 1 ngày', { from: '2026-05-10', to: '2026-05-10' }],
    ['kỳ đảo', { from: '2026-08-31', to: '2026-01-01' }],
    ['kỳ trước khi dự án có số', { from: '2020-01-01', to: '2020-12-31' }],
    ['month=9999-12', { month: '9999-12' }],
    ['month=0000-00', { month: '0000-00' }],
    ['day tương lai xa', { day: '9999-12-31' }],
    ['day ngày 30/02', { day: '2026-02-30' }],
    ['chuỗi rất dài', { from: 'x'.repeat(5000), to: 'y'.repeat(5000), month: 'z'.repeat(5000), day: 'w'.repeat(5000) }],
    ['tham số lặp (mảng)', { from: ['2026-01-01', '2026-02-01'], month: ['2026-03', '2026-04'] }],
  ] as [string, Record<string, string | string[]>][])('%s: vẫn render tên dự án', async (_n, sp) => {
    await expect(render(sp)).resolves.toContain(name());
  });

  it('kỳ tương lai: chart không có điểm nào ở tháng chưa tới (không bịa số tương lai)', async () => {
    const out = await render({ from: '2027-01-01', to: '2027-06-30' });
    expect(out).not.toMatch(/2027-0[1-6]/);
  });
});
