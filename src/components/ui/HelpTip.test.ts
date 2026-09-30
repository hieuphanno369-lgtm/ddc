import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelpTip } from './HelpTip';

// HelpTip.tsx dung JSX ma khong tu import React - can shim nay (mau KpiCard.test.ts).
(globalThis as unknown as { React: typeof React }).React = React;

describe('HelpTip', () => {
  it('render dung nut "?" + bong bong, alignRight -> class "help rt"; co aria-describedby khop id bong bong (Task 5)', () => {
    const out = renderToStaticMarkup(React.createElement(HelpTip, { text: 'Nội dung', label: 'Giải thích', alignRight: true }));
    expect(out).toContain('class="help rt"');
    expect(out).toContain('aria-label="Giải thích"');
    const m = out.match(/aria-describedby="([^"]+)"/);
    expect(m?.[1]).toBeTruthy();
    expect(out).toContain(`<span class="bub" id="${m![1]}" role="tooltip">Nội dung</span>`);
  });

  it('khong alignRight -> class "help"', () => {
    const out = renderToStaticMarkup(React.createElement(HelpTip, { text: 'X', label: 'Y' }));
    expect(out).toContain('class="help"');
  });
});

/**
 * P4 (E3): "?" mo bang bam. Vitest chay moi truong node (khong DOM) nen o day chi khoa markup SSR;
 * hanh vi bam/tap/dong nam o e2e/31-help-tip.spec.ts, phan hinh hoc nam o tooltip-position.test.ts.
 */
describe('HelpTip - mo bang bam (P4, markup SSR)', () => {
  it('mac dinh dong: aria-expanded="false", type=button', () => {
    const out = renderToStaticMarkup(React.createElement(HelpTip, { text: 'Giai thich X', label: 'Giai thich X' }));
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('type="button"');
    expect(out).toContain('role="tooltip"');
  });

  it('bong bong khong co style inline luc SSR (khong hien san, hover/focus cu do CSS xu ly)', () => {
    const out = renderToStaticMarkup(React.createElement(HelpTip, { text: 'a', label: 'a', alignRight: true }));
    expect(out).not.toMatch(/class="bub"[^>]*style=/);
    expect(out).not.toContain('display:block');
  });
});
