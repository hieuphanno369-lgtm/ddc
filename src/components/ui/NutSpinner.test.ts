import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NutSpinner } from './NutSpinner';

(globalThis as unknown as { React: typeof React }).React = React;

describe('NutSpinner', () => {
  it('render dai oc an voi doc man hinh', () => {
    const html = renderToStaticMarkup(createElement(NutSpinner, { size: 20 }));
    expect(html).toContain('data-auth="spinner"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"');
    expect(html).toContain('width="20"');
  });

  it('css quay 1s va tat khi reduced-motion', () => {
    const css = readFileSync(join(__dirname, 'NutSpinner.module.css'), 'utf8');
    expect(css).toContain('1s linear infinite');
    const m = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\{[^}]*\}\s*\}/);
    expect(m?.[0]).toContain('animation: none');
  });
});
