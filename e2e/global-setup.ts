import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { loadDotEnv } from './helpers/env';

/**
 * Task 9 (P3B) - chạy 1 lần trước mọi spec: nạp `.env`, khẳng định chắc chắn đang trỏ vào DB/cổng
 * của B (KHÔNG BAO GIỜ ghi nhầm DB của A), seed lại (dữ liệu lặp lại được), dọn kênh thông báo
 * `E2E ...` còn sót từ lần chạy trước.
 */
export default async function globalSetup(): Promise<void> {
  const env = loadDotEnv();
  Object.assign(process.env, env);

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.includes('/ddc_control_tower_b')) {
    throw new Error('DATABASE_URL khong tro vao ddc_control_tower_b - dung chay e2e (co the dinh DB cua A). Kiem tra .env.');
  }
  if (process.env.NEXTAUTH_URL !== 'http://localhost:3001') {
    throw new Error("NEXTAUTH_URL phai la 'http://localhost:3001' de dang nhap e2e khong bi chuyen sang cong 3000 - sua .env (Q8, ke-hoach.md P3B).");
  }
  if (!process.env.NOTIFY_SECRET_KEY) {
    throw new Error('Thieu NOTIFY_SECRET_KEY trong .env - can de luu kenh thong bao trong test 07-admin.spec.ts.');
  }

  execSync('npx prisma db seed', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: dbUrl } });

  const prisma = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    await prisma.notifyChannel.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
  } finally {
    await prisma.$disconnect();
  }
}
