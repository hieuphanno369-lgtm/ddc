import { defineConfig, devices } from '@playwright/test';
import { loadE2eEnv, resolveE2eTarget } from './e2e/helpers/env';

/**
 * Task 9 (P3B) - e2e luong chinh. Chay tuan tu (1 worker) tren cong + DB lay tu .env, chi cap
 * trong E2E_TARGETS (e2e/helpers/env.ts) (globalSetup kiem lai lan 2, xem e2e/global-setup.ts).
 * L-5 (danh-gia-bao-mat.md): vitest.config.ts nay co them 'e2e/**\/*.test.ts' de unit-test cac ham
 * thuan trong e2e/helpers/*.ts qua `npm test` - testMatch '**\/*.spec.ts' o day de Playwright CHI
 * chay cac spec (.spec.ts), khong dam vao .test.ts cua vitest (2 test runner khac nhau, khong
 * chung file). `auth.setup.ts`/`global-setup.ts` khong khop ca 2 pattern nen khong bi anh huong.
 */
// .env thang bien shell, tru E2E_DATABASE_URL/E2E_NEXTAUTH_URL (script test:e2e:a). Sai cap DB + cong -> throw ngay.
const target = resolveE2eTarget(loadE2eEnv());

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // May e2e dung chung voi nhieu dev server (3 tai khoan): dang nhap co luc cham hon 5s mac dinh cua expect.
  expect: { timeout: 15_000 },
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: target.baseURL,
    locale: 'vi-VN',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx next dev -p ${target.port}`,
    url: `${target.baseURL}/vi/login`,
    // A (cong rieng 3010) khong bam server co san (N-P7-1): cong ban -> Playwright bao loi, khong chay spec.
    reuseExistingServer: target.reuseServer,
    timeout: 180_000,
    // DIRECT_URL cung tro DB e2e: .env cua moi ben tro DB that, lenh Prisma nao doc directUrl cung khong cham duoc DB that.
    env: { NEXTAUTH_URL: target.baseURL, DATABASE_URL: target.databaseUrl, DIRECT_URL: target.databaseUrl },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ },
  ],
});
