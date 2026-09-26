import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Switch } from './Switch';

(globalThis as unknown as { React: typeof React }).React = React;

describe('Switch', () => {
  it('checked=true -> class "switch on" + aria-checked true', () => {
    const out = renderToStaticMarkup(React.createElement(Switch, { checked: true, label: 'Bật' }));
    expect(out).toContain('class="switch on"');
    expect(out).toContain('aria-checked="true"');
  });

  it('checked=false -> class "switch" (khong co "on")', () => {
    const out = renderToStaticMarkup(React.createElement(Switch, { checked: false, label: 'Tắt' }));
    expect(out).toContain('class="switch"');
    expect(out).toContain('aria-checked="false"');
  });
});
