import { headers } from 'next/headers';
import { repo } from '@/server/repo';

/** Ghi 1 dòng activity (login + thao tác ghi). Retention 14 ngày xử lý ở repo. */
export async function logActivity(user: { name: string; email: string }, action: string, detail = '') {
  let ip = '';
  let userAgent = '';
  try {
    const h = await headers();
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    userAgent = h.get('user-agent') ?? '';
  } catch {
    /* ignore - không phải request context */
  }
  await repo.logActivity({ userEmail: user.email, userName: user.name, action, detail, ip, userAgent });
}
