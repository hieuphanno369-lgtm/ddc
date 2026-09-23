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
