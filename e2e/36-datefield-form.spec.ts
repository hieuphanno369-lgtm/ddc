import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';
import { vi } from './helpers/i18n';

/**
 * P4 nhom F (tester): `DateField` moi o cac form nhap ngay - Tao/Sua du an, Moc chinh, Ke hoach thiet bi.
 * Kiem: xoa trong 1 ngay roi luu ("chua co ngay", khong bao loi thua), nhap sai, 8 chu so lien, dan "1/2/2026" (T-7).
 * Ghi vao DB e2e (project 1); afterAll tra nguyen (globalSetup con seed lai o lan chay sau).
 */
Object.assign(process.env, loadE2eEnv());
const prisma = new PrismaClient({ datasourceUrl: resolveE2eTarget(process.env).databaseUrl });
const PROJECT_ID = 1;

test.use({ storageState: 'e2e/.auth/admin.json' });

type ProjectDates = {
  contractDate: Date | null; plannedStartDate: Date | null; plannedFinishDate: Date | null;
  committedHandoverDate: Date | null; actualStartDate: Date | null; actualFinishDate: Date | null;
};
let backupProject: ProjectDates;
let backupMilestones: Awaited<ReturnType<typeof prisma.projectKeyMilestone.findMany>> = [];
let backupPlans: Awaited<ReturnType<typeof prisma.projectEquipmentPlan.findMany>> = [];
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function open(page: Page) {
  await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
  await expect(page.getByLabel(vi('form.contractDate'), { exact: true }).first()).toHaveAttribute('data-ready', 'true');
}
const save = (page: Page) => page.getByRole('button', { name: vi('projectForm.btn.save') });
const dateErr = (page: Page) => page.getByRole('alert').filter({ hasText: vi('period.dateInvalid') });

test.describe('36 - DateField o cac form nhap ngay', () => {
  test.beforeAll(async () => {
    const p = await prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID } });
    backupProject = {
      contractDate: p.contractDate, plannedStartDate: p.plannedStartDate, plannedFinishDate: p.plannedFinishDate,
      committedHandoverDate: p.committedHandoverDate, actualStartDate: p.actualStartDate, actualFinishDate: p.actualFinishDate,
    };
    backupMilestones = await prisma.projectKeyMilestone.findMany({ where: { projectId: PROJECT_ID } });
    backupPlans = await prisma.projectEquipmentPlan.findMany({ where: { projectId: PROJECT_ID } });
  });

  test.afterAll(async () => {
    await prisma.project.update({ where: { id: PROJECT_ID }, data: backupProject });
    // Luu moc chinh thay ca bo dong (id doi), nen tra lai bang cach xoa roi tao lai tu ban sao.
    await prisma.projectKeyMilestone.deleteMany({ where: { projectId: PROJECT_ID } });
    if (backupMilestones.length) await prisma.projectKeyMilestone.createMany({ data: backupMilestones });
    await prisma.projectEquipmentPlan.deleteMany({ where: { projectId: PROJECT_ID } });
    if (backupPlans.length) await prisma.projectEquipmentPlan.createMany({ data: backupPlans });
    await prisma.$disconnect();
  });

  test('Sua du an: xoa trong Ngay ky HD roi Luu -> DB la "chua co ngay" (null), khong bao loi thua', async ({ page }) => {
    await open(page);
    const f = page.getByLabel(vi('form.contractDate'), { exact: true }).first();
    await expect(f).toHaveValue('20/11/2025');
    await f.fill('');
    await f.press('Enter');
    await expect(f).toHaveValue('');
    await expect(dateErr(page)).toHaveCount(0);
    await expect(f).not.toHaveAttribute('aria-invalid', 'true');
    await save(page).click();
    await expect(page.getByText(vi('projectForm.saved.updated'))).toBeVisible();
    expect((await prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID } })).contractDate).toBeNull();
  });

  test('Sua du an: xoa trong roi Luu NGAY (khong Enter, chi bam Luu) van luu duoc "chua co ngay"', async ({ page }) => {
    await prisma.project.update({ where: { id: PROJECT_ID }, data: { contractDate: new Date('2025-11-20T00:00:00Z') } });
    await open(page);
    const f = page.getByLabel(vi('form.contractDate'), { exact: true }).first();
    await f.fill('');
    await save(page).click(); // blur cua o ngay xay ra khi bam nut
    await expect(page.getByText(vi('projectForm.saved.updated'))).toBeVisible();
    expect((await prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID } })).contractDate).toBeNull();
  });

  test('Sua du an: 8 chu so lien "20112025" tu chen "/" -> 20/11/2025, Luu ghi dung 2025-11-20', async ({ page }) => {
    await open(page);
    const f = page.getByLabel(vi('form.contractDate'), { exact: true }).first();
    await f.fill('20112025');
    await expect(f).toHaveValue('20/11/2025');
    await f.press('Enter');
    await expect(dateErr(page)).toHaveCount(0);
    await save(page).click();
    await expect(page.getByText(vi('projectForm.saved.updated'))).toBeVisible();
    expect(iso((await prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID } })).contractDate)).toBe('2025-11-20');
  });

  test('Sua du an: nhap sai (31/02/2026, 99/99/9999, nam 1999) -> bao loi role=alert, gia tri cu khong bi ghi', async ({ page }) => {
    await open(page);
    const f = page.getByLabel(vi('form.contractDate'), { exact: true }).first();
    for (const bad of ['31022026', '99999999', '01011999', '01013000']) {
      await f.fill(bad);
      await f.press('Enter');
      await expect(dateErr(page)).toBeVisible();
      await expect(f).toHaveAttribute('aria-invalid', 'true');
    }
    // sua lai dung thi loi tat
    await f.fill('20112025');
    await f.press('Enter');
    await expect(dateErr(page)).toHaveCount(0);
    expect(iso((await prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID } })).contractDate)).toBe('2025-11-20');
  });

  test('Sua du an: roi o bang Tab khi con chu sai ("31/02") cung bao loi, khong nuot (trang moi, chua Enter lan nao)', async ({ page }) => {
    await open(page);
    const f = page.getByLabel(vi('form.contractDate'), { exact: true }).first();
    await f.fill('3102');
    await f.press('Tab');
    await expect(dateErr(page)).toBeVisible();
  });

  test('(BUG T-8) go ngay + Enter roi SUA tiep + bam Luu (khong Enter lan 2) -> phai luu gia tri sua sau cung', async ({ page }) => {
    await open(page);
    const f = page.getByLabel(vi('form.contractDate'), { exact: true }).first();
    await f.fill('20112025');
    await f.press('Enter');
    await f.fill('21112025');
    await save(page).click();
    await expect(page.getByText(vi('projectForm.saved.updated'))).toBeVisible();
    expect(iso((await prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID } })).contractDate)).toBe('2025-11-21');
  });

  test('(BUG T-8) go ngay sai + Enter roi go tiep ngay sai khac + Tab -> van phai bao loi', async ({ page }) => {
    await open(page);
    const f = page.getByLabel(vi('form.contractDate'), { exact: true }).first();
    await f.fill('31022026');
    await f.press('Enter');
    await expect(dateErr(page)).toBeVisible();
    await f.fill('3102');
    await f.press('Tab');
    await expect(dateErr(page)).toBeVisible();
  });

  test('Sua du an: nhap sai roi bam Luu -> khong ghi ngay sai (DB giu nguyen)', async ({ page }) => {
    await open(page);
    const f = page.getByLabel(vi('form.plannedStart'), { exact: true }).first();
    const before = iso((await prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID } })).plannedStartDate);
    await f.fill('31022026');
    await save(page).click();
    await page.waitForTimeout(800);
    expect(iso((await prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID } })).plannedStartDate)).toBe(before);
  });

  test('(BUG T-7) dan "1/2/2026" (khong dem 0) -> phai thanh 01/02/2026, khong bao loi', async ({ page }) => {
    await open(page);
    const f = page.getByLabel(vi('form.contractDate'), { exact: true }).first();
    await f.fill('1/2/2026');
    await f.press('Enter');
    await expect(dateErr(page)).toHaveCount(0);
    await expect(f).toHaveValue('01/02/2026');
  });

  test('Tao du an (mode=new): 6 o ngay + ngay ky HD gia tri mac dinh, nhap 8 chu so roi xoa trong khong bao loi thua', async ({ page }) => {
    await page.goto('/vi/ho-so-du-an?mode=new');
    await expect(page.getByRole('button', { name: vi('projectForm.btn.create'), exact: true })).toBeVisible();
    for (const key of ['form.contractDate', 'form.plannedStart', 'form.plannedFinish', 'form.committedHandover', 'form.actualStart', 'form.actualFinish']) {
      const f = page.getByLabel(vi(key), { exact: true }).first();
      await expect(f).toHaveAttribute('data-ready', 'true');
      await f.fill('01012027');
      await expect(f).toHaveValue('01/01/2027');
      await f.press('Enter');
      await expect(dateErr(page)).toHaveCount(0);
      await f.fill('');
      await f.press('Enter');
      await expect(f).toHaveValue('');
      await expect(dateErr(page)).toHaveCount(0);
    }
  });

  test('Moc chinh: xoa trong Ngay thuc te cua 1 moc roi Luu -> actualDate null; goi lai bang 8 chu so -> ghi lai', async ({ page }) => {
    const rows = await prisma.projectKeyMilestone.findMany({ where: { projectId: PROJECT_ID, actualDate: { not: null } }, orderBy: { sortOrder: 'asc' } });
    expect(rows.length).toBeGreaterThan(0);
    const target = rows[0]!;
    const actual = iso(target.actualDate)!;
    await open(page);
    const actuals = page.getByLabel(vi('form.keyMs.colActual'), { exact: true });
    const idx = 0; // moc dau tien co ngay thuc te (sortOrder 0/1 theo seed)
    const cell = actuals.nth(idx);
    await expect(cell).toHaveValue(`${actual.slice(8, 10)}/${actual.slice(5, 7)}/${actual.slice(0, 4)}`);
    await cell.fill('');
    await cell.press('Enter');
    await expect(cell).toHaveValue('');
    await expect(dateErr(page)).toHaveCount(0);
    await save(page).click();
    await expect(page.getByText(vi('projectForm.saved.updated'))).toBeVisible();
    expect((await prisma.projectKeyMilestone.findFirstOrThrow({ where: { projectId: PROJECT_ID, name: target.name } })).actualDate).toBeNull();

    await open(page);
    const cell2 = page.getByLabel(vi('form.keyMs.colActual'), { exact: true }).nth(idx);
    await cell2.fill(`${actual.slice(8, 10)}${actual.slice(5, 7)}${actual.slice(0, 4)}`);
    await cell2.press('Enter');
    await save(page).click();
    await expect(page.getByText(vi('projectForm.saved.updated'))).toBeVisible();
    expect(iso((await prisma.projectKeyMilestone.findFirstOrThrow({ where: { projectId: PROJECT_ID, name: target.name } })).actualDate)).toBe(actual);
  });

  test('Moc chinh: Ngay ke hoach nhap sai -> bao loi tai o, khong sap trang', async ({ page }) => {
    await open(page);
    const planned = page.getByLabel(vi('form.keyMs.colPlanned'), { exact: true }).first();
    await planned.fill('45/13/2026');
    await planned.press('Enter');
    await expect(dateErr(page)).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('Ke hoach thiet bi (Nhap lieu): nhap 2 ngay bang 8 chu so, xoa trong "Den ngay" roi Luu -> bao loi ke hoach, khong 500; nhap du -> luu', async ({ page }) => {
    await page.goto(`/vi/nhap-lieu?project=${PROJECT_ID}&step=resources`);
    const from = page.getByLabel(vi('equipmentPlan.colFrom'), { exact: true });
    if ((await from.count()) === 0) {
      await page.getByRole('button', { name: vi('equipmentPlan.addGroup') }).click();
      await page.getByRole('button', { name: vi('equipmentPlan.addSegment') }).first().click();
    }
    const f = page.getByLabel(vi('equipmentPlan.colFrom'), { exact: true }).first();
    const t = page.getByLabel(vi('equipmentPlan.colTo'), { exact: true }).first();
    await expect(f).toHaveAttribute('data-ready', 'true');
    await f.fill('01012027');
    await f.press('Enter');
    await expect(f).toHaveValue('01/01/2027');
    await t.fill('');
    await t.press('Enter');
    await expect(t).toHaveValue('');
    await expect(dateErr(page)).toHaveCount(0);
    const total = page.getByPlaceholder(vi('equipmentPlan.colTotal')).first();
    if (!(await total.inputValue())) await total.fill('2');
    await page.getByRole('button', { name: vi('equipmentPlan.save') }).click();
    await expect(page.getByText(vi('equipmentPlan.err.invalid'))).toBeVisible();

    await t.fill('10012027');
    await t.press('Enter');
    await expect(t).toHaveValue('10/01/2027');
    await page.getByRole('button', { name: vi('equipmentPlan.save') }).click();
    await expect(page.getByText(/Đã lưu \d+ loại thiết bị/)).toBeVisible();
    const rows = await prisma.projectEquipmentPlan.findMany({ where: { projectId: PROJECT_ID, plannedStart: new Date('2027-01-01T00:00:00Z') } });
    expect(rows.map((r) => iso(r.plannedFinish))).toContain('2027-01-10');
  });
});
