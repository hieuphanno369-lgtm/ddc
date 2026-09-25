import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import type { PortfolioKpis } from '@/server/queries';

/**
 * N-3 (Task 2) - ReportPage bo KPI/cot backlog, AlertsPage che message alert tien, khi
 * user.canViewFinance = false (giả lập BOD bị Quản trị tắt quyền tài chính - Q6).
 * Boilerplate y hệt operation-pages-render.test.ts.
 */
const { alertListProps } = vi.hoisted(() => ({ alertListProps: [] as { alerts: unknown[]; canClose: boolean }[] }));

vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
  homeForRole: () => '/overview',
}));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/server/report', () => ({ getReportData: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));
vi.mock('@/components/alerts/AlertList', () => ({
  AlertList: (props: { alerts: unknown[]; canClose: boolean }) => {
    alertListProps.push(props);
    return null;
  },
}));

import { getCurrentUser } from '@/lib/session';
import { getReportData } from '@/server/report';
import ReportPage from '../../app/[locale]/(app)/report/page';
import AlertsPage from '../../app/[locale]/(app)/alerts/page';

(globalThis as unknown as { React: typeof React }).React = React;

const BOD_NO_FINANCE: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: false };
const BOD_FINANCE: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

const KPIS: PortfolioKpis = {
  totalProjects: 17,
  inProgress: 11,
  behindSchedule: 4,
  penaltyRisk: 3,
  penalized: 1,
  backlog: 250,
  delta: { totalProjects: 1, inProgress: 0, behindSchedule: -1, penaltyRisk: 0, penalized: 0, backlog: 10 },
};

const render = async (page: () => Promise<unknown>) => renderToStaticMarkup((await page()) as React.ReactElement);

beforeEach(() => {
  repo.reset();
  alertListProps.length = 0;
  vi.mocked(getReportData).mockResolvedValue({ kpis: KPIS, p0Red: [], rows: [] });
});

afterEach(() => vi.clearAllMocks());

describe('/report - BOD bi tat quyen tai chinh (Q6) khong thay backlog', () => {
  it('canViewFinance=false -> khong co kpi.backlog', async () => {
    (getCurrentUser as Mock).mockResolvedValue(BOD_NO_FINANCE);
    const out = await render(ReportPage);
    expect(out).not.toContain('kpi.backlog');
  });

  it('canViewFinance=true -> co kpi.backlog', async () => {
    (getCurrentUser as Mock).mockResolvedValue(BOD_FINANCE);
    const out = await render(ReportPage);
    expect(out).toContain('kpi.backlog');
  });
});

describe('/alerts - che message alert cong no qua han khi khong quyen tai chinh', () => {
  it('canViewFinance=false -> message alert tien thanh financeGate.alertHidden', async () => {
    repo.insertEngineAlerts([
      {
        projectId: 1,
        alertType: 'Amber',
        ruleCode: 'ar_overdue',
        dedupeKey: 'ar_overdue:e2e-alerts-page',
        ruleTriggered: 'Công nợ quá hạn > 5% HĐ',
        message: 'Công nợ quá hạn 12.5 tỷ = 6.0% giá trị HĐ',
        owner: 'BOD',
        deadline: '2026-09-30',
        openedAt: new Date().toISOString(),
      },
    ]);
    (getCurrentUser as Mock).mockResolvedValue(BOD_NO_FINANCE);

    await render(AlertsPage);

    const { alerts } = alertListProps[0] as { alerts: { ruleCode: string | null; message: string }[] };
    const moneyAlert = alerts.find((a) => a.ruleCode === 'ar_overdue');
    expect(moneyAlert?.message).toBe('financeGate.alertHidden');
  });

  it('canViewFinance=true -> giu nguyen message', async () => {
    repo.insertEngineAlerts([
      {
        projectId: 1,
        alertType: 'Amber',
        ruleCode: 'ar_overdue',
        dedupeKey: 'ar_overdue:e2e-alerts-page-2',
        ruleTriggered: 'Công nợ quá hạn > 5% HĐ',
        message: 'Công nợ quá hạn 12.5 tỷ = 6.0% giá trị HĐ',
        owner: 'BOD',
        deadline: '2026-09-30',
        openedAt: new Date().toISOString(),
      },
    ]);
    (getCurrentUser as Mock).mockResolvedValue(BOD_FINANCE);

    await render(AlertsPage);

    const { alerts } = alertListProps[0] as { alerts: { ruleCode: string | null; message: string }[] };
    const moneyAlert = alerts.find((a) => a.ruleCode === 'ar_overdue');
    expect(moneyAlert?.message).toBe('Công nợ quá hạn 12.5 tỷ = 6.0% giá trị HĐ');
  });
});
