import { test, expect, type Locator } from '@playwright/test';
import { en, vi } from './helpers/i18n';

/**
 * P7-C1 (7.3): ten app hien thi moi (dong dam "BAO CAO QUAN TRI" / "MANAGEMENT REPORTS", dong mo
 * "Danh Muc Du An" / "Project Portfolio") khong tran/xuong dong o sidebar desktop, thu gon, drawer
 * mobile, va h1 trang dang nhap; tieu de tab dung theo locale.
 */

const T = { vi, en } as const;
type Loc = keyof typeof T;
const LOCALES: Loc[] = ['vi', 'en'];

async function assertSingleLineNoOverflow(locator: Locator): Promise<void> {
  const box = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, height: r.height, lineHeight };
  });
  expect(box.scrollWidth, 'chu tran (scrollWidth > clientWidth)').toBeLessThanOrEqual(box.clientWidth);
  expect(box.height, 'xuong qua 1 dong').toBeLessThan(1.5 * box.lineHeight);
}

test.describe('10 - ten app moi (7.3): sidebar + login vi/en', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.describe('Sidebar desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    for (const loc of LOCALES) {
      test(`${loc} - dong dam/mo dung chu, 1 dong, khong tran, khong de logo`, async ({ page }) => {
        await page.goto(`/${loc}/overview`);

        const aside = page.locator('aside.side');
        const b = aside.locator('.brand .nm b');
        const span = aside.locator('.brand .nm span');
        await expect(b).toHaveText(T[loc]('app.headerTitle'));
        await expect(span).toHaveText(T[loc]('app.name'));
        await expect(page).toHaveTitle(`${T[loc]('app.headerTitle')} - ${T[loc]('app.name')}`);

        await assertSingleLineNoOverflow(b);
        await assertSingleLineNoOverflow(span);

        const nmBox = await aside.locator('.brand .nm').boundingBox();
        const asideBox = await aside.boundingBox();
        expect(nmBox).not.toBeNull();
        expect(asideBox).not.toBeNull();
        expect(nmBox!.x + nmBox!.width).toBeLessThanOrEqual(asideBox!.x + asideBox!.width);

        const bBox = await b.boundingBox();
        const spanBox = await span.boundingBox();
        expect(spanBox!.y).toBeGreaterThanOrEqual(bBox!.y + bBox!.height);

        await aside.screenshot({ path: `test-results/p7-sidebar-${loc}-desktop.png` });
      });
    }
  });

  test.describe('Sidebar thu gon', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    for (const loc of LOCALES) {
      test(`${loc} - bam nut dau -> thu gon, chi con logo`, async ({ page }) => {
        await page.goto(`/${loc}/overview`);

        await page.locator('header.topbar button').first().click();

        const aside = page.locator('aside.side');
        await expect(aside).toHaveClass(/is-collapsed/);
        await expect(aside.locator('.brand .nm')).toBeHidden();
        const appicon = aside.locator('.brand .appicon');
        await expect(appicon).toBeVisible();

        const iconBox = await appicon.boundingBox();
        const asideBox = await aside.boundingBox();
        expect(iconBox).not.toBeNull();
        expect(asideBox).not.toBeNull();
        expect(iconBox!.x).toBeGreaterThanOrEqual(asideBox!.x);
        expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(asideBox!.x + asideBox!.width);

        await aside.screenshot({ path: `test-results/p7-sidebar-${loc}-collapsed.png` });
      });
    }
  });

  test.describe('Drawer mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    for (const loc of LOCALES) {
      test(`${loc} - mo drawer -> dung chu, 1 dong, khong tran`, async ({ page }) => {
        await page.goto(`/${loc}/overview`);

        await page.locator('header.topbar button').first().click();

        const aside = page.locator('aside.side');
        await expect(aside).toHaveClass(/is-open/);

        const b = aside.locator('.brand .nm b');
        const span = aside.locator('.brand .nm span');
        await expect(b).toHaveText(T[loc]('app.headerTitle'));
        await expect(span).toHaveText(T[loc]('app.name'));

        await assertSingleLineNoOverflow(b);
        await assertSingleLineNoOverflow(span);

        await aside.screenshot({ path: `test-results/p7-sidebar-${loc}-mobile.png` });
      });
    }
  });
});

test.describe('10 - ten app moi (7.3): trang dang nhap vi/en', () => {
  for (const loc of LOCALES) {
    test(`${loc} - ten app tren panel dang nhap dung chu, 1 dong, tieu de tab dung`, async ({ browser }) => {
      const ctx = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        viewport: { width: 1440, height: 900 },
      });
      const page = await ctx.newPage();
      await page.goto(`/${loc}/login`);

      // P3F: ten app la dong 1 cua thuong hieu tren panel trai (CSS doi hoa thuong, textContent van la app.headerTitle).
      const title = page.locator('[data-auth="showcase"] [data-auth="brand-title"]');
      await expect(title).toHaveText(T[loc]('app.headerTitle'));
      await assertSingleLineNoOverflow(title);
      await expect(page).toHaveTitle(`${T[loc]('app.headerTitle')} - ${T[loc]('app.name')}`);

      await page.locator('[data-auth="showcase"]').screenshot({ path: `test-results/p7-login-${loc}.png` });
      await ctx.close();
    });
  }
});
