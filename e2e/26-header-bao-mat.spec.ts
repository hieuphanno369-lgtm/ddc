import { test, expect, request as pwRequest, type APIRequestContext, type APIResponse } from '@playwright/test';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';

/**
 * P5-B - header bao mat (CSP Report-Only + nonce) co mat tren trang, redirect, ban dich intl; nonce doi
 * moi request va khop HTML; endpoint /api/csp-report nhan bao cao. Dung APIRequestContext (khong cookie
 * cho phan chua dang nhap, storageState admin cho phan co phien).
 */
const BASE = resolveE2eTarget(loadE2eEnv()).baseURL;

const HEADERS = [
  'content-security-policy-report-only', 'reporting-endpoints', 'x-content-type-options',
  'referrer-policy', 'x-frame-options', 'permissions-policy',
];
// IP rieng cua spec nay de khong an vao gioi han chung cua /api/csp-report.
const XFF = '198.51.100.26';

const REPORT = JSON.stringify({
  'csp-report': { 'document-uri': `${BASE}/vi/login`, 'blocked-uri': 'inline', 'effective-directive': 'script-src', disposition: 'report' },
});
const API_REPORT = JSON.stringify([
  { type: 'csp-violation', body: { documentURL: `${BASE}/vi/login`, blockedURL: 'eval', effectiveDirective: 'script-src', disposition: 'report' } },
]);

function expectSix(res: APIResponse, label: string) {
  const h = res.headers();
  for (const name of HEADERS) expect(h[name], `${label}: thieu ${name}`).toBeTruthy();
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
}

function nonceOf(res: APIResponse): string {
  const m = /'nonce-([^']+)'/.exec(res.headers()['content-security-policy-report-only'] ?? '');
  expect(m, 'CSP khong co nonce').not.toBeNull();
  return m![1];
}

let anon: APIRequestContext;
let admin: APIRequestContext;
test.beforeAll(async () => {
  anon = await pwRequest.newContext({ baseURL: BASE });
  admin = await pwRequest.newContext({ baseURL: BASE, storageState: 'e2e/.auth/admin.json' });
});
test.afterAll(async () => {
  await anon.dispose();
  await admin.dispose();
});

test.describe('26 - header bao mat va CSP Report-Only', () => {
  const PUBLIC: Array<[string, number]> = [
    ['/vi/login', 200],
    ['/vi/quen-mat-khau', 200],
    ['/vi/dat-lai-mat-khau?token=x', 200],
  ];
  for (const [path, status] of PUBLIC) {
    test(`khong cookie ${path} -> ${status}, du 6 header`, async () => {
      const res = await anon.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(status);
      expectSix(res, path);
    });
  }

  test('khong cookie /vi/overview -> 307, du 6 header', async () => {
    const res = await anon.get('/vi/overview', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expectSix(res, '/vi/overview');
  });

  test('khong cookie /overview (khong locale) -> redirect, du 6 header', async () => {
    const res = await anon.get('/overview', { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(res.status());
    expectSix(res, '/overview');
  });

  for (const path of ['/vi/overview', '/vi/projects/1']) {
    test(`co phien admin ${path} -> 200, du 6 header`, async () => {
      const res = await admin.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(200);
      expectSix(res, path);
    });
  }

  test('/vi/login goi 2 lan: nonce khac nhau, HTML chua dung nonce cua response do', async () => {
    const a = await anon.get('/vi/login');
    const b = await anon.get('/vi/login');
    const na = nonceOf(a);
    const nb = nonceOf(b);
    expect(na).not.toBe(nb);
    expect(await a.text()).toContain(`nonce="${na}"`);
    expect(await b.text()).toContain(`nonce="${nb}"`);
  });

  test('POST /api/csp-report: application/csp-report hop le -> 204', async () => {
    const res = await anon.post('/api/csp-report', {
      data: REPORT, headers: { 'content-type': 'application/csp-report', 'x-forwarded-for': XFF },
    });
    expect(res.status()).toBe(204);
  });

  test('POST /api/csp-report: application/reports+json hop le -> 204', async () => {
    const res = await anon.post('/api/csp-report', {
      data: API_REPORT, headers: { 'content-type': 'application/reports+json', 'x-forwarded-for': XFF },
    });
    expect(res.status()).toBe(204);
  });

  test('POST /api/csp-report: text/plain -> 415', async () => {
    const res = await anon.post('/api/csp-report', {
      data: REPORT, headers: { 'content-type': 'text/plain', 'x-forwarded-for': XFF },
    });
    expect(res.status()).toBe(415);
  });

  test('POST /api/csp-report: body 20000 byte -> 413', async () => {
    const res = await anon.post('/api/csp-report', {
      data: 'a'.repeat(20_000), headers: { 'content-type': 'application/csp-report', 'x-forwarded-for': XFF },
    });
    expect(res.status()).toBe(413);
  });

  test('GET /api/csp-report -> 405', async () => {
    const res = await anon.get('/api/csp-report', { headers: { 'x-forwarded-for': XFF } });
    expect(res.status()).toBe(405);
  });
});
