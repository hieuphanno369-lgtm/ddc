import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAuthSecret } from './env';

afterEach(() => vi.unstubAllEnvs());

describe('requireAuthSecret', () => {
  it('rong -> throw khop /NEXTAUTH_SECRET/', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '');
    expect(() => requireAuthSecret()).toThrow(/NEXTAUTH_SECRET/);
  });

  it('chi co khoang trang -> throw', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '   ');
    expect(() => requireAuthSecret()).toThrow(/NEXTAUTH_SECRET/);
  });

  it("'abc' -> tra 'abc'", () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'abc');
    expect(requireAuthSecret()).toBe('abc');
  });
});
