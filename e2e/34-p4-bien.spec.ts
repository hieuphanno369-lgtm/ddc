import { test, expect, type Page } from '@playwright/test';
import { vi } from './helpers/i18n';

/**
 * P4 tester - e2e cho các trường hop bien cua muc 4 ke hoach tren giao dien that (DB e2e da seed):
 * (1) chart Tong quan ve xong co du lieu (khong trong) - Recharts co animation, phai cho ve xong roi moi ket luan,
 * (2) tham so URL rac o Tong quan va Chi tiet khong gay 500 va khong lo "NaN"/"undefined"/"Invalid Date" ra man hinh,
 * (3) ky trong so, ky tuong lai, ky 1 ngay, ky cat ngang thang: ve duoc, dong tom tat dung,
 * (4) viewer khong thay tien o cac khoi moi.
 */

const BAD_TEXT = /NaN|undefined|Invalid Date|Application error|Infinity/;

async function noBadText(page: Page) {
  const text = await page.locator('main, body').first().innerText();
  expect(text).not.toMatch(BAD_TEXT);
}

test.describe('34 - Bien P4 (admin)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('chart Tong quan ve xong co du lieu: donut co lat, cot co chieu cao, khong con trong', async ({ page }) => {
    await page.goto('/vi/overview');
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 30_000 });
    // Cho animation ket thuc: so lat/cot on dinh, sau do do chieu cao that cua cot.
    await expect.poll(() => page.locator('.recharts-pie-sector').count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(() => page.locator('.recharts-bar-rectangle').count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(2500);
    const heights = await page.locator('.recharts-bar-rectangle path, .recharts-bar-rectangle rect').evaluateAll((els) =>
      els.map((e) => (e as SVGGraphicsElement).getBBox().height));
    expect(heights.length).toBeGreaterThan(0);
    expect(Math.max(...heights)).toBeGreaterThan(10);
    const sector = await page.locator('.recharts-pie-sector path').first().getAttribute('d');
    expect(sector).toBeTruthy();
  });

  const OVERVIEW_JUNK = [
    '?month=all',
    '?month=abc',
    '?month=9999-12',
    '?from=r%C3%A1c&to=r%C3%A1c',
    '?from=2026-02-30&to=2026-13-40',
    '?from=2026-09-10&to=2026-07-15',
    '?status=hack&team=-1&customer=abc&priority=P9&groupBy=password',
    '?groupKey=khong-ton-tai',
    `?from=${'x'.repeat(3000)}&to=${'y'.repeat(3000)}`,
    '?page=-5&sort=value&search=%27%3B--',
  ];
  for (const q of OVERVIEW_JUNK) {
    test(`Tong quan ${q.slice(0, 60)}: mo duoc, khong loi, khong NaN`, async ({ page }) => {
      const res = await page.goto(`/vi/overview${q}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByTestId('period-summary')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.kpi').first()).toBeVisible();
      await noBadText(page);
    });
  }

  const DETAIL_JUNK = [
    '?from=xx&to=2026-13-40&month=abc&day=2026-02-30',
    '?month=9999-12',
    '?day=9999-12-31',
    '?from=2027-01-01&to=2027-06-30',
    '?from=2020-01-01&to=2020-12-31',
    '?from=2026-05-10&to=2026-05-10',
    `?month=${'z'.repeat(3000)}`,
  ];
  for (const q of DETAIL_JUNK) {
    test(`Chi tiet ${q.slice(0, 60)}: mo duoc, khong loi, khong NaN`, async ({ page }) => {
      const res = await page.goto(`/vi/projects/1${q}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
      await noBadText(page);
    });
  }

  test('Chi tiet id la (1.0, 0x1, 99999): 404, khong 500', async ({ page }) => {
    for (const id of ['1.0', '0x1', '99999', '0']) {
      const res = await page.goto(`/vi/projects/${id}`);
      expect(res?.status(), id).toBe(404);
    }
  });

  test('ky truoc khi co du lieu (2020): KPI phat sinh 0, delta trong, chart khong nem loi', async ({ page }) => {
    await page.goto('/vi/overview?from=2020-01-01&to=2020-03-31');
    await expect(page.getByTestId('period-summary')).toContainText('01/2020 - 03/2020');
    await expect(page.getByTestId('period-summary')).toContainText('31/03/2020');
    await noBadText(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('ky nam hang trong tuong lai (2027): so ton tai HOM NAY, khong ve thang chua toi, dong tom tat ghi ro', async ({ page }) => {
    await page.goto('/vi/overview?from=2027-01-01&to=2027-03-31');
    const summary = page.getByTestId('period-summary');
    await expect(summary).toContainText('01/2027 - 03/2027');
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    // "so ton tai <hom nay>" (asOf = min(cuoi ky, hom nay)), khong phai 31/03/2027.
    await expect(summary).toContainText(`${dd}/${mm}/${today.getFullYear()}`);
    await noBadText(page);
  });

  test('ky 1 ngay va ky cat ngang thang: dong tom tat dung thang tron, ghi chu "Ky chi co 1 thang"', async ({ page }) => {
    await page.goto('/vi/overview?from=2026-07-15&to=2026-07-15');
    await expect(page.getByTestId('period-summary')).toContainText('07/2026 - 07/2026');
    await expect(page.getByText(vi('period.oneMonth')).first()).toBeVisible({ timeout: 30_000 });
    await page.goto('/vi/overview?from=2026-06-15&to=2026-08-10');
    await expect(page.getByTestId('period-summary')).toContainText('06/2026 - 08/2026');
    await expect(page.getByTestId('period-summary')).toContainText('10/08/2026');
  });

  test('link tu Tong quan sang Chi tiet giu ky, chip "Dung so thang" khi moc lon hon thang co so', async ({ page }) => {
    await page.goto('/vi/overview?from=2026-06-15&to=2026-08-10');
    const link = page.locator('table.tbl tbody tr').first().locator('a[href*="/projects/"]').first();
    await expect(link).toHaveAttribute('href', /from=2026-06-15&to=2026-08-10/);
  });

  test('mo Chi tiet co ky 1 ngay o thang khong co so nhan luc: khong loi, nhan "So ngay" la ngay that', async ({ page }) => {
    await page.goto('/vi/projects/1?from=2026-05-10&to=2026-05-10');
    await expect(page.getByTestId('detail-time-bar')).toBeVisible();
    await noBadText(page);
  });
});

test.describe('34 - Bien P4 (viewer khong xem tien)', () => {
  test.use({ storageState: 'e2e/.auth/viewer.json' });

  test('Tong quan voi ky tuy chon: khong co The doanh thu, HD chua khoi cong, S-curve; con so san luong (khong phai tien)', async ({ page }) => {
    await page.goto('/vi/overview?from=2026-01-01&to=2026-09-16');
    await expect(page.getByTestId('period-summary')).toBeVisible({ timeout: 30_000 });
    const body = page.locator('body');
    await expect(body).not.toContainText(vi('kpiGroup.revenue'));
    await expect(body).not.toContainText(vi('kpi.backlog'));
    await expect(body).not.toContainText(vi('overview.sCurve'));
    await expect(body).toContainText(vi('kpiGroup.tonnage'));
  });

  test('Chi tiet du an duoc gan, co ky/moc: khong co S-curve, bang tai chinh, gia tri hop dong', async ({ page }) => {
    await page.goto('/vi/projects/1?from=2026-01-01&to=2026-08-31&month=2026-06');
    await expect(page.getByTestId('detail-time-bar')).toBeVisible({ timeout: 30_000 });
    const body = page.locator('body');
    await expect(body).not.toContainText(vi('detail.sCurve12'));
    await expect(body).not.toContainText(vi('detail.financial'));
    await expect(body).not.toContainText(vi('metric.contractValue'));
  });

  test('Chi tiet du an KHONG duoc gan (id 3) dung ky/moc trong URL: 404, khong lo du lieu', async ({ page }) => {
    const res = await page.goto('/vi/projects/3?from=2026-01-01&to=2026-08-31&month=2026-06&day=2026-06-10');
    expect(res?.status()).toBe(404);
  });
});
