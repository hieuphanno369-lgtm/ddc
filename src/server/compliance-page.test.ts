import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * Logic nghiệp vụ của trang /compliance: chỉ liệt kê dự án Đang_trien_khai VÀ
 * chưa có fact tháng hiện tại (khớp getMissingMonth). Seed KHÔNG có dự án nào
 * thiếu fact tháng 2026-09 nên phải tự dựng fixture mới chạm được nhánh có dòng.
 * Render tĩnh (react-dom/server) để khẳng định nội dung thật sự hiển thị.
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
  homeForRole: () => '/overview',
}));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
// Link của next-intl cần provider → thay bằng thẻ <a> để render tĩnh được.
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));
// StatusBadge là client component dùng useTranslations → stub để render tĩnh.
vi.mock('@/components/ui/Badges', () => ({ StatusBadge: () => null }));

import { getCurrentUser } from '@/lib/session';
import CompliancePage from '../../app/[locale]/(app)/compliance/page';

// tsconfig để `jsx: preserve` → esbuild hạ JSX của file .tsx được import về classic
// runtime (React.createElement); React là biến tự do trong module trang nên cần global.
(globalThis as unknown as { React: typeof React }).React = React;

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const MONTH = '2026-09';

/** Dựng 1 dự án Đang_trien_khai chưa nộp số liệu tháng này. */
function seedMissingProject(name: string, picEmail: string | null) {
  const template = repo.listProjects()[0];
  const p = repo.createProject(
    {
      projectName: name,
      customerId: template.customerId,
      teamKdId: template.teamKdId,
      marketCode: template.marketCode,
      projectType: template.projectType,
      priority: 'P1',
      contractValue: 500,
    },
    'tester',
  );
  repo.saveProjectProfile(p.id, { actualStartDate: '2026-01-15' }, 'tester');
  if (picEmail) repo.addAssignment(p.id, picEmail);
  return p;
}

async function html() {
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
  return renderToStaticMarkup((await CompliancePage()) as React.ReactElement);
}

beforeEach(() => repo.reset());
afterEach(() => {
  vi.clearAllMocks();
  repo.reset();
});

describe('/compliance - danh sách dự án chưa nộp số liệu', () => {
  it('khi mọi dự án đã nộp: hiện thông báo rỗng, không có bảng', async () => {
    const out = await html();

    expect(out).toContain('compliance.empty');
    expect(out).not.toContain('compliance.lastUpdate');
  });

  it('dự án Đang_trien_khai chưa có fact tháng này xuất hiện kèm mã DA, PIC, ngày cập nhật', async () => {
    const p = seedMissingProject('Dự án chưa nộp số liệu', 'pm1@daidung.com.vn');

    const out = await html();

    expect(out).toContain('Dự án chưa nộp số liệu');
    expect(out).toContain(p.currentAliasCode);
    expect(out).toContain('pm1@daidung.com.vn'); // không có trong userRoles → fallback về email
    expect(out).not.toContain('compliance.empty');
    expect(out).toContain('compliance.lastUpdate');
  });

  it('dự án Đang_trien_khai ĐÃ có fact tháng này không xuất hiện', async () => {
    const existing = repo.listProjects().find((p) => repo.getLatestFact(p.id, MONTH) != null)!;

    const out = await html();

    expect(out).not.toContain(existing.projectName);
    expect(out).toContain('compliance.empty');
  });

  it('dự án chưa nộp nhưng chưa khởi công (Chuan_bi) không xuất hiện', async () => {
    const template = repo.listProjects()[0];
    const p = repo.createProject(
      {
        projectName: 'Dự án chuẩn bị',
        customerId: template.customerId,
        teamKdId: template.teamKdId,
        marketCode: template.marketCode,
        projectType: template.projectType,
        priority: 'P1',
        contractValue: 100,
      },
      'tester',
    );

    const out = await html();

    expect(out).not.toContain('Dự án chuẩn bị');
    expect(out).toContain('compliance.empty');
    expect(p.actualStartDate).toBeNull();
  });
});
