import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * F6 (P3A, Task 10): `logout()` gọi `clearDraftsOnLogout` (đã có test hành vi đầy đủ ở
 * `src/lib/drafts.test.ts`, gồm cả trường hợp storage bị chặn) TRƯỚC `signOut`. Vitest chạy env
 * `node` (không DOM - xem vitest.config.ts) nên không dựng được click thật; soi mã nguồn để khẳng
 * định đúng thứ tự gọi. Tester nên bấm "Đăng xuất" thật (Playwright/thủ công) và kiểm DevTools
 * Application không còn key `ddc_draft_`/`ddc_pform_` sau khi đăng xuất.
 */
describe('SettingsMenu.logout - xoa ban nhap truoc khi dang xuat (F6)', () => {
  it('goi clearDraftsOnLogout truoc signOut trong ham logout', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/layout/SettingsMenu.tsx'), 'utf-8');
    expect(src).toContain("import { clearDraftsOnLogout } from '@/lib/drafts';");
    const fnMatch = /function logout\(\) \{([\s\S]*?)\n {2}\}/.exec(src);
    expect(fnMatch, 'khong tim thay ham logout()').toBeTruthy();
    const body = fnMatch![1];
    const clearIdx = body.indexOf('clearDraftsOnLogout(');
    const signOutIdx = body.indexOf('signOut(');
    expect(clearIdx).toBeGreaterThan(-1);
    expect(signOutIdx).toBeGreaterThan(clearIdx);
  });
});
