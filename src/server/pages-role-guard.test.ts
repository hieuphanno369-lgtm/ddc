import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';
import type { Role } from '@/server/repo/types';

/**
 * Guard RBAC của 4 trang mới (server component). Trang không được phó mặc middleware:
 * chưa login → /<locale>/login; sai role → /<locale>${homeForRole(role)}.
 * /audit chỉ admin; /report, /alerts, /compliance cho admin + bod.
 */
const { redirectCalls } = vi.hoisted(() => ({ redirectCalls: [] as string[] }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectCalls.push(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'vi'),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
  homeForRole: (role: Role) => (role === 'data-entry' ? '/nhap-lieu' : '/overview'),
}));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/server/actions', () => ({ closeAlertAction: vi.fn() }));
vi.mock('@/server/report', () => ({
  getReportData: vi.fn(async () => ({
    kpis: {
      totalProjects: 0,
      inProgress: 0,
      behindSchedule: 0,
      penaltyRisk: 0,
      penalized: 0,
      backlog: 0,
      delta: { totalProjects: 0, inProgress: 0, behindSchedule: 0, penaltyRisk: 0, penalized: 0, backlog: 0 },
    },
    p0Red: [],
    rows: [],
  })),
}));
// getAuditLogPage doc Prisma truc tiep - mock lai bang mock-repo de khong choc Postgres that
// (Bước 3, ke-hoach.md Task 6).
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

import * as React from 'react';
import { getCurrentUser } from '@/lib/session';
import ReportPage from '../../app/[locale]/(app)/report/page';
import AlertsPage from '../../app/[locale]/(app)/alerts/page';
import CompliancePage from '../../app/[locale]/(app)/compliance/page';
import AuditPage from '../../app/[locale]/(app)/audit/page';

// tsconfig để `jsx: preserve` nên esbuild hạ JSX về classic runtime (React.createElement)
// cho các file .tsx được import; React ở đây là biến tự do trong module trang → phải có global.
(globalThis as unknown as { React: typeof React }).React = React;

const user = (role: Role): CurrentUser => ({ name: role, email: `${role}@daidung.com.vn`, role, canViewFinance: true });

function login(u: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(u);
}

/** Gọi page, trả về URL đã redirect (hoặc null nếu trang render bình thường). */
async function visit(page: () => Promise<unknown>): Promise<string | null> {
  redirectCalls.length = 0;
  try {
    await page();
    return null;
  } catch (e) {
    const m = /^REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
}

const OPERATION_PAGES: [string, () => Promise<unknown>][] = [
  ['/report', ReportPage],
  ['/alerts', AlertsPage],
  ['/compliance', CompliancePage],
];

afterEach(() => vi.clearAllMocks());

describe.each(OPERATION_PAGES)('guard %s (admin + bod)', (_path, page) => {
  it('chưa đăng nhập → /vi/login', async () => {
    login(null);
    expect(await visit(page)).toBe('/vi/login');
  });

  it('admin được vào', async () => {
    login(user('admin'));
    expect(await visit(page)).toBeNull();
  });

  it('bod được vào', async () => {
    login(user('bod'));
    expect(await visit(page)).toBeNull();
  });

  it('data-entry bị đá về /vi/nhap-lieu', async () => {
    login(user('data-entry'));
    expect(await visit(page)).toBe('/vi/nhap-lieu');
  });

  it('viewer bị đá về /vi/overview', async () => {
    login(user('viewer'));
    expect(await visit(page)).toBe('/vi/overview');
  });
});

describe('guard /audit (CHỈ admin)', () => {
  it('chưa đăng nhập → /vi/login', async () => {
    login(null);
    expect(await visit(AuditPage)).toBe('/vi/login');
  });

  it('admin được vào', async () => {
    login(user('admin'));
    expect(await visit(AuditPage)).toBeNull();
  });

  it('bod bị đá về /vi/overview', async () => {
    login(user('bod'));
    expect(await visit(AuditPage)).toBe('/vi/overview');
  });

  it('data-entry bị đá về /vi/nhap-lieu', async () => {
    login(user('data-entry'));
    expect(await visit(AuditPage)).toBe('/vi/nhap-lieu');
  });

  it('viewer bị đá về /vi/overview', async () => {
    login(user('viewer'));
    expect(await visit(AuditPage)).toBe('/vi/overview');
  });
});
