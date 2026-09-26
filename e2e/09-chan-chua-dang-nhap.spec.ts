import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { loadDotEnv, resolveE2eTarget } from './helpers/env';

/**
 * P3D-B (S-1, bao-mat.md P3C-B): nguoi CHUA dang nhap khong duoc doc du lieu du an.
 * Dung APIRequestContext moi (khong cookie) de chac chan khong dinh storageState cua spec khac.
 */
const BASE = resolveE2eTarget({ ...process.env, ...loadDotEnv() }).baseURL;

// Moi page thuc co trong app/[locale]/(app) (khop test tinh src/server/app-pages-require-user.test.ts).
const APP_PATHS = [
  '/vi/overview',
  '/vi/projects',
  '/vi/projects/1',
  '/vi/report',
  '/vi/alerts',
  '/vi/compliance',
  '/vi/audit',
  '/vi/admin',
  '/vi/import',
  '/vi/data-dictionary',
  '/vi/data-schema',
  '/vi/nhap-lieu',
  '/vi/ho-so-du-an',
  '/vi/nhap-lieu?project=1',
  '/vi/overview?month=all',
  '/en/overview',
  '/en/projects/1',
  '/vi',
];

const REDIRECT_CODES = [302, 303, 307, 308];

let api: APIRequestContext;
test.beforeAll(async () => {
  api = await pwRequest.newContext({ baseURL: BASE });
});
test.afterAll(async () => {
  await api.dispose();
});

function loginPathFor(p: string): string {
  return p.startsWith('/en') ? '/en/login' : '/vi/login';
}

test.describe('09 - chan truy cap khi chua dang nhap (S-1)', () => {
  for (const p of APP_PATHS) {
    for (const rsc of [false, true]) {
      test(`${p}${rsc ? ' [RSC: 1]' : ''} -> redirect login, khong lo du lieu`, async () => {
        const res = await api.get(p, { maxRedirects: 0, headers: rsc ? { RSC: '1' } : {} });
        const body = await res.text();
        expect(body).not.toContain('projectName');
        expect(body).not.toContain('masterCode');
        expect(REDIRECT_CODES).toContain(res.status());
        const location = res.headers()['location'] ?? '';
        expect(new URL(location, BASE).pathname).toBe(loginPathFor(p));
      });
    }
  }

  test('trinh duyet khong cookie mo /vi/overview va /vi/projects/1 -> ve /vi/login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    for (const p of ['/vi/overview', '/vi/projects/1']) {
      await page.goto(BASE + p);
      await page.waitForURL('**/vi/login');
      // KHONG kiem page.content() chua 'projectName': trang login nhung catalog i18n (vi.json co key
      // projectName/masterCode) nen se bao gia. Viec khong lo du lieu da kiem o cac test api.get phia tren.
    }
    await ctx.close();
  });

  // Lop 2 (page tu goi requireUser): gia lap vuot middleware kieu CVE-2025-29927. Du middleware co
  // bi bo qua hay khong, than phan hoi van khong duoc chua du lieu du an.
  for (const p of ['/vi/overview', '/vi/projects/1']) {
    test(`${p} [x-middleware-subrequest] -> khong lo du lieu`, async () => {
      const res = await api.get(p, {
        maxRedirects: 0,
        headers: { RSC: '1', 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' },
      });
      const body = await res.text();
      expect(body).not.toContain('projectName');
      expect(body).not.toContain('masterCode');
      expect([200, ...REDIRECT_CODES]).toContain(res.status());
    });
  }

  test('trang login van mo duoc khi chua dang nhap (200)', async () => {
    const res = await api.get('/vi/login', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });

  // Khoa hoi quy: cac route API da tu chan (ky vong XANH ngay tu truoc khi sua).
  test('API khong cookie: khong tra du lieu', async () => {
    expect((await api.get('/api/export', { maxRedirects: 0 })).status()).toBe(401);
    expect((await api.get('/api/report/export', { maxRedirects: 0 })).status()).toBe(403);
    expect((await api.get('/api/templates/daily-resources?project=1', { maxRedirects: 0 })).status()).toBe(403);
    expect((await api.get('/api/photos/2026-09/x.png', { maxRedirects: 0 })).status()).toBe(401);
    expect([401, 403]).toContain((await api.post('/api/photo-upload', { maxRedirects: 0 })).status());
    expect([401, 503]).toContain((await api.post('/api/cron/alerts_daily', { maxRedirects: 0 })).status());
    const health = await api.get('/api/health');
    expect(health.status()).toBe(200);
    expect(Object.keys(await health.json()).sort()).toEqual(['status', 'time']);
  });
});
