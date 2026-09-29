import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/csp-report/route';
import { CSP_REPORT_GLOBAL_PER_MIN } from '@/lib/csp-report';

/**
 * P5-B: /api/csp-report la endpoint cong khai (khong phien), chi ghi console.warn, co gioi han tan suat
 * theo IP va toan cuc, tran kich thuoc body. Moi ca dung x-forwarded-for rieng de khong dinh gioi han cua ca khac.
 */
let ipSeq = 0;
const nextIp = () => `198.51.100.${++ipSeq}`;

const REPORT = JSON.stringify({
  'csp-report': { 'document-uri': 'http://localhost/vi/login', 'blocked-uri': 'inline', 'effective-directive': 'script-src', disposition: 'report' },
});
const API_REPORT = JSON.stringify([{ type: 'csp-violation', body: { documentURL: 'http://localhost/vi/login', blockedURL: 'eval', effectiveDirective: 'script-src', disposition: 'report' } }]);

function req(body: string, contentType: string, ip = nextIp(), extra: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/csp-report', {
    method: 'POST', body, headers: { 'content-type': contentType, 'x-forwarded-for': ip, ...extra },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('POST /api/csp-report', () => {
  it('application/csp-report hop le -> 204, log dung 1 lan voi tien to', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const res = await POST(req(REPORT, 'application/csp-report'));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warn.mock.calls[0][0]).event).toBe('csp_report.violation');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
  it('application/reports+json hop le -> 204', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await POST(req(API_REPORT, 'application/reports+json'))).status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('text/plain -> 415, khong log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await POST(req(REPORT, 'text/plain'))).status).toBe(415);
    expect(warn).not.toHaveBeenCalled();
  });
  it('content-length 999999 -> 413', async () => {
    expect((await POST(req(REPORT, 'application/csp-report', nextIp(), { 'content-length': '999999' }))).status).toBe(413);
  });
  it('body that 20000 byte khong co content-length -> 413', async () => {
    const big = new NextRequest('http://localhost/api/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report', 'x-forwarded-for': nextIp() },
      body: new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new Uint8Array(20_000).fill(97));
          c.close();
        },
      }),
      duplex: 'half',
    });
    expect((await POST(big)).status).toBe(413);
  });
  it('body JSON hong -> 204, khong log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await POST(req('{"csp-report":', 'application/csp-report'))).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });
  it('cung 1 IP: 30 lan 204, lan 31 -> 429 co Retry-After', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ip = nextIp();
    for (let i = 0; i < 30; i++) expect((await POST(req(REPORT, 'application/csp-report', ip))).status).toBe(204);
    const res = await POST(req(REPORT, 'application/csp-report', ip));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });
  // Dat cuoi file: vi.resetModules() de co bo dem rateLimit moi (Map cap module).
  it(`gioi han toan cuc: ${CSP_REPORT_GLOBAL_PER_MIN} IP khac nhau deu 204, lan ke tiep -> 429`, async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.resetModules();
    const { POST: FreshPost } = await import('../../app/api/csp-report/route');
    for (let i = 0; i < CSP_REPORT_GLOBAL_PER_MIN; i++) {
      const res = await FreshPost(req(REPORT, 'application/csp-report', `10.20.${Math.floor(i / 250)}.${(i % 250) + 1}`));
      expect(res.status).toBe(204);
    }
    const res = await FreshPost(req(REPORT, 'application/csp-report', '10.30.0.1'));
    expect(res.status).toBe(429);
  });
  it('M1: da cham tran toan he thong thi 1000 IP gia deu 429 va khong tao them khoa theo IP', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.resetModules();
    const keys: string[] = [];
    vi.doMock('@/lib/rate-limit', async () => {
      const real = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit');
      return { ...real, rateLimit: (key: string, limit?: number, windowMs?: number) => { keys.push(key); return real.rateLimit(key, limit, windowMs); } };
    });
    const { POST: FreshPost } = await import('../../app/api/csp-report/route');
    for (let i = 0; i < CSP_REPORT_GLOBAL_PER_MIN; i++) await FreshPost(req(REPORT, 'application/csp-report', `10.40.0.${i + 1}`));
    const before = keys.filter((k) => k.startsWith('csp-report:') && k !== 'csp-report:global').length;
    expect(before).toBe(CSP_REPORT_GLOBAL_PER_MIN);
    for (let i = 0; i < 1000; i++) {
      const res = await FreshPost(req(REPORT, 'application/csp-report', `10.50.${Math.floor(i / 250)}.${(i % 250) + 1}`));
      expect(res.status).toBe(429);
    }
    const after = keys.filter((k) => k.startsWith('csp-report:') && k !== 'csp-report:global').length;
    expect(after).toBe(before);
    vi.doUnmock('@/lib/rate-limit');
  });
});
