import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DepartmentRow } from '@/server/repo/signup-types';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/server/actions-signup-admin', () => ({
  saveDepartmentAction: vi.fn(), setDepartmentActiveAction: vi.fn(), deleteDepartmentAction: vi.fn(),
}));

import { DepartmentEditor } from './DepartmentEditor';

const departments: DepartmentRow[] = [
  { id: 1, name: 'Ke toan', isActive: true, userCount: 2, pendingCount: 0 },
  { id: 2, name: 'Kho', isActive: false, userCount: 0, pendingCount: 0 },
  { id: 3, name: 'Mua hang', isActive: true, userCount: 0, pendingCount: 1 },
];

const render = (list: DepartmentRow[]) => renderToStaticMarkup(React.createElement(DepartmentEditor, { departments: list }));

describe('DepartmentEditor', () => {
  it('hien ten, trang thai va so nguoi dung', () => {
    const html = render(departments);
    for (const n of ['Ke toan', 'Kho', 'Mua hang']) expect(html).toContain(`value="${n}"`);
    expect(html).toContain('department.active');
    expect(html).toContain('department.hidden');
    expect(html).toContain('department.hint');
    for (const k of ['department.name', 'department.status', 'department.users']) expect(html).toContain(k);
  });

  it('nut Xoa chi hien khi khong co nguoi dung va khong co dang ky cho', () => {
    const html = render(departments);
    // chi phong ban 2 (Kho) xoa duoc: 1 nut Xoa
    expect((html.match(/>department\.delete</g) ?? [])).toHaveLength(1);
  });

  it('nut An hoac Hien lai theo trang thai; luon co dong them moi', () => {
    const html = render(departments);
    expect((html.match(/>department\.hide</g) ?? [])).toHaveLength(2);
    expect((html.match(/>department\.show</g) ?? [])).toHaveLength(1);
    expect(html).toContain('department.add');
  });

  it('danh muc rong van co dong them moi', () => {
    const html = render([]);
    expect(html).toContain('department.add');
    expect(html).not.toContain('department.delete');
  });
});
