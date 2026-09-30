import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardHeader } from './Card';

// Card.tsx dung JSX ma khong tu import React - can shim nay (mau KpiCard.test.ts).
(globalThis as unknown as { React: typeof React }).React = React;

describe('CardHeader.titleExtra', () => {
  it('title + subtitle + titleExtra: titleExtra render trong <h3>, ngay sau subtitle', () => {
    const out = renderToStaticMarkup(
      React.createElement(CardHeader, {
        title: 'T',
        subtitle: 'S',
        titleExtra: React.createElement('span', { className: 'chip c-plain' }, 'X'),
      }),
    );
    expect(out).toBe('<div class="hd"><h3>T<span class="en">S</span><span class="chip c-plain">X</span></h3></div>');
  });

  it('chi co title: khong doi hanh vi cu', () => {
    const out = renderToStaticMarkup(React.createElement(CardHeader, { title: 'T' }));
    expect(out).toBe('<div class="hd"><h3>T</h3></div>');
  });
});

describe('CardHeader.action (bao Fragment co key, DOM khong doi)', () => {
  it('action va titleExtra nhieu con: van la anh em truc tiep cua <h3>/<div.hd>, khong them the boc', () => {
    const out = renderToStaticMarkup(
      React.createElement(CardHeader, {
        title: 'T',
        titleExtra: React.createElement(React.Fragment, null, React.createElement('i', null, 'a'), React.createElement('b', null, 'b')),
        action: React.createElement('span', { className: 'legend' }, 'L'),
      }),
    );
    expect(out).toBe('<div class="hd"><h3>T<i>a</i><b>b</b></h3><span class="legend">L</span></div>');
  });

  it('khong co action/titleExtra: khong sinh gi them', () => {
    expect(renderToStaticMarkup(React.createElement(CardHeader, { title: 'T' }))).toBe('<div class="hd"><h3>T</h3></div>');
  });
});
