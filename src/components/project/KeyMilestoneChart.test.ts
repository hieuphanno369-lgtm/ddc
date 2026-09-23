import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}|${Object.values(v).join(',')}` : k),
}));

import { repo } from '@/server/repo/mock-repo';
import { KeyMilestoneChart } from './KeyMilestoneChart';

describe('KeyMilestoneChart', () => {
  it('render dung 5 ten moc seed + trang thai dung', () => {
    const milestones = repo.getKeyMilestones(1);
    const out = renderToStaticMarkup(React.createElement(KeyMilestoneChart, { milestones, today: '2026-09-16' }));

    for (const name of ['Duyệt thiết kế kỹ thuật', 'Duyệt Shop Drawing đợt 1', 'Xuất xưởng lô đầu tiên', 'Hoàn thành lắp dựng', 'Nghiệm thu bàn giao']) {
      expect(out).toContain(name);
    }
    expect(out).toContain('detail.keyMs.doneLate|3');
    expect(out).toContain('detail.keyMs.doneLate|5');
    expect(out).toContain('detail.keyMs.late|1');
    expect(out).toContain('detail.keyMs.left|13');
  });

  it('mang rong -> hien trang thai trong', () => {
    const out = renderToStaticMarkup(React.createElement(KeyMilestoneChart, { milestones: [], today: '2026-09-16' }));
    expect(out).toContain('detail.keyMs.empty');
  });
});
