import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SignupRequestRow } from '@/server/repo/signup-types';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  useLocale: () => 'vi',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/server/actions-signup-admin', () => ({ approveSignupAction: vi.fn(), rejectSignupAction: vi.fn() }));

import { SignupRequestList } from './SignupRequestList';

const rows: SignupRequestRow[] = [
  { id: 1, email: 'a@daidung.vn', name: 'Nguyen A', departmentId: 3, departmentName: 'Ke toan', locale: 'vi', createdAt: '2026-09-29T02:00:00.000Z', requestIp: '203.0.113.5' },
  { id: 2, email: 'b@daidung.com.vn', name: 'Tran B', departmentId: null, departmentName: null, locale: 'en', createdAt: '2026-09-28T02:00:00.000Z', requestIp: '' },
];

const render = (requests: SignupRequestRow[]) => renderToStaticMarkup(React.createElement(SignupRequestList, { requests }));

describe('SignupRequestList', () => {
  it('danh sach rong -> thong bao khong co dang ky', () => {
    const html = render([]);
    expect(html).toContain('signup.pendingEmpty');
    expect(html).not.toContain('<table');
  });

  it('moi dong co ten, email, phong ban (null -> "-"), ngay gui dinh dang theo locale', () => {
    const html = render(rows);
    expect(html).toContain('Nguyen A');
    expect(html).toContain('a@daidung.vn');
    expect(html).toContain('Ke toan');
    expect(html).toContain('29/09/2026');
    expect(html).toContain('>-</td>');
    for (const k of ['signup.fullName', 'signup.companyEmail', 'signup.department', 'signup.colSubmitted', 'signup.colRole']) {
      expect(html).toContain(k);
    }
  });

  it('o vai tro co du 4 vai tro, chon san viewer; co nut Bat va Tu choi cho tung dong', () => {
    const html = render(rows);
    const selects = html.match(/<select/g) ?? [];
    expect(selects).toHaveLength(2);
    for (const label of ['role.admin', 'role.bod', 'role.dataEntry', 'role.viewer']) expect(html).toContain(label);
    expect(html).toContain('<option value="viewer" selected="">');
    expect((html.match(/signup\.approve</g) ?? [])).toHaveLength(2);
    expect((html.match(/signup\.reject</g) ?? [])).toHaveLength(2);
  });

  it('man hep: bang co minWidth 840 de cuon ngang trong .scroll', () => {
    expect(render(rows)).toContain('min-width:840px');
  });
});
