/**
 * Barrel - runtime dùng Prisma repo (async). Test import './mock-repo' trực tiếp
 * nên vẫn giữ mock-repo (sync) riêng, không đụng.
 */
import { repo as prismaRepo } from './prisma-repo';
import { readRepoPrisma } from './read-prisma';

/** P2B: gộp read repo vào repo (mutate object gốc) - tầng trên chỉ import `repo` như cũ. */
export const repo = Object.assign(prismaRepo, readRepoPrisma);
export type * from './types';
export type * from './read-types';
