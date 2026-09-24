import { notFound } from 'next/navigation';
import type { CurrentUser } from '@/lib/session';
import { repo } from './repo';

/**
 * Quyền ĐỌC chi tiết 1 dự án (B-4, danh-gia.md vòng 2 - BOLA/IDOR, rủi ro lớn nhất trước
 * go-live: Task 8 vừa thêm biên chế nhân lực/thiết bị theo ngày của từng nhà thầu vào đúng
 * trang đang dính).
 *
 * admin/bod xem MỌI dự án (vai trò lãnh đạo/vận hành cần nhìn toàn portfolio).
 * data-entry/viewer CHỈ xem dự án mình có trong `project_assignments` - seed đã chuẩn bị sẵn
 * cho việc này từ trước (`buildAssignments()` trong `src/data/seed/history.ts` gán Backup cho
 * viewer@ đúng những dự án viewer được xem, kèm ghi chú "được gán Backup để có quyền đọc"),
 * chỉ là hàm enforce (chính hàm này) chưa từng được viết - đây là phần "authz.ts" mà bản kế
 * hoạch Run 1 đã liệt kê trong "Bản đồ file" nhưng chưa Task nào triển khai.
 *
 * Không tìm thấy quyền -> notFound() (KHÔNG phân biệt "dự án không tồn tại" với "có tồn tại
 * nhưng không có quyền" bằng 2 thông điệp khác nhau, tránh lộ qua brute-force id xem dự án nào
 * tồn tại).
 */
export async function requireProjectRead(user: CurrentUser | null, projectId: number): Promise<void> {
  if (!user) notFound();
  if (user.role === 'admin' || user.role === 'bod') return;
  const assigned = await repo.getAssignmentsForUser(user.email);
  if (assigned.includes(projectId)) return;
  notFound();
}

/** Quyền GHI 1 dự án - cùng luật requireProject trong actions.ts: admin, hoặc data-entry có trong project_assignments. */
export async function canWriteProject(user: CurrentUser | null, projectId: number): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'data-entry' && (await repo.getAssignmentsForUser(user.email)).includes(projectId)) return true;
  return false;
}
