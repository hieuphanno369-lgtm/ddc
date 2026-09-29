import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next-intl', () => {
  const t = Object.assign((key: string) => key, {
    rich: (key: string, vals: Record<string, (chunks: string) => React.ReactNode>) => vals.link(key),
  });
  return { useTranslations: () => t, useLocale: () => 'vi' };
});
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh() {}, replace() {} }),
  Link: (p: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: p.href, className: p.className }, p.children),
}));
vi.mock('@/server/actions-signup', () => ({ submitSignupAction: vi.fn() }));

import { SignupForm } from './SignupForm';

const render = (departments: { id: number; name: string }[], googleEnabled = false) =>
  renderToStaticMarkup(React.createElement(SignupForm, { departments, googleEnabled }));

describe('SignupForm (P3F-3)', () => {
  it('o Phong ban chi hien khi co phong ban dang dung', () => {
    const withDepartments = render([{ id: 1, name: 'Ke toan' }, { id: 2, name: 'Kho' }]);
    expect(withDepartments).toContain('id="signup-department"');
    expect(withDepartments).toContain('>Ke toan</option>');
    expect(withDepartments).toContain('signup.departmentPlaceholder');
    expect(render([])).not.toContain('id="signup-department"');
  });

  it('co o ho ten, email, mat khau voi id, autocomplete va nhan gan dung', () => {
    const html = render([]);
    expect(html).toContain('id="signup-name"');
    expect(html).toMatch(/autocomplete="name"/i);
    expect(html).toContain('id="signup-email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('id="signup-password"');
    expect(html).toMatch(/autocomplete="new-password"/i);
    expect(html).toContain('<label for="signup-name"');
    expect(html).toContain('<label for="signup-email"');
    expect(html).toContain('<label for="signup-password"');
    expect(html).toContain('signup.emailHint');
  });

  it('co link Dieu khoan va link ve dang nhap', () => {
    const html = render([]);
    expect(html).toContain('href="/dieu-khoan"');
    expect(html).toContain('href="/login"');
  });

  it('khong co o checkbox nao', () => {
    expect(render([{ id: 1, name: 'A' }], true)).not.toContain('type="checkbox"');
  });

  it('nut Google chi hien khi googleEnabled', () => {
    expect(render([], false)).not.toContain('authPage.continueGoogle');
    expect(render([], true)).toContain('authPage.continueGoogle');
  });
});
