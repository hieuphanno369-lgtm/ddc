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

  it('data-entry bi admin tat cot DB false -> canViewFinance false', async () => {
    findUniqueMock.mockResolvedValue({ role: 'data-entry', canViewFinance: false });
    expect(await resolveAccess('pm@daidung.com.vn')).toEqual({ role: 'data-entry', canViewFinance: false });
  });

  it('viewer mac dinh cot DB false -> canViewFinance false', async () => {
    findUniqueMock.mockResolvedValue({ role: 'viewer', canViewFinance: false });
    expect(await resolveAccess('viewer@daidung.com.vn')).toEqual({ role: 'viewer', canViewFinance: false });
  });

  it('viewer duoc admin bat cot DB true -> canViewFinance true', async () => {
    findUniqueMock.mockResolvedValue({ role: 'viewer', canViewFinance: true });
    expect(await resolveAccess('viewer@daidung.com.vn')).toEqual({ role: 'viewer', canViewFinance: true });
  });

  it('khong tim thay tai khoan -> fallback ROLE_SEED (mac dinh viewer, false)', async () => {
    findUniqueMock.mockResolvedValue(null);
    expect(await resolveAccess('unknown@daidung.com.vn')).toEqual({ role: 'viewer', canViewFinance: false });
  });

  it('prisma nem loi -> fallback, khong vo', async () => {
    findUniqueMock.mockRejectedValue(new Error('db down'));
    expect(await resolveAccess('unknown@daidung.com.vn')).toEqual({ role: 'viewer', canViewFinance: false });
  });
});
