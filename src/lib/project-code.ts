import { addDaysIso, type IsoDate } from '@/lib/clock';
import type { ProjectAlias } from '@/server/repo/types';

/** G-3: quy tắc mã CT (alias hiện hành) - chữ, số và `. _ - /`, không khoảng trắng. */
export const PROJECT_CODE_MAX = 40;
export const PROJECT_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function normalizeProjectCode(s: string): string {
  return s.trim();
}

export function isValidProjectCode(s: string): boolean {
  const t = normalizeProjectCode(s);
  return t.length >= 1 && t.length <= PROJECT_CODE_MAX && PROJECT_CODE_RE.test(t);
}

export interface AliasChangePlan {
  closeId: number | null;
  closeTo: IsoDate | null;
  retypeId: number | null;
  insertOld: Omit<ProjectAlias, 'id'> | null;
  insertNew: Omit<ProjectAlias, 'id'> | null;
}

/**
 * Dựng kế hoạch đổi mã CT (G-3): đóng dòng alias đang mở, mở dòng mới từ ngày mai; đổi lần 2
 * trong cùng ngày thì sửa lại dòng chờ chưa có hiệu lực thay vì đẻ thêm dòng.
 */
export function planAliasChange(a: {
  projectId: number;
  aliases: ProjectAlias[];
  oldCode: string;
  newCode: string;
  today: IsoDate;
  reason: string;
  by: string;
  projectCreatedAt: string;
}): AliasChangePlan {
  const open = a.aliases.find((x) => x.effectiveTo == null) ?? null;
  const tomorrow = addDaysIso(a.today, 1);

  // 1) Đổi lần hai trong cùng ngày: dòng mở sẵn chưa có hiệu lực -> sửa mã của chính dòng đó.
  if (open && open.effectiveFrom.slice(0, 10) > a.today) {
    return { closeId: null, closeTo: null, retypeId: open.id, insertOld: null, insertNew: null };
  }

  const insertNew: Omit<ProjectAlias, 'id'> = {
    projectId: a.projectId,
    aliasCode: a.newCode,
    aliasType: 'Ma_CT',
    effectiveFrom: tomorrow,
    effectiveTo: null,
    reason: a.reason,
    approvedBy: a.by,
  };

  // 2) Có dòng đang mở: đóng lại hôm nay, mở dòng mới từ mai.
  if (open) {
    return { closeId: open.id, closeTo: a.today, retypeId: null, insertOld: null, insertNew };
  }

  // 3) Chưa có dòng alias nào đang mở: chèn dòng mã cũ (đã đóng) + dòng mã mới.
  const createdDate = a.projectCreatedAt.slice(0, 10);
  const insertOld: Omit<ProjectAlias, 'id'> = {
    projectId: a.projectId,
    aliasCode: a.oldCode,
    aliasType: 'Ma_CT',
    effectiveFrom: createdDate < a.today ? createdDate : a.today,
    effectiveTo: a.today,
    reason: 'Mã trước khi đổi',
    approvedBy: a.by,
  };
  return { closeId: null, closeTo: null, retypeId: null, insertOld, insertNew };
}
