import { describe, it, expect, beforeEach } from 'vitest';
import { repo } from './mock-repo';
import { hashPassword, verifyPassword } from '@/lib/password';
import type { UserAccount } from './types';

function acct(email: string, role: UserAccount['role'] = 'viewer'): UserAccount {
  return {
    email,
    name: email.split('@')[0],
    passwordHash: hashPassword('Pass@12345'),
    role,
    canViewFinance: role !== 'viewer',
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
}

describe('account management (mock repo)', () => {
  beforeEach(() => {
    repo.reset();
  });

  it('createAccount + findAccount', () => {
    repo.createAccount(acct('x@daidung.com.vn', 'bod'));
    expect(repo.findAccount('X@DAIDUNG.COM.VN')?.role).toBe('bod');
  });

  it('setUserRole (T-2): viewer luôn tắt, data-entry luôn bật, vai trò khác giữ nguyên - bỏ qua cờ caller truyền', () => {
    repo.createAccount(acct('y@daidung.com.vn', 'bod')); // canViewFinance = true (seed ban đầu)
    repo.setUserRole('y@daidung.com.vn', 'viewer', true); // cờ true bị bỏ qua - viewer luôn tắt
    expect(repo.findAccount('y@daidung.com.vn')?.canViewFinance).toBe(false);
    repo.setUserRole('y@daidung.com.vn', 'bod', false); // cờ false bị bỏ qua - vai trò khác giữ nguyên (false)
    expect(repo.findAccount('y@daidung.com.vn')?.canViewFinance).toBe(false);
    repo.setUserRole('y@daidung.com.vn', 'data-entry', false); // cờ false bị bỏ qua - data-entry luôn bật (T-1)
    expect(repo.findAccount('y@daidung.com.vn')?.canViewFinance).toBe(true);
    repo.setUserRole('y@daidung.com.vn', 'admin', false); // vai trò khác giữ nguyên (true)
    expect(repo.findAccount('y@daidung.com.vn')?.canViewFinance).toBe(true);
  });

  it('changePassword đổi hash, verify mật khẩu mới', () => {
    repo.createAccount(acct('z@daidung.com.vn'));
    repo.changePassword('z@daidung.com.vn', hashPassword('New@99999'));
    const a = repo.findAccount('z@daidung.com.vn')!;
    expect(verifyPassword('New@99999', a.passwordHash)).toBe(true);
    expect(verifyPassword('Pass@12345', a.passwordHash)).toBe(false);
  });

  it('setAccountActive khóa/mở tài khoản', () => {
    repo.createAccount(acct('w@daidung.com.vn'));
    repo.setAccountActive('w@daidung.com.vn', false);
    expect(repo.findAccount('w@daidung.com.vn')?.isActive).toBe(false);
    repo.setAccountActive('w@daidung.com.vn', true);
    expect(repo.findAccount('w@daidung.com.vn')?.isActive).toBe(true);
  });

  it('removeUserRole xóa tài khoản', () => {
    repo.createAccount(acct('del@daidung.com.vn'));
    repo.removeUserRole('del@daidung.com.vn');
    expect(repo.findAccount('del@daidung.com.vn')).toBeUndefined();
  });
});
