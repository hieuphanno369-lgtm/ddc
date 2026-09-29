import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { vi } from './helpers/i18n';

/**
 * P3F Task 4 - giao dien 3 trang xac thuc (Dang nhap, Quen mat khau, Dat lai mat khau) theo ban chot 29/09:
 * ma tran viewport x sang/toi x trang, do so do pixel chinh, reduced-motion, trang thai dang xu ly, loi, doi
 * ngon ngu giu query, ban phim, CLS. Anh luu vao .bangiao/anh-p3f/ de soi voi Main/Dark/Mobile.dc.html.
 * Gan x-forwarded-for gia (TEST-NET-3) cho cac ca gui sai mat khau de khong cong don vao khoa IP dung chung.
 */
const SHOTS = '.bangiao/anh-p3f';
mkdirSync(SHOTS, { recursive: true });

const NO_AUTH = { cookies: [], origins: [] };
const VIEWPORTS = [
  { w: 1440, h: 900 },
  { w: 1280, h: 800 },
  { w: 390, h: 844 },
] as const;
const SCHEMES = ['light', 'dark'] as const;
const PAGES = [
  { slug: 'login-vi', path: '/vi/login' },
  { slug: 'quen-mat-khau', path: '/vi/quen-mat-khau' },
  { slug: 'dat-lai-mat-khau', path: '/vi/dat-lai-mat-khau?token=khong-hop-le' },
  { slug: 'login-en', path: '/en/login' },
] as const;

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

const box = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  expect(b, `khong tim thay hop cua ${sel}`).not.toBeNull();
  return b!;
};

const intersects = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('27 - ma tran giao dien (khong cuon ngang, chup anh)', () => {
  test.use({ storageState: NO_AUTH, reducedMotion: 'reduce' });
  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      for (const pg of PAGES) {
        test(`${pg.slug} ${vp.w}x${vp.h} ${scheme}`, async ({ page }) => {
          await page.setViewportSize({ width: vp.w, height: vp.h });
          await page.emulateMedia({ colorScheme: scheme });
          await open(page, pg.path);
          const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(over, 'cuon ngang').toBeLessThanOrEqual(0);
          await page.screenshot({
            path: `${SHOTS}/dang-nhap-${pg.slug}-${vp.w}-${scheme === 'light' ? 'sang' : 'toi'}.png`,
            fullPage: true,
          });
        });
      }
    }
  }
});

test.describe('27 - so do pixel', () => {
  test.use({ storageState: NO_AUTH, reducedMotion: 'reduce' });

  test('1440 sang /vi/login: panel 796, the 452, nut 50, o email 48, nut mat 44x44, cau khong de len chu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page, '/vi/login');

    const showcase = await box(page, '[data-auth="showcase"]');
    expect(Math.abs(showcase.width - 796)).toBeLessThanOrEqual(1);
    const card = await box(page, '[data-auth="card"]');
    expect(Math.abs(card.width - 452)).toBeLessThanOrEqual(1);
    const btn = await box(page, '[data-auth="card"] button[type="submit"]');
    expect(Math.round(btn.height)).toBe(50);
    const email = await box(page, '#auth-email');
    expect(Math.round(email.height)).toBe(48);
    const eye = await box(page, `button[aria-label="${vi('auth.showPassword')}"]`);
    expect(Math.round(eye.width)).toBe(44);
    expect(Math.round(eye.height)).toBe(44);
    expect(intersects(await box(page, '[data-auth="crane"]'), await box(page, '[data-auth="hero-text"]'))).toBe(false);
  });

  test('1280x800: panel trai co lai, cau khong de len chu, the form nam tron trong khung nhin', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/vi/login');
    const showcase = await box(page, '[data-auth="showcase"]');
    expect(showcase.width).toBeLessThan(796);
    expect(intersects(await box(page, '[data-auth="crane"]'), await box(page, '[data-auth="hero-text"]'))).toBe(false);
    const card = await box(page, '[data-auth="card"]');
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(1280);
  });

  test('390: panel trai an, dau trang di dong hien, the rong 358, moi vung bam >= 44x44', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/vi/login');
    await expect(page.locator('[data-auth="showcase"]')).toBeHidden();
    await expect(page.locator('[data-auth="mobile-head"]')).toBeVisible();
    const card = await box(page, '[data-auth="card"]');
    expect(Math.abs(card.width - 358)).toBeLessThanOrEqual(1);

    const small = await page.evaluate(() => {
      const bad: string[] = [];
      const els = document.querySelectorAll<HTMLElement>('[data-auth="shell"] a, [data-auth="shell"] button, [data-auth="shell"] input, [data-auth="shell"] select');
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // Phan tu du lon: do truc tiep hop; phan tu nho hon 44 phai co vung bam nho ra bang ::after (elementFromPoint).
        if (r.width >= 43.5 && r.height >= 43.5) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        for (const [dx, dy] of [[-21.5, -21.5], [21.5, -21.5], [-21.5, 21.5], [21.5, 21.5]]) {
          const hit = document.elementFromPoint(cx + dx, cy + dy);
          if (!hit || !(hit === el || el.contains(hit))) {
            bad.push(`${el.tagName.toLowerCase()}#${el.id || ''} "${(el.textContent || '').trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
            break;
          }
        }
      });
      return bad;
    });
    expect(small, `vung bam < 44x44: ${small.join(' | ')}`).toEqual([]);
  });

  test('toi: chu tieu de rgb(242, 245, 249), the co backdrop-filter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page, '/vi/login');
    const color = await page.locator('[data-auth="card"] h1').evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(242, 245, 249)');
    const filter = await page.locator('[data-auth="card"]').evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(filter).not.toBe('none');
  });
});

test.describe('27 - animation', () => {
  test.use({ storageState: NO_AUTH, viewport: { width: 1440, height: 900 } });

  test('reduced-motion: moi [data-anim] khong chay, tia han an', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: NO_AUTH, reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await open(page, '/vi/login');
    const res = await page.evaluate(() =>
      [...document.querySelectorAll<SVGElement>('[data-anim]')].map((el) => {
        const cs = getComputedStyle(el);
        return { anim: el.getAttribute('data-anim'), name: cs.animationName, opacity: cs.opacity };
      }),
    );
    expect(res.length).toBeGreaterThanOrEqual(7);
    for (const r of res) expect(r.name, `data-anim=${r.anim}`).toBe('none');
    expect(res.find((r) => r.anim === 'spark')?.opacity).toBe('0');
    await ctx.close();
  });

  test('co animation: chu ky cau 10s, den nhap nhay 1.6s, sau 2s moi khoi form hien', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: NO_AUTH, reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await open(page, '/vi/login');
    const dur = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).animationDuration);
    expect(await dur('[data-anim="trolley"]')).toBe('10s');
    expect(await dur('[data-anim="blink"]')).toBe('1.6s');
    await page.waitForTimeout(2000);
    const opacities = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-auth="card"] form > *')].map((el) => getComputedStyle(el).opacity),
    );
    expect(opacities.length).toBeGreaterThan(0);
    for (const o of opacities) expect(o).toBe('1');
    await ctx.close();
  });

  test('CLS < 0.01 sau 3s o 1440', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: NO_AUTH, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/vi/login');
    await page.waitForTimeout(3000);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.01);
    await ctx.close();
  });
});

test.describe('27 - hanh vi', () => {
  test.use({ storageState: NO_AUTH, reducedMotion: 'reduce', extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.88' } });

  test('dang xu ly: dai oc xoay hien, nut aria-busy va disabled', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route('**/api/auth/callback/credentials**', (r) => setTimeout(() => r.continue(), 1500));
    await open(page, '/vi/login');
    await page.locator('#auth-email').fill('khong-ton-tai-e2e27@daidung.com.vn');
    await page.locator('#auth-password').fill('mat-khau-sai-e2e-27');
    const submit = page.locator('[data-auth="card"] button[type="submit"]');
    await submit.click();
    await expect(page.locator('[data-auth="spinner"]').first()).toBeVisible();
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    await expect(submit).toBeDisabled();
  });

  test('sai mat khau -> the loi co noi dung invalidCredentials', async ({ page }) => {
    await open(page, '/vi/login');
    await page.locator('#auth-email').fill('khong-ton-tai-e2e27b@daidung.com.vn');
    await page.locator('#auth-password').fill('mat-khau-sai-e2e-27');
    await page.getByRole('button', { name: vi('auth.signIn') }).click();
    await expect(page.locator('[data-auth="notice-error"]')).toContainText(vi('auth.invalidCredentials'));
  });

  test('?error=AccessDenied -> the loi googleDenied', async ({ page }) => {
    await open(page, '/vi/login?error=AccessDenied');
    await expect(page.locator('[data-auth="notice-error"]')).toContainText(vi('authSecurity.googleDenied'));
  });

  test('doi ngon ngu o trang dat lai mat khau giu nguyen ?token=', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/vi/dat-lai-mat-khau?token=abc');
    await page.locator('[data-auth="lang-switch"] button', { hasText: 'EN' }).click();
    await expect(page).toHaveURL(/\/en\/dat-lai-mat-khau\?token=abc$/);
  });

  test('ban phim: thu tu Tab dung va moi phan tu focus co vien 2px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/vi/login');
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100); // quy tac reduced-motion chung dat transition 1e-5s: doi vien focus on dinh
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const label = el.id || el.getAttribute('aria-label') || (el.textContent || '').trim();
        return { label, outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle, href: el.getAttribute('href') };
      });
      if (!info) continue;
      expect(info.outlineWidth, `outline cua ${info.label}`).toBe('2px');
      expect(info.outlineStyle, `outline cua ${info.label}`).not.toBe('none');
      seen.push(info.href ?? info.label);
      if (info.href === '/dang-ky' || info.href?.endsWith('/dang-ky')) break;
    }
    const idx = (needle: string | RegExp) => seen.findIndex((s) => (typeof needle === 'string' ? s === needle : needle.test(s)));
    const order = [
      'VI',
      'EN',
      'auth-email',
      /quen-mat-khau$/,
      'auth-password',
      vi('auth.showPassword'),
      vi('auth.signIn'),
      /dang-ky$/,
    ].map(idx);
    expect(order.every((n) => n >= 0), `Tab di qua: ${seen.join(' > ')}`).toBe(true);
    expect([...order].sort((a, b) => a - b), `Tab di qua: ${seen.join(' > ')}`).toEqual(order);
  });
});
