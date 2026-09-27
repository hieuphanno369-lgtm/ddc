import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '@/lib/session';

/**
 * N-3 (Task 2) - trang Chi tiết dự án che HĐ/S-curve/What-if/message alert tiền cho người
 * không có quyền tài chính. Boilerplate y hệt projects-detail-page-finance-guard.test.ts.
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
vi.mock('@/components/project/WhatIf', () => ({ WhatIf: () => null }));
vi.mock('@/components/project/ProjectSwitcher', () => ({ ProjectSwitcher: () => null }));

import { getCurrentUser } from '@/lib/session';
import { repo } from '@/server/repo/mock-repo';
import ProjectDetailPage from '../../app/[locale]/(app)/projects/[id]/page';

(globalThis as unknown as { React: typeof React }).React = React;

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

async function render(user: CurrentUser) {
  (getCurrentUser as Mock).mockResolvedValue(user);
  return renderToStaticMarkup(
    (await ProjectDetailPage({ params: Promise.resolve({ id: '1', locale: 'vi' }), searchParams: Promise.resolve({}) })) as React.ReactElement,
  );
}

beforeEach(() => repo.reset());
afterEach(() => vi.clearAllMocks());

describe('N-3 - trang Chi tiết dự án che số tiền khi khong quyen tai chinh', () => {
  it('viewer (canViewFinance=false): khong hien HD, S-curve 12 thang, What-if, khoi tai chinh; van hien tonnage + SPI/CPI', async () => {
    const out = await render(VIEWER);
    expect(out).not.toContain('metric.contractValue');
    expect(out).not.toContain('detail.sCurve12');
    expect(out).not.toContain('whatif.title');
    expect(out).not.toContain('detail.financial');
    expect(out).toContain('financeGate.tonnage');
    expect(out).toContain('detail.spiCpi12');
    expect(out).not.toMatch(/"pv":/);
    expect(out).not.toMatch(/"bac":/);
  });

  it('admin (canViewFinance=true): hien du HD, S-curve, What-if', async () => {
    const out = await render(ADMIN);
    expect(out).toContain('metric.contractValue');
    expect(out).toContain('detail.sCurve12');
    expect(out).toContain('whatif.title');
  });

  it('repo.getFinancial KHONG duoc goi khi viewer khong co quyen tai chinh', async () => {
    const spy = vi.spyOn(repo, 'getFinancial');
    await render(VIEWER);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('alert cong no qua han (co so tien): viewer thay financeGate.alertHidden, khong thay so tien; admin thay nguyen van', async () => {
    repo.insertEngineAlerts([
      {
        projectId: 1,
        alertType: 'Amber',
        ruleCode: 'ar_overdue',
        dedupeKey: 'ar_overdue:e2e-task2',
        ruleTriggered: 'Công nợ quá hạn > 5% HĐ',
        message: 'Công nợ quá hạn 12.5 tỷ = 6.0% giá trị HĐ',
        owner: 'BOD',
        deadline: '2026-09-30',
        openedAt: new Date().toISOString(),
      },
    ]);

    const outViewer = await render(VIEWER);
    expect(outViewer).toContain('financeGate.alertHidden');
    expect(outViewer).not.toContain('12.5 tỷ');

    const outAdmin = await render(ADMIN);
    expect(outAdmin).toContain('12.5 tỷ');
  });
});
