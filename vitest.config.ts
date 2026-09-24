import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Ghim đồng hồ: giữ nguyên mốc REPORT_DATE cũ để test cũ không lệch ngày.
    env: { DDC_FAKE_TODAY: '2026-09-16', NEXTAUTH_SECRET: 'test-secret' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
