import type { ProjectSummary } from '@/server/queries';

/** ProjectSummary an toàn để đưa cho client: 3 trường tiền có thể là null (đã che). */
export type SafeProjectSummary = Omit<ProjectSummary, 'contractValue' | 'eac' | 'vac'> & {
  contractValue: number | null;
  eac: number | null;
  vac: number | null;
};

/** N-3: che 3 trường tiền của 1 dự án cho người không có quyền tài chính. */
export function maskProjectSummary(s: ProjectSummary, canViewFinance: boolean): SafeProjectSummary {
  if (canViewFinance) return { ...s };
  return { ...s, contractValue: null, eac: null, vac: null };
}

export function maskProjectSummaries(list: ProjectSummary[], canViewFinance: boolean): SafeProjectSummary[] {
  return list.map((s) => maskProjectSummary(s, canViewFinance));
}

export interface GroupValueRow {
  key: string;
  tonnage: number;
  value: number;
}

/** N-3: che cột "Trị" của chart nhóm (Lượng & Trị) cho người không có quyền tài chính. */
export function maskGroupRows(
  rows: GroupValueRow[],
  canViewFinance: boolean,
): Array<{ key: string; tonnage: number; value: number | null }> {
  return rows.map((r) => ({ key: r.key, tonnage: r.tonnage, value: canViewFinance ? r.value : null }));
}

export type ListSort = 'priority' | 'name' | 'value' | 'spi' | 'pctActual';

/** N-3: người không có quyền tài chính không được sắp xếp theo "Giá trị" (rò rỉ gián tiếp - K2). */
export function safeListSort(sort: ListSort, canViewFinance: boolean): ListSort {
  return sort === 'value' && !canViewFinance ? 'priority' : sort;
}

/** Luật cảnh báo có số tiền trong message (R5 công nợ quá hạn). */
export function isMoneyAlert(a: { ruleCode: string | null; ruleTriggered: string }): boolean {
  if (a.ruleCode === 'ar_overdue') return true;
  return a.ruleCode == null && a.ruleTriggered.startsWith('Công nợ quá hạn');
}

/** N-3 (Q4=a): che message của cảnh báo có số tiền cho người không có quyền tài chính. */
export function maskAlertMessage<T extends { ruleCode: string | null; ruleTriggered: string; message: string }>(
  a: T,
  canViewFinance: boolean,
  hiddenText: string,
): T {
  if (isMoneyAlert(a) && !canViewFinance) return { ...a, message: hiddenText };
  return a;
}
