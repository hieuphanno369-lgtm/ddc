import { test, expect, type Page } from '@playwright/test';
import { vi } from './helpers/i18n';

/**
 * P5-B - DO vi pham CSP tren trinh duyet that (Report-Only nen khong duoc chan gi). Spec khong do vi co
 * vi pham; chi do neu co thu bi CHAN that (disposition khac 'report') hoac chuc nang hong. Danh sach
 * vi pham dinh kem `csp-vi-pham.json` de tester chep vao docs/csp-header-bao-mat.md muc 8.
 */
interface Violation {
  directive: string; blocked: string; source: string; line: number; sample: string; disposition: string; page: string;
}
interface Row extends Violation { route: string }

const all: Row[] = [];
const consoleLines: string[] = [];

async function collect(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: unknown[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push({
        directive: e.effectiveDirective, blocked: e.blockedURI, source: e.sourceFile, line: e.lineNumber,
        sample: e.sample, disposition: e.disposition, page: location.pathname,
      });
    });
  });
  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('Content Security Policy') || t.includes('Content-Security-Policy')) consoleLines.push(t.slice(0, 300));
  });
}

async function settle(page: Page, route: string): Promise<void> {
  // Tren `next start` yeu cau /_next/image?w=48 (logo 38px) treo mai khi thieu sharp (loi co san, xem
  // .bangiao/ket-qua-test.md), nen networkidle khong toi. Cho toi da 15 giay roi do tiep, khong de spec chet vi no.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    test.info().annotations.push({ type: 'khong-idle', description: `${route}: mang khong yen sau 15 giay` });
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const found = (await page.evaluate(() => (window as unknown as { __csp: Violation[] }).__csp)) as Violation[];
  for (const v of found) all.push({ ...v, route });
}

test.describe('27 - thu vi pham CSP (khong phien)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('/vi/login, nut Google, /vi/quen-mat-khau, /vi/dat-lai-mat-khau, /vi/dang-ky, /vi/dieu-khoan', async ({ page }) => {
    await collect(page);
    await page.route('https://accounts.google.com/**', (r) => r.abort());

    await page.goto('/vi/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const google = page.getByRole('button', { name: vi('authPage.continueGoogle') });
    if (await google.count()) {
      // Nut Google chi hien khi .env co GOOGLE_CLIENT_ID/SECRET (giong spec 20: khong co thi bo qua buoc bam).
      await expect(google).toBeVisible();
      const req = page.waitForRequest((r) => r.url().includes('/api/auth/signin/google'));
      await google.click();
      await req;
    } else {
      test.info().annotations.push({ type: 'bo-qua', description: 'Khong co GOOGLE_CLIENT_ID/SECRET: bo buoc bam nut Google' });
    }
    await settle(page, '/vi/login');

    await page.goto('/vi/quen-mat-khau');
    // P3F: trang luon co tieu de (co SMTP hay khong), dung tieu de de kiem hien thi.
    await expect(page.getByText(vi('authPage.forgotHeading')).first()).toBeVisible();
    await settle(page, '/vi/quen-mat-khau');

    await page.goto('/vi/dat-lai-mat-khau?token=x');
    await settle(page, '/vi/dat-lai-mat-khau?token=x');

    // P3F: 2 trang cong khai moi. Khong co SMTP thi /dang-ky chi hien thong bao, van co tieu de trang.
    await page.goto('/vi/dang-ky');
    await expect(page.locator('h1').first()).toBeVisible();
    await settle(page, '/vi/dang-ky');

    await page.goto('/vi/dieu-khoan');
    await expect(page.getByText(vi('terms.title')).first()).toBeVisible();
    await settle(page, '/vi/dieu-khoan');
  });
});

test.describe('27 - thu vi pham CSP (phien admin)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  const CHART_ROUTES = ['/vi/overview', '/vi/projects/1'];
  const OTHER_ROUTES = ['/vi/overview?month=all', '/vi/projects', '/vi/report', '/vi/alerts', '/vi/admin', '/vi/nhap-lieu'];

  for (const route of [...CHART_ROUTES, ...OTHER_ROUTES]) {
    test(`${route}`, async ({ page }) => {
      await collect(page);
      await page.goto(route);
      if (CHART_ROUTES.includes(route)) await expect(page.locator('.recharts-surface').first()).toBeVisible();
      await settle(page, route);
    });
  }
});

test('tong hop: Report-Only khong duoc chan thu gi', async ({}, testInfo) => {
  const summary = new Map<string, number>();
  for (const v of all) {
    const k = `${v.route} | ${v.directive} | ${v.blocked}`;
    summary.set(k, (summary.get(k) ?? 0) + 1);
  }
  console.log(`[csp] Tong ${all.length} vi pham (Report-Only). Bang tom tat (trang | chi thi | nguon bi chan | so lan):`);
  for (const [k, n] of summary) console.log(`  ${k} | ${n}`);
  if (consoleLines.length) console.log(`[csp] ${consoleLines.length} dong console lien quan CSP, vd: ${consoleLines[0]}`);
  await testInfo.attach('csp-vi-pham.json', {
    body: JSON.stringify({ violations: all, console: consoleLines }, null, 2),
    contentType: 'application/json',
  });
  // Assert duy nhat: Report-Only khong duoc chan gi.
  expect(all.filter((v) => v.disposition !== 'report')).toEqual([]);
});
