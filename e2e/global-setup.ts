import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { loadDotEnv, resolveE2eTarget } from './helpers/env';

/**
 * Task 9 (P3B) - chạy 1 lần trước mọi spec: nạp `.env`, khẳng định chắc chắn đang trỏ vào
 * cap DB + cong da dang ky trong E2E_TARGETS, KHONG BAO GIO DB cua A (dữ liệu thật), seed lại
 * (dữ liệu lặp lại được), dọn kênh thông báo `E2E ...` còn sót từ lần chạy trước.
 */
export default async function globalSetup(): Promise<void> {
  const env = loadDotEnv();
  Object.assign(process.env, env);

  const { databaseUrl } = resolveE2eTarget(process.env);
  if (!process.env.NOTIFY_SECRET_KEY) {
    throw new Error('Thieu NOTIFY_SECRET_KEY trong .env - can de luu kenh thong bao trong test 07-admin.spec.ts.');
  }

  execSync('npx prisma db seed', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl } });

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await prisma.notifyChannel.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
  } finally {
    await prisma.$disconnect();
  }
}
