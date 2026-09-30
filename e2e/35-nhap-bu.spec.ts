import { test, expect, type Browser } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { addDaysIso, todayIso } from '../src/lib/clock';
import { formatDmy } from '../src/lib/date-input';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';
import { vi } from './helpers/i18n';

/**
 * P4 (F5): nhap bu lich su tren giao dien that (DB e2e da seed, du an 1 co PIC `pm`).
 * Luong: admin bat khoang -> PIC chon ngay cu (30 ngay truoc) va luu duoc, co nhan "nhap bu" trong audit_log + activity_log
 * -> admin tat -> ngay do bi khoa lai. PIC va viewer khong thay the "Nhap bu lich su" o Ho so du an.
 * Thang chua ngay cu co the da khoa so trong seed (Q10: nhap bu khong vuot khoa so), nen spec mo khoa tam thoi
 * dung thang do roi tra lai nguyen thoi diem khoa khi xong (globalSetup seed lai o lan chay sau).
 */
Object.assign(process.env, loadE2eEnv());
const prisma = new PrismaClient({ datasourceUrl: resolveE2eTarget(process.env).databaseUrl });

const PROJECT_ID = 1;
const today = todayIso();
const OLD_DAY = addDaysIso(today, -30);
const FROM = addDaysIso(today, -35);
const TO = addDaysIso(today, -25);
const OLD_MONTH = OLD_DAY.slice(0, 7);
const NOTE = 'e2e-p4 nhap bu lich su';

let lockedBackup: { projectId: number; version: number; snapshotLockedAt: Date }[] = [];

async function pmPage(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL, storageState: 'e2e/.auth/pm.json' });
  return { context, page: await context.newPage() };
}

test.describe.configure({ mode: 'serial' });

test.describe('35 - Nhap bu lich su', () => {
  test.beforeAll(async () => {
    const ids = (await prisma.projectBackfillWindow.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((r) => String(r.id));
    if (ids.length) await prisma.auditLog.deleteMany({ where: { tableName: 'project_backfill_window', recordId: { in: ids } } });
    await prisma.projectBackfillWindow.deleteMany({ where: { projectId: PROJECT_ID } });
    await prisma.auditLog.deleteMany({ where: { field: 'backfill', recordId: `${PROJECT_ID}/${OLD_DAY}` } });
    const locked = await prisma.factProgressMonthly.findMany({
      where: { yearMonth: OLD_MONTH, snapshotLockedAt: { not: null } },
      select: { projectId: true, version: true, snapshotLockedAt: true },
    });
    lockedBackup = locked.map((r) => ({ projectId: r.projectId, version: r.version, snapshotLockedAt: r.snapshotLockedAt! }));
    await prisma.factProgressMonthly.updateMany({ where: { yearMonth: OLD_MONTH }, data: { snapshotLockedAt: null } });
    await prisma.factDailyManpower.deleteMany({ where: { projectId: PROJECT_ID, workDate: new Date(`${OLD_DAY}T00:00:00Z`) } });
  });

  test.afterAll(async () => {
    await prisma.factDailyManpower.deleteMany({ where: { projectId: PROJECT_ID, workDate: new Date(`${OLD_DAY}T00:00:00Z`) } });
    for (const r of lockedBackup) {
      await prisma.factProgressMonthly.updateMany({
        where: { projectId: r.projectId, yearMonth: OLD_MONTH, version: r.version },
        data: { snapshotLockedAt: r.snapshotLockedAt },
      });
    }
    await prisma.$disconnect();
  });

  test('admin bat nhap bu o Ho so du an: khoang hien trong danh sach dang bat', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
    const panel = page.getByTestId('backfill-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('backfill-none')).toBeVisible();

    const from = page.getByTestId('backfill-from');
    const to = page.getByTestId('backfill-to');
    await expect(from).toHaveAttribute('data-ready', 'true');
    await from.fill(formatDmy(FROM));
    await from.press('Enter');
    await to.fill(formatDmy(TO));
    await to.press('Enter');
    await page.getByTestId('backfill-note').fill(NOTE);
    await page.getByTestId('backfill-enable').click();

    const active = page.getByTestId('backfill-active');
    await expect(active).toContainText(vi('backfill.active', { from: formatDmy(FROM), to: formatDmy(TO) }));
    await expect(active).toContainText(NOTE);
    await context.close();
  });

  test('PIC thay nhan "Dang nhap bu", chon ngay cu 30 ngay truoc, luu duoc, audit_log + activity_log co nhan nhap bu', async ({ browser, baseURL }) => {
    const { context, page } = await pmPage(browser, baseURL);
    await page.goto(`/vi/nhap-lieu?project=${PROJECT_ID}&step=resources`);
    await expect(page.getByTestId('backfill-badge').first()).toContainText(vi('backfill.active', { from: formatDmy(FROM), to: formatDmy(TO) }));

    const dateField = page.getByTestId('entry-date');
    await expect(dateField).toHaveAttribute('data-ready', 'true');
    await dateField.fill(formatDmy(OLD_DAY));
    await dateField.press('Enter');
    await expect(page).toHaveURL(new RegExp(`date=${OLD_DAY}`));
    await expect(page.getByTestId('entry-date')).toHaveValue(formatDmy(OLD_DAY));
    await expect(page.getByText(vi('dailyEntry.outOfWindow'))).toHaveCount(0);

    const firstInput = page.locator('table.tbl input[type="number"]').first();
    await expect(firstInput).toBeEnabled();
    await firstInput.fill('7');
    const saveStaticPrefix = vi('dailyEntry.save').split('{')[0].trim();
    await page.getByRole('button', { name: saveStaticPrefix, exact: false }).click();
    const savedStaticPrefix = vi('dailyEntry.saved').split('{')[0].trim();
    await expect(page.getByText(savedStaticPrefix, { exact: false })).toBeVisible();

    const audit = await prisma.auditLog.findFirst({ where: { field: 'backfill', recordId: `${PROJECT_ID}/${OLD_DAY}` } });
    expect(audit).toMatchObject({ tableName: 'fact_daily_resources', newValue: 'nhap bu', changedBy: process.env.E2E_PM_EMAIL });
    const activity = await prisma.activityLog.findFirst({
      where: { action: 'save_daily_resources_backfill', userEmail: process.env.E2E_PM_EMAIL },
      orderBy: { id: 'desc' },
    });
    expect(activity?.detail).toContain(OLD_DAY);
    await context.close();
  });

  test('PIC (data-entry) va viewer khong thay the "Nhap bu lich su"', async ({ browser, baseURL }) => {
    const { context, page } = await pmPage(browser, baseURL);
    await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
    await expect(page.getByTestId('backfill-panel')).toHaveCount(0);
    await context.close();

    const viewerContext = await browser.newContext({ baseURL, storageState: 'e2e/.auth/viewer.json' });
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
    await expect(viewerPage.getByTestId('backfill-panel')).toHaveCount(0);
    await expect(viewerPage.getByText(vi('backfill.title'))).toHaveCount(0);
    await viewerContext.close();
  });

  test('admin tat khoang: ngay cu bi khoa lai (o ngay bao ngoai khoang, khong con nhan Dang nhap bu)', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
    await page.getByTestId('backfill-disable').click();
    await expect(page.getByTestId('backfill-none')).toBeVisible();
    await context.close();

    const { context: pmContext, page: pmPageObj } = await pmPage(browser, baseURL);
    await pmPageObj.goto(`/vi/nhap-lieu?project=${PROJECT_ID}&step=resources&date=${OLD_DAY}`);
    await expect(pmPageObj.getByTestId('backfill-badge')).toHaveCount(0);
    const dateField = pmPageObj.getByTestId('entry-date');
    await expect(dateField).toHaveAttribute('data-ready', 'true');
    // Trang roi ve hom nay vi ngay cu khong con hop le.
    await expect(dateField).toHaveValue(formatDmy(today));
    await dateField.fill(formatDmy(OLD_DAY));
    await dateField.press('Enter');
    await expect(pmPageObj.getByTestId('entry-date-error')).toBeVisible();
    await pmContext.close();
  });

  test('o ngay cho phep xoa trong (allowEmpty): khong bao loi khi xoa, bat nhap bu thieu ngay bi chan o giao dien', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
    const from = page.getByTestId('backfill-from');
    await expect(from).toHaveAttribute('data-ready', 'true');
    await from.fill(formatDmy(FROM));
    await from.press('Enter');
    await expect(from).toHaveValue(formatDmy(FROM));
    await from.fill('');
    await from.press('Enter');
    await expect(from).toHaveValue('');
    await expect(page.getByTestId('backfill-from-error')).toHaveCount(0);

    await page.getByTestId('backfill-note').fill(NOTE);
    await page.getByTestId('backfill-enable').click();
    await expect(page.getByTestId('backfill-error')).toHaveText(vi('backfill.errInvalid'));
    await expect(page.getByTestId('backfill-none')).toBeVisible();

    // Ngay ket thuc o tuong lai bi chan ngay o o ngay (max = hom nay).
    const to = page.getByTestId('backfill-to');
    await to.fill(formatDmy(addDaysIso(today, 1)));
    await to.press('Enter');
    await expect(page.getByTestId('backfill-to-error')).toBeVisible();
    await context.close();
  });
});
