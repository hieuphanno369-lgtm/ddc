import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/lib/session';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { requireProjectRead } from './authz';

/**
 * B-4 (danh-gia.md, vòng 2) - BOLA/IDOR ở `/projects/[id]`: trước fix, MỌI user đã đăng nhập
 * (kể cả viewer/data-entry) đọc được chi tiết BẤT KỲ dự án nào chỉ bằng cách đổi số trên URL.
 * Task 8 vừa thêm biên chế nhân lực/thiết bị theo ngày của từng nhà thầu vào đúng trang này nên
 * rủi ro tăng thêm. Dữ liệu seed (`buildAssignments()`, history.ts) đã chuẩn bị sẵn cho việc
 * enforce quyền này từ trước: pm@ (data-entry) là PIC dự án {1,2,3,5,7,11}; viewer@ được gán
 * Backup ở dự án {1,2,4,6,8,10} - dự án 3 và 9 dùng để kiểm cả 2 nhánh "được gán"/"không được gán".
 */
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const PM_DATA_ENTRY: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

describe('requireProjectRead - B-4 (vòng 2, BOLA/IDOR)', () => {
  it('phải thất bại (oracle - chưa có guard nào khác chặn): gọi trực tiếp getProject(9) không qua requireProjectRead vẫn đọc được (chứng minh lỗ hổng nằm ở CHỖ GỌI, không phải ở tầng đọc dữ liệu)', async () => {
    const { repo } = await import('@/server/repo');
    expect(await repo.getProject(9)).toBeDefined();
  });

  it('admin -> xem MỌI dự án, kể cả dự án không ai gán (9)', async () => {
    await expect(requireProjectRead(ADMIN, 9)).resolves.toBeUndefined();
    await expect(requireProjectRead(ADMIN, 1)).resolves.toBeUndefined();
  });

  it('bod -> xem MỌI dự án, kể cả dự án không ai gán (9)', async () => {
    await expect(requireProjectRead(BOD, 9)).resolves.toBeUndefined();
  });

  it('data-entry (pm@) -> xem được dự án mình là PIC (1, 3)', async () => {
    await expect(requireProjectRead(PM_DATA_ENTRY, 1)).resolves.toBeUndefined();
    await expect(requireProjectRead(PM_DATA_ENTRY, 3)).resolves.toBeUndefined();
  });

  it('data-entry (pm@) -> BỊ CHẶN ở dự án mình không phải PIC (9)', async () => {
    await expect(requireProjectRead(PM_DATA_ENTRY, 9)).rejects.toThrow('NOT_FOUND');
  });

  it('viewer -> xem được dự án mình được gán Backup (1, 4)', async () => {
    await expect(requireProjectRead(VIEWER, 1)).resolves.toBeUndefined();
    await expect(requireProjectRead(VIEWER, 4)).resolves.toBeUndefined();
  });

  it('viewer -> BỊ CHẶN ở dự án mình KHÔNG được gán (3 - chỉ pm@ là PIC, viewer không có Backup)', async () => {
    await expect(requireProjectRead(VIEWER, 3)).rejects.toThrow('NOT_FOUND');
  });

  it('viewer -> BỊ CHẶN ở dự án không ai gán viewer (9)', async () => {
    await expect(requireProjectRead(VIEWER, 9)).rejects.toThrow('NOT_FOUND');
  });

  it('chưa đăng nhập (user=null) -> BỊ CHẶN ở mọi dự án', async () => {
    await expect(requireProjectRead(null, 1)).rejects.toThrow('NOT_FOUND');
  });
});
