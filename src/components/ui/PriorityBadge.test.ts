/** Rule Priority (chu du an chot 2026-09-29): P0 vang nhan thuong hieu, P1 navy, P2/P3 xam; khong dung do/cam. */
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

import { PriorityBadge } from './Badges';

const render = (priority: 'P0' | 'P1' | 'P2' | 'P3') =>
  renderToStaticMarkup(React.createElement(PriorityBadge, { priority }));

describe('PriorityBadge', () => {
  it.each([
    ['P0', 'c-gold'],
    ['P1', 'c-info'],
    ['P2', 'c-plain'],
    ['P3', 'c-plain'],
  ] as const)('%s -> %s', (p, cls) => {
    expect(render(p)).toContain(`chip ${cls}`);
  });

  it.each(['P0', 'P1', 'P2', 'P3'] as const)('%s khong dung mau canh bao (do/cam)', (p) => {
    const out = render(p);
    expect(out).not.toContain('c-dan');
    expect(out).not.toContain('c-warn');
  });
});
