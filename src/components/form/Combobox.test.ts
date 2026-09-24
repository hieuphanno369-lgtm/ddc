import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combobox } from './Combobox';

// Combobox.tsx dung JSX ma khong tu import React - can shim nay (mau KpiCard.test.ts).
(globalThis as unknown as { React: typeof React }).React = React;

describe('Combobox - ARIA combobox (P1B Task 4, trang thai dong)', () => {
  it('input co role combobox, aria-expanded false, aria-autocomplete list, aria-controls khac rong, khong co aria-activedescendant', () => {
    const out = renderToStaticMarkup(
      React.createElement(Combobox, { value: '', onChange: () => {}, options: [{ value: '1', label: 'A' }] }),
    );

    expect(out).toContain('role="combobox"');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('aria-autocomplete="list"');
    const m = out.match(/aria-controls="([^"]+)"/);
    expect(m?.[1]).toBeTruthy();
    expect(out).not.toContain('aria-activedescendant');
  });
});
