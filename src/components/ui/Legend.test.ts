import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Legend, type LegendItem } from './Legend';

// Legend.tsx dùng JSX mà không tự import React - cần shim này (mẫu KpiCard.test.ts).
(globalThis as unknown as { React: typeof React }).React = React;

const ITEMS: LegendItem[] = [
  { label: 'KH', color: 'var(--s-plan)' },
  { label: 'Hôm nay', color: 'var(--danger)', line: true },
  { label: 'HT', color: 'var(--s-third)', shape: 'diamond' },
  { label: 'DK', color: 'var(--s-cost)', shape: 'tri' },
  { label: 'BĐ', color: 'var(--s-plan)', shape: 'ring' },
];

describe('Legend - bien the hinh dang cua .legend', () => {
  it('render dung swatch mau/hinh cho tung muc', () => {
    const out = renderToStaticMarkup(React.createElement(Legend, { items: ITEMS }));

    expect(out).toContain('<i style="background:var(--s-plan)"></i>KH');
    expect(out).toContain('class="ln"');
    expect(out).toContain('transform:rotate(45deg)');
    expect(out).toContain('clip-path:polygon(50% 0,100% 100%,0 100%)');
    expect(out).toContain('background:transparent;border:2px solid var(--s-plan)');
  });
});
