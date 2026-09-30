import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { addDaysIso, todayIso } from '../src/lib/clock';
import { waitChartsDrawn } from './helpers/chart-ready';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';

/**
 * P4 nhom G (G2) - tester soi pixel: Tong quan, Chi tiet, Bao cao, Nhap lieu (co badge nhap bu), Ho so du an (the nhap bu cua admin)
 * o 1440px va 390px, sang va toi. Luu anh o `.bangiao/anh-p4-f/`. Moi ca kiem tu dong: khong cuon ngang, khong loi trang
 * (pageerror), khong nhay "Application error"; badge nhap bu khong roi dong; the nhap bu khong tran khung.
 * Bat khoang nhap bu cho du an 1 bang Prisma (admin `e2e`), dong sach o afterAll.
 */
Object.assign(process.env, loadE2eEnv());
const prisma = new PrismaClient({ datasourceUrl: resolveE2eTarget(process.env).databaseUrl });
const OUT = '.bangiao/anh-p4-f';
mkdirSync(OUT, { recursive: true });

const today = todayIso();
const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;
const THEMES = ['light', 'dark'] as const;
let windowId = 0;

async function open(browser: Browser, baseURL: string | undefined, role: 'admin' | 'pm', vp: (typeof VIEWPORTS)[number], theme: 'light' | 'dark') {
  const context = await browser.newContext({
    baseURL,
    storageState: `e2e/.auth/${role}.json`,
    viewport: { width: vp.width, height: vp.height },
    colorScheme: theme,
    locale: 'vi-VN',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page, errors };
}

async function checkPage(page: Page, errors: string[]) {
  await expect(page.locator('body')).not.toContainText('Application error');
  const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(over.sw, `cuon ngang: scrollWidth ${over.sw} > clientWidth ${over.cw}`).toBeLessThanOrEqual(over.cw + 1);
  expect(errors, 'pageerror').toEqual([]);
}

test.describe.configure({ mode: 'default' });

test.describe('37 - soi pixel nhom F/G (anh o .bangiao/anh-p4-f)', () => {
  test.beforeAll(async () => {
    await prisma.projectBackfillWindow.deleteMany({ where: { projectId: 1, note: { startsWith: 'e2e-anh' } } });
    const w = await prisma.projectBackfillWindow.create({
      data: {
        projectId: 1,
        fromDate: new Date(`${addDaysIso(today, -35)}T00:00:00Z`),
        toDate: new Date(`${addDaysIso(today, -25)}T00:00:00Z`),
        note: 'e2e-anh nhap bu de soi pixel: ghi chu kha dai de kiem tra xuong dong trong the o 390px',
        enabledBy: process.env.E2E_ADMIN_EMAIL ?? 'admin@daidung.com.vn',
        expiresAt: new Date(Date.now() + 29 * 86_400_000),
      },
    });
    windowId = w.id;
    // 1 khoang da het han va 1 khoang da tat de the hien "lich su"
    await prisma.projectBackfillWindow.createMany({
      data: [
        { projectId: 1, fromDate: new Date('2025-01-05T00:00:00Z'), toDate: new Date('2025-01-20T00:00:00Z'), note: 'e2e-anh da het han', enabledBy: 'admin@daidung.com.vn', expiresAt: new Date(Date.now() - 86_400_000) },
        { projectId: 1, fromDate: new Date('2025-02-05T00:00:00Z'), toDate: new Date('2025-02-20T00:00:00Z'), note: 'e2e-anh da tat', enabledBy: 'admin@daidung.com.vn', expiresAt: new Date(Date.now() + 86_400_000), disabledAt: new Date(), disabledBy: 'admin@daidung.com.vn' },
      ],
    });
  });

  test.afterAll(async () => {
    await prisma.projectBackfillWindow.deleteMany({ where: { projectId: 1, note: { startsWith: 'e2e-anh' } } });
    await prisma.$disconnect();
  });

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const tag = `${vp.name}-${theme}`;

      test(`Tong quan ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'admin', vp, theme);
        await page.goto('/vi/overview');
        await waitChartsDrawn(page);
        await page.screenshot({ path: `${OUT}/tq-${tag}.png`, fullPage: true });
        await checkPage(page, errors);
        await context.close();
      });

      test(`Chi tiet ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'admin', vp, theme);
        await page.goto('/vi/projects/1');
        await waitChartsDrawn(page);
        await page.screenshot({ path: `${OUT}/ct-${tag}.png`, fullPage: true });
        await checkPage(page, errors);
        await context.close();
      });

      test(`Bao cao ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'admin', vp, theme);
        await page.goto('/vi/report');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/bc-${tag}.png`, fullPage: true });
        await checkPage(page, errors);
        await context.close();
      });

      test(`Nhap lieu (PIC, co badge nhap bu) ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'pm', vp, theme);
        await page.goto('/vi/nhap-lieu?project=1&step=resources');
        const badge = page.getByTestId('backfill-badge').first();
        await expect(badge).toBeVisible();
        await expect(page.getByTestId('entry-date')).toHaveAttribute('data-ready', 'true');
        // Badge khong roi dong khi chu vua khung: chieu cao <= ~2 dong chu (1 dong o 1440px)
        const box = await badge.boundingBox();
        const lh = await badge.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || 18);
        expect(box!.height, `badge cao ${box!.height}px, dong ${lh}px`).toBeLessThan(lh * (vp.width >= 1000 ? 1.9 : 3.2) + 20);
        expect(box!.x + box!.width, 'badge vuot khung phai').toBeLessThanOrEqual(vp.width + 1);
        await page.screenshot({ path: `${OUT}/nl-${tag}.png`, fullPage: true });
        await badge.screenshot({ path: `${OUT}/nl-badge-${tag}.png` });
        await checkPage(page, errors);
        await context.close();
      });

      test(`Nhap lieu buoc So lieu thang (PIC, tab thang co thang nhap bu) ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'pm', vp, theme);
        await page.goto('/vi/nhap-lieu?project=1');
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${OUT}/nl-thang-${tag}.png`, fullPage: true });
        // P-3: nhan "Ap dung" 1 dong; o chon du an du rong de doc ma + ten du an (khong bi cat con ~130px o 390px)
        const label = page.locator('.stagegrid label.inline-row').first();
        const lbox = await label.boundingBox();
        const llh = await label.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || 18);
        expect(lbox!.height, `nhan Ap dung cao ${lbox!.height}px, dong ${llh}px`).toBeLessThan(llh * 1.5);
        const sbox = await page.locator('select').first().boundingBox();
        expect(sbox!.width, `o chon du an chi rong ${sbox!.width}px`).toBeGreaterThanOrEqual(Math.min(240, vp.width - 60));
        await checkPage(page, errors);
        await context.close();
      });

      test(`Ho so du an (admin, the Nhap bu lich su) ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'admin', vp, theme);
        await page.goto('/vi/ho-so-du-an?project=1');
        const panel = page.getByTestId('backfill-panel');
        await expect(panel).toBeVisible();
        await expect(page.getByTestId('backfill-from')).toHaveAttribute('data-ready', 'true');
        await expect(page.getByTestId('backfill-active')).toBeVisible();
        await panel.scrollIntoViewIfNeeded();
        await panel.screenshot({ path: `${OUT}/hs-the-${tag}.png` });
        await page.screenshot({ path: `${OUT}/hs-${tag}.png`, fullPage: true });
        const pb = await panel.boundingBox();
        expect(pb!.x + pb!.width, 'the nhap bu vuot khung').toBeLessThanOrEqual(vp.width + 1);
        // moi con cua the nam trong khung the (khong tran)
        const overflow = await panel.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return [...el.querySelectorAll<HTMLElement>('*')]
            .filter((c) => { const b = c.getBoundingClientRect(); return b.width > 0 && (b.right > r.right + 1 || b.left < r.left - 1); })
            .map((c) => `${c.tagName}.${c.className}`.slice(0, 60));
        });
        expect(overflow, 'phan tu tran khoi the nhap bu').toEqual([]);
        // P-1: tieu de the 1 dong (khong bi ep hep rot chu), cau mo ta nam duoi tieu de
        const head = await panel.evaluate((el) => {
          const h4 = el.querySelector('.h h4')!.getBoundingClientRect();
          const p = el.querySelector('.h p')!.getBoundingClientRect();
          return { h4Height: h4.height, h4Bottom: h4.bottom, pTop: p.top, lineHeight: parseFloat(getComputedStyle(el.querySelector('.h h4')!).lineHeight) || 20 };
        });
        expect(head.h4Height, 'tieu de the nhap bu rot dong').toBeLessThan(head.lineHeight * 1.5);
        expect(head.pTop, 'cau mo ta phai nam duoi tieu de').toBeGreaterThanOrEqual(head.h4Bottom - 1);
        await checkPage(page, errors);
        await context.close();
      });
    }
  }

  test('window id da tao (kiem fixture)', () => {
    expect(windowId).toBeGreaterThan(0);
  });
});
