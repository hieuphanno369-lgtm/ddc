import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

/**
 * Rule Priority (chu du an chot 2026-09-29): badge P0 vang nhan, P1 navy, P2/P3 xam, khong do/cam;
 * the "Top du an trong diem" khong hien tre/dung tien do, cham vang. Chup anh de soi pixel.
 */
test.use({ storageState: 'e2e/.auth/admin.json' });

const SHOTS = 'test-results/anh-priority';

for (const theme of ['light', 'dark'] as const) {
  test(`the Top va bang du an - ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/vi/overview');

    const card = page.locator('.card', { hasText: vi('topPriority.title') }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText(vi('topPriority.subtitle'))).toBeVisible();
    // Khong con nhan tre/dung va khong con cham do/xanh trang thai.
    await expect(card.locator('.chip')).toHaveCount(0);
    const dots = card.locator('.dot');
    const n = await dots.count();
    for (let i = 0; i < n; i++) {
      await expect(dots.nth(i)).toHaveAttribute('style', /var\(--gold\)/);
    }
    await card.screenshot({ path: `${SHOTS}/the-top-${theme}.png` });

    // Bang du an nam o trang Tong quan (ProjectTable trong OverviewWidgets).
    const chips = page.locator('table .chip', { hasText: /^P[0-3]/ });
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const cls = (await chips.nth(i).getAttribute('class')) ?? '';
      expect(cls).not.toMatch(/c-dan|c-warn/);
      const text = (await chips.nth(i).textContent()) ?? '';
      if (text.startsWith('P0')) expect(cls).toContain('c-gold');
      if (text.startsWith('P1')) expect(cls).toContain('c-info');
    }
    await page.locator('table').first().screenshot({ path: `${SHOTS}/bang-du-an-${theme}.png` });
  });
}
