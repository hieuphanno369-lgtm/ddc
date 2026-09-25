import { test, expect } from '@playwright/test';
import { vi } from './helpers/i18n';

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('07 - Quan tri (admin)', () => {
  test('sua ty gia USD thang hien tai -> nguon Nhap tay', async ({ page }) => {
    await page.goto('/vi/admin');
    await expect(page.getByText(vi('fxRates.title'))).toBeVisible();

    // Nhan dien bang ty gia qua cot USD (rieng cua bang nay) - tranh khoanh vung ".card" long nhau
    // gay locator cham/khong on dinh.
    const table = page.locator('table.tbl').filter({ has: page.locator('th', { hasText: 'USD' }) });
    const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
      .format(new Date())
      .slice(0, 7);
    const row = table.locator('tbody tr').filter({ hasText: currentMonth }).first();
    // Cot dau tien la thang, cot thu 2 la USD (FX_CURRENCIES = ['USD','EUR']).
    const usdCell = row.locator('td').nth(1);
    await usdCell.getByRole('button', { name: vi('fxRates.edit') }).click();
    await usdCell.locator('input[type="number"]').fill('25500');
    await usdCell.getByRole('button', { name: vi('fxRates.save') }).click();

    await expect(usdCell.getByText(vi('fxRates.source.manual'))).toBeVisible();
  });

  test('them khu vuc san xuat moi -> xuat hien trong bang', async ({ page }) => {
    await page.goto('/vi/admin');
    await expect(page.getByText(vi('factoryAdmin.title'))).toBeVisible();

    const name = `E2E KV ${Date.now()}`;

    // Dong nhap moi la dong cuoi bang FactoryEditor (input rong).
    const table = page.locator('table.tbl').filter({ hasText: vi('factoryAdmin.name') });
    const newRow = table.locator('tbody tr').last();
    await newRow.locator('input').nth(0).fill(name);
    await newRow.locator('input').nth(2).fill('1000');
    await newRow.getByRole('button', { name: vi('factoryAdmin.add') }).click();

    await expect(page.getByText(name)).toBeVisible();
  });

  test('kenh thong bao: them webhook, sua lai URL trong, gui thu, chan IP noi bo; them + xoa kenh email; khong lo v1:', async ({ page }) => {
    await page.goto('/vi/admin');
    // Khoanh vung trong the NotifyChannelEditor - nut "Luu" trung chu voi FactoryEditor (moi dong
    // FactoryEditor luon co san nut "Luu"), khong khoanh vung se bam nham/bao loi strict mode.
    const card = page.locator('.card', { hasText: vi('notifyAdmin.title') }).first();
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: vi('notifyAdmin.add') }).click();
    const nameField = card.locator('.field', { hasText: vi('notifyAdmin.name') }).locator('input');
    await nameField.fill('E2E Webhook');
    const urlField = card.locator('.field', { hasText: vi('notifyAdmin.webhookUrl') }).locator('input[type="password"]');
    await urlField.fill('https://example.invalid/hook');
    await card.getByRole('button', { name: vi('notifyAdmin.save') }).click();

    const webhookRow = card.locator('tr', { hasText: 'E2E Webhook' });
    await expect(webhookRow.getByText('••••hook')).toBeVisible();

    await webhookRow.getByRole('button', { name: vi('notifyAdmin.edit') }).click();
    const urlFieldEdit = card.locator('.field', { hasText: vi('notifyAdmin.webhookUrl') }).locator('input[type="password"]');
    await expect(urlFieldEdit).toHaveValue('');

    await webhookRow.getByRole('button', { name: vi('notifyAdmin.test') }).click();
    await expect(card.getByText(vi('notifyAdmin.err.dns_failed'))).toBeVisible({ timeout: 15_000 });

    await urlFieldEdit.fill('https://127.0.0.1/x');
    await card.getByRole('button', { name: vi('notifyAdmin.save') }).click();
    await expect(card.getByText(vi('notifyAdmin.err.blocked_ip'))).toBeVisible();
    await card.getByRole('button', { name: vi('notifyAdmin.cancel') }).click();

    await card.getByRole('button', { name: vi('notifyAdmin.add') }).click();
    await card.locator('.field', { hasText: vi('notifyAdmin.kind') }).locator('select').selectOption('email');
    await card.locator('.field', { hasText: vi('notifyAdmin.name') }).locator('input').fill('E2E Mail');
    await card.locator('.field', { hasText: vi('notifyAdmin.smtpHost') }).locator('input').fill('smtp.example.invalid');
    await card.locator('.field', { hasText: vi('notifyAdmin.smtpPort') }).locator('input').fill('587');
    await card.locator('.field', { hasText: vi('notifyAdmin.fromAddress') }).locator('input').fill('noreply@daidung.com.vn');
    await card.getByRole('button', { name: vi('notifyAdmin.save') }).click();

    const emailRow = card.locator('tr', { hasText: 'E2E Mail' });
    await expect(emailRow).toBeVisible();
    await card.getByPlaceholder(vi('notifyAdmin.recipientEmail')).fill('e2e@daidung.com.vn');
    await card.getByRole('button', { name: vi('notifyAdmin.addRecipient') }).click();
    await expect(card.getByText('e2e@daidung.com.vn')).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await webhookRow.getByRole('button', { name: vi('notifyAdmin.delete') }).click();
    await expect(webhookRow).toHaveCount(0);

    page.once('dialog', (d) => d.accept());
    await emailRow.getByRole('button', { name: vi('notifyAdmin.delete') }).click();
    await expect(emailRow).toHaveCount(0);

    expect(await page.content()).not.toContain('v1:');
  });
});
