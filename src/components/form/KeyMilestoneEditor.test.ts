import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { KeyMilestoneDraft, KeyMsErrors } from '@/lib/key-milestones';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign(
      (k: string, v?: Record<string, unknown>) => {
        const m = /^form\.keyMs\.suggest\.s(\d)$/.exec(k);
        if (m) return `Mốc ${m[1]}`;
        return v ? `${k}|${Object.values(v).join(',')}` : k;
      },
      { rich: (k: string) => k },
    ),
  useLocale: () => 'vi',
}));

import { KeyMilestoneEditor } from './KeyMilestoneEditor';

const VALUE: KeyMilestoneDraft[] = [
  { name: 'Mốc 1', plannedDate: '2026-09-20', actualDate: null },
  { name: 'Xong', plannedDate: '2026-09-01', actualDate: '2026-09-03' },
];
const ERRORS: KeyMsErrors = { 0: ['name'] };

describe('KeyMilestoneEditor', () => {
  it('render dung id, gia tri, trang thai, goi y, va o loi', () => {
    const out = renderToStaticMarkup(
      React.createElement(KeyMilestoneEditor, { id: 'key-milestones', value: VALUE, onChange: () => {}, today: '2026-09-16', errors: ERRORS }),
    );

    expect(out).toContain('id="key-milestones"');
    expect(out).toContain('value="Mốc 1"');
    expect(out).toContain('detail.keyMs.left|4');
    expect(out).toContain('detail.keyMs.doneLate|2');
    for (const s of ['+ Mốc 2', '+ Mốc 3', '+ Mốc 4', '+ Mốc 5']) expect(out).toContain(s);
    expect(out).not.toContain('+ Mốc 1');
    expect(out).not.toContain('+ Mốc 6');
    expect(out).toContain('class="inp bad"');
  });
});
