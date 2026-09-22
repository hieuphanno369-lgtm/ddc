/**
 * Barrel - runtime dùng Prisma repo (async). Test import './mock-repo' trực tiếp
 * nên vẫn giữ mock-repo (sync) riêng, không đụng.
 */
export { repo } from './prisma-repo';
export type * from './types';
