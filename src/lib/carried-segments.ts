/**
 * Đoạn nét liền / nét đứt của chart theo tháng (P4, D-10): tháng nào có dự án dùng số tháng trước
 * (`carriedProjects > 0`) thì đoạn nối từ tháng liền trước tới tháng đó vẽ nét đứt. HÀM THUẦN.
 * Recharts không cho đổi nét vẽ giữa chừng trong 1 Line, nên mỗi đoạn là 1 cột dữ liệu riêng (`withRunKeys`)
 * và 1 Line riêng; 2 đoạn kề nhau dùng chung điểm nối để đường liền mạch.
 */

export interface CarriedRun {
  dashed: boolean;
  /** Chỉ số điểm đầu và cuối (gồm cả 2 đầu). */
  from: number;
  to: number;
}

export function carriedRuns(carried: readonly number[]): CarriedRun[] {
  if (carried.length === 0) return [];
  if (carried.length === 1) return [{ dashed: false, from: 0, to: 0 }];
  const runs: CarriedRun[] = [];
  for (let i = 1; i < carried.length; i++) {
    const dashed = carried[i] > 0;
    const last = runs[runs.length - 1];
    if (last && last.dashed === dashed) last.to = i;
    else runs.push({ dashed, from: i - 1, to: i });
  }
  return runs;
}

/** Thêm cột `${key}_r${n}` cho từng đoạn (giá trị ở chỉ số nằm trong đoạn, còn lại null). */
export function withRunKeys<T extends Record<string, unknown>>(
  data: readonly T[],
  keys: readonly string[],
  runs: readonly CarriedRun[],
): (T & Record<string, number | null>)[] {
  return data.map((row, i) => {
    const extra: Record<string, number | null> = {};
    for (const key of keys) {
      runs.forEach((run, n) => {
        extra[`${key}_r${n}`] = i >= run.from && i <= run.to ? ((row[key] as number | null) ?? null) : null;
      });
    }
    return { ...row, ...extra };
  });
}
