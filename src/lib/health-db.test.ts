import { describe, expect, it } from 'vitest';
import { pingDb } from './health-db';

/** P5-B Task 3 - pingDb dua query() voi setTimeout, luon clearTimeout, khong de lot unhandled rejection. */
describe('pingDb', () => {
  it('query resolve -> { ok: true }', async () => {
    await expect(pingDb(() => Promise.resolve('x'), 1000)).resolves.toEqual({ ok: true });
  });

  it('query reject -> ok:false, timedOut:false, error la loi goc', async () => {
    const boom = new Error('boom');
    const r = await pingDb(() => Promise.reject(boom), 1000);
    expect(r).toEqual({ ok: false, timedOut: false, error: boom });
  });

  it('query throw dong bo -> nhu reject', async () => {
    const boom = new Error('sync-boom');
    const r = await pingDb(() => {
      throw boom;
    }, 1000);
    expect(r).toEqual({ ok: false, timedOut: false, error: boom });
  });

  it('query treo qua timeoutMs=20 -> timedOut:true trong duoi 200ms', async () => {
    const start = Date.now();
    const r = await pingDb(() => new Promise(() => undefined), 20);
    expect(Date.now() - start).toBeLessThan(200);
    expect(r).toEqual({ ok: false, timedOut: true });
  });

  it('query reject SAU khi da het gio -> khong co unhandled rejection', async () => {
    const seen: unknown[] = [];
    const onUnhandled = (e: unknown) => seen.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      let rejectLate!: (e: unknown) => void;
      const late = new Promise<never>((_, rej) => {
        rejectLate = rej;
      });
      const r = await pingDb(() => late, 10);
      expect(r).toEqual({ ok: false, timedOut: true });
      rejectLate(new Error('qua tre'));
      await new Promise((res) => setTimeout(res, 50));
      expect(seen).toHaveLength(0);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
