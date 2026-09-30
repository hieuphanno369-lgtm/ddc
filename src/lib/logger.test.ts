import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorFields, logger, redact } from './logger';

/**
 * P5-B Task 1 - logger JSON co cau truc, loc khoa nhay cam. Khuon spy console theo
 * `src/lib/client-ip.test.ts`.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger', () => {
  it("warn('a.b', { alertId: 5 }) -> console.warn dung 1 lan, 1 doi so, JSON dung", () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('a.b', { alertId: 5 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toHaveLength(1);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.level).toBe('warn');
    expect(line.event).toBe('a.b');
    expect(line.alertId).toBe(5);
    expect(typeof line.ts).toBe('string');
    expect(new Date(line.ts).toISOString()).toBe(line.ts);
  });

  it('info dung console.info, error dung console.error', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logger.info('x.y');
    logger.error('z.w');
    expect(info).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("fields { event: 'x', level: 'y' } khong ghi de duoc event/level", () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('that.event', { event: 'x', level: 'y' });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.event).toBe('that.event');
    expect(line.level).toBe('warn');
  });

  it('cac khoa nhay cam bi loc thanh [redacted]', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('nhay.cam', {
      password: 'x',
      smtpPass: 'y',
      webhookUrl: 'https://x',
      clientIp: '1.2.3.4',
      sessionToken: 'abc',
      email: 'a@b.c',
      authorization: 'Bearer x',
      headers: { cookie: 'a' },
      passwordHash: 'h',
    });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    for (const k of ['password', 'smtpPass', 'webhookUrl', 'clientIp', 'sessionToken', 'email', 'authorization', 'headers', 'passwordHash']) {
      expect(line[k]).toBe('[redacted]');
    }
  });

  it('cac khoa khong nhay cam giu nguyen', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('giu.nguyen', {
      alertId: 1,
      jobName: 'alerts_daily',
      description: 'mo ta',
      recipientCount: 3,
      routePath: '/vi/login',
      errCode: 'P2002',
    });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.alertId).toBe(1);
    expect(line.jobName).toBe('alerts_daily');
    expect(line.description).toBe('mo ta');
    expect(line.recipientCount).toBe(3);
    expect(line.routePath).toBe('/vi/login');
    expect(line.errCode).toBe('P2002');
  });

  it('loc de quy vao object long nhau, cat chuoi dai, gioi han mang', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('de.quy', {
      ctx: { user: { email: 'a@b.c' } },
      arr: Array.from({ length: 30 }, (_, i) => i),
      longStr: 'a'.repeat(600),
    });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.ctx.user.email).toBe('[redacted]');
    expect(line.arr).toHaveLength(20);
    expect(line.longStr).toHaveLength(500);
  });

  it('do sau 4 -> [depth]', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('sau.qua', { a: { b: { c: { d: 1 } } } });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.a.b.c.d).toBe('[depth]');
  });

  it('object vong tham chieu -> logError unserializable, khong throw', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => logger.error('vong.lap', { data: circular })).not.toThrow();
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.logError).toBe('unserializable');
    expect(line.event).toBe('vong.lap');
    expect(line.level).toBe('error');
  });

  it('bigint -> logError unserializable, khong throw', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => logger.error('bigint.loi', { big: BigInt(10) })).not.toThrow();
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.logError).toBe('unserializable');
  });

  describe('redact', () => {
    it('giu nguyen field khong nhay cam, loc field nhay cam - kiem qua logger', () => {
      const out = redact({ password: 'x', alertId: 1 });
      expect(out.password).toBe('[redacted]');
      expect(out.alertId).toBe(1);
    });
  });

  describe('errorFields', () => {
    it("Error('password=hunter2') - khong chuoi nao chua hunter2, co errName, errStack", () => {
      const e = new Error('password=hunter2');
      const f = errorFields(e);
      expect(f.errName).toBe('Error');
      expect(JSON.stringify(f)).not.toContain('hunter2');
      expect(f.errStack).toBeDefined();
      for (const line of f.errStack ?? []) expect(line.startsWith('at ')).toBe(true);
    });

    it("code='P2002' hop le -> errCode; code='abc def' khong hop le -> khong co errCode", () => {
      const e1 = Object.assign(new Error('x'), { code: 'P2002' });
      expect(errorFields(e1).errCode).toBe('P2002');
      const e2 = Object.assign(new Error('x'), { code: 'abc def' });
      expect(errorFields(e2).errCode).toBeUndefined();
    });

    it("digest='123' -> errDigest", () => {
      const e = Object.assign(new Error('x'), { digest: '123' });
      expect(errorFields(e).errDigest).toBe('123');
    });

    it("errorFields('chuoi') -> errName:'string'", () => {
      expect(errorFields('chuoi').errName).toBe('string');
    });
  });
});
