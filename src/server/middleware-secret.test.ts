import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Task 8 (P1A) - thiếu NEXTAUTH_SECRET phải trả 500 rõ ràng, không chạy RBAC ngầm với secret rỗng.
 */
vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next(),
}));

import middleware from '../../middleware';

afterEach(() => vi.unstubAllEnvs());

describe('middleware - fail-closed khi thieu NEXTAUTH_SECRET', () => {
  it('env rong -> 500 Server misconfigured', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', '');

    const res = await middleware(new NextRequest('http://localhost/vi/overview'));

    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(/NEXTAUTH_SECRET/);
  });
});
