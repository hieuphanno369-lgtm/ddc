/**
 * Barrel - runtime dùng Prisma repo (async). Test import './mock-repo' trực tiếp
 * nên vẫn giữ mock-repo (sync) riêng, không đụng.
 */
import { repo as prismaRepo } from './prisma-repo';
import { readRepoPrisma } from './read-prisma';
import { notifyRepoPrisma } from './prisma-repo-notify';

/** P2B: gộp read repo vào repo (mutate object gốc) - tầng trên chỉ import `repo` như cũ. */
/** P3B (Task 4): gộp thêm repo kênh/người nhận thông báo. */
export const repo = Object.assign(prismaRepo, readRepoPrisma, notifyRepoPrisma);
export type * from './types';
export type * from './read-types';
