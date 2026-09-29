import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  applySecurityHeaders, buildCsp, generateNonce, securityHeaders, withCspRequestHeaders,
} from './security-headers';

const N = 'AAAAAAAAAAAAAAAAAAAAAA==';

describe('generateNonce', () => {
  it('dung dang 24 ky tu base64, 200 lan khong trung', () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const n = generateNonce();
      expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      set.add(n);
    }
    expect(set.size).toBe(200);
  });
});

describe('buildCsp', () => {
  it('ban production dung chinh xac chuoi', () => {
    expect(buildCsp({ nonce: N, dev: false })).toBe(
      `default-src 'self'; script-src 'self' 'nonce-${N}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report; report-to csp-endpoint`,
    );
  });
  it('dev co unsafe-eval, prod khong', () => {
    expect(buildCsp({ nonce: N, dev: true })).toContain(`'strict-dynamic' 'unsafe-eval'`);
    expect(buildCsp({ nonce: N, dev: false })).not.toContain('unsafe-eval');
  });
  it('script-src khong co unsafe-inline; khong co frame-ancestors hay upgrade-insecure-requests', () => {
    const csp = buildCsp({ nonce: N, dev: true });
    const script = csp.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(script).not.toContain('unsafe-inline');
    expect(csp).not.toContain('frame-ancestors');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
  it.each(['abc"; script-src *', '', 'x'.repeat(24)])('nonce la %j ne loi', (nonce) => {
    expect(() => buildCsp({ nonce, dev: false })).toThrow(Error);
  });
});

describe('securityHeaders', () => {
  it('dung 6 khoa va gia tri', () => {
    const h = securityHeaders({ nonce: N, dev: false });
    expect(Object.keys(h).sort()).toEqual([
      'Content-Security-Policy-Report-Only', 'Permissions-Policy', 'Referrer-Policy', 'Reporting-Endpoints',
      'X-Content-Type-Options', 'X-Frame-Options',
    ]);
    expect(h['Content-Security-Policy-Report-Only']).toBe(buildCsp({ nonce: N, dev: false }));
    expect(h['Reporting-Endpoints']).toBe('csp-endpoint="/api/csp-report"');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  });
});

describe('applySecurityHeaders', () => {
  it('ghi de header co san va tra lai chinh response', () => {
    const res = new Response('x', { headers: { 'X-Frame-Options': 'SAMEORIGIN' } });
    const out = applySecurityHeaders(res, securityHeaders({ nonce: N, dev: false }));
    expect(out).toBe(res);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('withCspRequestHeaders', () => {
  it('ghi de header client gui, giu cookie/accept-language/url', () => {
    const req = new NextRequest('http://localhost/vi/login?a=1', {
      headers: {
        'x-nonce': 'evil', 'content-security-policy-report-only': 'evil', 'content-security-policy': 'evil', cookie: 'k=v', 'accept-language': 'vi',
      },
    });
    const csp = buildCsp({ nonce: N, dev: false });
    const out = withCspRequestHeaders(req, N, csp);
    expect(out.headers.get('x-nonce')).toBe(N);
    expect(out.headers.get('content-security-policy-report-only')).toBe(csp);
    expect(out.headers.get('content-security-policy')).toBeNull();
    expect(out.headers.get('cookie')).toBe('k=v');
    expect(out.headers.get('accept-language')).toBe('vi');
    expect(out.url).toBe(req.url);
    expect(out.method).toBe('GET');
  });
  it('khong chiem body cua request goc', async () => {
    const req = new NextRequest('http://localhost/vi/login', { method: 'POST', body: 'abc' });
    withCspRequestHeaders(req, N, buildCsp({ nonce: N, dev: false }));
    expect(req.bodyUsed).toBe(false);
    expect(await req.text()).toBe('abc');
  });
});
