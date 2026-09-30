import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { addDaysIso, todayIso } from '../src/lib/clock';
import { waitChartsDrawn } from './helpers/chart-ready';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';
import { en, vi } from './helpers/i18n';

/**
 * P4 vong sua sau reviewer/security - tester soi pixel cac cho vong nay cham toi, 1440 va 390, sang va toi.
 * Anh luu o `.bangiao/anh-p4-sua/` (chua commit). Moi ca kiem tu dong: khong cuon ngang, khong pageerror,
 * dau "?" moi (C-4) can giua theo chieu doc voi chip/badge canh no, bong bong nam trong khung nhin, the nhat ky (S-3) khong tran.
 * Du lieu nhap bu cua du an 3 (audit `3/<id>`) tao bang Prisma, don sach o afterAll.
 */
Object.assign(process.env, loadE2eEnv());
const prisma = new PrismaClient({ datasourceUrl: resolveE2eTarget(process.env).databaseUrl });
const OUT = '.bangiao/anh-p4-sua';
mkdirSync(OUT, { recursive: true });

const today = todayIso();
const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;
const THEMES = ['light', 'dark'] as const;
const PROJECT_ID = 3;
const NOTE = 'e2e-anh-sua nhat ky nhap bu';
let windowId = 0;

async function open(browser: Browser, baseURL: string | undefined, role: 'admin' | 'pm', vp: (typeof VIEWPORTS)[number], theme: 'light' | 'dark', locale = 'vi-VN') {
  const context = await browser.newContext({
    baseURL,
    storageState: `e2e/.auth/${role}.json`,
    viewport: { width: vp.width, height: vp.height },
    colorScheme: theme,
    locale,
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

/** Tam theo chieu doc cua 2 phan tu lech nhau khong qua `tol` px. */
async function expectVerticallyAligned(a: Locator, b: Locator, tol: number, what: string) {
  const [ba, bb] = [await a.boundingBox(), await b.boundingBox()];
  expect(ba && bb, `${what}: thieu bounding box`).toBeTruthy();
  const diff = Math.abs(ba!.y + ba!.height / 2 - (bb!.y + bb!.height / 2));
  expect(diff, `${what}: lech tam doc ${diff.toFixed(1)}px`).toBeLessThanOrEqual(tol);
}

/** Bong bong `.help .bub` co animation (scale) khi mo: cho toa do on dinh (2 lan do cach 120ms giong nhau) roi moi kiem. */
async function settledBox(loc: Locator) {
  let prev = await loc.boundingBox();
  for (let i = 0; i < 20; i++) {
    await loc.page().waitForTimeout(120);
    const cur = await loc.boundingBox();
    if (prev && cur && Math.abs(prev.x - cur.x) < 0.5 && Math.abs(prev.width - cur.width) < 0.5 && Math.abs(prev.y - cur.y) < 0.5) return cur;
    prev = cur;
  }
  return prev;
}

test.describe.configure({ mode: 'default' });

test.describe('39 - soi pixel vong sua (anh o .bangiao/anh-p4-sua)', () => {
  test.beforeAll(async () => {
    await prisma.projectBackfillWindow.deleteMany({ where: { projectId: PROJECT_ID, note: NOTE } });
    const w = await prisma.projectBackfillWindow.create({
      data: {
        projectId: PROJECT_ID,
        fromDate: new Date(`${addDaysIso(today, -65)}T00:00:00Z`),
        toDate: new Date(`${addDaysIso(today, -60)}T00:00:00Z`),
        note: NOTE,
        enabledBy: process.env.E2E_ADMIN_EMAIL ?? 'admin@daidung.com.vn',
        expiresAt: new Date(Date.now() + 29 * 86_400_000),
      },
    });
    windowId = w.id;
    await prisma.auditLog.create({
      data: {
        tableName: 'project_backfill_window', recordId: `${PROJECT_ID}/${w.id}`, field: 'enable', oldValue: '',
        newValue: `${addDaysIso(today, -65)}..${addDaysIso(today, -60)}`, changedBy: process.env.E2E_ADMIN_EMAIL ?? 'admin@daidung.com.vn', note: NOTE,
      },
    });
  });
  test.afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tableName: 'project_backfill_window', recordId: `${PROJECT_ID}/${windowId}` } });
    await prisma.projectBackfillWindow.deleteMany({ where: { projectId: PROJECT_ID, note: NOTE } });
    await prisma.$disconnect();
  });

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const tag = `${vp.name}-${theme}`;

      test(`Chi tiet: 3 dau "?" moi (Khau nghen, 2 the huy dong) ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'admin', vp, theme);
        await page.goto('/vi/projects/2');
        await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
        await waitChartsDrawn(page);
        await checkPage(page, errors);
        await page.screenshot({ path: `${OUT}/chi-tiet-${tag}.png`, fullPage: true });

        const badge = page.getByText(new RegExp(`^${vi('detail.bottleneck')}:`)).first();
        await badge.scrollIntoViewIfNeeded();
        const help = badge.locator('xpath=following-sibling::*[contains(@class,"help")][1]');
        await expectVerticallyAligned(help, badge, 4, 'dau ? va badge Khau nghen');
        await help.click();
        await expect(help.locator('.bub')).toBeVisible();
        const bb = await settledBox(help.locator('.bub'));
        expect(bb!.x).toBeGreaterThanOrEqual(0);
        expect(bb!.x + bb!.width).toBeLessThanOrEqual(vp.width + 1);
        await page.screenshot({ path: `${OUT}/khau-nghen-bubble-${tag}.png` });
        await page.keyboard.press('Escape');

        for (const id of ['res-manpower', 'res-equipment']) {
          const card = page.locator(`#${id}`);
          await card.scrollIntoViewIfNeeded();
          const h = card.locator('h3 .help');
          await expectVerticallyAligned(h, card.locator('h3 .chip'), 4, `dau ? va chip Nhap tay (${id})`);
          await h.click();
          await expect(h.locator('.bub')).toBeVisible();
          const b = await settledBox(h.locator('.bub'));
          expect(b!.x).toBeGreaterThanOrEqual(0);
          expect(b!.x + b!.width).toBeLessThanOrEqual(vp.width + 1);
          await page.screenshot({ path: `${OUT}/${id}-bubble-${tag}.png` });
          await page.keyboard.press('Escape');
        }
        await context.close();
      });

      test(`Ho so du an ${PROJECT_ID}: the nhat ky co dong Nhap bu lich su, khong tran khung ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'admin', vp, theme);
        await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
        const card = page.locator('.card', { has: page.getByRole('heading', { name: vi('projectForm.audit.title') }) });
        await expect(card.locator('tbody tr', { hasText: vi('projectForm.audit.tbl.project_backfill_window') })).toHaveCount(1);
        await card.scrollIntoViewIfNeeded();
        await checkPage(page, errors);
        const box = await card.boundingBox();
        expect(box!.x + box!.width, 'the nhat ky tran khung nhin').toBeLessThanOrEqual(vp.width + 1);
        await card.screenshot({ path: `${OUT}/nhat-ky-vi-${tag}.png` });
        await page.screenshot({ path: `${OUT}/ho-so-${tag}.png`, fullPage: true });
        await context.close();
      });

      test(`Nhat ky nhap bu tieng Anh ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'admin', vp, theme, 'en-US');
        await page.goto(`/en/ho-so-du-an?project=${PROJECT_ID}`);
        const card = page.locator('.card', { has: page.getByRole('heading', { name: en('projectForm.audit.title') }) });
        await expect(card.locator('tbody tr', { hasText: en('projectForm.audit.tbl.project_backfill_window') })).toHaveCount(1);
        await card.scrollIntoViewIfNeeded();
        await checkPage(page, errors);
        await card.screenshot({ path: `${OUT}/nhat-ky-en-${tag}.png` });
        await context.close();
      });

      test(`Nhap lieu cua PIC: o chon thang chi co 2 thang ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'pm', vp, theme);
        await page.goto('/vi/nhap-lieu?project=1');
        const select = page.locator('select', { has: page.locator(`option[value="${today.slice(0, 7)}"]`) });
        await expect(select).toBeVisible();
        expect(await select.locator('option').count()).toBe(2);
        await checkPage(page, errors);
        await page.screenshot({ path: `${OUT}/nhap-lieu-${tag}.png`, fullPage: true });
        await context.close();
      });

      test(`Tong quan ky giua thang + chart cong suat dung i18n (vi va en) ${tag}`, async ({ browser, baseURL }) => {
        const { context, page, errors } = await open(browser, baseURL, 'admin', vp, theme);
        await page.goto('/vi/overview?from=2026-03-01&to=2026-03-27');
        await expect(page.getByTestId('period-summary')).toBeVisible();
        await waitChartsDrawn(page);
        await checkPage(page, errors);
        await expect(page.locator('main')).toContainText(vi('chartHowTo.capacityLegend'));
        await page.screenshot({ path: `${OUT}/tong-quan-${tag}.png`, fullPage: true });
        await page.goto('/en/overview?from=2026-03-01&to=2026-03-27');
        await expect(page.getByTestId('period-summary')).toBeVisible();
        await waitChartsDrawn(page);
        await expect(page.locator('main')).toContainText(en('chartHowTo.capacityLegend'));
        await expect(page.locator('main')).not.toContainText(vi('chartHowTo.capacityLegend'));
        await context.close();
      });
    }
  }
});
