import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/csp-report/route';

/**
 * P5-B (tester) - ca bien o muc route: log KHONG duoc chua query string (token dat lai mat khau), khong xuong dong
 * chen vao log, va yeu cau bi tu choi (415/413) khong bao gio ghi log.
 */
let seq = 0;
const ip = () => `203.0.113.${++seq}`;
const mk = (body: string, ct = 'application/csp-report') =>
  new NextRequest('http://localhost/api/csp-report', { method: 'POST', body, headers: { 'content-type': ct, 'x-forwarded-for': ip() } });

afterEach(() => vi.restoreAllMocks());

describe('POST /api/csp-report - bien', () => {
  it('document-uri co ?token=BI_MAT va #hash -> dong log khong chua token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const body = JSON.stringify({
      'csp-report': {
        'document-uri': 'http://localhost/vi/dat-lai-mat-khau?token=BI_MAT_123#frag',
        'blocked-uri': 'https://evil.example/x.js?token=BI_MAT_456', 'effective-directive': 'script-src', disposition: 'report',
      },
    });
    expect((await POST(mk(body))).status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).not.toContain('BI_MAT');
    expect(logged).not.toContain('frag');
    expect(logged).toContain('/vi/dat-lai-mat-khau');
  });
  it('gia tri co xuong dong khong tach thanh nhieu dong log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const body = JSON.stringify({
      'csp-report': { 'document-uri': 'http://localhost/vi/login', 'blocked-uri': 'inline', 'effective-directive': 'script-src\n[csp-report] gia mao', disposition: 'report', 'script-sample': 'a\r\nb' },
    });
    await POST(mk(body));
    const logged = warn.mock.calls.map((c) => c.map(String).join(' ')).join('');
    expect(logged).not.toMatch(/[\r\n]/);
  });
  it('415 va 413 khong ghi log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await POST(mk('x', 'text/html'))).status).toBe(415);
    const big = new NextRequest('http://localhost/api/csp-report', {
      method: 'POST', body: 'x', headers: { 'content-type': 'application/csp-report', 'x-forwarded-for': ip(), 'content-length': '20000' },
    });
    expect((await POST(big)).status).toBe(413);
    expect(warn).not.toHaveBeenCalled();
  });
  it('phuong thuc GET khong duoc export (405 do Next)', async () => {
    const mod = await import('../../app/api/csp-report/route');
    expect((mod as Record<string, unknown>).GET).toBeUndefined();
  });
});
