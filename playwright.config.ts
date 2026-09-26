import { defineConfig, devices } from '@playwright/test';
import { loadDotEnv, resolveE2eTarget } from './e2e/helpers/env';

/**
 * Task 9 (P3B) - e2e luong chinh. Chay tuan tu (1 worker) tren cong + DB lay tu .env, chi cap
 * trong E2E_TARGETS (e2e/helpers/env.ts) (globalSetup kiem lai lan 2, xem e2e/global-setup.ts).
 * L-5 (danh-gia-bao-mat.md): vitest.config.ts nay co them 'e2e/**\/*.test.ts' de unit-test cac ham
 * thuan trong e2e/helpers/*.ts qua `npm test` - testMatch '**\/*.spec.ts' o day de Playwright CHI
 * chay cac spec (.spec.ts), khong dam vao .test.ts cua vitest (2 test runner khac nhau, khong
 * chung file). `auth.setup.ts`/`global-setup.ts` khong khop ca 2 pattern nen khong bi anh huong.
 */
// .env thang bien shell (giong global-setup.ts). Sai cap DB + cong -> throw ngay, webServer khong khoi dong.
const target = resolveE2eTarget({ ...process.env, ...loadDotEnv() });

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
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
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NEXTAUTH_URL: target.baseURL, DATABASE_URL: target.databaseUrl },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ },
  ],
});
