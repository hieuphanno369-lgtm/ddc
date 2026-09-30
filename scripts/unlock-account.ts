/**
 * P3E (Task 6) - lệnh server mở khoá tài khoản bị khoá do sai mật khẩu 5 lần liên tiếp (dùng khi
 * chính admin bị khoá, không vào được UI để bấm nút). Chạy trên máy chủ, không qua HTTP.
 * Usage: npm run unlock-account -- <email>
 */
import { prisma } from '@/server/db';
import { prismaAuthStore } from '@/server/repo/prisma-repo-auth';
import { unlockAccountCli } from '@/server/unlock-account-cli';

async function log(email: string): Promise<void> {
  await prisma.activityLog.create({
    data: { userEmail: email, userName: 'server-cli', action: 'account_unlock_cli', detail: '', ip: '', userAgent: 'cli' },
  });
}

async function main() {
  const rawEmail = process.argv[2] ?? '';
  const { code, message } = await unlockAccountCli(prismaAuthStore, rawEmail, log);
  console.log(message);
  // `process.exit` chạy NGAY, không chờ `.finally()` phía ngoài - phải `$disconnect` TRƯỚC khi exit.
  await prisma.$disconnect();
  process.exit(code);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
