import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from './index';

(globalThis as unknown as { React: typeof React }).React = React;

type IconFn = (p: icons.IconProps) => React.ReactElement;
const entries = Object.entries(icons).filter(
  (e): e is [string, IconFn] => e[0].startsWith('Icon') && typeof e[1] === 'function',
);

describe('bo icon P3F', () => {
  it('co it nhat 57 icon (51 cu + 6 moi)', () => {
    expect(entries.length).toBeGreaterThanOrEqual(57);
  });

  it.each(entries)('%s theo chuan net 1.8, currentColor, 24x24', (_name, Icon) => {
    const html = renderToStaticMarkup(createElement(Icon, { size: 20 }));
    for (const s of [
      'viewBox="0 0 24 24"',
      'width="20"',
      'height="20"',
      'stroke="currentColor"',
      'stroke-width="1.8"',
      'stroke-linecap="round"',
      'stroke-linejoin="round"',
      'fill="none"',
      'aria-hidden="true"',
    ]) {
      expect(html).toContain(s);
    }
    for (const s of ['fill="#', 'stroke="#', 'stroke-width="1.7"']) {
      expect(html).not.toContain(s);
    }
  });

  it('6 icon moi co mat', () => {
    for (const n of ['IconSetSquare', 'IconHexNut', 'IconMail', 'IconArrowRight', 'IconArrowLeft', 'IconStage']) {
      expect(typeof (icons as Record<string, unknown>)[n]).toBe('function');
    }
  });

  it('IconHexNut dung hinh dai oc', () => {
    const html = renderToStaticMarkup(createElement(icons.IconHexNut, {}));
    expect(html).toContain('d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"');
    expect(html).toContain('r="3.2"');
  });

  it('props ghi de duoc strokeWidth', () => {
    const html = renderToStaticMarkup(createElement(icons.IconCheck, { strokeWidth: 2 }));
    expect(html).toContain('stroke-width="2"');
    expect(html).not.toContain('stroke-width="1.8"');
  });
});
