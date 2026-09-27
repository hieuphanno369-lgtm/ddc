import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // L-5 (danh-gia-bao-mat.md): them e2e/**/*.test.ts de unit-test cac ham thuan trong
    // e2e/helpers/*.ts (vd isExpectedDbUrl) - khong khop *.spec.ts (Playwright specs) nen khong
    // dung `npm run test:e2e`.
    include: ['src/**/*.test.ts', 'e2e/**/*.test.ts'],
    // Ghim đồng hồ: giữ nguyên mốc REPORT_DATE cũ để test cũ không lệch ngày.
    env: { DDC_FAKE_TODAY: '2026-09-16', NEXTAUTH_SECRET: 'test-secret' },
    // next-intl 4 chỉ phát hành ESM: Vitest (CJS) không tự nạp được 'next/navigation' từ trong
    // node_modules/next-intl khi test import next-intl/navigation - inline để Vitest transform qua Vite.
    server: { deps: { inline: ['next-intl'] } },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
