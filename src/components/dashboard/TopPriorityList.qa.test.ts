import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SafeProjectSummary } from '@/lib/finance-gate';

/**
 * Test doc lap (khong sua test cua coder) cho TopPriorityList - P3C-B Buoc 10.
 * Nguon: .bangiao/ke-hoach.md muc Buoc 10, .bangiao/thay-doi.md muc "Buoc 9-10".
 * Bao 3 nhom: duong chay thuan loi, bien da neu ten trong ke hoach, va it nhat 1 ca
 * "phai that bai neu ro ri" (N-3: khong duoc lo so tien).
 */

(globalThis as unknown as { React: typeof React }).React = React;

let currentLocale = 'vi';
vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => currentLocale,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));

import { TopPriorityList } from './TopPriorityList';

function makeItem(over: Partial<SafeProjectSummary>): SafeProjectSummary {
  return {
    id: 1,
    masterCode: 'M001',
    currentAliasCode: 'A001',
    projectName: 'Du an mau',
    customerId: 1,
    customerName: 'KH',
    teamName: 'KD1',
    teamKdId: 1,
    projectType: 'EPC',
    marketCode: 'TN',
    priority: 'P0',
    status: 'Dang_trien_khai',
    onTrack: true,
    penalty: 'none',
    contractValue: null,
    tonnage: 100,
    pctPlan: 0.5,
    pctActual: 0.4,
    spi: 1,
    cpi: 1,
    eac: null,
    vac: null,
    bottleneckStage: null,
    ...over,
  } as unknown as SafeProjectSummary;
}

const render = (items: SafeProjectSummary[]) => renderToStaticMarkup(React.createElement(TopPriorityList, { items }));

describe('TopPriorityList - QA doc lap Buoc 10 (T2)', () => {
  it('duong chay thuan loi: giu nguyen thu tu dau vao (khong tu sap xep lai)', () => {
    // selectTopPriority da sap xep o tang query; component chi render dung thu tu items truyen vao.
    const items = [
      makeItem({ id: 10, projectName: 'Du an Zeta' }),
      makeItem({ id: 20, projectName: 'Du an Alpha' }),
      makeItem({ id: 30, projectName: 'Du an Mu' }),
    ];
    const out = render(items);
    const posZeta = out.indexOf('Du an Zeta');
    const posAlpha = out.indexOf('Du an Alpha');
    const posMu = out.indexOf('Du an Mu');
    expect(posZeta).toBeGreaterThan(-1);
    expect(posAlpha).toBeGreaterThan(posZeta);
    expect(posMu).toBeGreaterThan(posAlpha);
  });

  it('bien: status khac Dang_trien_khai + onTrack=false -> KHONG tinh la tre (isBehindSchedule doi hoi dung status)', () => {
    const out = render([makeItem({ id: 1, status: 'Hoan_thanh', onTrack: false })]);
    expect(out).toContain('background:var(--gold)');
    expect(out).not.toContain('topPriority.onTrack');
    expect(out).not.toContain('background:var(--danger)');
    expect(out).not.toContain('topPriority.behind');
  });

  it('bien: status Tam_dung + onTrack=false -> van la cham vang P0 (khong hien trang thai tre)', () => {
    const out = render([makeItem({ id: 2, status: 'Tam_dung', onTrack: false })]);
    expect(out).toContain('background:var(--gold)');
  });

  it('bien: pctActual = 0 -> hien 0%, pctPlan = null -> hien dau gach ngang', () => {
    const out = render([makeItem({ id: 3, pctActual: 0, pctPlan: null })]);
    expect(out).toMatch(/0\s?%/);
    expect(out).toContain('metric.pctPlan -');
  });

  it('bien: locale en -> % van hien dung, khong crash', () => {
    currentLocale = 'en';
    try {
      const out = render([makeItem({ id: 4, pctActual: 0.4, pctPlan: 0.5 })]);
      expect(out).toMatch(/40\s?%/);
      expect(out).toMatch(/50\s?%/);
    } finally {
      currentLocale = 'vi';
    }
  });

  it('PHAI THAT BAI NEU RO RI (N-3): du lieu dinh dang muc tien lon van khong hien tren markup', () => {
    const leaked = makeItem({ id: 5, contractValue: 987654321, eac: 555555, vac: -777777 });
    const out = render([leaked]);
    expect(out).not.toContain('987654321');
    expect(out).not.toContain('555555');
    expect(out).not.toContain('777777');
    expect(out).not.toMatch(/contractValue/i);
  });
});
