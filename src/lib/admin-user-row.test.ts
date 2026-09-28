import { describe, expect, it } from 'vitest';
import { toAdminUserRow } from './admin-user-row';
import type { UserAccount } from '@/server/repo/types';

const BASE: UserAccount = {
  email: 'a@daidung.com.vn',
  name: 'A',
  passwordHash: 'hash-bi-mat',
  role: 'viewer',
  canViewFinance: false,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
  lockedAt: null,
};

describe('toAdminUserRow (S15 - khong lo passwordHash ra trinh duyet)', () => {
  it('khong con khoa passwordHash trong ket qua', () => {
    const row = toAdminUserRow(BASE);
    expect('passwordHash' in row).toBe(false);
    expect(JSON.stringify(row)).not.toContain('hash-bi-mat');
  });

  it('passwordHash khac rong -> hasPassword true', () => {
    expect(toAdminUserRow(BASE).hasPassword).toBe(true);
  });

  it('passwordHash rong (tai khoan chi Google) -> hasPassword false', () => {
    expect(toAdminUserRow({ ...BASE, passwordHash: '' }).hasPassword).toBe(false);
  });

  it('giu nguyen cac truong khac (email, name, role, lockedAt...)', () => {
    const row = toAdminUserRow({ ...BASE, lockedAt: '2026-09-28T00:00:00.000Z' });
    expect(row).toEqual({
      email: 'a@daidung.com.vn', name: 'A', role: 'viewer', canViewFinance: false, isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedAt: '2026-09-28T00:00:00.000Z',
      hasPassword: true,
    });
  });
});
