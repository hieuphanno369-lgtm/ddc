import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ProjectSummary } from '@/server/queries';

// Watchlist.tsx dung JSX ma khong tu import React - can shim nay (mau KpiCard.test.ts).
(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
}));

import { Watchlist } from './Watchlist';

const row = (id: number): ProjectSummary =>
  ({ id, projectName: `Du an ${id}`, spi: 0.7, cpi: 0.9, penalty: 'none' }) as unknown as ProjectSummary;

describe('Watchlist - cuon sau 5 dong (P1B Task 7, T9)', () => {
  it('7 muc: khung danh sach co overflow-y auto va max-height 400px (gia tri du phong SSR)', () => {
    const out = renderToStaticMarkup(React.createElement(Watchlist, { items: Array.from({ length: 7 }, (_, i) => row(i + 1)) }));

    expect(out).toContain('overflow-y:auto');
    expect(out).toContain('max-height:400px');
  });

  it('3 muc: khong co max-height (khong can cuon)', () => {
    const out = renderToStaticMarkup(React.createElement(Watchlist, { items: Array.from({ length: 3 }, (_, i) => row(i + 1)) }));

    expect(out).not.toContain('max-height');
  });
});
