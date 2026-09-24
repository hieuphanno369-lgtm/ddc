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
