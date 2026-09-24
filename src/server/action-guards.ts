import { getCurrentUser, type CurrentUser } from '@/lib/session';
import { canWriteProject } from './authz';
import type { Role } from './repo/types';

/** Chan write theo role - khuon `requireRole` o actions.ts:18-22. */
export async function requireRoleUser(allowed: Role[]): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || !allowed.includes(user.role)) return null;
  return user;
}

/** Chan write 1 du an - dung lai luat `canWriteProject` (src/server/authz.ts). */
export async function requireWriteProject(projectId: number): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!(await canWriteProject(user, projectId))) return null;
  return user;
}
