import { headers } from 'next/headers';
import { repo } from '@/server/repo';
import { clientIpFrom } from '@/lib/client-ip';

/**
 * R7 (bao-mat.md vòng 2) - giới hạn độ dài TRƯỚC khi ghi `activity_log`: dữ liệu đầu vào (nhất là
 * `name`/`email` ở nhánh Google chưa xác minh, `detail` do các nhánh khác tự ghép chuỗi) không đáng
 * tin tuyệt đối, cắt cho chắc thay vì phụ thuộc vào từng nơi gọi tự kiểm.
 */
const USER_EMAIL_MAX_LENGTH = 254;
const USER_NAME_MAX_LENGTH = 100;
const USER_AGENT_MAX_LENGTH = 256;
const DETAIL_MAX_LENGTH = 500;

/** Ghi 1 dòng activity (login + thao tác ghi). Retention 14 ngày xử lý ở repo. */
export async function logActivity(user: { name: string; email: string }, action: string, detail = '') {
  let ip = '';
  let userAgent = '';
  try {
    const h = await headers();
    // L2 - dùng chung `clientIpFrom` (TRUSTED_PROXY_HOPS, không còn tin phần tử đầu XFF).
    ip = clientIpFrom(h);
    userAgent = h.get('user-agent') ?? '';
  } catch {
    /* ignore - không phải request context */
  }
  await repo.logActivity({
    userEmail: user.email.slice(0, USER_EMAIL_MAX_LENGTH),
    userName: user.name.slice(0, USER_NAME_MAX_LENGTH),
    action,
    detail: detail.slice(0, DETAIL_MAX_LENGTH),
    ip,
    userAgent: userAgent.slice(0, USER_AGENT_MAX_LENGTH),
  });
}
