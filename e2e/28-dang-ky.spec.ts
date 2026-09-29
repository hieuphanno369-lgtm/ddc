import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { en, vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

/**
 * P3F Task 7 - dang ky tai khoan cho admin bat: luong that qua giao dien (form cong khai -> Quan tri -> dang nhap),
 * gioi han quyen, Phong ban, nhac admin, trang Dieu khoan, va soi pixel. Chay TUAN TU vi cac buoc noi tiep nhau.
 * Moi ngu canh chua dang nhap gan x-forwarded-for gia rieng (RFC 5737) de khong cong don vao gioi han 10 lan/gio/IP
 * cua dang ky va khoa IP dang nhap dung chung voi cac spec khac.
 * Don dep cuoi spec: tu choi moi dang ky con cho co tien to `e2e-dangky-` va xoa phong ban khong ai dung.
 */
const SHOTS = '.bangiao/anh-p3f';
mkdirSync(SHOTS, { recursive: true });

const TS = Date.now();
const NO_AUTH = { cookies: [], origins: [] };
const EMAIL_PREFIX = 'e2e-dangky-';
const PASSWORD = 'Abcdef1!';
const DEPT_A = `E2E PB ${TS}`;
const DEPT_B = `E2E PB2 ${TS}`;
const email = (tag: string) => `${EMAIL_PREFIX}${tag}-${TS}@daidung.vn`;
const EMAIL_1 = email('a');
const EMAIL_2 = email('b');

let ipCounter = 0;
/** IP gia duy nhat cho moi ngu canh (khong trung giua cac lan chay spec trong cung 1 gio). */
const fakeIp = () => `198.51.${(TS % 200) + 20}.${(ipCounter++ % 200) + 10}`;

async function anonContext(browser: Browser, extra: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> {
  return browser.newContext({ storageState: NO_AUTH, extraHTTPHeaders: { 'x-forwarded-for': fakeIp() }, ...extra });
}

async function adminContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: 'e2e/.auth/admin.json' });
}

async function fillSignup(page: Page, opts: { name?: string; dept?: string; email: string; password?: string }) {
  await page.locator('#signup-name').fill(opts.name ?? 'E2E Dang Ky');
  if (opts.dept) await page.locator('#signup-department').selectOption({ label: opts.dept });
  await page.locator('#signup-email').fill(opts.email);
  await page.locator('#signup-password').fill(opts.password ?? PASSWORD);
}

async function submitSignup(page: Page) {
  await page.getByRole('button', { name: vi('signup.submit') }).click();
}

test.describe.configure({ mode: 'serial' });

test.describe('28 - dang ky cho admin bat', () => {
  test('1. admin them 2 phong ban o the Phong ban', async ({ browser }) => {
    const ctx = await adminContext(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/admin');
    for (const name of [DEPT_A, DEPT_B]) {
      await page.locator('[data-department-new]').fill(name);
      await page.locator('tr', { has: page.locator('[data-department-new]') }).getByRole('button', { name: vi('department.add') }).click();
      await expect(page.locator(`[data-department-row="${name}"]`)).toBeVisible();
    }
    await ctx.close();
  });

  test('2. form cong khai: co phong ban, sai duoi email bao loi ngay duoi o, dung thi gui duoc va thay man chao mung', async ({ browser }) => {
    const ctx = await anonContext(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/dang-ky');
 await page.waitForLoadState('networkidle'); // cho hydrate truoc khi dien/bam form
    await expect(page.locator('#signup-department option', { hasText: DEPT_A })).toHaveCount(1);

    await fillSignup(page, { dept: DEPT_A, email: 'ten@gmail.com' });
    await submitSignup(page);
    await expect(page.getByText(vi('signup.emailDomainError'))).toBeVisible();
    await expect(page.locator('#signup-email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-auth="signup-done"]')).toHaveCount(0);

    await page.locator('#signup-email').fill(EMAIL_1);
    await expect(page.getByText(vi('authPage.strength4'), { exact: true })).toBeVisible();
    await submitSignup(page);
    await expect(page.getByText(vi('signup.doneTitle'))).toBeVisible();
    await ctx.close();
  });

  test('3. gui lai dung email do lan 2 -> van thay man chao mung (khong lo email da dang ky)', async ({ browser }) => {
    const ctx = await anonContext(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/dang-ky');
 await page.waitForLoadState('networkidle'); // cho hydrate truoc khi dien/bam form
    await fillSignup(page, { dept: DEPT_A, email: EMAIL_1 });
    await submitSignup(page);
    await expect(page.getByText(vi('signup.doneTitle'))).toBeVisible();
    await ctx.close();
  });

  test('4. tai khoan cho chua dang nhap duoc, chua vao duoc trang nao', async ({ browser }) => {
    const ctx = await anonContext(browser);
    const page = await ctx.newPage();
    await fillLogin(page, EMAIL_1, PASSWORD);
    await expect(page.locator('[data-auth="notice-error"]')).toContainText(vi('auth.invalidCredentials'));
    await page.goto('/vi/overview');
    await expect(page).toHaveURL(/\/vi\/login/);
    await ctx.close();
  });

  test('5. admin thay nhac o moi trang, bat tai khoan (vai tro viewer) thi dong bien mat', async ({ browser }) => {
    const ctx = await adminContext(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/overview');
    await expect(page.locator('[data-signup-reminder]')).toBeVisible();

    await page.goto('/vi/admin#dang-ky-cho');
    const row = page.locator(`[data-signup-row="${EMAIL_1}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(DEPT_A);
    await row.locator('select').selectOption('viewer');
    await row.getByRole('button', { name: vi('signup.approve') }).click();

    const msg = page.locator('[data-auth="signup-msg"]');
    await expect(msg).toBeVisible();
    const text = (await msg.innerText()).trim();
    expect([vi('signup.approvedMailed', { email: EMAIL_1 }), vi('signup.approvedNoMail', { email: EMAIL_1 })]).toContain(text);
    await expect(row).toHaveCount(0);
    await ctx.close();
  });

  test('6. nguoi dang ky dang nhap lai -> vao duoc /vi/overview', async ({ browser }) => {
    const ctx = await anonContext(browser);
    const page = await ctx.newPage();
    await fillLogin(page, EMAIL_1, PASSWORD);
    await page.waitForURL((u) => !u.pathname.includes('/login'));
    await expect(page).toHaveURL(/\/vi\/overview/);
    await ctx.close();
  });

  test('7. tu choi: dong bien mat, dang ky lai cung email thi dong moi xuat hien (Q5 = a)', async ({ browser }) => {
    const anon = await anonContext(browser);
    const p1 = await anon.newPage();
    await p1.goto('/vi/dang-ky');
 await p1.waitForLoadState('networkidle'); // cho hydrate truoc khi dien/bam form
    await fillSignup(p1, { dept: DEPT_A, email: EMAIL_2 });
    await submitSignup(p1);
    await expect(p1.getByText(vi('signup.doneTitle'))).toBeVisible();

    const ctx = await adminContext(browser);
    const admin = await ctx.newPage();
    await admin.goto('/vi/admin#dang-ky-cho');
    const row = admin.locator(`[data-signup-row="${EMAIL_2}"]`);
    await expect(row).toBeVisible();
    admin.once('dialog', (d) => void d.accept());
    await row.getByRole('button', { name: vi('signup.reject') }).click();
    await expect(row).toHaveCount(0);

    await p1.goto('/vi/dang-ky');
 await p1.waitForLoadState('networkidle'); // cho hydrate truoc khi dien/bam form
    await fillSignup(p1, { dept: DEPT_A, email: EMAIL_2 });
    await submitSignup(p1);
    await expect(p1.getByText(vi('signup.doneTitle'))).toBeVisible();
    await admin.reload();
    await expect(admin.locator(`[data-signup-row="${EMAIL_2}"]`)).toBeVisible();
    await anon.close();
    await ctx.close();
  });

  test('8. phong ban da co nguoi dung: khong co nut Xoa; An thi form dang ky khong con ten do', async ({ browser }) => {
    const ctx = await adminContext(browser);
    const admin = await ctx.newPage();
    await admin.goto('/vi/admin');
    const rowA = admin.locator(`[data-department-row="${DEPT_A}"]`);
    await expect(rowA).toBeVisible();
    await expect(rowA.getByRole('button', { name: vi('department.delete') })).toHaveCount(0);
    await rowA.getByRole('button', { name: vi('department.hide') }).click();
    await expect(rowA).toContainText(vi('department.hidden'));

    const anon = await anonContext(browser);
    const page = await anon.newPage();
    await page.goto('/vi/dang-ky');
 await page.waitForLoadState('networkidle'); // cho hydrate truoc khi dien/bam form
    const options = await page.locator('#signup-department option').allInnerTexts().catch(() => [] as string[]);
    expect(options).not.toContain(DEPT_A);
    await anon.close();

    // Phong ban B chua ai dung: co nut Xoa, xoa duoc (dong thoi don dep du lieu test).
    const rowB = admin.locator(`[data-department-row="${DEPT_B}"]`);
    admin.once('dialog', (d) => void d.accept());
    await rowB.getByRole('button', { name: vi('department.delete') }).click();
    await expect(rowB).toHaveCount(0);
    await ctx.close();
  });

  test('9. /vi/dieu-khoan va /en/dieu-khoan mo duoc khi chua dang nhap; link tren form dang ky dan toi do', async ({ browser }) => {
    const ctx = await anonContext(browser);
    const page = await ctx.newPage();
    for (const loc of ['vi', 'en'] as const) {
      await page.goto(`/${loc}/dieu-khoan`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(loc === 'vi' ? vi('terms.title') : en('terms.title'));
      await expect(page.getByText('[LIÊN HỆ]')).toBeVisible();
    }
    await page.goto('/vi/dang-ky');
 await page.waitForLoadState('networkidle'); // cho hydrate truoc khi dien/bam form
    await page.getByRole('link', { name: vi('terms.title') }).click();
    await expect(page).toHaveURL(/\/vi\/dieu-khoan$/);
    await ctx.close();
  });

  test('10. soi pixel: dang ky va man thanh cong 1440x960 / 390x844, sang/toi; dieu khoan; khong cuon ngang', async ({ browser }) => {
    // Mock-up DangKy.dc.html ve form CO o Phong ban: hien lai phong ban A (da an o buoc 8) de soi dung trang thai do,
    // chup xong an lai de buoc 11 kiem duoc danh muc trong.
    const setDeptA = async (action: 'department.show' | 'department.hide') => {
      const actx = await adminContext(browser);
      const admin = await actx.newPage();
      await admin.goto('/vi/admin');
      const row = admin.locator(`[data-department-row="${DEPT_A}"]`);
      await row.getByRole('button', { name: vi(action), exact: true }).click();
      await expect(row).toContainText(vi(action === 'department.show' ? 'department.active' : 'department.hidden'));
      await actx.close();
    };
    await setDeptA('department.show');
    const combos = [
      { w: 1440, h: 960, scheme: 'light' as const },
      { w: 1440, h: 960, scheme: 'dark' as const },
      { w: 390, h: 844, scheme: 'light' as const },
      { w: 390, h: 844, scheme: 'dark' as const },
    ];
    for (const c of combos) {
      const tag = `${c.w}-${c.scheme === 'light' ? 'sang' : 'toi'}`;
      const ctx = await anonContext(browser, { viewport: { width: c.w, height: c.h }, colorScheme: c.scheme, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto('/vi/dang-ky');
 await page.waitForLoadState('networkidle'); // cho hydrate truoc khi dien/bam form
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('#signup-department option', { hasText: DEPT_A })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `cuon ngang dang-ky ${tag}`).toBeLessThanOrEqual(0);
      if (c.w === 1440 && c.scheme === 'light') {
        const showcase = await page.locator('[data-auth="showcase"]').boundingBox();
        expect(Math.abs((showcase?.width ?? 0) - 696)).toBeLessThanOrEqual(1);
      }
      await page.screenshot({ path: `${SHOTS}/dang-ky-form-${tag}.png`, fullPage: true });

      await fillSignup(page, { email: email(`px-${tag}`), name: 'E2E Pixel' });
      // Neu form co o phong ban (danh muc khong trong) thi chon phong ban dau tien co san.
      const select = page.locator('#signup-department');
      if ((await select.count()) > 0) {
        const values = await select.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
        if (values.length > 0) await select.selectOption(values[0]);
      }
      await submitSignup(page);
      await expect(page.getByText(vi('signup.doneTitle'))).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/dang-ky-thanh-cong-${tag}.png`, fullPage: true });

      await page.goto('/vi/dieu-khoan');
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `cuon ngang dieu-khoan ${tag}`).toBeLessThanOrEqual(0);
      if (c.w === 1440 || c.w === 390) await page.screenshot({ path: `${SHOTS}/dieu-khoan-${tag}.png`, fullPage: true });
      await ctx.close();
    }

    // Trang Quan tri co 2 the moi, khong lech (chup de soi tay).
    for (const c of combos) {
      const tag = `${c.w}-${c.scheme === 'light' ? 'sang' : 'toi'}`;
      const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json', viewport: { width: c.w, height: c.h }, colorScheme: c.scheme, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto('/vi/admin');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#dang-ky-cho')).toBeVisible();
      // O loc Lich su hoat dong khong duoc tran khoi the khi co email dai (email dang ky test rat dai).
      // O nam trong vung cuon ngang (bang rong o man 390 cuon trong .scroll) khong tinh la tran.
      const tran = await page.evaluate(() =>
        Array.from(document.querySelectorAll('main select, main input'))
          .filter((el) => {
            const card = el.closest('.card');
            if (!card || el.getBoundingClientRect().right <= card.getBoundingClientRect().right + 0.5) return false;
            for (let p = el.parentElement; p && p !== card; p = p.parentElement) {
              if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return false;
            }
            return true;
          })
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      expect(tran, `o nhap tran khoi the quan-tri ${tag}`).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/quan-tri-dang-ky-${tag}.png`, fullPage: true });
      await ctx.close();
    }
    await setDeptA('department.hide');
  });

  test('11. danh muc phong ban trong -> form khong hoi phong ban (bo qua neu DB con phong ban khac dang dung)', async ({ browser }) => {
    const ctx = await anonContext(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/dang-ky');
 await page.waitForLoadState('networkidle'); // cho hydrate truoc khi dien/bam form
    await page.evaluate(() => document.fonts.ready);
    const remaining = await page.locator('#signup-department').count();
    test.skip(remaining > 0, 'DB con phong ban dang dung khac ngoai phong ban cua test nay');
    await expect(page.locator('#signup-name')).toBeVisible();
    await ctx.close();
  });

  test('don dep: tu choi dang ky con cho, xoa tai khoan va phong ban test cua spec nay', async ({ browser }) => {
    const ctx = await adminContext(browser);
    const admin = await ctx.newPage();
    await admin.goto('/vi/admin#dang-ky-cho');
    const rows = admin.locator(`[data-signup-row^="${EMAIL_PREFIX}"]`);
    for (let guard = 0; guard < 20 && (await rows.count()) > 0; guard++) {
      admin.once('dialog', (d) => void d.accept());
      const before = await rows.count();
      await rows.first().getByRole('button', { name: vi('signup.reject') }).click();
      await expect(rows).toHaveCount(before - 1);
    }
    await expect(rows).toHaveCount(0);

    // Xoa tai khoan da bat cua spec (ca lan chay truoc) de phong ban test het nguoi dung, roi xoa phong ban test.
    const users = admin.locator('tr', { has: admin.locator(`td.mono:text-matches("^${EMAIL_PREFIX}")`) });
    for (let guard = 0; guard < 20 && (await users.count()) > 0; guard++) {
      const before = await users.count();
      await users.first().getByRole('button', { name: vi('common.delete'), exact: true }).click();
      await expect(users).toHaveCount(before - 1);
    }
    await expect(users).toHaveCount(0);

    await admin.reload();
    const depts = admin.locator('[data-department-row^="E2E PB"]');
    for (let guard = 0; guard < 20 && (await depts.count()) > 0; guard++) {
      admin.once('dialog', (d) => void d.accept());
      const before = await depts.count();
      await depts.first().getByRole('button', { name: vi('department.delete'), exact: true }).click();
      await expect(depts).toHaveCount(before - 1);
    }
    await expect(depts).toHaveCount(0);
    await ctx.close();
  });
});

