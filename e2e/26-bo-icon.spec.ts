import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * P3F Task 2 - soi bo icon moi (net 1.8, khong meo, can dong voi chu) tren cac trang chinh,
 * 1440/390 x sang/toi. Anh luu vao .bangiao/anh-p3f/ de nguoi soi pixel.
 */
const SHOTS = '.bangiao/anh-p3f';
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
] as const;
const SCHEMES = ['light', 'dark'] as const;
const PAGES = ['overview', 'du-an', 'nhap-lieu', 'admin', 'alerts'] as const;

async function pathFor(page: Page, slug: (typeof PAGES)[number]): Promise<string> {
  if (slug === 'overview') return '/vi/overview';
  if (slug === 'nhap-lieu') return '/vi/nhap-lieu';
  if (slug === 'admin') return '/vi/admin';
  if (slug === 'alerts') return '/vi/alerts';
  await page.goto('/vi/overview');
  const href = await page
    .locator('a[href*="/projects/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);
  return href && /\/projects\/\d+/.test(href) ? href.replace(/^\/(?!vi\/)/, '/vi/').replace(/\?.*$/, '') : '/vi/projects/1';
}

/** Kiem moi svg icon dang hien thi (nam trong root): nét 1.8, vuong, va can dong voi chu ke ben. */
async function auditIcons(page: Page, rootSelector: string) {
  const bad = await page.evaluate((sel) => {
    const root = document.querySelector(sel) ?? document.body;
    const out: string[] = [];
    const svgs = root.querySelectorAll<SVGSVGElement>('svg[aria-hidden="true"][viewBox="0 0 24 24"]');
    svgs.forEach((svg) => {
      const r = svg.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const sw = svg.getAttribute('stroke-width');
      const cs = getComputedStyle(svg);
      if (sw !== '1.8' && !svg.hasAttribute('data-stroke-override') && sw !== '2') out.push(`stroke-width=${sw} @${svg.parentElement?.className}`);
      if (Math.abs(r.width - r.height) > 0.6) out.push(`meo ${r.width}x${r.height} @${svg.parentElement?.tagName}.${svg.parentElement?.className} ${svg.outerHTML.slice(0, 60)}`);
      if (cs.display === 'none') return;
      const inRow = svg.closest('a.nav, .stage .nm');
      if (inRow) {
        const text = inRow.querySelector<HTMLElement>('.truncate');
        if (text) {
          const tr = text.getBoundingClientRect();
          const dy = Math.abs(r.top + r.height / 2 - (tr.top + tr.height / 2));
          if (tr.height > 0 && dy > 2) out.push(`lech dong ${dy.toFixed(1)}px`);
        }
      }
    });
    return out;
  }, rootSelector);
  expect(bad, `icon loi: ${bad.join('; ')}`).toEqual([]);
}

test.describe('26 - bo icon P3F', () => {
  test.use({ storageState: 'e2e/.auth/admin.json', reducedMotion: 'reduce' });

  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      test.describe(`${vp.w} ${scheme}`, () => {
        test.use({ viewport: { width: vp.w, height: vp.h }, colorScheme: scheme });

        for (const slug of PAGES) {
          test(`trang ${slug}`, async ({ page }) => {
            const path = await pathFor(page, slug);
            await page.goto(path);
            await page.waitForLoadState('networkidle');
            await auditIcons(page, 'body');
            if (slug === 'du-an') {
              const n = await page.locator('.stage .nm svg[data-stage-icon]').count();
              expect(n).toBeGreaterThan(0);
            }
            if (vp.w < 1024) {
              await page.locator('.topbar button.nav').click();
              await expect(page.locator('aside.side.is-open')).toBeVisible();
              await auditIcons(page, 'aside.side');
              await page.locator('.side-scrim').click({ position: { x: 380, y: 400 } });
              await expect(page.locator('aside.side.is-open')).toHaveCount(0);
            }
            await page.screenshot({
              path: `${SHOTS}/icon-${slug}-${vp.w}-${scheme === 'light' ? 'sang' : 'toi'}.png`,
              fullPage: true,
            });
          });
        }
      });
    }
  }
});
