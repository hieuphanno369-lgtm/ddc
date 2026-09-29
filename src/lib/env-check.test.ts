import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkServerEnv, enforceServerEnv, REQUIRED_PROD_ENV } from './env-check';

/**
 * P5-B Task 2 - kiem env bat buoc khi khoi dong (instrumentation.ts). Dung object env truyen vao,
 * KHONG stub process.env, de moi ca doc lap voi nhau.
 */
const VALID: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
  NEXTAUTH_SECRET: 'a'.repeat(32),
  NEXTAUTH_URL: 'https://ct.daidung.vn',
  NOTIFY_SECRET_KEY: Buffer.alloc(32, 1).toString('base64'),
  CRON_SECRET: 'b'.repeat(32),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkServerEnv', () => {
  it('VALID -> khong co van de gi', () => {
    expect(checkServerEnv(VALID)).toEqual([]);
  });

  it.each(REQUIRED_PROD_ENV)('thieu %s -> dung 1 van de missing', (name) => {
    const env = { ...VALID, [name]: '' };
    expect(checkServerEnv(env)).toEqual([{ name, reason: 'missing' }]);
  });

  it('chuoi toan khoang trang cung la missing', () => {
    const env = { ...VALID, CRON_SECRET: '   ' };
    expect(checkServerEnv(env)).toEqual([{ name: 'CRON_SECRET', reason: 'missing' }]);
  });

  it("DATABASE_URL='mysql://x' -> invalid", () => {
    const env = { ...VALID, DATABASE_URL: 'mysql://x' };
    expect(checkServerEnv(env)).toEqual([{ name: 'DATABASE_URL', reason: 'invalid' }]);
  });

  it('NEXTAUTH_SECRET 31 ky tu -> invalid, 32 ky tu -> hop le', () => {
    expect(checkServerEnv({ ...VALID, NEXTAUTH_SECRET: 'a'.repeat(31) })).toEqual([
      { name: 'NEXTAUTH_SECRET', reason: 'invalid' },
    ]);
    expect(checkServerEnv({ ...VALID, NEXTAUTH_SECRET: 'a'.repeat(32) })).toEqual([]);
  });

  it('CRON_SECRET 31 ky tu -> invalid, 32 ky tu -> hop le', () => {
    expect(checkServerEnv({ ...VALID, CRON_SECRET: 'b'.repeat(31) })).toEqual([
      { name: 'CRON_SECRET', reason: 'invalid' },
    ]);
    expect(checkServerEnv({ ...VALID, CRON_SECRET: 'b'.repeat(32) })).toEqual([]);
  });

  it.each([
    ['http://ct.daidung.vn', 'invalid'],
    ['http://localhost:3005', 'ok'],
    ['https://ct.daidung.vn/app', 'invalid'],
    ['https://ct.daidung.vn/?a=1', 'invalid'],
    ['khong-phai-url', 'invalid'],
  ] as const)('NEXTAUTH_URL=%s -> %s', (url, expected) => {
    const problems = checkServerEnv({ ...VALID, NEXTAUTH_URL: url });
    if (expected === 'ok') expect(problems).toEqual([]);
    else expect(problems).toEqual([{ name: 'NEXTAUTH_URL', reason: 'invalid' }]);
  });

  it('NOTIFY_SECRET_KEY base64 cua 16 byte -> invalid', () => {
    const env = { ...VALID, NOTIFY_SECRET_KEY: Buffer.alloc(16, 1).toString('base64') };
    expect(checkServerEnv(env)).toEqual([{ name: 'NOTIFY_SECRET_KEY', reason: 'invalid' }]);
  });

  it('chi co GOOGLE_CLIENT_ID -> GOOGLE_CLIENT_SECRET missing', () => {
    expect(checkServerEnv({ ...VALID, GOOGLE_CLIENT_ID: 'x' })).toEqual([
      { name: 'GOOGLE_CLIENT_SECRET', reason: 'missing' },
    ]);
  });

  it('chi co GOOGLE_CLIENT_SECRET -> GOOGLE_CLIENT_ID missing', () => {
    expect(checkServerEnv({ ...VALID, GOOGLE_CLIENT_SECRET: 'x' })).toEqual([
      { name: 'GOOGLE_CLIENT_ID', reason: 'missing' },
    ]);
  });

  it('ca 2 GOOGLE deu rong -> hop le', () => {
    expect(checkServerEnv({ ...VALID, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' })).toEqual([]);
  });

  it.each([
    ['0', 'invalid'],
    ['abc', 'invalid'],
    ['1.5', 'invalid'],
    ['', 'ok'],
    ['2', 'ok'],
  ] as const)('TRUSTED_PROXY_HOPS=%s -> %s', (hops, expected) => {
    const problems = checkServerEnv({ ...VALID, TRUSTED_PROXY_HOPS: hops });
    if (expected === 'ok') expect(problems).toEqual([]);
    else expect(problems).toEqual([{ name: 'TRUSTED_PROXY_HOPS', reason: 'invalid' }]);
  });
});

describe('enforceServerEnv', () => {
  it('production thieu 2 bien -> exit(1) dung 1 lan, console.error 1 dong JSON event env.invalid', () => {
    const exit = vi.fn();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = { ...VALID, NODE_ENV: 'production', NOTIFY_SECRET_KEY: '', CRON_SECRET: '' };
    enforceServerEnv(env, exit);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(err).toHaveBeenCalledTimes(1);
    const line = JSON.parse(err.mock.calls[0][0] as string);
    expect(line.event).toBe('env.invalid');
    expect(line.problems).toHaveLength(2);
    const raw = err.mock.calls[0][0] as string;
    for (const v of Object.values(VALID)) expect(raw).not.toContain(v);
  });

  it("NODE_ENV='development' -> khong exit, console.warn event env.invalid_dev", () => {
    const exit = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = { ...VALID, NODE_ENV: 'development', CRON_SECRET: '' };
    enforceServerEnv(env, exit);
    expect(exit).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warn.mock.calls[0][0] as string).event).toBe('env.invalid_dev');
  });

  it("NEXT_PHASE='phase-production-build' -> khong exit, khong log", () => {
    const exit = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = { NEXT_PHASE: 'phase-production-build' };
    enforceServerEnv(env, exit);
    expect(exit).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });

  it('env hop le -> khong log, khong exit', () => {
    const exit = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    enforceServerEnv({ ...VALID, NODE_ENV: 'production' }, exit);
    expect(exit).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });
});
