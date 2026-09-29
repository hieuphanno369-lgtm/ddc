import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';
import { vi } from './helpers/i18n';

/**
 * P3F (tester) - truong hop bien cua Dang ky, bo sung cho e2e 28: phong ban bi an giua luc dien form, mat khau khong lot
 * vao URL / kho luu tru / duong dan yeu cau, gioi han 3 lan/gio/email hien tren giao dien, email viet hoa duoc chuan hoa,
 * tien to ten mien con bi tu choi tai form. Chay TUAN TU. Moi ngu canh chua dang nhap co x-forwarded-for gia rieng.
 * Don dep cuoi spec: tu choi dang ky con cho `e2e-dangky-` va xoa phong ban `E2E PB29`.
 */
const { databaseUrl } = resolveE2eTarget(loadE2eEnv());
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const CHANNEL_NAME = 'E2E dang ky bien smtp';
const TS = Date.now();
const NO_AUTH = { cookies: [], origins: [] };
const PREFIX = 'e2e-dangky-';
const DEPT = `E2E PB29 ${TS}`;
const SECRET = `Mk-BiMat-${TS}-z!`;
const email = (tag: string) => `${PREFIX}29${tag}-${TS}@daidung.vn`;

let ipCounter = 0;
const fakeIp = () => `198.52.${(TS % 200) + 20}.${(ipCounter++ % 200) + 10}`;

const anon = (browser: Browser): Promise<BrowserContext> =>
  browser.newContext({ storageState: NO_AUTH, extraHTTPHeaders: { 'x-forwarded-for': fakeIp() } });
const adminCtx = (browser: Browser): Promise<BrowserContext> => browser.newContext({ storageState: 'e2e/.auth/admin.json' });

async function fill(page: Page, o: { dept?: string; email: string; name?: string }) {
  await page.locator('#signup-name').fill(o.name ?? 'E2E Bien');
  if (o.dept) await page.locator('#signup-department').selectOption({ label: o.dept });
  await page.locator('#signup-email').fill(o.email);
}
const submit = (page: Page) => page.getByRole('button', { name: vi('signup.submit') }).click();

test.describe.configure({ mode: 'serial' });

test.describe('29 - dang ky: truong hop bien', () => {
  test.beforeAll(async () => {
    await prisma.notifyChannel.deleteMany({ where: { name: CHANNEL_NAME } });
    await prisma.notifyChannel.create({
      data: { kind: 'email', name: CHANNEL_NAME, isEnabled: false, settings: { smtpHost: 'smtp.invalid', fromAddress: 'noreply@daidung.vn' } },
    });
  });
  test.afterAll(async () => {
    await prisma.notifyChannel.deleteMany({ where: { name: CHANNEL_NAME } });
    await prisma.$disconnect();
  });

  test('1. admin them phong ban', async ({ browser }) => {
    const ctx = await adminCtx(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/admin');
    await page.locator('[data-department-new]').fill(DEPT);
    await page.locator('tr', { has: page.locator('[data-department-new]') }).getByRole('button', { name: vi('department.add') }).click();
    await expect(page.locator(`[data-department-row="${DEPT}"]`)).toBeVisible();
    await ctx.close();
  });

  test('2. phong ban bi an giua luc dien form -> bao danh sach da doi, khong dang ky, o Phong ban het ten do', async ({ browser }) => {
    const ctx = await anon(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/dang-ky');
    await page.waitForLoadState('networkidle'); // cho hydrate, tranh bam submit truoc khi form co handler
    await fill(page, { dept: DEPT, email: email('pb') });

    const admin = await adminCtx(browser);
    const ap = await admin.newPage();
    await ap.goto('/vi/admin');
    await ap.locator(`[data-department-row="${DEPT}"]`).getByRole('button', { name: vi('department.hide'), exact: true }).click();
    await expect(ap.locator(`[data-department-row="${DEPT}"]`)).toContainText(vi('department.hidden'));

    await submit(page);
    await expect(page.getByText(vi('signup.departmentChanged'))).toBeVisible();
    await expect(page.locator('[data-auth="signup-done"]')).toHaveCount(0);
    await expect(page.locator('#signup-department option', { hasText: DEPT })).toHaveCount(0);

    // Khoi phuc phong ban: idempotent (chi bam khi con o trang thai an), vi luc suite chay day tai mot cu bam co the roi
    // dung luc bang tai lai sau router.refresh().
    const deptRow = ap.locator(`[data-department-row="${DEPT}"]`);
    await expect(async () => {
      if ((await deptRow.textContent())?.includes(vi('department.hidden'))) {
        await deptRow.getByRole('button', { name: vi('department.show'), exact: true }).click({ timeout: 3000 });
      }
      await expect(deptRow).toContainText(vi('department.active'), { timeout: 4000 });
    }).toPass({ timeout: 25_000 });
    await admin.close();
    await ctx.close();
  });

  test('3. form khong co o mat khau, yeu cau gui di khong mang truong mat khau, khong luu gi vao kho trinh duyet (S1)', async ({ browser }) => {
    const ctx = await anon(browser);
    const page = await ctx.newPage();
    const posted: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST') posted.push(r.postData() ?? '');
    });
    await page.goto('/vi/dang-ky');
    await page.waitForLoadState('networkidle'); // cho hydrate, tranh bam submit truoc khi form co handler
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('#signup-password')).toHaveCount(0);
    await fill(page, { dept: DEPT, email: email('mk') });
    await submit(page);
    await expect(page.getByText(vi('signup.doneTitle'))).toBeVisible();

    expect(posted.filter((b) => /password|matkhau/i.test(b))).toEqual([]);
    const stores = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
    expect(stores).toBe('[{},{}]');
    await ctx.close();
  });

  test('4. mat khau khong lot vao URL khi dang nhap sai', async ({ browser }) => {
    const ctx = await anon(browser);
    const page = await ctx.newPage();
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto('/vi/login');
    await page.waitForLoadState('networkidle'); // cho hydrate, tranh bam submit truoc khi form co handler
    await page.locator('#auth-email').fill(email('mk'));
    await page.locator('#auth-password').fill(SECRET);
    await page.getByRole('button', { name: vi('auth.signIn') }).click();
    await expect(page.locator('[data-auth="notice-error"]')).toContainText(vi('auth.invalidCredentials'));
    expect(page.url()).not.toContain(SECRET);
    expect(urls.filter((u) => u.includes(SECRET) || u.includes(encodeURIComponent(SECRET)))).toEqual([]);
    await ctx.close();
  });

  test('5. email viet hoa duoc nhan va admin thay dang chuan hoa chu thuong', async ({ browser }) => {
    const ctx = await anon(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/dang-ky');
    await page.waitForLoadState('networkidle'); // cho hydrate, tranh bam submit truoc khi form co handler
    await fill(page, { dept: DEPT, email: email('hoa').toUpperCase() });
    await submit(page);
    await expect(page.getByText(vi('signup.doneTitle'))).toBeVisible();
    await ctx.close();

    const admin = await adminCtx(browser);
    const ap = await admin.newPage();
    await ap.goto('/vi/admin#dang-ky-cho');
    await expect(ap.locator(`[data-signup-row="${email('hoa')}"]`)).toBeVisible();
    await admin.close();
  });

  test('6. ten mien con, duoi keo dai va nhieu @ bi bao loi tai form, khong gui', async ({ browser }) => {
    const ctx = await anon(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/dang-ky');
    await page.waitForLoadState('networkidle'); // cho hydrate, tranh bam submit truoc khi form co handler
    for (const bad of ['ten@mail.daidung.vn', 'ten@daidung.vn.evil.com', 'ten@daidung.vn@daidung.vn']) {
      await fill(page, { dept: DEPT, email: bad });
      await submit(page);
      await expect(page.getByText(vi('signup.emailDomainError')).first()).toBeVisible();
      await expect(page.locator('[data-auth="signup-done"]')).toHaveCount(0);
    }
    await ctx.close();
  });

  test('6b. ho ten co ky tu an (zero-width, RTL) bi bao loi ten tai form, khong gui (S2)', async ({ browser }) => {
    const ctx = await anon(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/dang-ky');
    await page.waitForLoadState('networkidle'); // cho hydrate, tranh bam submit truoc khi form co handler
    for (const name of ['E2E\u200bBien', 'E2E\u202eBien']) {
      await fill(page, { dept: DEPT, email: email('an'), name });
      await submit(page);
      await expect(page.getByText(vi('signup.nameError'))).toBeVisible();
      await expect(page.locator('[data-auth="signup-done"]')).toHaveCount(0);
    }
    await ctx.close();
  });

  test('7. gui lan thu 4 cung email trong 1 gio (IP khac nhau) -> bao gui qua nhieu lan', async ({ browser }) => {
    const target = email('rl');
    for (let i = 0; i < 3; i++) {
      const ctx = await anon(browser);
      const page = await ctx.newPage();
      await page.goto('/vi/dang-ky');
      await page.waitForLoadState('networkidle'); // cho hydrate, tranh bam submit truoc khi form co handler
      await fill(page, { dept: DEPT, email: target });
      await submit(page);
      await expect(page.getByText(vi('signup.doneTitle'))).toBeVisible();
      await ctx.close();
    }
    const ctx = await anon(browser);
    const page = await ctx.newPage();
    await page.goto('/vi/dang-ky');
    await page.waitForLoadState('networkidle'); // cho hydrate, tranh bam submit truoc khi form co handler
    await fill(page, { dept: DEPT, email: target });
    await submit(page);
    await expect(page.getByText(vi('signup.rateLimited'))).toBeVisible();
    await expect(page.locator('[data-auth="signup-done"]')).toHaveCount(0);
    await ctx.close();
  });

  test('8. trang cong khai (dang nhap, quen/dat lai mat khau, dang ky, dieu khoan; vi + en) khong goi API du lieu du an', async ({ browser }) => {
    const ctx = await anon(browser);
    const page = await ctx.newPage();
    const apis: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/api/')) apis.push(u.pathname);
    });
    for (const loc of ['vi', 'en']) {
      for (const path of ['login', 'dang-ky', 'dieu-khoan', 'login?mode=forgot', 'login?token=abc']) {
        await page.goto(`/${loc}/${path}`);
        await page.waitForLoadState('networkidle');
      }
    }
    // Chi duoc phep cac diem cua xac thuc + bao cao CSP; khong co /api/projects, /api/export, ... nao.
    const bad = apis.filter((a) => !/^\/api\/(auth\/|csp-report)/.test(a));
    expect(bad, `API la tren trang cong khai: ${bad.join(', ')}`).toEqual([]);
    await ctx.close();
  });

  test('don dep: tu choi dang ky con cho va xoa phong ban test', async ({ browser }) => {
    const ctx = await adminCtx(browser);
    const admin = await ctx.newPage();
    await admin.goto('/vi/admin#dang-ky-cho');
    const rows = admin.locator(`[data-signup-row^="${PREFIX}29"]`);
    for (let guard = 0; guard < 20 && (await rows.count()) > 0; guard++) {
      admin.once('dialog', (d) => void d.accept());
      const before = await rows.count();
      await rows.first().getByRole('button', { name: vi('signup.reject') }).click();
      await expect(rows).toHaveCount(before - 1);
    }
    await expect(rows).toHaveCount(0);
    await admin.reload();
    const depts = admin.locator('[data-department-row^="E2E PB29"]');
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
