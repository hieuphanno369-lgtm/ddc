import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

/**
 * P7-C1b (7.7-7.10, chu du an giao 2026-09-26):
 * 7.7 bo khoi "Du an can luu y" duoi thanh loc; 7.8 the to noi la "Dang trien khai";
 * 7.9 so tong du an giua bieu do tron + bieu do tron dung truoc "Luong & Tri theo Team KD";
 * 7.10 trang Chi tiet: sidebar hien ten du an (dam) + ma du an (mo), co hieu ung; trang khac giu ten app.
 */

test.use({ storageState: 'e2e/.auth/admin.json', viewport: { width: 1280, height: 800 } });

test.describe('11 - Tong quan (7.7-7.9)', () => {
  test('khong con khoi "Du an can luu y", the to noi = Dang trien khai', async ({ page }) => {
    await page.goto('/vi/overview');
    await expect(page.locator('.kpis').first()).toBeVisible();

    // Khong kiem '.alert' tran: cac dong "Top du an trong diem" cung dung class nay.
    await expect(page.getByText(vi('overview.watchlist'), { exact: true })).toHaveCount(0);

    const hero = page.locator('.kpis').first().locator('.kpi.key');
    await expect(hero).toHaveCount(1);
    await expect(hero.locator('.lb')).toContainText(vi('kpi.inProgress'));
  });

  test('bieu do tron dung truoc, co so tong du an o giua', async ({ page }) => {
    await page.goto('/vi/overview');
    const cards = page.locator('.g2').first().locator(':scope > *');
    await expect(cards.first()).toContainText(vi('overview.statusBreakdown'));

    const center = page.getByTestId('donut-total');
    await expect(center).toBeVisible();
    await expect(center).toContainText(vi('kpi.totalProjects'));

    // So o giua = tong cac dong chu giai ben duoi.
    const legendValues = await cards.first().locator('button span.font-bold').allTextContents();
    const sum = legendValues.reduce((a, v) => a + Number(v), 0);
    await expect(center.locator('b')).toHaveText(String(sum));

    // Nam giua vong tron: tam o so voi tam SVG lech < 4px.
    const svg = await cards.first().locator('svg.recharts-surface').first().boundingBox();
    const box = await center.boundingBox();
    expect(Math.abs(box!.x + box!.width / 2 - (svg!.x + svg!.width / 2))).toBeLessThan(4);
    expect(Math.abs(box!.y + box!.height / 2 - (svg!.y + svg!.height / 2))).toBeLessThan(4);
    await cards.first().screenshot({ path: 'test-results/p7-donut-total.png' });
  });
});

test.describe('11 - Sidebar ten du an (7.10)', () => {
  test('trang Chi tiet: dong dam = ten du an, dong mo = ma du an; ve trang khac tra lai ten app', async ({ page }) => {
    await page.goto('/vi/projects/1');
    const name = (await page.locator('.phead h2').first().textContent())!.trim();
    const code = (await page.locator('.phead .meta .mono').first().textContent())!.trim();

    const nm = page.locator('aside.side .brand .nm');
    await expect(nm).toHaveClass(/is-project/);
    await expect(nm.locator('b')).toHaveText(name);
    await expect(nm.locator('span')).toHaveText(code);
    await expect(nm.locator('b')).toHaveAttribute('title', name);

    // Co hieu ung chuyen dong (animation-name khac none) khi khong bat giam chuyen dong.
    const anim = await nm.locator('b').evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).not.toBe('none');

    // Ten dai khong tran khoi sidebar.
    const nmBox = await nm.boundingBox();
    const asideBox = await page.locator('aside.side').boundingBox();
    expect(nmBox!.x + nmBox!.width).toBeLessThanOrEqual(asideBox!.x + asideBox!.width);
    await page.locator('aside.side').screenshot({ path: 'test-results/p7-sidebar-project.png' });

    await page.locator('aside.side a[href$="/overview"]').click();
    await expect(page).toHaveURL(/\/vi\/overview/);
    await expect(nm).not.toHaveClass(/is-project/);
    await expect(nm.locator('b')).toHaveText(vi('app.headerTitle'));
    await expect(nm.locator('span')).toHaveText(vi('app.name'));
  });

  test('giam chuyen dong: khong co animation', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
      reducedMotion: 'reduce',
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await page.goto('/vi/projects/1');
    const b = page.locator('aside.side .brand .nm.is-project b');
    await expect(b).toBeVisible();
    expect(await b.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    await ctx.close();
  });
});
