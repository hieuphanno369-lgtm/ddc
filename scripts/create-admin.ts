/**
 * P5-B (Task 7b) - lenh tao admin dau tien tren DB production moi tinh (chua co tai khoan nao).
 * Dung khi khong the dung `createAccountAction` (no bat `requireRole(['admin'])`, chua co admin
 * nao thi khong ai goi duoc). Usage: npm run create-admin -- <email> [ten]
 */
import { prisma } from '@/server/db';
import { repo } from '@/server/repo/prisma-repo';
import { hashPassword } from '@/lib/password';
import { createAdminCli, generateTempPassword } from '@/server/create-admin-cli';

async function log(email: string): Promise<void> {
  await prisma.activityLog.create({
    data: { userEmail: email, userName: 'server-cli', action: 'create_admin_cli', detail: '', ip: '', userAgent: 'cli' },
  });
}

async function main() {
  const rawEmail = process.argv[2] ?? '';
  const rawName = process.argv[3];
  const { code, message, tempPassword } = await createAdminCli(repo, rawEmail, rawName, {
    hash: hashPassword,
    genPassword: () => generateTempPassword(),
    now: () => new Date(),
    log,
  });
  console.log(message);
  if (tempPassword) {
    // Mat khau tam chi hien DUNG 1 LAN o day - khong dua qua logger, khong ghi file, khong ghi activityLog.
    console.log(`Mat khau tam (chi hien 1 lan, hay chep lai ngay): ${tempPassword}`);
    console.log('Dang nhap roi DOI MAT KHAU NGAY (menu tai khoan > Doi mat khau).');
  }
  // `process.exit` chay NGAY, khong cho `.finally()` phia ngoai - phai `$disconnect` TRUOC khi exit.
  await prisma.$disconnect();
  process.exit(code);
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.name : String(e));
  await prisma.$disconnect();
  process.exit(1);
});
