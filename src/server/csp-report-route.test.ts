import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/csp-report/route';

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
    expect(warn.mock.calls[0][0]).toBe('[csp-report]');
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
      // @ts-expect-error duplex bat buoc khi body la stream
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
  it('gioi han toan cuc: 300 IP khac nhau deu 204, lan 301 -> 429', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.resetModules();
    const { POST: FreshPost } = await import('../../app/api/csp-report/route');
    for (let i = 0; i < 300; i++) {
      const res = await FreshPost(req(REPORT, 'application/csp-report', `10.20.${Math.floor(i / 250)}.${(i % 250) + 1}`));
      expect(res.status).toBe(204);
    }
    const res = await FreshPost(req(REPORT, 'application/csp-report', '10.30.0.1'));
    expect(res.status).toBe(429);
  });
});
