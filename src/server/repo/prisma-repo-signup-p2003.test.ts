/**
 * I1 (bao-mat P3F) - `deleteDepartment`: co dang ky chen vao giua luc dem va luc xoa thi FK RESTRICT nem P2003,
 * phai tra `in_use` thay vi de loi 500 chung bay ra.
 */
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const tx = {
  department: { count: vi.fn(), delete: vi.fn() },
  userRole: { count: vi.fn() },
  signupRequest: { count: vi.fn() },
};
const $transaction = vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx));
vi.mock('@/server/db', () => ({ prisma: { $transaction: (fn: never) => $transaction(fn) } }));

import { prismaSignupStore } from './prisma-repo-signup';

const p2003 = () => new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x' });

describe('prismaSignupStore.deleteDepartment (I1)', () => {
  it('P2003 khi xoa -> in_use', async () => {
    tx.department.count.mockResolvedValue(1);
    tx.userRole.count.mockResolvedValue(0);
    tx.signupRequest.count.mockResolvedValue(0);
    tx.department.delete.mockRejectedValue(p2003());
    expect(await prismaSignupStore.deleteDepartment(5)).toEqual({ inUse: 1 });
  });

  it('loi khac van duoc nem ra', async () => {
    tx.department.count.mockResolvedValue(1);
    tx.userRole.count.mockResolvedValue(0);
    tx.signupRequest.count.mockResolvedValue(0);
    tx.department.delete.mockRejectedValue(new Error('boom'));
    await expect(prismaSignupStore.deleteDepartment(5)).rejects.toThrow('boom');
  });

  it('khong ai dung -> ok', async () => {
    tx.department.count.mockResolvedValue(1);
    tx.userRole.count.mockResolvedValue(0);
    tx.signupRequest.count.mockResolvedValue(0);
    tx.department.delete.mockResolvedValue({});
    expect(await prismaSignupStore.deleteDepartment(5)).toBe('ok');
  });
});
