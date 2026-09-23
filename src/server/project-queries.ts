import { addDaysIso, currentMonth, endOfMonth, isValidYearMonth, todayIso, type IsoDate } from '@/lib/clock';
import { sumByDate, type DailyPoint } from '@/lib/daily-series';
import { repo } from './repo';

/** Cửa sổ đọc bảng theo ngày: đủ dài để vẽ ~6 tháng mà không quét cả bảng. */
const RESOURCE_WINDOW_DAYS = 180;

export interface ResourceSnapshot {
  /** Ngày mà con số thuộc về; null = chưa có dữ liệu ngày nào trong cửa sổ. */
  asOfDate: IsoDate | null;
  manpowerPlanned: number;
  manpowerActual: number;
  equipmentPlanned: number;
  equipmentActual: number;
}

/** Kết thúc ở min(hôm nay, cuối tháng đang xem) - xem tháng quá khứ phải ra số của tháng đó. */
export function resourceWindow(yearMonth: string): { from: IsoDate; to: IsoDate } {
  // N-3: validate NGAY TẠI ĐÂY, không dựa vào caller (vd trang) đã tự validate hay chưa - `?month`
  // rác/ngoài miền giá trị (`'abc'`, `'9999-12'`) từng lọt thẳng vào endOfMonth() và ném RangeError.
  const ym = isValidYearMonth(yearMonth) ? yearMonth : currentMonth();
  const monthEnd = endOfMonth(ym);
  const today = todayIso();
  const to = monthEnd < today ? monthEnd : today;
  return { from: addDaysIso(to, -(RESOURCE_WINDOW_DAYS - 1)), to };
}

/**
 * Nguồn lực = ẢNH CHỤP ngày gần nhất CÓ dữ liệu, cộng ngang nhà thầu trong đúng ngày đó (Q3).
 * KHÔNG cộng dồn cả khoảng: 7 ngày × 520 người không phải 3.640 người.
 * Nhân lực và thiết bị có thể nhập lệch ngày → mỗi bên lấy ngày cuối của chính nó,
 * asOfDate trả ngày mới hơn trong hai ngày (đó là ngày ghi dưới scorecard).
 */
export async function getResourceSnapshot(projectId: number, yearMonth: string): Promise<ResourceSnapshot> {
  const { from, to } = resourceWindow(yearMonth);
  const manpower = await repo.getDailyManpower(projectId, from, to);
  const equipment = await repo.getDailyEquipment(projectId, from, to);

  // Cả 2 repo đều trả đã sort tăng dần theo workDate (Task 6 Bước 7 / Task 7 Bước 5).
  const lastManpowerDay = manpower.at(-1)?.workDate ?? null;
  const lastEquipmentDay = equipment.at(-1)?.workDate ?? null;
  const manpowerRows = manpower.filter((m) => m.workDate === lastManpowerDay);
  const equipmentRows = equipment.filter((e) => e.workDate === lastEquipmentDay);
  const days = [lastManpowerDay, lastEquipmentDay].filter((d): d is IsoDate => d != null).sort();

  return {
    asOfDate: days.at(-1) ?? null,
    manpowerPlanned: manpowerRows.reduce((s, m) => s + m.plannedHeadcount, 0),
    manpowerActual: manpowerRows.reduce((s, m) => s + m.actualHeadcount, 0),
    equipmentPlanned: equipmentRows.reduce((s, e) => s + e.qtyPlanned, 0),
    equipmentActual: equipmentRows.reduce((s, e) => s + e.qtyActual, 0),
  };
}

/** Chuỗi nhân lực theo ngày (đã cộng ngang nhà thầu) để client tự gộp tuần/tháng. */
export async function getManpowerDaily(projectId: number, yearMonth: string): Promise<DailyPoint[]> {
  const { from, to } = resourceWindow(yearMonth);
  return sumByDate(await repo.getDailyManpower(projectId, from, to));
}
