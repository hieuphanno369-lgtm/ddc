import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '@/lib/session';

/**
 * Dot 2 - render THAT trang app/[locale]/(app)/projects/[id]/page.tsx cho tung Task khop
 * mock-up. Dung chung boilerplate voi projects-detail-page-month-guard.test.ts (dong 1-46).
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
// Badges/WhatIf/ProjectSwitcher là client component (useTranslations/useLocale/useRouter) -
// không gọi được ở renderToStaticMarkup, in thẳng prop cần kiểm ra HTML giống pattern có sẵn
// ở operation-pages-render.test.ts.
vi.mock('@/components/ui/Badges', () => ({
  MarketLabel: () => null,
  PriorityBadge: () => null,
  StatusBadge: (p: { status: string }) => React.createElement('span', null, `status:${p.status}`),
  TypeLabel: () => null,
}));
vi.mock('@/components/project/WhatIf', () => ({ WhatIf: () => null }));
vi.mock('@/components/project/ProjectSwitcher', () => ({ ProjectSwitcher: () => null }));

import { getCurrentUser } from '@/lib/session';
import ProjectDetailPage from '../../app/[locale]/(app)/projects/[id]/page';

(globalThis as unknown as { React: typeof React }).React = React;

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

async function render(searchParams: Record<string, string> = {}, projectId = '1', user: CurrentUser = ADMIN) {
  (getCurrentUser as Mock).mockResolvedValue(user);
  return renderToStaticMarkup(
    (await ProjectDetailPage({ params: { id: projectId, locale: 'vi' }, searchParams })) as React.ReactElement,
  );
}

afterEach(() => vi.clearAllMocks());

describe('Task 1 - 3 the "Trong tam" (%TT, SPI, CPI) dung canh nhau', () => {
  it('dung 3 the .kpi.key, gan dung %TT/SPI/CPI', async () => {
    const out = await render();
    const keys = [...out.matchAll(/class="kpi rise key"><span class="tag">kpi\.focusTag<\/span><div class="lb">([^<]+)<\/div>/g)].map((m) => m[1]);
    expect(keys).toEqual(['metric.pctActual', 'metric.spi', 'metric.cpi']);
  });
  it('thu tu 6 the: %KH, %TT, SPI, CPI, Tong nhan luc, Tong thiet bi (P1B Task 1: thay EAC/VAC)', async () => {
    const out = await render();
    const pos = ['metric.pctPlan', 'metric.pctActual', 'metric.spi', 'metric.cpi', 'resourceKpi.manpowerTotal', 'resourceKpi.equipmentTotal']
      .map((k) => out.indexOf(`<div class="lb">${k}</div>`));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it('khong con the EAC/VAC rieng (bang EVM van co the chua metric.eac trong <td>, khong assert chuoi tron)', async () => {
    const out = await render();
    expect(out).not.toContain('<div class="lb">metric.eac</div>');
    expect(out).not.toContain('<div class="lb">metric.vac</div>');
    expect(out).not.toContain('kpis k2');
  });

  it('the Tong nhan luc/thiet bi la anchor cuon toi dung card Tang 4, kem KH + so nha thau', async () => {
    const out = await render();
    expect(out).toContain('href="#res-manpower"');
    expect(out).toContain('id="res-manpower"');
    expect(out).toContain('href="#res-equipment"');
    expect(out).toContain('id="res-equipment"');
    expect(out).toContain('resourceKpi.planContractors');
  });

  it('du an 17 (chua co du lieu ngay): khong hien KH/so nha thau, hien "Chua co du lieu"', async () => {
    const out = await render({}, '17');
    expect(out).not.toContain('resourceKpi.planContractors');
    expect(out).toContain('detail.noDailyData');
  });
});

describe('Task 2 - Timeline KH/TT dang thanh', () => {
  it('du an 1: co .tl, vien Hom nay, thanh TT, dong chan 4 muc', async () => {
    const out = await render();
    for (const s of ['class="tl"', 'class="todaypill"', 'detail.tl.todayPill', 'class="tlbar act"', 'class="tlfoot"', 'detail.tl.startDelay', 'detail.tl.gap']) expect(out).toContain(s);
  });
  it('du an 17 (chua khoi cong): khong co thanh TT, hien "Chua khoi cong"', async () => {
    const out = await render({}, '17');
    expect(out).toContain('detail.tl.notStarted');
    expect(out).not.toContain('class="tlbar act"');
  });
});

describe('T13a - cot trong so chuoi gia tri lay that tu project_stage_weight (P1B Task 2)', () => {
  it('du an 1: trong so mac dinh 5/10/10/40/5/27/3 -> co "40%" (fabrication) va "5%" (design), khong con dau "-" cung', async () => {
    const out = await render();
    expect(out).toContain('class="w">40%</span>');
    expect(out).toContain('class="w">5%</span>');
    expect(out).not.toContain('class="w">-</span>');
  });
});

describe('Task 6 - the "Cac moc chinh" + nut "Sua moc" theo vai tro', () => {
  it('admin thay the + link toi dung buoc Ho so', async () => {
    const out = await render();
    expect(out).toContain('detail.keyMs.title');
    expect(out).toContain('href="/nhap-lieu?project=1&amp;step=profile#key-milestones"');
  });
  it('bod va viewer KHONG thay nut sua', async () => {
    expect(await render({}, '1', BOD)).not.toContain('step=profile');
    expect(await render({}, '1', VIEWER)).not.toContain('step=profile');
  });
});
