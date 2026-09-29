import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // tệp import 10MB (IMPORT_MAX_BYTES) + phần đầu multipart; mặc định Next 14 là 1MB.
  experimental: { serverActions: { bodySizeLimit: '11mb' } },
  // P5 hạ tầng: Dockerfile chạy bản standalone (node server.js).
  output: 'standalone',
  // docs/csp-header-bao-mat.md mục 3: ẩn X-Powered-By.
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
