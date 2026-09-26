import { describe, expect, it, vi } from 'vitest';
import type { Role } from '@/server/repo/types';

/**
 * P3D-B (S-1): requireUser la helper duy nhat de page (app) chot dang nhap/vai o tang page,
 * khong pho mac middleware/layout (redirect o layout khong chan duoc page stream du lieu song song).
 */
const { getCurrentUserMock } = vi.hoisted(() => ({ getCurrentUserMock: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@/lib/session', () => ({
  getCurrentUser: getCurrentUserMock,
  homeForRole: (role: Role) => (role === 'data-entry' ? '/nhap-lieu' : '/overview'),
}));

import { requireUser } from './require-user';

describe('requireUser', () => {
  it('chua dang nhap (vi) -> REDIRECT:/vi/login', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    await expect(requireUser('vi')).rejects.toThrow('REDIRECT:/vi/login');
  });

  it('chua dang nhap (en) -> REDIRECT:/en/login', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    await expect(requireUser('en')).rejects.toThrow('REDIRECT:/en/login');
  });

  it('admin, khong truyen roles -> tra dung user', async () => {
    const user = { name: 'A', email: 'a@daidung.com.vn', role: 'admin' as Role, canViewFinance: true };
    getCurrentUserMock.mockResolvedValue(user);
    await expect(requireUser('vi')).resolves.toEqual(user);
  });

  it('viewer, roles = [admin] -> REDIRECT:/vi/overview', async () => {
    getCurrentUserMock.mockResolvedValue({ name: 'V', email: 'v@daidung.com.vn', role: 'viewer', canViewFinance: false });
    await expect(requireUser('vi', ['admin'])).rejects.toThrow('REDIRECT:/vi/overview');
  });

  it('data-entry, roles = [admin, bod] -> REDIRECT:/vi/nhap-lieu', async () => {
    getCurrentUserMock.mockResolvedValue({ name: 'D', email: 'd@daidung.com.vn', role: 'data-entry', canViewFinance: false });
    await expect(requireUser('vi', ['admin', 'bod'])).rejects.toThrow('REDIRECT:/vi/nhap-lieu');
  });

  it('bod, roles = [admin, bod] -> tra dung user', async () => {
    const user = { name: 'B', email: 'b@daidung.com.vn', role: 'bod' as Role, canViewFinance: false };
    getCurrentUserMock.mockResolvedValue(user);
    await expect(requireUser('vi', ['admin', 'bod'])).resolves.toEqual(user);
  });

  it('roles rong ([]) voi admin -> REDIRECT:/vi/overview (mang rong nghia la khong ai duoc vao)', async () => {
    getCurrentUserMock.mockResolvedValue({ name: 'A', email: 'a@daidung.com.vn', role: 'admin', canViewFinance: true });
    await expect(requireUser('vi', [])).rejects.toThrow('REDIRECT:/vi/overview');
  });
});
