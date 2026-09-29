import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'vi',
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace() {} }),
  Link: (p: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: p.href, className: p.className }, p.children),
}));
vi.mock('@/components/ui/motion', () => ({ usePressable: () => {} }));

import { LoginForm } from './LoginForm';

const render = (props: { googleEnabled: boolean; initialError?: 'googleDenied' | null }) =>
  renderToStaticMarkup(React.createElement(LoginForm, props));

describe('LoginForm (P3F)', () => {
  it('o email va mat khau co id, autocomplete va nhan gan dung', () => {
    const html = render({ googleEnabled: false });
    expect(html).toContain('id="auth-email"');
    expect(html).toMatch(/autocomplete="email"/i);
    expect(html).toContain('id="auth-password"');
    expect(html).toMatch(/autocomplete="current-password"/i);
    expect(html).toContain('<label for="auth-email"');
    expect(html).toContain('<label for="auth-password"');
  });

  it('nut Google chi hien khi googleEnabled', () => {
    expect(render({ googleEnabled: false })).not.toContain('authPage.continueGoogle');
    expect(render({ googleEnabled: true })).toContain('authPage.continueGoogle');
  });

  it('loi Google bi tu choi hien khi initialError = googleDenied', () => {
    expect(render({ googleEnabled: true, initialError: 'googleDenied' })).toContain('authSecurity.googleDenied');
    expect(render({ googleEnabled: true })).not.toContain('authSecurity.googleDenied');
  });

  it('co link quen mat khau va dang ky', () => {
    const html = render({ googleEnabled: false });
    expect(html).toContain('href="/quen-mat-khau"');
    expect(html).toContain('href="/dang-ky"');
  });

  it('khong co o ghi nho (Q3 = a)', () => {
    expect(render({ googleEnabled: true })).not.toContain('type="checkbox"');
  });
});
