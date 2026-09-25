import { defineConfig, devices } from '@playwright/test';

/**
 * Task 9 (P3B) - e2e luong chinh. Chay tuan tu (1 worker) tren cong 3001 + DB
 * ddc_control_tower_b (globalSetup kiem chac chan, xem e2e/global-setup.ts). KHONG chung
 * `npm test` (vitest.config.ts include chi src/**).
 */
export default defineConfig({
  testDir: 'e2e',
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
