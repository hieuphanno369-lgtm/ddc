/**
 * Barrel - runtime dùng Prisma repo (async). Test import './mock-repo' trực tiếp
 * nên vẫn giữ mock-repo (sync) riêng, không đụng.
 */
import { repo as prismaRepo } from './prisma-repo';
import { readRepoPrisma } from './read-prisma';
import { notifyRepoPrisma } from './prisma-repo-notify';
import { backfillRepoPrisma } from './prisma-repo-backfill';

/** P2B: gộp read repo vào repo (mutate object gốc) - tầng trên chỉ import `repo` như cũ. */
/** P3B (Task 4): gộp thêm repo kênh/người nhận thông báo. */
/** P4 (F2): gộp thêm repo nhập bù lịch sử. */
export const repo = Object.assign(prismaRepo, readRepoPrisma, notifyRepoPrisma, backfillRepoPrisma);
export type * from './types';
export type * from './read-types';
