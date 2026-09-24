import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '@/lib/session';

// SettingsMenu.tsx dung JSX ma khong tu import React - can shim nay (mau KpiCard.test.ts).
(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => 'vi',
}));
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    React.createElement('a', { href: props.href, className: props.className }, props.children),
  usePathname: () => '/overview',
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('./ChangePasswordModal', () => ({ ChangePasswordModal: () => null }));

import { SettingsMenu } from './SettingsMenu';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

describe('SettingsMenu - ARIA menu button (P1B Task 5, trang thai dong)', () => {
  it('nut trigger co aria-haspopup menu, aria-expanded false, aria-controls; khong co role="menu" (dang dong)', () => {
    const out = renderToStaticMarkup(React.createElement(SettingsMenu, { user: ADMIN }));

    expect(out).toContain('aria-haspopup="menu"');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('aria-controls="');
    expect(out).not.toContain('role="menu"');
  });
});
