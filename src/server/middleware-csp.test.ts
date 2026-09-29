import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * P5-B: middleware phai gan du 6 header bao mat (CSP Report-Only + nonce) len MOI response (trang,
 * redirect, 500, next-intl) va chuyen CSP + nonce vao request render (x-middleware-request-*).
 * next-intl that KHONG nap duoc trong Vitest (loi `default is not a function` do CJS/ESM), nen dung mock
 * mo phong dung hanh vi rewrite cua next-intl (node_modules/next-intl/dist/development/middleware/middleware.js:45-56):
 * sao chep request.headers vao `request.headers` cua rewrite, tu do Next sinh `x-middleware-request-*`.
 * Viec Next that doc nonce nay duoc kiem o e2e 26.
 */
const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: getTokenMock }));

vi.mock('next-intl/middleware', () => ({
  default: () => (req: NextRequest) =>
    NextResponse.rewrite(new URL(req.url), { request: { headers: new Headers(req.headers) } }),
}));

import middleware from '../../middleware';

const SIX = [
  'content-security-policy-report-only', 'reporting-endpoints', 'x-content-type-options',
  'referrer-policy', 'x-frame-options', 'permissions-policy',
];

async function hit(path: string, headers: Record<string, string> = {}) {
  return middleware(new NextRequest(`http://localhost${path}`, { headers }));
}
const nonceOf = (res: Response) => /'nonce-([^']+)'/.exec(res.headers.get('content-security-policy-report-only') ?? '')?.[1];
function expectSix(res: Response) {
  for (const h of SIX) expect(res.headers.get(h), h).toBeTruthy();
  expect(res.headers.get('x-frame-options')).toBe('DENY');
}

afterEach(() => {
  getTokenMock.mockReset();
  vi.unstubAllEnvs();
});

describe('middleware - header bao mat va CSP', () => {
  it('khong phien /vi/login -> du 6 header, CSP + nonce di vao request render', async () => {
    getTokenMock.mockResolvedValue(null);
    const res = await hit('/vi/login');
    expectSix(res);
    expect(res.headers.get('x-middleware-request-content-security-policy-report-only')).toBe(
      res.headers.get('content-security-policy-report-only'),
    );
    expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonceOf(res));
    const overridden = res.headers.get('x-middleware-override-headers') ?? '';
    expect(overridden).toContain('content-security-policy-report-only');
    expect(overridden).toContain('x-nonce');
  });

  it('khong phien /vi/overview -> 307 ve /vi/login van du 6 header', async () => {
    getTokenMock.mockResolvedValue(null);
    const res = await hit('/vi/overview');
    expect(res.status).toBe(307);
    expectSix(res);
  });

  it('/overview khong locale -> response cua next-intl du 6 header', async () => {
    getTokenMock.mockResolvedValue(null);
    expectSix(await hit('/overview'));
  });

  it('data-entry vao /vi/overview -> redirect /vi/nhap-lieu du 6 header', async () => {
    getTokenMock.mockResolvedValue({ email: 'pm@daidung.com.vn', role: 'data-entry' });
    const res = await hit('/vi/overview');
    expect(new URL(res.headers.get('location')!).pathname).toBe('/vi/nhap-lieu');
    expectSix(res);
  });

  it('thieu NEXTAUTH_SECRET -> 500 du 6 header', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', '');
    const res = await hit('/vi/overview');
    expect(res.status).toBe(500);
    expectSix(res);
  });

  it('2 request lien tiep -> 2 nonce khac nhau', async () => {
    getTokenMock.mockResolvedValue(null);
    const a = nonceOf(await hit('/vi/login'));
    const b = nonceOf(await hit('/vi/login'));
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('client gui x-nonce va CSP gia -> header chuyen tiep mang gia tri moi, khong con evil', async () => {
    getTokenMock.mockResolvedValue(null);
    const res = await hit('/vi/login', { 'x-nonce': 'evil', 'content-security-policy-report-only': 'evil' });
    expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonceOf(res));
    expect(res.headers.get('x-middleware-request-content-security-policy-report-only')).not.toContain('evil');
    expect(res.headers.get('x-middleware-request-x-nonce')).not.toBe('evil');
  });

  it("CSP trong test (NODE_ENV=test) khong co 'unsafe-eval'", async () => {
    getTokenMock.mockResolvedValue(null);
    expect((await hit('/vi/login')).headers.get('content-security-policy-report-only')).not.toContain('unsafe-eval');
  });
});
