import { prisma } from '@/server/db';
import { Prisma } from '@prisma/client';
import {
  normalizeDepartmentName,
  type ApproveResult,
  type DepartmentRow,
  type SignupRequestRow,
  type SignupStore,
} from './signup-types';

/** Ném ra từ trong giao dịch để hoàn tác khi email đã có tài khoản (P2002 ở `userRole.create`). */
class DuplicateAccountError extends Error {}

const isKnown = (e: unknown, code: string) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;

/**
 * P3F-3 (Task 5) - `SignupStore` bằng Prisma thật (khớp hợp đồng trong `signup-types.ts` và bộ ca
 * `signup-store-contract.ts`). `email` do bên gọi đã chuẩn hoá (`trim().toLowerCase()`).
 */
export const prismaSignupStore: SignupStore = {
  async listDepartments() {
    const rows = await prisma.department.findMany({
      include: { _count: { select: { users: true, signupRequests: true } } },
    });
    const out: DepartmentRow[] = rows.map((d) => ({
      id: d.id,
      name: d.name,
      isActive: d.isActive,
      userCount: d._count.users,
      pendingCount: d._count.signupRequests,
    }));
    return out.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  },

  async listActiveDepartments() {
    const rows = await prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  },

  async isActiveDepartment(id) {
    return (await prisma.department.count({ where: { id, isActive: true } })) > 0;
  },

  async saveDepartment(input, by) {
    const name = normalizeDepartmentName(input.name);
    const clash = await prisma.department.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(input.id !== undefined ? { NOT: { id: input.id } } : {}),
      },
      select: { id: true },
    });
    if (clash) return 'duplicate_name';
    try {
      if (input.id === undefined) {
        const created = await prisma.department.create({ data: { name, updatedBy: by } });
        return { id: created.id, name: created.name };
      }
      const updated = await prisma.department.update({ where: { id: input.id }, data: { name, updatedBy: by } });
      return { id: updated.id, name: updated.name };
    } catch (e) {
      if (isKnown(e, 'P2002')) return 'duplicate_name';
      if (isKnown(e, 'P2025')) return 'not_found';
      throw e;
    }
  },

  async setDepartmentActive(id, isActive, by) {
    const result = await prisma.department.updateMany({ where: { id }, data: { isActive, updatedBy: by } });
    return result.count > 0;
  },

  async deleteDepartment(id) {
    return prisma.$transaction(async (tx) => {
      const exists = await tx.department.count({ where: { id } });
      if (exists === 0) return 'not_found' as const;
      const inUse = (await tx.userRole.count({ where: { departmentId: id } })) + (await tx.signupRequest.count({ where: { departmentId: id } }));
      if (inUse > 0) return { inUse };
      await tx.department.delete({ where: { id } });
      return 'ok' as const;
    });
  },

  async emailTaken(email) {
    const [user, pending] = await Promise.all([
      prisma.userRole.count({ where: { email } }),
      prisma.signupRequest.count({ where: { email } }),
    ]);
    return user > 0 || pending > 0;
  },

  async createRequest(row) {
    try {
      await prisma.signupRequest.create({
        data: {
          email: row.email,
          name: row.name,
          departmentId: row.departmentId,
          passwordHash: row.passwordHash,
          locale: row.locale,
          requestIp: row.requestIp,
          createdAt: new Date(row.createdAtIso),
        },
      });
      return 'created';
    } catch (e) {
      if (isKnown(e, 'P2002')) return 'duplicate';
      throw e;
    }
  },

  async listPending() {
    const rows = await prisma.signupRequest.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { department: { select: { name: true } } },
    });
    const out: SignupRequestRow[] = rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      departmentId: r.departmentId,
      departmentName: r.department?.name ?? null,
      locale: r.locale === 'en' ? 'en' : 'vi',
      createdAt: r.createdAt.toISOString(),
    }));
    return out;
  },

  async countPending() {
    return prisma.signupRequest.count();
  },

  async approveRequest(id, input): Promise<ApproveResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Xoá đăng ký TRƯỚC (P2025 nếu người khác vừa xử lý): 2 admin bật cùng lúc chỉ 1 người thắng.
        const req = await tx.signupRequest.delete({ where: { id } });
        try {
          await tx.userRole.create({
            data: {
              email: req.email,
              name: req.name,
              passwordHash: req.passwordHash,
              role: input.role,
              canViewFinance: input.canViewFinance,
              isActive: true,
              departmentId: req.departmentId,
            },
          });
        } catch (e) {
          // Ném ra ngoài để giao dịch hoàn tác (đăng ký VẪN còn) rồi bắt ở dưới.
          if (isKnown(e, 'P2002')) throw new DuplicateAccountError();
          throw e;
        }
        return { email: req.email, name: req.name, locale: req.locale === 'en' ? ('en' as const) : ('vi' as const) };
      });
    } catch (e) {
      if (e instanceof DuplicateAccountError) return 'duplicate_account';
      if (isKnown(e, 'P2025')) return 'not_found';
      throw e;
    }
  },

  async rejectRequest(id) {
    try {
      const req = await prisma.signupRequest.delete({ where: { id } });
      return { email: req.email };
    } catch (e) {
      if (isKnown(e, 'P2025')) return 'not_found';
      throw e;
    }
  },
};
