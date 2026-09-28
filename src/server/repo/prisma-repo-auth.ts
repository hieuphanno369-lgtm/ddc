import { prisma } from '@/server/db';
import { Prisma } from '@prisma/client';
import type { AuthAccountState, AuthStore, Role } from './types';

/** Date | null → ISO string | null (khớp `prisma-repo.ts`). */
const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

interface UserRoleAuthRow {
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  canViewFinance: boolean;
  isActive: boolean;
  failedLoginCount: number | null;
  lockedAt: Date | null;
  passwordChangedAt: Date | null;
}

function toAccountState(u: UserRoleAuthRow): AuthAccountState {
  return {
    email: u.email,
    name: u.name,
    passwordHash: u.passwordHash,
    role: u.role as Role,
    canViewFinance: u.canViewFinance,
    isActive: u.isActive,
    failedLoginCount: u.failedLoginCount ?? 0,
    lockedAt: iso(u.lockedAt),
    passwordChangedAt: iso(u.passwordChangedAt),
  };
}

/**
 * P3E (Task 5) - `AuthStore` bằng Prisma thật (khớp hợp đồng + JSDoc trong `types.ts`, các hằng
 * "PHẢI NGUYÊN TỬ" ở đó áp dụng cho toàn bộ hàm dưới đây). `email` do bên gọi đã chuẩn hoá
 * (`trim().toLowerCase()`), KHÔNG lowercase lại ở đây.
 */
export const prismaAuthStore: AuthStore = {
  async getAccountState(email) {
    const u = await prisma.userRole.findUnique({ where: { email } });
    if (!u) return null;
    return toAccountState(u);
  },

  async registerFailedLogin(email, threshold, nowIso) {
    let updated: { failedLoginCount: number };
    try {
      updated = await prisma.userRole.update({
        where: { email },
        data: { failedLoginCount: { increment: 1 } },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return null;
      throw e;
    }
    const count = updated.failedLoginCount;
    const locked = count >= threshold;
    let justLocked = false;
    if (locked) {
      // Khoá bằng điều kiện `lockedAt IS NULL` tại thời điểm ghi (không dựa vào giá trị đọc trước
      // đó): `count === 1` nghĩa là lời gọi NÀY vừa chuyển lockedAt từ null sang khoá (thắng cuộc);
      // `count === 0` nghĩa là 1 lời gọi khác đã khoá xong trước (tài khoản vẫn đang khoá, chỉ không
      // phải lời gọi này khoá nó).
      const lockResult = await prisma.userRole.updateMany({
        where: { email, lockedAt: null },
        data: { lockedAt: new Date(nowIso) },
      });
      justLocked = lockResult.count === 1;
    }
    return { count, locked, justLocked };
  },

  async resetFailedLogin(email) {
    // L3 - nguyên tử: chỉ đặt về 0 khi CHƯA khoá tại thời điểm ghi.
    const result = await prisma.userRole.updateMany({
      where: { email, lockedAt: null },
      data: { failedLoginCount: 0 },
    });
    return result.count === 1;
  },

  async unlockAccount(email) {
    const result = await prisma.userRole.updateMany({
      where: { email },
      data: { failedLoginCount: 0, lockedAt: null },
    });
    return result.count > 0;
  },

  async setPassword(email, passwordHash, bumpChangedAt, nowIso) {
    const now = new Date(nowIso);
    return prisma.$transaction(async (tx) => {
      const result = await tx.userRole.updateMany({
        where: { email },
        data: { passwordHash, ...(bumpChangedAt ? { passwordChangedAt: now } : {}) },
      });
      // S-2 - huỷ mọi token đặt lại còn dùng được của email này (dù bumpChangedAt hay không): mật khẩu
      // đã đổi qua đường khác thì link đặt lại cũ không còn lý do để dùng.
      await tx.passwordResetToken.updateMany({ where: { email, usedAt: null }, data: { usedAt: now } });
      return result.count > 0;
    });
  },

  // R3-1 (bao-mat.md vòng 3, Trung) - compare-and-swap: chỉ `updateMany` khi `passwordHash` hiện tại
  // trong DB khớp `oldHash` (điều kiện `where`); `count === 0` nghĩa là ai đó đã ghi đè xen giữa lúc
  // verify và lúc gọi hàm này - KHÔNG ghi, KHÔNG huỷ token (giữ nguyên trạng thái của lần ghi đã thắng).
  // R4-4 (bao-mat.md vòng 4, Thấp) - THÊM `isActive: true, lockedAt: null` vào `where`: tài khoản bị
  // TẮT hoặc bị KHOÁ xen giữa lúc verify và lúc ghi (vd admin thao tác đồng thời) cũng phải làm CAS
  // thua (count 0), không cho đổi mật khẩu "chui" qua đường tự đổi trong Cài đặt.
  async setPasswordIfHash(email, oldHash, newHash, nowIso) {
    const now = new Date(nowIso);
    return prisma.$transaction(async (tx) => {
      const result = await tx.userRole.updateMany({
        where: { email, passwordHash: oldHash, isActive: true, lockedAt: null },
        data: { passwordHash: newHash, passwordChangedAt: now },
      });
      if (result.count === 0) return false;
      await tx.passwordResetToken.updateMany({ where: { email, usedAt: null }, data: { usedAt: now } });
      return true;
    });
  },

  // R4-1a (bao-mat.md vòng 4, Trung, chốt chủ dự án 2026-09-28) - thu hồi mọi phiên: bump
  // `passwordChangedAt`, KHÔNG đổi `passwordHash`.
  // R5-6 (bao-mat.md vòng 5, Thấp) - KHÔNG kéo lùi: chỉ ghi khi chưa có `passwordChangedAt` hoặc mốc
  // hiện tại CŨ HƠN `nowIso` (kiểu "GREATEST" bằng `where`, không ghi đè vô điều kiện). `count === 0`
  // do đã có mốc MỚI HƠN (1 thao tác khác nhanh hơn vừa ghi) vẫn coi là "đã có hiệu lực" -> `true`,
  // chỉ khi tài khoản không còn tồn tại mới trả `false`.
  async revokeSessions(email, nowIso) {
    const now = new Date(nowIso);
    const result = await prisma.userRole.updateMany({
      where: { email, OR: [{ passwordChangedAt: null }, { passwordChangedAt: { lt: now } }] },
      data: { passwordChangedAt: now },
    });
    if (result.count > 0) return true;
    const exists = await prisma.userRole.findUnique({ where: { email }, select: { email: true } });
    return exists !== null;
  },

  // Xem JSDoc `AuthStore.reserveAccountGuess` (types.ts): advisory lock theo `account_guess:email`, đọc
  // `failedLoginCount`/`lockedAt` TƯƠI và đếm chỗ đang giữ trong CÙNG giao dịch. Kind cố định, dùng
  // chung cho Đăng nhập và Đổi mật khẩu (R6-1).
  async reserveAccountGuess(email, nowIso, sinceIso, threshold) {
    const kind = 'account_guess';
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${kind} || ':' || ${email}))`;
      const account = await tx.userRole.findUnique({ where: { email }, select: { failedLoginCount: true, lockedAt: true } });
      if (!account || account.lockedAt !== null) return null;
      const held = await tx.authThrottle.count({ where: { kind, key: email, createdAt: { gte: new Date(sinceIso) } } });
      if ((account.failedLoginCount ?? 0) + held >= threshold) return null;
      const created = await tx.authThrottle.create({ data: { kind, key: email, createdAt: new Date(nowIso) } });
      return created.id;
    });
  },

  async recordThrottle(kind, key, nowIso) {
    await prisma.authThrottle.create({ data: { kind, key, createdAt: new Date(nowIso) } });
  },

  async countThrottle(kind, key, sinceIso) {
    return prisma.authThrottle.count({ where: { kind, key, createdAt: { gte: new Date(sinceIso) } } });
  },

  async reserveThrottle(kind, key, nowIso, sinceIso, limit) {
    // N2 - BẮT BUỘC transaction có `pg_advisory_xact_lock(hashtext(kind:key))` MỞ ĐẦU, rồi mọi câu
    // lệnh sau đó dùng qua `tx` - khoá đúng cặp kind:key, tự nhả khi transaction kết thúc, không
    // chặn các kind:key khác; xem JSDoc `AuthStore.reserveThrottle` (types.ts) vì sao 1 câu SQL đơn
    // thuần ở READ COMMITTED không đủ (2 giao dịch song song vẫn thấy số đếm cũ trước khi COMMIT).
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${kind} || ':' || ${key}))`;
      const count = await tx.authThrottle.count({ where: { kind, key, createdAt: { gte: new Date(sinceIso) } } });
      if (count >= limit) return null;
      const created = await tx.authThrottle.create({ data: { kind, key, createdAt: new Date(nowIso) } });
      return created.id;
    });
  },

  async releaseThrottle(id) {
    // N2 - xoá theo `id` (khoá chính), KHÔNG dùng `delete` (ném P2025 nếu dòng đã bị `pruneAuthData`
    // dọn trước đó) và KHÔNG lọc theo kind/key/createdAt (2 dòng có thể trùng mili giây).
    await prisma.authThrottle.deleteMany({ where: { id } });
  },

  async replaceResetToken(email, tokenHash, expiresAtIso, requestIp) {
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { email } });
      await tx.passwordResetToken.create({
        data: { email, tokenHash, expiresAt: new Date(expiresAtIso), requestIp },
      });
    });
  },

  async peekResetToken(tokenHash, nowIso) {
    const t = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!t || t.usedAt !== null || t.expiresAt.getTime() <= new Date(nowIso).getTime()) return false;
    if (!t.user.isActive || t.user.passwordHash === '') return false;
    return true;
  },

  async consumeResetToken(tokenHash, passwordHash, nowIso) {
    return prisma.$transaction(async (tx) => {
      const now = new Date(nowIso);
      // K4 - "đặt cửa" NGUYÊN TỬ: điều kiện `where` gộp CẢ token (còn hạn, chưa dùng) LẪN tài khoản
      // (L5 - `isActive`/`passwordHash !== ''` qua quan hệ `user`, kiểm TẠI THỜI ĐIỂM TIÊU chứ không
      // chỉ lúc `peek`) - 2 request đồng thời chỉ 1 cái thắng; tài khoản không hợp lệ thì `count`
      // luôn là 0, token KHÔNG bị đốt (giữ đúng hành vi kho bộ nhớ: không đổi `usedAt` khi trả `ok: false`).
      const updated = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
          user: { isActive: true, passwordHash: { not: '' } },
        },
        data: { usedAt: now },
      });
      if (updated.count === 0) return { ok: false as const };

      const token = await tx.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
      /* c8 ignore next */
      if (!token) return { ok: false as const };
      const account = token.user;
      const locked = account.lockedAt !== null;

      await tx.userRole.update({
        where: { email: account.email },
        data: {
          passwordHash,
          passwordChangedAt: now,
          ...(locked ? {} : { failedLoginCount: 0 }),
        },
      });
      // Vô hiệu mọi token khác còn dùng được của email (kể cả chính token vừa dùng - đã set usedAt ở trên).
      await tx.passwordResetToken.updateMany({ where: { email: account.email, usedAt: null }, data: { usedAt: now } });

      return { ok: true as const, email: account.email, name: account.name, locked };
    });
  },

  async pruneAuthData(beforeIso) {
    const before = new Date(beforeIso);
    await prisma.authThrottle.deleteMany({ where: { createdAt: { lt: before } } });
    await prisma.passwordResetToken.deleteMany({ where: { createdAt: { lt: before } } });
  },
};
