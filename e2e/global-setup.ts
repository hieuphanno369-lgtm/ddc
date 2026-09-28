import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import { E2E_LOCK_PASSWORD, loadE2eEnv, resolveE2eTarget } from './helpers/env';

/**
 * Task 9 (P3B) - chạy 1 lần trước mọi spec: nạp `.env`, khẳng định chắc chắn đang trỏ vào
 * cap DB + cong da dang ky trong E2E_TARGETS, KHONG BAO GIO DB cua A (dữ liệu thật), seed lại
 * (dữ liệu lặp lại được), dọn kênh thông báo `E2E ...` còn sót từ lần chạy trước.
 */
export default async function globalSetup(): Promise<void> {
  Object.assign(process.env, loadE2eEnv());

  const { databaseUrl } = resolveE2eTarget(process.env);
  if (!process.env.NOTIFY_SECRET_KEY) {
    throw new Error('Thieu NOTIFY_SECRET_KEY trong .env - can de luu kenh thong bao trong test 07-admin.spec.ts.');
  }

  // DIRECT_URL cung tro DB e2e (bao mat T-1): neu sau nay doi sang lenh doc directUrl (migrate reset, db push) van khong cham DB that.
  execSync('npx prisma db seed', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl } });

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await prisma.notifyChannel.deleteMany({ where: { name: { startsWith: 'E2E ' } } });

    // Task 6/7 (P3E) - 2 tài khoản viewer riêng cho spec khoá tài khoản + quên mật khẩu, tạo lại mỗi
    // lần chạy (upsert - đảm bảo lockedAt/failedLoginCount về trạng thái sạch giữa các lần chạy).
    // Vòng sửa bảo mật 4 (S-2) - thêm `e2e-doimk@daidung.com.vn` cho spec tự đổi mật khẩu (giữ
    // phiên hiện tại, đăng xuất phiên khác) - cùng mật khẩu để dùng lại hằng số có sẵn.
    // Tester, vòng sau sửa bảo mật (R2-1, bao-mat.md vòng 2) - thêm `e2e-r21@daidung.com.vn` riêng
    // cho spec 24 (tái hiện kịch bản khai thác phiên "hồi sinh" qua POST /api/auth/session), tách
    // khỏi `e2e-doimk` vì spec 24 đổi mật khẩu nhiều lần trong cùng file, không nên chung tài khoản
    // với spec 23 (thứ tự chạy giữa 2 file .spec.ts không đảm bảo mật khẩu hiện tại là gì).
    const passwordHash = await hashPassword(E2E_LOCK_PASSWORD);
    for (const email of [
      'e2e-khoa@daidung.com.vn',
      'e2e-quenmk@daidung.com.vn',
      'e2e-doimk@daidung.com.vn',
      'e2e-r21@daidung.com.vn',
    ]) {
      await prisma.userRole.upsert({
        where: { email },
        update: { passwordHash, isActive: true, lockedAt: null, failedLoginCount: 0 },
        create: { email, name: email, passwordHash, role: 'viewer', canViewFinance: false, isActive: true },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
