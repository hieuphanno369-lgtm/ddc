/**
 * "Chậm/Nhanh N ngày · ±x,x%" so với tiến độ kế hoạch - dòng phụ hiển thị dưới thẻ %TT
 * (metric.pctActual) ở trang Chi tiết. Vòng bổ sung P2B (2026-09-24, công thức do điều phối
 * viên chọn theo yêu cầu chủ dự án):
 *   - gapPct = pctActual − pctPlan (điểm %, cùng đơn vị phân số 0-1 với pctPlan/pctActual ở
 *     src/server/queries.ts và src/lib/evm.ts - KHÔNG nhân 100 ở đây, tầng hiển thị tự nhân khi
 *     format chuỗi %).
 *   - gapDays = làm tròn(gapPct × số ngày kế hoạch), số ngày kế hoạch = plannedFinishDate −
 *     plannedStartDate.
 * Pure function, không tự dịch/format chuỗi hiển thị - tầng gọi (trang Chi tiết) tự ghép với
 * i18n nhóm `kpiSchedule`.
 */

export type ScheduleGapDirection = 'behind' | 'ahead' | 'onTrack';

export interface ScheduleGapResult {
  /** < 0 = chậm, > 0 = nhanh, = 0 = đúng tiến độ - quyết định theo gapDays (không phải gapPct). */
  direction: ScheduleGapDirection;
  /** Số ngày chênh lệch đã làm tròn (Math.round). Âm = chậm, dương = nhanh. */
  gapDays: number;
  /** Điểm % chênh lệch dạng phân số (0.033 = 3,3 điểm %). Âm = chậm, dương = nhanh. */
  gapPct: number;
}

/** Parse 'YYYY-MM-DD' | ISO đầy đủ | Date. Rác → null. (Copy cách làm của src/lib/evm.ts toDate). */
function toDate(v: string | Date | null): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Tính chênh lệch %TT so với %KH theo thời gian, quy đổi ra số ngày.
 * Thiếu pctPlan/pctActual, thiếu ngày kế hoạch, hoặc số ngày kế hoạch <= 0 (ngày kết thúc
 * <= ngày bắt đầu, kể cả kế hoạch 0 ngày) → null (không đoán, tầng hiển thị ẩn dòng).
 */
export function calcScheduleGap(
  pctPlan: number | null,
  pctActual: number | null,
  plannedStartDate: string | Date | null,
  plannedFinishDate: string | Date | null,
): ScheduleGapResult | null {
  if (pctPlan == null || pctActual == null) return null;
  const start = toDate(plannedStartDate);
  const finish = toDate(plannedFinishDate);
  if (!start || !finish) return null;
  const planDays = (finish.getTime() - start.getTime()) / 86_400_000;
  if (planDays <= 0) return null;

  const gapPct = pctActual - pctPlan;
  const gapDays = Math.round(gapPct * planDays);
  const direction: ScheduleGapDirection = gapDays < 0 ? 'behind' : gapDays > 0 ? 'ahead' : 'onTrack';
  return { direction, gapDays, gapPct };
}
