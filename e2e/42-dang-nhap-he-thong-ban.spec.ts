import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { AUTH_TX_OPTIONS } from '../src/server/repo/auth-tx';
import { E2E_LOCK_PASSWORD, loadE2eEnv, resolveE2eTarget } from './helpers/env';
import { vi } from './helpers/i18n';
import { fillLogin } from './helpers/login';

/**
 * Sửa lỗi P2028 - đăng nhập thất bại do lỗi hệ thống phải báo "Hệ thống đang bận", không báo sai email/mật khẩu.
 * Giả lập lỗi hệ thống THẬT, không cửa hậu trong app: giữ advisory lock `login_fail_ip:<IP giả>` (đúng khoá mà
 * `reserveThrottle` dùng) lâu hơn `AUTH_TX_OPTIONS.timeout`, giao dịch giữ chỗ IP của app bị Prisma huỷ (P2028).
 * IP giả RFC 5737 riêng cho spec này; lock tự nhả khi giao dịch của spec kết thúc.
 */
const { databaseUrl } = resolveE2eTarget(loadE2eEnv());
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const EMAIL = 'e2e-khoa@daidung.com.vn';
const FAKE_IP = '203.0.113.91';
const KIND = 'login_fail_ip';

async function waitUntilLockHeld(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const rows = await prisma.$queryRaw<{ held: boolean }[]>`SELECT NOT pg_try_advisory_xact_lock(hashtext(${KIND} || ':' || ${FAKE_IP})) AS held`;
    if (rows[0]?.held) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('khong thay advisory lock bi giu sau 5s');
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe('42 - dang nhap khi he thong ban (sua loi P2028)', () => {
  test('loi he thong -> bao "he thong ban" (khong bao sai mat khau), khong tinh luot sai IP; het ban dang nhap lai duoc', async ({ browser }) => {
    const holdSeconds = AUTH_TX_OPTIONS.timeout / 1000 + 5;
    test.setTimeout((holdSeconds + 90) * 1000);

    const holder = prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${KIND} || ':' || ${FAKE_IP}))`;
          await tx.$executeRaw`SELECT pg_sleep(${holdSeconds}::float8)`;
        },
        { maxWait: 10_000, timeout: (holdSeconds + 30) * 1000 },
      )
      .then(
        () => 'ok',
        (e: unknown) => e,
      );
    await waitUntilLockHeld();

    const ctx = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { 'x-forwarded-for': FAKE_IP },
    });
    const page = await ctx.newPage();

    // Đúng mật khẩu nhưng hệ thống lỗi.
    await fillLogin(page, EMAIL, E2E_LOCK_PASSWORD);
    await expect(page.getByText(vi('loginBusy.systemBusy'))).toBeVisible({ timeout: (holdSeconds + 30) * 1000 });
    await expect(page.getByText(vi('auth.invalidCredentials'))).toHaveCount(0);

    expect(await holder).toBe('ok');
    // Giao dịch giữ chỗ IP đã bị huỷ: không để lại dòng nào, không tính là 1 lượt sai.
    expect(await prisma.authThrottle.count({ where: { kind: KIND, key: FAKE_IP } })).toBe(0);

    // Hết bận: đăng nhập lại đúng mật khẩu vào được.
    await fillLogin(page, EMAIL, E2E_LOCK_PASSWORD);
    await page.waitForURL('**/vi/overview**');
    await ctx.close();
  });
});
