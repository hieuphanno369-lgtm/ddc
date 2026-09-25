import { defineConfig, devices } from '@playwright/test';

/**
 * Task 9 (P3B) - e2e luong chinh. Chay tuan tu (1 worker) tren cong 3001 + DB
 * ddc_control_tower_b (globalSetup kiem chac chan, xem e2e/global-setup.ts).
 * L-5 (danh-gia-bao-mat.md): vitest.config.ts nay co them 'e2e/**\/*.test.ts' de unit-test cac ham
 * thuan trong e2e/helpers/*.ts qua `npm test` - testMatch '**\/*.spec.ts' o day de Playwright CHI
 * chay cac spec (.spec.ts), khong dam vao .test.ts cua vitest (2 test runner khac nhau, khong
 * chung file). `auth.setup.ts`/`global-setup.ts` khong khop ca 2 pattern nen khong bi anh huong.
 */
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
    baseURL: 'http://localhost:3001',
    locale: 'vi-VN',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx next dev -p 3001',
    url: 'http://localhost:3001/vi/login',
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NEXTAUTH_URL: 'http://localhost:3001' },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ },
  ],
});
