import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // tệp import 10MB (IMPORT_MAX_BYTES) + phần đầu multipart; mặc định Next 14 là 1MB.
  experimental: { serverActions: { bodySizeLimit: '11mb' } },
};

export default withNextIntl(nextConfig);
