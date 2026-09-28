/**
 * P3E Task 6 (D3) - test DOC LAP moi cho `UserEditor` (chua tung co test file truoc do).
 * Kiem theo "Cho Tester nen soi ky" muc 4 trong ke-hoach.md: khoi "Tai khoan dang bi khoa" khi co
 * NHIEU tai khoan cung bi khoa 1 luc (danh sach hien du, moi dong dung tai khoan do, khong nham dong).
 * Dung renderToStaticMarkup (cung mau voi ExchangeRateEditor.test.ts) - khong render duoc su kien
 * click that (khong co DOM/JSDOM su kien), nen chi kiem CAU TRUC/NOI DUNG tinh, khong kiem hanh vi
 * click goi dung action (phan do da co e2e 21-khoa-tai-khoan.spec.ts va anh chup admin-locked-block).
 */
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminUserRow } from '@/server/repo/types';
import { formatDateTime } from '@/lib/format';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  useLocale: () => 'vi',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/server/actions', () => ({
  createAccountAction: vi.fn(),
  removeUserRoleAction: vi.fn(),
  resetPasswordAction: vi.fn(),
  setUserRoleAction: vi.fn(),
  toggleAccountActiveAction: vi.fn(),
}));
vi.mock('@/server/actions-account-lock', () => ({ unlockAccountAction: vi.fn() }));
vi.mock('@/server/actions-user-finance', () => ({ setUserCanViewFinanceAction: vi.fn() }));

import { UserEditor } from './UserEditor';

const USER = (over: Partial<AdminUserRow> = {}): AdminUserRow => ({
  email: 'a@daidung.com.vn',
  name: 'A',
  role: 'viewer',
  canViewFinance: false,
  isActive: true,
  lockedAt: null,
  hasPassword: true,
  lastLoginAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

function render(users: AdminUserRow[]): string {
  return renderToStaticMarkup(React.createElement(UserEditor, { users }));
}

describe('UserEditor - D3 khoi "Tai khoan dang bi khoa"', () => {
  it('duong chay thuan loi: khong ai bi khoa -> khong hien khoi, bang van hien binh thuong', () => {
    const out = render([USER()]);
    expect(out).not.toContain('authSecurity.lockedList');
    expect(out).toContain('a@daidung.com.vn');
    expect(out).toContain('admin.active');
  });

  it('bien (Cho Tester #4): NHIEU tai khoan cung bi khoa 1 luc -> hien du ca 2, dung so luong, moi dong dung email/gio khoa cua chinh no', () => {
    const lockedA = USER({ email: 'khoa-a@daidung.com.vn', lockedAt: '2026-09-28T01:00:00.000Z' });
    const lockedB = USER({ email: 'khoa-b@daidung.com.vn', lockedAt: '2026-09-28T02:00:00.000Z' });
    const out = render([lockedA, lockedB]);

    expect(out).toContain('authSecurity.lockedList:{&quot;n&quot;:2}');
    // Ca 2 email co mat dung 1 lan trong khoi khoa VA 1 lan trong bang duoi -> 2 lan/email.
    expect(out.split('khoa-a@daidung.com.vn').length - 1).toBe(2);
    expect(out.split('khoa-b@daidung.com.vn').length - 1).toBe(2);
    // Moi dong trong khoi khoa dat DUNG canh gio khoa cua CHINH no (khong bi hoan doi).
    const idxA = out.indexOf('khoa-a@daidung.com.vn');
    const idxB = out.indexOf('khoa-b@daidung.com.vn');
    // Gio khoa hien dung theo cung ham formatDateTime component dung (may chay o mui gio nao cung
    // dung, khong doan cung mot gio UTC).
    const idxTimeA = out.indexOf(formatDateTime(lockedA.lockedAt, 'vi'));
    const idxTimeB = out.indexOf(formatDateTime(lockedB.lockedAt, 'vi'));
    expect(idxTimeA).toBeGreaterThan(idxA);
    expect(idxTimeA).toBeLessThan(idxB);
    expect(idxTimeB).toBeGreaterThan(idxB);
  });

  it('bien: tai khoan chua bi khoa KHONG lot vao khoi "Tai khoan dang bi khoa" du dung chung danh sach voi tai khoan da khoa', () => {
    const locked = USER({ email: 'khoa@daidung.com.vn', lockedAt: '2026-09-28T01:00:00.000Z' });
    const active = USER({ email: 'hoat-dong@daidung.com.vn', lockedAt: null });
    const out = render([locked, active]);

    expect(out).toContain('authSecurity.lockedList:{&quot;n&quot;:1}');
    // Email hoat dong chi xuat hien 1 lan (trong bang), khong xuat hien trong khoi khoa o tren cung.
    const lockedBlockEnd = out.indexOf('</div></div><div class="scroll">');
    const lockBlock = lockedBlockEnd === -1 ? out : out.slice(0, out.indexOf('scroll'));
    expect(lockBlock).not.toContain('hoat-dong@daidung.com.vn');
  });

  it('badge "Chi Google" chi hien dung 1 dong khong co mat khau, khong lo sang dong khac', () => {
    const googleOnly = USER({ email: 'chi-google@daidung.com.vn', hasPassword: false });
    const normal = USER({ email: 'co-mk@daidung.com.vn', hasPassword: true });
    const out = render([googleOnly, normal]);

    // Loai tru "authSecurity.googleOnlyHint" (dong goi y o form them tai khoan, luon hien san) -
    // chi dem dung badge "authSecurity.googleOnly" (khong co hau to "Hint" theo sau).
    const badgeMatches = out.match(/authSecurity\.googleOnly(?!Hint)/g) ?? [];
    expect(badgeMatches).toHaveLength(1);
    const idxBadge = out.indexOf('authSecurity.googleOnly', out.indexOf('authSecurity.googleOnlyHint') + 1);
    const idxGoogleEmail = out.indexOf('chi-google@daidung.com.vn');
    const idxNormalEmail = out.indexOf('co-mk@daidung.com.vn');
    expect(idxBadge).toBeGreaterThan(idxGoogleEmail);
    expect(idxBadge).toBeLessThan(idxNormalEmail);
  });

  it('phai that bai: tai khoan bi khoa hien badge "Bi khoa (sai mat khau)" trong bang, KHONG con la nut bam doi trang thai isActive nhu tai khoan thuong', () => {
    const locked = USER({ email: 'khoa@daidung.com.vn', lockedAt: '2026-09-28T01:00:00.000Z' });
    const out = render([locked]);
    expect(out).toContain('authSecurity.lockedBadge');
    // Khac voi tai khoan thuong (co nut <button> boc badge active/locked cu) - o day badge dung mot
    // minh, khong nam trong button rieng cho o TRANG THAI (chi con button o khoi tren cung).
    expect(out).not.toContain('admin.active');
  });
});
