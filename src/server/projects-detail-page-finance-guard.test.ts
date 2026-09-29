import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '@/lib/session';

/**
 * Task 8 (P1A) - `canViewFinance = user?.canViewFinance ?? false` (fail-closed) ở
 * app/[locale]/(app)/projects/[id]/page.tsx dòng 64. Trước sửa là `?? true` (fail-open):
 * bất kỳ user nào thiếu trường `canViewFinance` (token cũ, race condition session, bug ở
 * chỗ khác gán quên field) đều bị lộ khối tài chính. Bài test này khoá hành vi fail-closed
 * lại bằng cách render THẬT trang (không mock canViewFinance) với user thiếu hẳn field đó,
 * độc lập với các test Task 6 vốn chỉ dùng user đã set sẵn true/false tường minh.
 *
 * Dùng chung boilerplate mock với projects-detail-page-render.test.ts.
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
vi.mock('@/components/project/DetailTimeBar', () => ({ DetailTimeBar: () => null }));
vi.mock('@/components/project/ResourceDayNav', () => ({ ResourceDayNav: () => null }));

import { getCurrentUser } from '@/lib/session';
import ProjectDetailPage from '../../app/[locale]/(app)/projects/[id]/page';

(globalThis as unknown as { React: typeof React }).React = React;

async function render(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
  return renderToStaticMarkup(
    (await ProjectDetailPage({ params: Promise.resolve({ id: '1', locale: 'vi' }), searchParams: Promise.resolve({}) })) as React.ReactElement,
  );
}

afterEach(() => vi.clearAllMocks());

describe('fail-closed canViewFinance (Task 8) - ?? false, khong phai ?? true', () => {
  it('user thieu han field canViewFinance (undefined) -> KHONG hien khoi tai chinh', async () => {
    const user = { name: 'X', email: 'x@daidung.com.vn', role: 'admin' } as unknown as CurrentUser;
    const out = await render(user);
    expect(out).not.toContain('detail.financial');
  });

  it('user.canViewFinance = true tuong minh -> hien khoi tai chinh (doi chung)', async () => {
    const user: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
    const out = await render(user);
    expect(out).toContain('detail.financial');
  });

  it('user.canViewFinance = false tuong minh -> KHONG hien khoi tai chinh', async () => {
    const user: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
    const out = await render(user);
    expect(out).not.toContain('detail.financial');
  });
});
