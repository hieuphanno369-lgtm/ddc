import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { addDaysIso, addMonths, todayIso } from '../src/lib/clock';
import { formatDmy } from '../src/lib/date-input';
import { loadE2eEnv, resolveE2eTarget } from './helpers/env';
import { en, vi } from './helpers/i18n';

/**
 * P4 vong sua sau reviewer va security-reviewer (thay-doi.md muc 6): kiem hanh vi that tren trinh duyet.
 * C-3: Chi tiet va Tong quan cung %KH/%TT khi ky ket thuc giua thang (oracle tinh tay tu ngay trong DB).
 * C-4: dau "?" o Khau nghen va Huy dong nguon luc (Chi tiet), khong loi console.
 * N-2: Nhap lieu chi liet ke thang server cho phep voi data-entry, admin van 12 thang.
 * S-1: ky tuy y va team/customer id la khong lam trang loi, so lieu dung, khong ghi them khoa cache xuong dia.
 * S-3: the nhat ky Ho so du an hien dong bat/tat nhap bu (vi/en), khong hien o du an khac.
 */
Object.assign(process.env, loadE2eEnv());
const prisma = new PrismaClient({ datasourceUrl: resolveE2eTarget(process.env).databaseUrl });

const today = todayIso();
const BAD_TEXT = /NaN|undefined|Invalid Date|Application error|Infinity/;

const utc = (d: Date | string) => (typeof d === 'string' ? Date.parse(`${d}T00:00:00Z`) : d.getTime());

/** Oracle %KH (theo thoi gian) tinh tay: (moc - bat dau) / (ket thuc - bat dau), kep [0,100]. */
function oraclePctPlan(start: Date, finish: Date, asOf: string): number {
  const total = finish.getTime() - start.getTime();
  const elapsed = utc(asOf) - start.getTime();
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

function parseVnPct(s: string): number {
  const m = s.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (!m) throw new Error(`Khong doc duoc % tu "${s}"`);
  return Number(m[1].replace(',', '.'));
}

const kpiValue = (page: Page, labelKey: string) => page.locator('.kpi', { hasText: vi(labelKey) }).locator('.vl').first();

/** Du an thuoc ky (Q4): [bat dau, ket thuc] giao ky; thieu bat dau lay ngay ky HD, thieu ca hai thi thuoc moi ky. */
async function projectsInPeriod(from: string, to: string) {
  const rows = await prisma.project.findMany({ where: { isActive: true } });
  return rows.filter((p) => {
    const start = p.actualStartDate ?? p.plannedStartDate ?? p.contractDate;
    const end = p.actualFinishDate ?? p.plannedFinishDate;
    return (start == null || start.toISOString().slice(0, 10) <= to) && (end == null || end.toISOString().slice(0, 10) >= from);
  });
}

async function countText(page: Page): Promise<{ n: number; total: number }> {
  const t = (await page.getByTestId('filter-count').textContent()) ?? '';
  const m = t.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) throw new Error(`filter-count khong co dang n / total: "${t}"`);
  return { n: Number(m[1]), total: Number(m[2]) };
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

test.describe('38 - P4 vong sua (admin)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('C-3: bam ten du an tu Tong quan sang Chi tiet, ky ket thuc giua thang: %KH va %TT bang nhau', async ({ page }) => {
    const from = '2026-03-01';
    const to = '2026-03-27';
    await page.goto(`/vi/overview?from=${from}&to=${to}`);
    await expect(page.getByTestId('period-summary')).toBeVisible();
    const row = page.locator('table tbody tr', { has: page.locator('a[href*="/projects/10?"]') });
    await expect(row).toHaveCount(1);
    const rowPctActual = parseVnPct(await row.innerText());
    await row.locator('a[href*="/projects/10?"]').first().click();
    await expect(page).toHaveURL(new RegExp(`/projects/10\\?.*from=${from}`));
    await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });

    const p10 = await prisma.project.findUniqueOrThrow({ where: { id: 10 } });
    const expected = oraclePctPlan(p10.plannedStartDate!, p10.plannedFinishDate!, to); // 122/126 ngay = 96,83
    expect(expected).toBeCloseTo(96.83, 1);
    const plan = parseVnPct(await kpiValue(page, 'metric.pctPlan').innerText());
    expect(plan).toBeCloseTo(expected, 1);
    // Khong bi day len 100% (so tai cuoi thang 31/03 nhu truoc khi sua C-3).
    expect(plan).toBeLessThan(100);
    const actual = parseVnPct(await kpiValue(page, 'metric.pctActual').innerText());
    expect(actual).toBeCloseTo(rowPctActual, 2);
  });

  test('C-3: moi du an ky 01/07 - 15/07: %KH Chi tiet = oracle tai 15/07, %TT va trang thai khop dong Tong quan', async ({ page }) => {
    const from = '2026-07-01';
    const to = '2026-07-15';
    await page.goto(`/vi/overview?from=${from}&to=${to}`);
    await expect(page.getByTestId('period-summary')).toBeVisible();
    const rows = page.locator('table tbody tr');
    const n = await rows.count();
    expect(n).toBeGreaterThan(5);
    const infos = await rows.evaluateAll((trs) =>
      trs.map((tr) => ({ text: (tr as HTMLElement).innerText.replace(/\s+/g, ' '), href: tr.querySelector('a')?.getAttribute('href') ?? '' })));
    const asOf = to < today ? to : today;
    let checked = 0;
    for (const info of infos) {
      const id = Number(info.href.match(/\/projects\/(\d+)/)?.[1]);
      if (!id) continue;
      await page.goto(info.href);
      await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
      const p = await prisma.project.findUniqueOrThrow({ where: { id } });
      const plan = parseVnPct(await kpiValue(page, 'metric.pctPlan').innerText());
      expect(plan, `du an ${id}: %KH`).toBeCloseTo(oraclePctPlan(p.plannedStartDate!, p.plannedFinishDate!, asOf), 1);
      const actual = await kpiValue(page, 'metric.pctActual').innerText();
      expect(info.text, `du an ${id}: %TT`).toContain(actual.replace(/\s+/g, ' ').trim());
      // Trang thai o Chi tiet la 1 trong cac nhan trang thai; dong Tong quan phai chua dung nhan do.
      const header = await page.locator('main').innerText();
      const labels = ['inProgress', 'completed', 'paused', 'preparation'].map((k) => vi(`status.${k}`));
      const detailStatus = labels.find((l) => header.includes(l));
      expect(detailStatus, `du an ${id}: nhan trang thai o Chi tiet`).toBeTruthy();
      expect(info.text, `du an ${id}: trang thai`).toContain(detailStatus!);
      checked++;
    }
    expect(checked).toBe(n);
  });

  test('C-3 nguoc: khong dat ngay mot ky thi Chi tiet van tinh tai min(cuoi thang, hom nay) nhu cu', async ({ page }) => {
    // Ky mac dinh (den hom nay): %KH = oracle tai hom nay, khong tai cuoi thang mac dinh.
    await page.goto('/vi/projects/2');
    await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
    const p = await prisma.project.findUniqueOrThrow({ where: { id: 2 } });
    const plan = parseVnPct(await kpiValue(page, 'metric.pctPlan').innerText());
    expect(plan).toBeCloseTo(oraclePctPlan(p.plannedStartDate!, p.plannedFinishDate!, today), 1);
  });

  test('C-4: dau "?" o Khau nghen (bong bong dung chu, khong tran) va o 2 the Huy dong nguon luc', async ({ page }) => {
    await page.goto('/vi/projects/2');
    await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
    const badge = page.getByText(new RegExp(`^${vi('detail.bottleneck')}:`)).first();
    await expect(badge).toBeVisible();
    const bottleneckHelp = badge.locator('xpath=following-sibling::*[contains(@class,"help")][1]');
    await expect(bottleneckHelp).toHaveCount(1);
    await bottleneckHelp.click();
    await expect(bottleneckHelp).toHaveAttribute('aria-expanded', 'true');
    const bub = bottleneckHelp.locator('.bub');
    await expect(bub).toBeVisible();
    await expect(bub).toHaveText(vi('helpTip.dtBottleneck'));
    const box = await settledBox(bub);
    const vw = page.viewportSize()!.width;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
    await page.keyboard.press('Escape');
    await expect(bub).toBeHidden();

    for (const id of ['res-manpower', 'res-equipment']) {
      const card = page.locator(`#${id}`);
      await card.scrollIntoViewIfNeeded();
      await expect(card).toHaveCSS('overflow', 'visible');
      const help = card.locator('h3 .help');
      await expect(help).toHaveCount(1);
      await help.click();
      await expect(help).toHaveAttribute('aria-expanded', 'true');
      await expect(help.locator('.bub')).toBeVisible();
      await expect(help.locator('.bub')).toHaveText(vi('helpTip.dtMobilization'));
      const b = await settledBox(help.locator('.bub'));
      expect(b!.x).toBeGreaterThanOrEqual(0);
      expect(b!.x + b!.width).toBeLessThanOrEqual(vw + 1);
      await page.keyboard.press('Escape');
    }
  });

  test('C-4 tieng Anh: 3 dau "?" hien chuoi en', async ({ page }) => {
    await page.goto('/en/projects/2');
    await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
    const badge = page.getByText(new RegExp(`^${en('detail.bottleneck')}:`)).first();
    const help = badge.locator('xpath=following-sibling::*[contains(@class,"help")][1]');
    await help.click();
    await expect(help.locator('.bub')).toHaveText(en('helpTip.dtBottleneck'));
    await page.keyboard.press('Escape');
    const man = page.locator('#res-manpower h3 .help');
    await man.click();
    await expect(man.locator('.bub')).toHaveText(en('helpTip.dtMobilization'));
  });

  test('C-4: trang Chi tiet khong bao loi React "unique key" trong console (dev)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    for (const id of [2, 3, 4, 5, 6, 7]) {
      await page.goto(`/vi/projects/${id}`);
      await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1000);
    }
    const keyWarnings = errors.filter((e) => /unique "key" prop/.test(e));
    expect(keyWarnings, `console: ${errors.map((e) => e.slice(0, 100)).join(' || ')}`).toEqual([]);
  });

  test('N-3: ky keo sang thang tuong lai cho cung cot cong suat/san luong nhu ky den het thang hien tai', async ({ page }) => {
    const widths = async (q: string) => {
      await page.goto(`/vi/overview${q}`);
      const card = page.locator('.card', { hasText: vi('chartHowTo.capacityLegend') }).first();
      await expect(card.locator('.recharts-bar-rectangle').first()).toBeVisible({ timeout: 30_000 });
      const read = () => card.locator('.recharts-bar-rectangle path, .recharts-bar-rectangle rect').evaluateAll((els) => els.map((e) => Math.round((e as SVGGraphicsElement).getBBox().width)));
      // Recharts co animation: doc lai cho toi khi 2 lan doc lien tiep (cach 700ms) giong nhau.
      let prev = await read();
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(700);
        const cur = await read();
        if (JSON.stringify(cur) === JSON.stringify(prev)) return cur;
        prev = cur;
      }
      return prev;
    };
    const cur = today.slice(0, 7);
    const upToNow = await widths(`?from=${addMonths(cur, -2)}-01&to=${today}`);
    const future = await widths(`?from=${addMonths(cur, -2)}-01&to=${addMonths(cur, 3)}-28`);
    expect(upToNow.length).toBeGreaterThan(0);
    expect(future, 'cong suat ky khong duoc nhan them thang sau hom nay').toEqual(upToNow);
  });

  test('N-2: admin van thay 12 thang o Nhap lieu', async ({ page }) => {
    await page.goto('/vi/nhap-lieu?project=1');
    const select = page.locator('select', { has: page.locator(`option[value="${today.slice(0, 7)}"]`) });
    await expect(select).toHaveCount(1);
    const values = await select.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    const expected = Array.from({ length: 12 }, (_, i) => addMonths(today.slice(0, 7), i - 11));
    expect(values).toEqual(expected);
  });

  test('S-1: team/customer id la khong lam trang loi, so du an dung, khong ghi them khoa cache', async ({ page }) => {
    const cacheDir = join(process.cwd(), '.next', 'cache', 'fetch-cache');
    const files = () => readdirSync(cacheDir).length;
    // Lam nong 1 lan (ky mac dinh) roi moi do.
    await page.goto('/vi/overview');
    await expect(page.getByTestId('filter-count')).toBeVisible();
    await page.waitForTimeout(2500);
    const before = files();

    const from = '2026-03-13';
    const to = '2026-08-17';
    const expected = (await projectsInPeriod(from, to)).length;
    for (const q of [
      `?from=${from}&to=${to}&team=99999&customer=88888`,
      `?from=${from}&to=${to}&team=1e9&customer=-3`,
      `?team=77777&customer=66666`,
      `?from=2026-01-07&to=2026-09-11`,
      `?from=2019-05-05&to=2026-09-29&team=555`,
    ]) {
      const res = await page.goto(`/vi/overview${q}`);
      expect(res?.status(), q).toBe(200);
      await expect(page.getByTestId('period-summary')).toBeVisible();
      await expect(page.locator('.kpi').first()).toBeVisible();
      const { n, total } = await countText(page);
      expect(n, `${q}: id la ve 'all', n = total`).toBe(total);
      if (q.includes(`from=${from}`) && !q.includes('1e9')) expect(total, q).toBe(expected);
      const text = await page.locator('main').innerText();
      expect(text).not.toMatch(BAD_TEXT);
      await page.waitForTimeout(1200);
    }
    // Ky khong hop le hien dong bao; id la khong lam hien "Ky khong hop le".
    await page.goto('/vi/overview?team=99999');
    await expect(page.getByTestId('period-invalid')).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(files(), 'ky tuy y va id la khong ghi them tep vao .next/cache/fetch-cache').toBe(before);
  });

  test('S-1: id team va customer THAT van loc dung', async ({ page }) => {
    const from = '2026-01-01';
    const to = '2026-09-30';
    const inPeriod = await projectsInPeriod(from, to);
    const teamId = inPeriod[0].teamKdId;
    const customerId = inPeriod[0].customerId;
    await page.goto(`/vi/overview?from=${from}&to=${to}&team=${teamId}`);
    let c = await countText(page);
    expect(c.total).toBe(inPeriod.length);
    expect(c.n).toBe(inPeriod.filter((p) => p.teamKdId === teamId).length);
    expect(c.n).toBeLessThan(c.total + 1);
    await page.goto(`/vi/overview?from=${from}&to=${to}&customer=${customerId}`);
    c = await countText(page);
    expect(c.n).toBe(inPeriod.filter((p) => p.customerId === customerId).length);
  });

  test('S-1: cung ky tuy y, tai lai cho cung KPI "Du an trong ky" bang oracle DB', async ({ page }) => {
    const from = '2026-02-11';
    const to = '2026-06-19';
    const expected = String((await projectsInPeriod(from, to)).length);
    const card = () => page.locator('.kpi', { hasText: vi('kpi.totalProjects') }).locator('.vl').first();
    await page.goto(`/vi/overview?from=${from}&to=${to}`);
    await expect(card()).toHaveText(expected);
    await page.reload();
    await expect(card()).toHaveText(expected);
    const all = await page.locator('.kpi').allInnerTexts();
    expect(all.join(' ')).not.toMatch(BAD_TEXT);
  });
});

// ---- S-3 + N-2 (data-entry): nhap bu, nhat ky theo du an ----
const PROJECT_ID = 1;
const OTHER_PROJECT_ID = 3;
const FROM = addDaysIso(today, -65);
const TO = addDaysIso(today, -60);
const NOTE = 'e2e-p4 vong sua nhat ky nhap bu';

async function ctxPage(browser: Browser, baseURL: string | undefined, role: 'admin' | 'pm') {
  const context = await browser.newContext({ baseURL, storageState: `e2e/.auth/${role}.json` });
  return { context, page: await context.newPage() };
}

/** Xoa khoang nhap bu va dong audit cua du an 1 (spec 35 chay truoc de lai dong enable/disable cu; `1/<id>` chi la du an 1). */
async function cleanBackfill() {
  const ids = (await prisma.projectBackfillWindow.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })).map((r) => r.id);
  await prisma.auditLog.deleteMany({ where: { tableName: 'project_backfill_window', recordId: { startsWith: `${PROJECT_ID}/` } } });
  if (ids.length) await prisma.projectBackfillWindow.deleteMany({ where: { id: { in: ids } } });
}

test.describe('38 - Nhat ky nhap bu theo du an (S-3) va thang cho PIC (N-2)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => {
    await cleanBackfill();
  });
  test.afterAll(async () => {
    await cleanBackfill();
  });

  test('N-2: PIC (data-entry) chi thay thang hien tai va thang truoc; ?month=cu roi ve thang hien tai', async ({ browser, baseURL }) => {
    const { context, page } = await ctxPage(browser, baseURL, 'pm');
    await page.goto(`/vi/nhap-lieu?project=${PROJECT_ID}`);
    const cur = today.slice(0, 7);
    const select = page.locator('select', { has: page.locator(`option[value="${cur}"]`) });
    await expect(select).toHaveCount(1);
    const values = await select.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(values).toEqual([addMonths(cur, -1), cur]);
    await expect(select).toHaveValue(cur);
    // Thang cu (ngoai khoang): URL ep thang cu khong mo duoc thang do.
    await page.goto(`/vi/nhap-lieu?project=${PROJECT_ID}&month=${addMonths(cur, -6)}`);
    await expect(select).toHaveValue(cur);
    await context.close();
  });

  test('S-3: admin bat nhap bu du an 1 -> the nhat ky Ho so du an 1 hien dong "Nhap bu lich su" (vi), du an 3 khong hien', async ({ browser, baseURL }) => {
    const { context, page } = await ctxPage(browser, baseURL, 'admin');
    await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
    await expect(page.getByTestId('backfill-panel')).toBeVisible();
    const from = page.getByTestId('backfill-from');
    const to = page.getByTestId('backfill-to');
    await expect(from).toHaveAttribute('data-ready', 'true');
    await from.fill(formatDmy(FROM));
    await from.press('Enter');
    await to.fill(formatDmy(TO));
    await to.press('Enter');
    await page.getByTestId('backfill-note').fill(NOTE);
    await page.getByTestId('backfill-enable').click();
    await expect(page.getByTestId('backfill-active')).toContainText(NOTE);

    const win = await prisma.projectBackfillWindow.findFirstOrThrow({ where: { projectId: PROJECT_ID, note: NOTE } });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { tableName: 'project_backfill_window', field: 'enable', recordId: `${PROJECT_ID}/${win.id}` } });
    expect(audit.recordId).toMatch(/^1\/\d+$/);

    await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
    const card = page.locator('.card', { has: page.getByRole('heading', { name: vi('projectForm.audit.title') }) });
    const rowsOfWindow = card.locator('tbody tr', { hasText: vi('projectForm.audit.tbl.project_backfill_window') });
    await expect(rowsOfWindow).toHaveCount(1);
    await expect(rowsOfWindow.first()).toContainText('enable');
    await expect(rowsOfWindow.first()).toContainText(`${FROM}..${TO}`);

    await page.goto(`/vi/ho-so-du-an?project=${OTHER_PROJECT_ID}`);
    const other = page.locator('.card', { has: page.getByRole('heading', { name: vi('projectForm.audit.title') }) });
    await expect(other).toBeVisible();
    await expect(other.getByText(vi('projectForm.audit.tbl.project_backfill_window'))).toHaveCount(0);
    await context.close();
  });

  test('S-3 tieng Anh: nhan "Historical backfill" o the nhat ky', async ({ browser, baseURL }) => {
    const { context, page } = await ctxPage(browser, baseURL, 'admin');
    await page.goto(`/en/ho-so-du-an?project=${PROJECT_ID}`);
    const card = page.locator('.card', { has: page.getByRole('heading', { name: en('projectForm.audit.title') }) });
    await expect(card.locator('tbody tr', { hasText: en('projectForm.audit.tbl.project_backfill_window') })).toHaveCount(1);
    await expect(card.getByText(vi('projectForm.audit.tbl.project_backfill_window'))).toHaveCount(0);
    await context.close();
  });

  test('N-2 + nhap bu: khi khoang dang bat, PIC thay them cac thang cua khoang (va chi cac thang do)', async ({ browser, baseURL }) => {
    const { context, page } = await ctxPage(browser, baseURL, 'pm');
    await page.goto(`/vi/nhap-lieu?project=${PROJECT_ID}`);
    const cur = today.slice(0, 7);
    const select = page.locator('select', { has: page.locator(`option[value="${cur}"]`) });
    const values = await select.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    const windowMonths: string[] = [];
    for (let m = FROM.slice(0, 7); m <= TO.slice(0, 7); m = addMonths(m, 1)) windowMonths.push(m);
    expect(values).toEqual([...new Set([...windowMonths, addMonths(cur, -1), cur])].sort());
    await context.close();
  });

  test('S-3: admin tat khoang -> the nhat ky co them dong "disable", PIC het thay thang cu', async ({ browser, baseURL }) => {
    const { context, page } = await ctxPage(browser, baseURL, 'admin');
    await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
    await page.getByTestId('backfill-disable').click();
    await expect(page.getByTestId('backfill-none')).toBeVisible();
    await page.goto(`/vi/ho-so-du-an?project=${PROJECT_ID}`);
    const card = page.locator('.card', { has: page.getByRole('heading', { name: vi('projectForm.audit.title') }) });
    const rows = card.locator('tbody tr', { hasText: vi('projectForm.audit.tbl.project_backfill_window') });
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'disable' })).toHaveCount(1);
    await context.close();

    const { context: pc, page: pm } = await ctxPage(browser, baseURL, 'pm');
    await pm.goto(`/vi/nhap-lieu?project=${PROJECT_ID}`);
    const cur = today.slice(0, 7);
    const values = await pm.locator('select', { has: pm.locator(`option[value="${cur}"]`) }).locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(values).toEqual([addMonths(cur, -1), cur]);
    await pc.close();
  });
});

test.describe('38 - Bien thoi gian tren Chi tiet, ngay ngoai le (khong loi)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('C-3 bien: ky 1 ngay 15/07 va ky cat ngang thang: Chi tiet mo duoc, %KH khop oracle', async ({ page }) => {
    const p = await prisma.project.findUniqueOrThrow({ where: { id: 1 } });
    for (const [from, to] of [['2026-07-15', '2026-07-15'], ['2026-05-20', '2026-06-03']] as const) {
      await page.goto(`/vi/projects/1?from=${from}&to=${to}`);
      await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
      const plan = parseVnPct(await kpiValue(page, 'metric.pctPlan').innerText());
      expect(plan, `${from}..${to}`).toBeCloseTo(oraclePctPlan(p.plannedStartDate!, p.plannedFinishDate!, to), 1);
      expect(await page.locator('main').innerText()).not.toMatch(BAD_TEXT);
    }
  });

  test('C-3 bien: ky tuong lai ket thuc sau hom nay thi %KH tinh tai hom nay (khong tai cuoi ky)', async ({ page }) => {
    const p = await prisma.project.findUniqueOrThrow({ where: { id: 2 } });
    const to = addDaysIso(today, 200);
    await page.goto(`/vi/projects/2?from=${addDaysIso(today, -20)}&to=${to}`);
    await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
    const plan = parseVnPct(await kpiValue(page, 'metric.pctPlan').innerText());
    expect(plan).toBeCloseTo(oraclePctPlan(p.plannedStartDate!, p.plannedFinishDate!, today), 1);
  });
});
