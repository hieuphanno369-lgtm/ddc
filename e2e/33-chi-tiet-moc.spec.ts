import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';
import { waitChartsDrawn } from './helpers/chart-ready';

/** 'dd/mm/yyyy' (ô ngày riêng) -> mili giây UTC. */
const dmyMs = (s: string) => {
  const [d, m, y] = s.split('/').map(Number);
  return Date.UTC(y, m - 1, d);
};

/**
 * P4 (D2, D3, D4): trang Chi tiet co bo chon moc thang, ky, dieu huong tuan cho nhom nguon luc, dong "So tai ...",
 * cau chay/nhanh 1 cau, vach moc tren chart. Du lieu: DB e2e da seed (17 du an, fact 2025-10..2026-09).
 * Du an 10 (PEPSICO) co actualFinishDate 2026-03-28 nen tu thang 03/2026 tro di la "Hoan thanh" (dung cho ca completed).
 * Anh chup o .bangiao/anh-p4 de soi pixel (1440 va 390, sang va toi).
 */
test.use({ storageState: 'e2e/.auth/admin.json' });

const SHOTS = '.bangiao/anh-p4';

test.describe('33 - Chi tiet: moc thang, ky, tuan', () => {
  test('mo khong tham so: moc = thang gan nhat co so, KPI ghi "So tai"', async ({ page }) => {
    await page.goto('/vi/projects/1');
    const bar = page.getByTestId('detail-time-bar');
    await expect(bar).toBeVisible();
    const selected = await bar.getByTestId('month-select').inputValue();
    expect(selected).toMatch(/^\d{4}-\d{2}$/);
    const [y, m] = selected.split('-');
    await expect(page.locator('.kpis').first().getByText(vi('asOf.month', { month: `${m}/${y}` })).first()).toBeVisible();
  });

  test('?month=2026-03: nut lui thang doi URL va doi so %TT', async ({ page }) => {
    await page.goto('/vi/projects/1?month=2026-03');
    const bar = page.getByTestId('detail-time-bar');
    await expect(bar.getByTestId('month-select')).toHaveValue('2026-03');
    const tt = page.locator('.kpi.key').first().locator('.vl');
    const before = await tt.textContent();
    await bar.getByTestId('month-prev').click();
    await expect(page).toHaveURL(/month=2026-02/);
    await expect(bar.getByTestId('month-select')).toHaveValue('2026-02');
    await expect(tt).not.toHaveText(before ?? '');
  });

  test('du an da ket thuc: mo thang sau ngay ket thuc thay "Hoan thanh" va nhan Hoan thanh 03/2026', async ({ page }) => {
    await page.goto('/vi/projects/10?month=2026-09');
    await expect(page.locator('.kpis').first().getByText(vi('asOf.completed', { month: '03/2026' })).first()).toBeVisible();
    const pct = await page.locator('.kpi.key').first().locator('.vl').textContent();
    expect(pct).not.toBe('-');
  });

  test('tuan truoc / tuan sau doi nhan "So ngay" 7 ngay, KPI nhan luc doi, anchor van cuon', async ({ page }) => {
    await page.goto('/vi/projects/1?month=2026-08');
    const nav = page.getByTestId('resource-day-nav');
    await expect(nav).toBeVisible();
    const input = nav.getByTestId('day-input');
    const day0 = await input.inputValue();
    await nav.getByTestId('day-prev').click();
    await expect(page).toHaveURL(/day=/);
    const day1 = await input.inputValue();
    expect(day0).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(dmyMs(day1) < dmyMs(day0)).toBe(true);
    const diff = (dmyMs(day0) - dmyMs(day1)) / 86400000;
    expect(diff).toBe(7);
    await nav.getByTestId('day-next').click();
    await expect(input).toHaveValue(day0);
    // KPI Nhan luc van la anchor toi chart.
    await expect(page.locator('a.kpi[href="#res-manpower"]')).toBeVisible();
    await expect(page.locator('a.kpi[href="#res-equipment"]')).toBeVisible();
  });

  test('cau chay/nhanh gop 1 cau o the %TT va chan timeline', async ({ page }) => {
    await page.goto('/vi/projects/1?month=2026-08');
    const sentence = /(Chậm|Nhanh) \d+ ngày \(\d+ điểm %\)|Đúng tiến độ/;
    await expect(page.locator('.kpi.key').first().getByText(sentence)).toBeVisible();
    await expect(page.locator('.tlfoot').getByText(sentence)).toBeVisible();
  });

  test('vach moc do tren S-curve, SPI/CPI va chart nhan luc theo thang', async ({ page }) => {
    await page.goto('/vi/projects/1?month=2026-06');
    await expect(page.locator('.recharts-reference-line-line').first()).toBeAttached({ timeout: 30_000 });
    await expect(page.getByTestId('marker-line')).toBeAttached({ timeout: 30_000 });
  });

  test('nhap ngay nguon luc dd/mm/yyyy: dung doi URL, sai bao loi', async ({ page }) => {
    await page.goto('/vi/projects/1?month=2026-08');
    const input = page.getByTestId('day-input');
    await expect(input).toHaveAttribute('data-ready', 'true');
    await input.fill('10/08/2026');
    await input.press('Enter');
    await expect(page).toHaveURL(/day=2026-08-10/);
    await input.fill('99/99/2026');
    await input.press('Enter');
    await expect(page.getByTestId('day-input-error')).toBeVisible();
    await expect(page).toHaveURL(/day=2026-08-10/);
  });

  test('from/to rac o Chi tiet hien dong "Ky khong hop le"', async ({ page }) => {
    await page.goto('/vi/projects/1?from=rac&to=rac');
    await expect(page.getByTestId('period-invalid')).toHaveText(vi('period.invalid'));
    await page.goto('/vi/projects/1');
    await expect(page.getByTestId('period-invalid')).toHaveCount(0);
  });

  test('thanh ky 390px: hai o ngay thang cot, khong tran ngang', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/vi/projects/1?month=2026-08');
    const from = await page.getByTestId('period-from').boundingBox();
    const to = await page.getByTestId('period-to').boundingBox();
    expect(from && to).toBeTruthy();
    // Cung hang thi thang hang tren; xep 2 hang thi cung mep trai. Khong lech kieu 1 ben canh phai.
    if (Math.abs(from!.y - to!.y) < 4) expect(from!.y).toBeCloseTo(to!.y, 0);
    else expect(Math.abs(from!.x - to!.x)).toBeLessThan(4);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('tham so rac khong gay loi 500', async ({ page }) => {
    const res = await page.goto('/vi/projects/1?from=xx&to=2026-13-40&month=abc&day=2026-02-30');
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId('detail-time-bar')).toBeVisible();
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const [w, h] of [[1440, 900], [390, 844]] as const) {
      test(`anh chi tiet ${w}px ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/vi/projects/1?month=2026-08');
        await expect(page.getByTestId('detail-time-bar')).toBeVisible();
        await waitChartsDrawn(page);
        await page.screenshot({ path: `${SHOTS}/chi-tiet-${w}-${theme}.png`, fullPage: true });
      });
    }
  }
});
