import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db', () => ({ prisma: {} }));
vi.mock('@/lib/activity');

import { authOptions } from './auth';

afterEach(() => vi.unstubAllEnvs());

describe('authOptions.callbacks.session - fail-closed canViewFinance', () => {
  it('token khong co canViewFinance -> session.user.canViewFinance === false', async () => {
    const session = await authOptions.callbacks!.session!({
      session: { user: { email: 'a@b' }, expires: '' },
      token: {},
    } as never);

    expect((session.user as { canViewFinance?: boolean }).canViewFinance).toBe(false);
  });
});

describe('authOptions.secret - fail-closed khi thieu NEXTAUTH_SECRET', () => {
  it('env rong -> truy cap authOptions.secret throw', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '');
    expect(() => authOptions.secret).toThrow(/NEXTAUTH_SECRET/);
  });
});
