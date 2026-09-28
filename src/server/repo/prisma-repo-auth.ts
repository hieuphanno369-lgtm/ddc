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
      // S-2 (bao-mat.md vong 4) - huy moi token dat lai con dung duoc cua email nay (du bumpChangedAt
      // hay khong): mat khau da doi qua duong khac thi 1 link dat lai cu con lai khong con ly do de dung.
      await tx.passwordResetToken.updateMany({ where: { email, usedAt: null }, data: { usedAt: now } });
      return result.count > 0;
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
