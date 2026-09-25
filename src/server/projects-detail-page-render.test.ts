import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  it('dung 3 the .kpi.key, gan dung %TT/SPI/CPI, KHONG con tag "Trong tam" (vong bo sung P2B)', async () => {
    const out = await render();
    const keys = [...out.matchAll(/class="kpi rise key"><div class="lb">([^<]+)<\/div>/g)].map((m) => m[1]);
    expect(keys).toEqual(['metric.pctActual', 'metric.spi', 'metric.cpi']);
    expect(out).not.toContain('class="tag"');
    expect(out).not.toContain('kpi.focusTag');
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

describe('T13b - so tuyet doi (tan) canh % o chuoi gia tri (P1B Task 3, nhanh T)', () => {
  it('du an 1: co hien so tan KH/TT cho giai doan dinh luong', async () => {
    const out = await render();
    expect(out).toContain('valueChainAbs.ton');
  });
});

describe('P2B Buoc 2 - T12b(a) chart nhan luc theo ca x nha thau', () => {
  it('co the id="res-shift" + tieu de manpowerCharts.shiftTitle, van con anchor res-manpower', async () => {
    const out = await render();
    expect(out).toContain('id="res-shift"');
    expect(out).toContain('manpowerCharts.shiftTitle');
    expect(out).toContain('href="#res-manpower"');
    expect(out).toContain('id="res-manpower"');
  });
});

describe('P2B Buoc 3 - T12b(b) chart cot chong nhan luc theo tuan', () => {
  it('co the id="res-weekly" + tieu de manpowerCharts.weeklyTitle, khong con detail.manpowerTrend', async () => {
    const out = await render();
    expect(out).toContain('id="res-weekly"');
    expect(out).toContain('manpowerCharts.weeklyTitle');
    expect(out).not.toContain('detail.manpowerTrend');
  });
});

describe('P2B Buoc 4 - T14 Gantt thiet bi', () => {
  it('co the id="eq-gantt" + tieu de equipmentGantt.title', async () => {
    const out = await render();
    expect(out).toContain('id="eq-gantt"');
    expect(out).toContain('equipmentGantt.title');
  });

  it('du an 17 (chua co ke hoach thiet bi) -> equipmentGantt.noPlan', async () => {
    const out = await render({}, '17');
    expect(out).toContain('equipmentGantt.noPlan');
  });
});

describe('Vong sua 1 muc 4 - the "Chuoi gia tri" rong het hang, bo the EVM (danh-gia.md)', () => {
  it('khong con tieu de detail.evmMetrics va cac chi so pv/sv/cv/eac rieng', async () => {
    const out = await render();
    expect(out).not.toContain('detail.evmMetrics');
    expect(out).not.toContain('metric.pv');
    expect(out).not.toContain('metric.sv');
    expect(out).not.toContain('metric.cv');
    expect(out).not.toContain('metric.eac');
  });

  it('chip "Toan bo 7 giai doan" luon hien canh chip khau nghen (neu co)', async () => {
    const out = await render();
    expect(out).toContain('valueChainCard.allStages');
  });

  it('dong chan co Sigma trong so + cong thuc %TT trong class="chainfoot"', async () => {
    const out = await render();
    expect(out).toContain('class="chainfoot"');
    expect(out).toContain('valueChainCard.footerWeight');
    expect(out).toContain('valueChainCard.footerFormula');
  });

  it('2 cot rieng (stagecol): trai design/procurement/transport/handover, phai shop/fabrication/erection dung thu tu', async () => {
    const out = await render();
    expect([...out.matchAll(/class="stagecol"/g)]).toHaveLength(2);
    const left = ['stage.design', 'stage.procurement', 'stage.transport', 'stage.handover'].map((k) => out.indexOf(`>${k}<`));
    const right = ['stage.shop', 'stage.fabrication', 'stage.erection'].map((k) => out.indexOf(`>${k}<`));
    expect(left.every((p) => p >= 0)).toBe(true);
    expect(right.every((p) => p >= 0)).toBe(true);
    expect([...left].sort((a, b) => a - b)).toEqual(left);
    expect([...right].sort((a, b) => a - b)).toEqual(right);
    // Cot phai bat dau ngay sau khi cot trai da liet ke xong (khong xen ke nhu STAGE_ORDER goc).
    expect(Math.min(...right)).toBeGreaterThan(Math.max(...left));
  });

  it('thanh tien do (.stage .fill) phai la the block hoac co display ro rang trong CSS, khong duoc la the inline-mac-dinh (vd <i>) khi rule CSS khong khai bao display - neu khong thanh se luon rong 0x0 va khong bao gio hien mau/rong theo %, ke ca hang "khau nghen" (.stage.bt .fill) khong tô cam duoc nhu mock-up doi (danh-gia.md muc 4(a)/(d)). Xac nhan bang Playwright that tren http://localhost:3001/vi/projects/1: moi hang .bar chi thay nen xam var(--fill-2), khong co gradient --accent/--accent-2 hay cam #ffb340, bat ke pct = 33% hay 100%. Mock-up mockup-apple-glass.html dong 1364 dung <div class="fill">, khong phai <i>.', async () => {
    const out = await render();
    const fillTagMatch = out.match(/<(\w+) class="fill"/);
    expect(fillTagMatch, 'khong tim thay phan tu class="fill" trong HTML render (StageRow)').not.toBeNull();
    const tag = fillTagMatch![1];

    const cssSrc = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf-8');
    const ruleMatch = cssSrc.match(/\.stage \.fill\{([^}]*)\}/);
    expect(ruleMatch, 'khong tim thay rule ".stage .fill{...}" trong app/globals.css').not.toBeNull();
    const hasExplicitDisplay = /display\s*:\s*(block|inline-block|flex|grid)/.test(ruleMatch![1]);

    // The mac dinh la display:inline (khong ap dung width/height qua CSS) - phai doi the hoac
    // CSS phai tu khai bao display khac inline thi width:NN% moi co tac dung.
    const INLINE_DEFAULT_TAGS = new Set(['i', 'span', 'em', 'b', 'strong', 'a', 'u', 'small']);
    const ok = !INLINE_DEFAULT_TAGS.has(tag) || hasExplicitDisplay;
    expect(
      ok,
      `the="<${tag} class=\"fill\">" mac dinh display:inline nhung ".stage .fill" trong app/globals.css khong khai bao "display:" -> width:${'{'}pct${'}'}% vo tac dung, thanh tien do luon rong 0x0. Sua 1 trong 2: (1) doi <i> thanh <div> o app/[locale]/(app)/projects/[id]/page.tsx (ham StageRow, dong ~579), hoac (2) them "display:block" (hoac inline-block/flex) vao rule ".stage .fill" o app/globals.css (dong ~469). KHONG sua ca 2 file nay trong test - day la ghi nhan loi cho Reviewer, khong phai cho Tester.`,
    ).toBe(true);
  });
});

describe('Task 6 - the "Cac moc chinh" + nut "Sua moc" theo vai tro', () => {
  it('admin thay the + link toi dung buoc Ho so', async () => {
    const out = await render();
    expect(out).toContain('detail.keyMs.title');
    expect(out).toContain('href="/ho-so-du-an?project=1#key-milestones"');
  });
  it('bod va viewer KHONG thay nut sua', async () => {
    expect(await render({}, '1', BOD)).not.toContain('ho-so-du-an');
    expect(await render({}, '1', VIEWER)).not.toContain('ho-so-du-an');
  });
});
