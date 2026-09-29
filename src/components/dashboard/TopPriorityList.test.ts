import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SafeProjectSummary } from '@/lib/finance-gate';

// TopPriorityList.tsx dung JSX ma khong tu import React - can shim nay (mau Watchlist.test.ts).
(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k, useLocale: () => 'vi' }));
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));

import { TopPriorityList } from './TopPriorityList';

const row = (id: number, onTrack = true): SafeProjectSummary =>
  ({
    id,
    projectName: `Du an ${id}`,
    priority: 'P0',
    status: 'Dang_trien_khai',
    onTrack,
    pctActual: 0.4,
    pctPlan: 0.5,
    contractValue: null,
  }) as unknown as SafeProjectSummary;

const render = (items: SafeProjectSummary[]) => renderToStaticMarkup(React.createElement(TopPriorityList, { items, period: { from: '2026-07-01', to: '2026-09-16' } }));

describe('TopPriorityList - the Top du an trong diem (P3C-B T2)', () => {
  it('7 muc: khung danh sach co overflow-y auto va max-height 400px (gia tri du phong SSR)', () => {
    const out = render(Array.from({ length: 7 }, (_, i) => row(i + 1)));
    expect(out).toContain('overflow-y:auto');
    expect(out).toContain('max-height:400px');
  });

  it('3 muc: khong co max-height (khong can cuon)', () => {
    const out = render(Array.from({ length: 3 }, (_, i) => row(i + 1)));
    expect(out).not.toContain('max-height');
  });

  // Chu du an chot 2026-09-29: the Top khong hien tre/dung tien do (xem o trang Chi tiet), cham mau vang P0.
  it.each([
    ['du an tre', false],
    ['du an dung tien do', true],
  ])('%s: cham vang P0, khong nhan tre/dung, khong mau do/xanh trang thai', (_n, onTrack) => {
    const out = render([row(1, onTrack)]);
    expect(out).toContain('background:var(--gold)');
    expect(out).not.toContain('topPriority.behind');
    expect(out).not.toContain('topPriority.onTrack');
    expect(out).not.toContain('var(--danger)');
    expect(out).not.toContain('var(--ok)');
  });

  it('dong hien % TT, % KH va link toi chi tiet du an', () => {
    const out = render([row(5)]);
    expect(out).toContain('href="/projects/5?from=2026-07-01&amp;to=2026-09-16"');
    expect(out).toContain('metric.pctActual');
    expect(out).toContain('metric.pctPlan');
    expect(out).toMatch(/40\s?%/);
    expect(out).toMatch(/50\s?%/);
  });

  it('rong: hien topPriority.empty', () => {
    const out = render([]);
    expect(out).toContain('topPriority.empty');
    expect(out).toContain('topPriority.title');
  });

  it('khong hien so tien (ke ca khi du lieu con contractValue)', () => {
    const leaked = { ...row(1), contractValue: 987654 } as unknown as SafeProjectSummary;
    const out = render([leaked]);
    expect(out).not.toContain('987654');
    expect(out).not.toContain('987.654');
  });
});

describe('TopPriorityList - link giu ky (P4 D-23)', () => {
  it('link sang Chi tiet mang from/to cua ky dang xem', () => {
    const html = render([{ id: 7, projectName: 'A', status: 'Dang_trien_khai', onTrack: true, pctActual: 0.5, pctPlan: 0.5 } as unknown as SafeProjectSummary]);
    expect(html).toContain('/projects/7?from=2026-07-01&amp;to=2026-09-16');
  });
});
