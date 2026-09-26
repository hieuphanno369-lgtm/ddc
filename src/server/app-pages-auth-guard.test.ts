import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';
import type { Role } from '@/server/repo/types';

/**
 * P3D-B (S-1): 4 page (app) CHUA tu kiem dang nhap (overview, projects, projects/[id], import) -
 * doc du lieu TRUOC khi biet co phien hay khong. Test nay khoa: sau khi requireUser duoc goi,
 * cac ham doc du lieu KHONG duoc goi truoc khi redirect xay ra.
 */
const { redirectCalls } = vi.hoisted(() => ({ redirectCalls: [] as string[] }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectCalls.push(url);
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
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
vi.mock('@/components/dashboard/OverviewWidgets', () => ({
  AlertBanner: () => null,
  BacklogOverdueCard: () => null,
  CapacityCard: () => null,
  GroupBarCard: () => null,
  KpiGrid: () => null,
  ProjectListCard: () => null,
  SCurveCard: () => null,
  SpiCpiCard: () => null,
  StatusDonutCard: () => null,
  TopPriorityCard: () => null,
}));
vi.mock('@/components/dashboard/FilterBar', () => ({ FilterBar: () => null }));
vi.mock('@/components/ui/Skeleton', () => ({ CardSkeleton: () => null }));
vi.mock('@/components/form/ImportPanel', () => ({ ImportPanel: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));
vi.mock('@/components/ui/Badges', () => ({
  MarketLabel: () => null,
  PriorityBadge: () => null,
  StatusBadge: () => null,
  TypeLabel: () => null,
}));
vi.mock('@/components/project/WhatIf', () => ({ WhatIf: () => null }));
vi.mock('@/components/project/ProjectSwitcher', () => ({ ProjectSwitcher: () => null }));

import * as React from 'react';
import { getCurrentUser } from '@/lib/session';
import { repo } from '@/server/repo/mock-repo';
import OverviewPage from '../../app/[locale]/(app)/overview/page';
import ProjectsPage from '../../app/[locale]/(app)/projects/page';
import ProjectDetailPage from '../../app/[locale]/(app)/projects/[id]/page';
import ImportPage from '../../app/[locale]/(app)/import/page';

// tsconfig `jsx: preserve` -> esbuild ha JSX ve React.createElement cho .tsx duoc import;
// React la bien tu do trong module trang -> phai co global (mau pages-role-guard.test.ts).
(globalThis as unknown as { React: typeof React }).React = React;

const user = (role: Role): CurrentUser => ({ name: role, email: `${role}@daidung.com.vn`, role, canViewFinance: true });

function login(u: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(u);
}

/** Goi page, tra ve URL da redirect (hoac null neu trang render binh thuong khong nem loi). */
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

afterEach(() => vi.clearAllMocks());

describe('overview/page.tsx - chua tu kiem dang nhap (S-1)', () => {
  it('chua dang nhap -> REDIRECT:/vi/login; khong doc du lieu', async () => {
    login(null);
    const readLastAuditAt = vi.spyOn(repo, 'readLastAuditAt');
    const getDims = vi.spyOn(repo, 'getDims');
    expect(await visit(() => OverviewPage({ searchParams: {} }))).toBe('/vi/login');
    expect(readLastAuditAt).not.toHaveBeenCalled();
    expect(getDims).not.toHaveBeenCalled();
  });

  it('data-entry -> REDIRECT:/vi/nhap-lieu', async () => {
    login(user('data-entry'));
    expect(await visit(() => OverviewPage({ searchParams: {} }))).toBe('/vi/nhap-lieu');
  });

  it('admin/viewer/bod -> khong redirect', async () => {
    for (const r of ['admin', 'viewer', 'bod'] as const) {
      login(user(r));
      expect(await visit(() => OverviewPage({ searchParams: {} }))).toBeNull();
    }
  });
});

describe('projects/page.tsx - chua tu kiem dang nhap (S-1)', () => {
  it('chua dang nhap -> REDIRECT:/vi/login; khong doc listProjects', async () => {
    login(null);
    const listProjects = vi.spyOn(repo, 'listProjects');
    expect(await visit(() => ProjectsPage({ params: { locale: 'vi' } }))).toBe('/vi/login');
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('chua dang nhap, locale en -> REDIRECT:/en/login', async () => {
    login(null);
    expect(await visit(() => ProjectsPage({ params: { locale: 'en' } }))).toBe('/en/login');
  });

  it('viewer -> redirect bat dau bang /vi/projects/ (hanh vi cu giu nguyen)', async () => {
    login(user('viewer'));
    const url = await visit(() => ProjectsPage({ params: { locale: 'vi' } }));
    expect(url).toMatch(/^\/vi\/projects\//);
  });
});

describe('projects/[id]/page.tsx - chua tu kiem dang nhap (S-1)', () => {
  it('chua dang nhap -> REDIRECT:/vi/login (truoc day la NOT_FOUND); khong doc getProject', async () => {
    login(null);
    const getProject = vi.spyOn(repo, 'getProject');
    const url = await visit(() => ProjectDetailPage({ params: { id: '1', locale: 'vi' }, searchParams: {} }));
    expect(url).toBe('/vi/login');
    expect(getProject).not.toHaveBeenCalled();
  });
});

describe('import/page.tsx - chua tu kiem dang nhap (S-1)', () => {
  it('chua dang nhap -> REDIRECT:/vi/login; khong doc listProjects/getSapQueue', async () => {
    login(null);
    const listProjects = vi.spyOn(repo, 'listProjects');
    const getSapQueue = vi.spyOn(repo, 'getSapQueue');
    expect(await visit(() => ImportPage())).toBe('/vi/login');
    expect(listProjects).not.toHaveBeenCalled();
    expect(getSapQueue).not.toHaveBeenCalled();
  });

  it('viewer -> REDIRECT:/vi/overview; bod -> REDIRECT:/vi/overview', async () => {
    login(user('viewer'));
    expect(await visit(() => ImportPage())).toBe('/vi/overview');
    login(user('bod'));
    expect(await visit(() => ImportPage())).toBe('/vi/overview');
  });

  it('admin/data-entry -> khong redirect', async () => {
    login(user('admin'));
    expect(await visit(() => ImportPage())).toBeNull();
    login(user('data-entry'));
    expect(await visit(() => ImportPage())).toBeNull();
  });
});
