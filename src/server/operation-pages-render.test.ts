import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import type { PortfolioKpis } from '@/server/queries';

/**
 * Nội dung render của 3 trang vận hành (đường thuận lợi + trạng thái rỗng mà kế
 * hoạch đã nêu tên). Render tĩnh để khẳng định đúng thứ người dùng nhìn thấy,
 * không chỉ khẳng định "không throw".
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
vi.mock('@/components/dashboard/ReportPeriodBar', () => ({ ReportPeriodBar: () => null }));
// getAuditLogPage doc Prisma truc tiep (khong qua repo) - mock lai bang du lieu cua mock-repo de
// khong choc Postgres that trong test render trang (Bước 3, ke-hoach.md Task 6).
vi.mock('@/server/audit-log-page', async () => {
  const { repo } = await import('@/server/repo/mock-repo');
  const { paginate, logSince } = await import('@/lib/log-paging');
  return {
    getAuditLogPage: vi.fn(async ({ page, range, pageSize = 20, now = new Date() }: { page: number; range: 'all' | '14d'; pageSize?: number; now?: Date }) => {
      const since = logSince(range, now);
      const rows = repo.getAuditLog().filter((a) => !since || new Date(a.changedAt) >= since);
      return { ...paginate(rows, page, pageSize), pageSize };
    }),
  };
});
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));
// AlertList là client component (useState/useRouter/useTranslations) → ghi lại props rồi trả null.
vi.mock('@/components/alerts/AlertList', () => ({
  AlertList: (props: { alerts: unknown[]; canClose: boolean }) => {
    alertListProps.push(props);
    return null;
  },
}));
// PriorityBadge/PenaltyBadge là client component (useTranslations) → in thẳng props ra HTML.
vi.mock('@/components/ui/Badges', () => ({
  PriorityBadge: (p: { priority: string }) => React.createElement('span', null, `badge-priority:${p.priority}`),
  PenaltyBadge: (p: { penalty: string }) => React.createElement('span', null, `badge-penalty:${p.penalty}`),
}));

import { getCurrentUser } from '@/lib/session';
import { getReportData } from '@/server/report';
import { defaultOverviewPeriod } from '@/lib/period';
import { todayIso } from '@/lib/clock';
import ReportPageReal from '../../app/[locale]/(app)/report/page';
const ReportPage = () => ReportPageReal({ searchParams: Promise.resolve({}) });
import AlertsPage from '../../app/[locale]/(app)/alerts/page';
import AuditPage from '../../app/[locale]/(app)/audit/page';

(globalThis as unknown as { React: typeof React }).React = React;

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const MONTH = '2026-09';

const KPIS: PortfolioKpis = {
  projectsInPeriod: 17,
  inProgress: 11,
  behindSchedule: 4,
  penaltyRisk: 3,
  penalized: 1,
  notStartedValue: 250,
  revenueInPeriod: 0,
  tonnageInPeriod: 0,
  asOfDate: '2026-09-16',
  months: ['2026-09'],
  delta: { projectsInPeriod: 1, inProgress: 0, behindSchedule: -1, penaltyRisk: 0, penalized: 0, notStartedValue: 10, revenueInPeriod: 0, tonnageInPeriod: 0 },
};

const emptyReport = { kpis: KPIS, p0Red: [], rows: [] };

const render = async (page: () => Promise<unknown>) => renderToStaticMarkup((await page()) as React.ReactElement);

beforeEach(() => {
  repo.reset();
  alertListProps.length = 0;
  vi.mocked(getReportData).mockResolvedValue(emptyReport);
});

afterEach(() => {
  vi.clearAllMocks();
  repo.reset();
});

describe('/report - render nội dung', () => {
  it('P0-Red rỗng: hiện common.noData trong card P0, không crash', async () => {
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = await render(ReportPage);

    expect(out).toContain('report.title');
    expect(out).toContain('report.p0Red');
    expect(out).toContain('common.noData');
    expect(out).not.toContain('badge-priority');
  });

  it('có dự án P0-Red: hiện tên dự án + badge, không còn noData của card P0', async () => {
    vi.mocked(getReportData).mockResolvedValue({
      kpis: KPIS,
      p0Red: [
        {
          id: 2,
          masterCode: 'M-2',
          currentAliasCode: 'DA-2',
          projectName: 'Nhà xưởng Bắc Ninh',
          customerId: 1,
          customerName: 'KH',
          teamName: 'KD1',
          teamKdId: 1,
          projectType: 'Nha_xuong',
          marketCode: 'TN',
          priority: 'P0',
          status: 'Dang_trien_khai',
          onTrack: false,
          penalty: 'penalized',
          contractValue: 100,
          tonnage: 10,
          pctPlan: 50,
          pctActual: 30,
          spi: 0.8,
          cpi: 0.9,
          eac: null,
          vac: null,
          bottleneckStage: null,
          dataState: { kind: 'current', month: '2026-09' },
        },
      ],
      rows: [{ id: 2, code: 'DA-2', name: 'Nhà xưởng Bắc Ninh', spi: null, cpi: null, pctActual: 0, backlog: 0 }],
    });
    (getCurrentUser as Mock).mockResolvedValue(BOD);

    const out = await render(ReportPage);

    expect(out).toContain('Nhà xưởng Bắc Ninh');
    expect(out).toContain('DA-2');
    expect(out).toContain('/projects/2');
    expect(out).toContain('badge-priority:P0');
    expect(out).toContain('badge-penalty:penalized');
    expect(out).toContain('report.projectTable');
    expect(out).toContain('/api/report/export');
  });

  it('T-2: kỳ từ URL được truyền vào getReportData và ghi dòng tóm tắt kỳ, không báo kỳ lỗi', async () => {
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = renderToStaticMarkup(
      (await ReportPageReal({ searchParams: Promise.resolve({ from: '2026-01-01', to: '2026-03-31' }) })) as React.ReactElement,
    );

    expect(getReportData).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-03-31' });
    expect(out).toContain('period.summary');
    expect(out).toContain('from=2026-01-01&amp;to=2026-03-31');
    expect(out).not.toContain('period.invalid');
  });

  it('T-2 và T-6: không có kỳ thì dùng 12 tháng mặc định; from/to rác thì hiện period.invalid', async () => {
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const def = await render(ReportPage);
    expect(def).not.toContain('period.invalid');
    expect(getReportData).toHaveBeenCalledWith(defaultOverviewPeriod(todayIso()));

    const junk = renderToStaticMarkup(
      (await ReportPageReal({ searchParams: Promise.resolve({ from: 'rac', to: 'rac' }) })) as React.ReactElement,
    );
    expect(junk).toContain('period.invalid');
  });

  it('bảng dự án rỗng vẫn hiện dòng thông báo trong bảng', async () => {
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = await render(ReportPage);

    expect(out).toContain('common.noData');
    expect(out).toContain('<table');
  });
});

describe('/alerts - render + lọc alert đang mở', () => {
  it('chỉ truyền alert CHƯA đóng và nối đúng tên dự án', async () => {
    const all = repo.getAlerts();
    const total = all.length;
    const closed = all[0];
    repo.closeAlert(closed.id, 'Đã xử lý', 'tester');
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    await render(AlertsPage);

    expect(alertListProps).toHaveLength(1);
    const { alerts, canClose } = alertListProps[0] as { alerts: { id: number; projectName: string }[]; canClose: boolean };
    expect(alerts).toHaveLength(total - 1);
    expect(alerts.map((a) => a.id)).not.toContain(closed.id);
    const nameById = new Map(repo.listProjects().map((p) => [p.id, p.projectName]));
    for (const a of alerts) expect(a.projectName).toBe(nameById.get(all.find((x) => x.id === a.id)!.projectId));
    expect(canClose).toBe(true);
  });

  it('BOD cũng có quyền đóng (canClose = true) - theo quyết định Q1', async () => {
    (getCurrentUser as Mock).mockResolvedValue(BOD);

    await render(AlertsPage);

    expect(alertListProps[0].canClose).toBe(true);
  });

  it('không còn alert đang mở: truyền mảng rỗng (AlertList tự hiện overview.noAlerts)', async () => {
    for (const a of repo.getAlerts()) repo.closeAlert(a.id, 'Đã xử lý', 'tester');
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    await render(AlertsPage);

    expect(alertListProps[0].alerts).toEqual([]);
  });
});

describe('/audit - render nội dung', () => {
  it('nhật ký rỗng: hiện common.noData (seed auditLog = [])', async () => {
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = await render(() => AuditPage({}));

    expect(out).toContain('audit.title');
    expect(out).toContain('common.noData');
    expect(out).not.toContain('<table');
  });

  it('có bản ghi: hiện bảng/record/field và cặp Cũ → Mới', async () => {
    repo.logAudit('fact_progress_monthly', '42', 'pctActual', '30', '45', 'admin@daidung.com.vn');
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = await render(() => AuditPage({}));

    expect(out).toContain('<table');
    expect(out).toContain('fact_progress_monthly');
    expect(out).toContain('pctActual');
    expect(out).toContain('admin@daidung.com.vn');
    expect(out).toContain('audit.old');
    expect(out).toContain('audit.new');
    expect(out).not.toContain('common.noData');
  });

  it('oldValue rỗng thì hiện dấu - thay vì ô trống', async () => {
    repo.logAudit('alert_log', '7', 'action', '', 'Đã xử lý', 'admin@daidung.com.vn');
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = await render(() => AuditPage({}));

    expect(out).toContain('Đã xử lý');
    expect(out).toMatch(/>-</);
  });

  it('25 lần ghi audit: chỉ 20 dòng dữ liệu trên trang, nút "sau" trỏ tới page=2 (P1B Task 6)', async () => {
    for (let i = 0; i < 25; i++) {
      repo.logAudit('fact_progress_monthly', String(i), 'pctActual', '1', '2', 'admin@daidung.com.vn');
    }
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = await render(() => AuditPage({}));
    const rowCount = (out.match(/<tr>/g) ?? []).length - 1; // trừ dòng <thead><tr> header

    expect(rowCount).toBe(20);
    expect(out).toContain('href="/audit?page=2"');
  });

  it('range=all: nút "14 ngày gần nhất" trỏ về /audit (bỏ tham số mặc định)', async () => {
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = await render(() => AuditPage({ searchParams: Promise.resolve({ range: 'all' }) }));

    expect(out).toContain('href="/audit"');
  });

  // Tester (P1B, Task 6): tham số rác trên URL thật (?page=..., không chỉ đơn vị parsePage())
  // phải không làm trang crash - render ở mức trang, đi qua đúng parsePage() bên trong AuditPage.
  it('?page=rac (chuoi khong phai so): khong throw, ve trang 1 nhu khong co page', async () => {
    for (let i = 0; i < 25; i++) {
      repo.logAudit('fact_progress_monthly', String(i), 'pctActual', '1', '2', 'admin@daidung.com.vn');
    }
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = await render(() => AuditPage({ searchParams: Promise.resolve({ page: 'rac' }) }));
    const rowCount = (out.match(/<tr>/g) ?? []).length - 1;

    expect(rowCount).toBe(20);
    expect(out).toContain('href="/audit?page=2"');
  });

  // Next.js cho phép ?page=2&page=3 -> searchParams.page thanh mang string[].
  it('?page bi lap lai thanh mang (Next.js searchParams) -> khong throw, fallback trang 1', async () => {
    for (let i = 0; i < 25; i++) {
      repo.logAudit('fact_progress_monthly', String(i), 'pctActual', '1', '2', 'admin@daidung.com.vn');
    }
    (getCurrentUser as Mock).mockResolvedValue(ADMIN);

    const out = await render(() => AuditPage({ searchParams: Promise.resolve({ page: ['2', '3'] }) }));
    const rowCount = (out.match(/<tr>/g) ?? []).length - 1;

    expect(rowCount).toBe(20);
    expect(out).toContain('href="/audit?page=2"');
  });
});
