import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));
vi.mock('@/server/db', () => ({ prisma: { userRole: { findUnique: findUniqueMock } } }));
vi.mock('@/lib/activity');

import { resolveAccess } from './auth';

beforeEach(() => {
  findUniqueMock.mockReset();
  vi.stubEnv('DATABASE_URL', 'postgres://x');
  vi.stubEnv('ROLE_SEED', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('resolveAccess - Q6 doc canViewFinance tung nguoi tu cot DB', () => {
  it('admin luon canViewFinance true du cot DB false', async () => {
    findUniqueMock.mockResolvedValue({ role: 'admin', canViewFinance: false });
    expect(await resolveAccess('admin@daidung.com.vn')).toEqual({ role: 'admin', canViewFinance: true });
  });

  it('bod cot DB true -> canViewFinance true', async () => {
    findUniqueMock.mockResolvedValue({ role: 'bod', canViewFinance: true });
    expect(await resolveAccess('bod@daidung.com.vn')).toEqual({ role: 'bod', canViewFinance: true });
  });

  it('data-entry luon canViewFinance true (T-1, tam thoi toi khi P3A gate form nhap lieu), bat ke cot DB', async () => {
    findUniqueMock.mockResolvedValue({ role: 'data-entry', canViewFinance: false });
    expect(await resolveAccess('pm@daidung.com.vn')).toEqual({ role: 'data-entry', canViewFinance: true });
  });

  it('viewer mac dinh cot DB false -> canViewFinance false', async () => {
    findUniqueMock.mockResolvedValue({ role: 'viewer', canViewFinance: false });
    expect(await resolveAccess('viewer@daidung.com.vn')).toEqual({ role: 'viewer', canViewFinance: false });
  });

  it('viewer duoc admin bat cot DB true -> canViewFinance true', async () => {
    findUniqueMock.mockResolvedValue({ role: 'viewer', canViewFinance: true });
    expect(await resolveAccess('viewer@daidung.com.vn')).toEqual({ role: 'viewer', canViewFinance: true });
  });

  it('khong tim thay tai khoan -> null (K14/L-11: fail-closed, khong con fallback ROLE_SEED)', async () => {
    findUniqueMock.mockResolvedValue(null);
    expect(await resolveAccess('unknown@daidung.com.vn')).toBeNull();
  });

  it('prisma nem loi -> null, khong vo (fail-closed)', async () => {
    findUniqueMock.mockRejectedValue(new Error('db down'));
    expect(await resolveAccess('unknown@daidung.com.vn')).toBeNull();
  });
});
