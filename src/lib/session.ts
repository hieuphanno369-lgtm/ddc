import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import type { Role } from '@/server/repo/types';

export interface CurrentUser {
  name: string;
  email: string;
  role: Role;
  canViewFinance: boolean;
}

/**
 * Lấy user hiện tại từ session next-auth (Google hoặc credentials).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (email) {
    return {
      name: session.user.name ?? email,
      email,
      role: ((session.user as { role?: Role }).role as Role) ?? 'viewer',
      canViewFinance: (session.user as { canViewFinance?: boolean }).canViewFinance ?? false,
    };
  }
  return null;
}

/** Home route theo role. */
export function homeForRole(role: Role): string {
  return role === 'data-entry' ? '/nhap-lieu' : '/overview';
}
