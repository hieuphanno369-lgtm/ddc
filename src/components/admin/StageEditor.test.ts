import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stages as seedStages } from '@/data/seed/erp';
import type { Stage } from '@/server/repo/types';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/server/actions-master', () => ({ saveStageAction: vi.fn(), setStageActiveAction: vi.fn() }));

import { StageEditor } from './StageEditor';

const render = (stages: Stage[]) => renderToStaticMarkup(React.createElement(StageEditor, { stages }));

/** P7-C2 Task 8: bảng quản trị giai đoạn trên /admin. */
describe('StageEditor', () => {
  it('render du 8 giai doan seed (ten VI + EN), co dong them moi va chu thich', () => {
    const out = render(seedStages);
    for (const s of seedStages) {
      expect(out).toContain(`value="${s.nameVi}"`);
      expect(out).toContain(`value="${s.nameEn}"`);
    }
    expect(out).toContain('stageAdmin.add');
    expect(out).toContain('stageAdmin.hint');
  });

  it('xep theo sortOrder roi code, khong theo thu tu mang dau vao', () => {
    const a: Stage = { code: 'b_two', nameVi: 'Hai', nameEn: 'Two', sortOrder: 2, calcMode: 'manual', side: 'left', isActive: true };
    const b: Stage = { code: 'a_one', nameVi: 'Một', nameEn: 'One', sortOrder: 2, calcMode: 'manual', side: 'right', isActive: true };
    const c: Stage = { code: 'z_first', nameVi: 'Đầu', nameEn: 'First', sortOrder: 1, calcMode: 'volume', side: 'left', isActive: true };
    const out = render([a, b, c]);
    const pos = ['Đầu', 'Một', 'Hai'].map((n) => out.indexOf(`value="${n}"`));
    expect(pos.every((p) => p > -1)).toBe(true);
    expect([...pos].sort((x, y) => x - y)).toEqual(pos);
  });

  it('giai doan ngung dung hien trang thai inactive va nut activate; dang dung hien nut deactivate', () => {
    const out = render([
      { code: 'design', nameVi: 'Thiết kế', nameEn: 'Design', sortOrder: 1, calcMode: 'manual', side: 'left', isActive: true },
      { code: 'custom_1', nameVi: 'Bảo hành', nameEn: 'Warranty', sortOrder: 2, calcMode: 'manual', side: 'left', isActive: false },
    ]);
    expect(out).toContain('stageAdmin.inactive');
    expect(out).toContain('stageAdmin.activate');
    expect(out).toContain('stageAdmin.active');
    expect(out).toContain('stageAdmin.deactivate');
  });
});
