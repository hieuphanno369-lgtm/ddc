import { addDaysIso, currentMonth, endOfMonth, isValidYearMonth, todayIso, type IsoDate } from '@/lib/clock';
import { sumByDate, type DailyPoint } from '@/lib/daily-series';
import type { ResourceRow } from '@/lib/resources';
import { STAGE_CALC_MODE, STAGE_ORDER } from '@/lib/stages';
import type { WorkItemCompare, WorkItemCompareRow } from '@/lib/stage-timeline';
import { TRACKING_DAYS, type WeeklyTracking } from '@/lib/tracking';
import { repo } from './repo';

/** Cửa sổ đọc bảng theo ngày: đủ dài để vẽ ~6 tháng mà không quét cả bảng. */
const RESOURCE_WINDOW_DAYS = 180;

export interface ResourceSnapshot {
  /**
   * Ngày MỚI HƠN trong 2 ngày cuối (nhân lực/thiết bị) - CHỈ dùng khi cần một mốc chung
   * (vd sắp xếp/so sánh nhiều dự án); null = cả 2 bên đều chưa có dữ liệu ngày nào.
   * KHÔNG dùng làm nhãn "Số liệu ngày ..." cho từng card riêng - xem N-6 (danh-gia.md vòng 2):
   * nhân lực và thiết bị có thể nhập lệch ngày, dán chung 1 nhãn sẽ hiện sai ngày cho bên còn lại.
   */
  asOfDate: IsoDate | null;
  /** Ngày cuối CÓ dữ liệu nhân lực - dùng cho nhãn ngày của card nhân lực. */
  manpowerAsOfDate: IsoDate | null;
  /** Ngày cuối CÓ dữ liệu thiết bị - dùng cho nhãn ngày của card thiết bị. */
  equipmentAsOfDate: IsoDate | null;
  manpowerPlanned: number;
  manpowerActual: number;
  equipmentPlanned: number;
  equipmentActual: number;
  /** Số nhà thầu KHÁC NHAU có dòng nhân lực trong ngày manpowerAsOfDate; 0 nếu chưa có dữ liệu. */
  manpowerContractors: number;
  /** Số nhà thầu KHÁC NHAU có dòng thiết bị trong ngày equipmentAsOfDate; 0 nếu chưa có dữ liệu. */
  equipmentContractors: number;
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
    manpowerAsOfDate: lastManpowerDay,
    equipmentAsOfDate: lastEquipmentDay,
    manpowerPlanned: manpowerRows.reduce((s, m) => s + m.plannedHeadcount, 0),
    manpowerActual: manpowerRows.reduce((s, m) => s + m.actualHeadcount, 0),
    equipmentPlanned: equipmentRows.reduce((s, e) => s + e.qtyPlanned, 0),
    equipmentActual: equipmentRows.reduce((s, e) => s + e.qtyActual, 0),
    manpowerContractors: new Set(manpowerRows.map((m) => m.contractorId)).size,
    equipmentContractors: new Set(equipmentRows.map((e) => e.contractorId)).size,
  };
}

export interface ResourceBreakdown {
  manpowerAsOfDate: IsoDate | null;
  equipmentAsOfDate: IsoDate | null;
  /** Theo nhà thầu, đúng ngày manpowerAsOfDate; sort KH giảm dần rồi tên. */
  manpower: ResourceRow[];
  /** Theo nhóm thiết bị (dim_equipment), đúng ngày equipmentAsOfDate, cộng ngang nhà thầu; note = tên nhà thầu dùng. */
  equipment: ResourceRow[];
}

const byPlannedDesc = (a: ResourceRow, b: ResourceRow) => b.planned - a.planned || a.name.localeCompare(b.name, 'vi');

/** Bảng "Nhân lực theo nhà thầu" / "Thiết bị theo nhóm" (mock-up dòng 759-767) - cùng ngày chụp với getResourceSnapshot. */
export async function getResourceBreakdown(projectId: number, yearMonth: string): Promise<ResourceBreakdown> {
  const { from, to } = resourceWindow(yearMonth);
  const manpower = await repo.getDailyManpower(projectId, from, to);
  const equipment = await repo.getDailyEquipment(projectId, from, to);
  const contractors = new Map((await repo.getContractors()).map((c) => [c.id, c]));
  const equipments = new Map((await repo.getEquipments()).map((e) => [e.id, e]));
  const manpowerAsOfDate = manpower.at(-1)?.workDate ?? null;
  const equipmentAsOfDate = equipment.at(-1)?.workDate ?? null;

  const man = new Map<number, ResourceRow>();
  for (const m of manpower) {
    if (m.workDate !== manpowerAsOfDate) continue;
    const c = contractors.get(m.contractorId);
    const row = man.get(m.contractorId) ?? { id: m.contractorId, name: c?.name ?? `#${m.contractorId}`, note: c?.scopeOfWork ?? '', planned: 0, actual: 0 };
    row.planned += m.plannedHeadcount;
    row.actual += m.actualHeadcount;
    man.set(m.contractorId, row);
  }
  const eqp = new Map<number, ResourceRow & { users: number[] }>();
  for (const e of equipment) {
    if (e.workDate !== equipmentAsOfDate) continue;
    const row = eqp.get(e.equipmentId) ?? { id: e.equipmentId, name: equipments.get(e.equipmentId)?.name ?? `#${e.equipmentId}`, note: '', planned: 0, actual: 0, users: [] };
    row.planned += e.qtyPlanned;
    row.actual += e.qtyActual;
    if (!row.users.includes(e.contractorId)) row.users.push(e.contractorId);
    eqp.set(e.equipmentId, row);
  }
  const equipmentRows = [...eqp.values()].map(({ users, ...r }) => ({
    ...r, note: [...users].sort((a, b) => a - b).map((id) => contractors.get(id)?.name ?? `#${id}`).join(', '),
  }));
  return { manpowerAsOfDate, equipmentAsOfDate, manpower: [...man.values()].sort(byPlannedDesc), equipment: equipmentRows.sort(byPlannedDesc) };
}

/**
 * 7 ngày tracking liên tiếp, kết thúc ở ngày cuối CÓ số liệu (nhân lực hoặc thiết bị) trong
 * resourceWindow(month) - Q4 mặc định (a). Không có số liệu → null.
 * Nhà thầu = danh sách project_contractor + nhà thầu có số liệu nhưng không còn trong danh sách.
 */
export async function getWeeklyTracking(projectId: number, yearMonth: string): Promise<WeeklyTracking | null> {
  const { from, to } = resourceWindow(yearMonth);
  const manpowerAll = await repo.getDailyManpower(projectId, from, to);
  const equipmentAll = await repo.getDailyEquipment(projectId, from, to);
  const lastDay = [manpowerAll.at(-1)?.workDate, equipmentAll.at(-1)?.workDate].filter((d): d is IsoDate => d != null).sort().at(-1);
  if (!lastDay) return null;
  const days = Array.from({ length: TRACKING_DAYS }, (_, i) => addDaysIso(lastDay, i - (TRACKING_DAYS - 1)));
  const inWeek = (d: IsoDate) => d >= days[0] && d <= lastDay;
  const manpower = manpowerAll.filter((m) => inWeek(m.workDate));
  const equipmentUsage = equipmentAll.filter((e) => inWeek(e.workDate));

  const all = new Map((await repo.getContractors()).map((c) => [c.id, c]));
  const contractors = (await repo.getContractors(projectId)).map((c) => ({ id: c.id, name: c.name, scopeOfWork: c.scopeOfWork }));
  const extra = [...new Set([...manpower.map((m) => m.contractorId), ...equipmentUsage.map((e) => e.contractorId)])]
    .filter((id) => !contractors.some((c) => c.id === id)).sort((a, b) => a - b);
  for (const id of extra) contractors.push({ id, name: all.get(id)?.name ?? `#${id}`, scopeOfWork: all.get(id)?.scopeOfWork ?? '' });

  const eqNames = new Map((await repo.getEquipments()).map((e) => [e.id, e.name]));
  const equipments = [...new Set(equipmentUsage.map((e) => e.equipmentId))].sort((a, b) => a - b)
    .map((id) => ({ id, name: eqNames.get(id) ?? `#${id}` }));
  return { days, today: todayIso(), contractors, equipments, manpower, equipmentUsage };
}

/** KH/TT (tấn) theo hạng mục cho từng giai đoạn ĐỊNH LƯỢNG của tháng (mock-up dòng 716-720, 1474-1506). */
export async function getWorkItemComparison(projectId: number, yearMonth: string): Promise<WorkItemCompare> {
  const ym = isValidYearMonth(yearMonth) ? yearMonth : currentMonth();
  const items = await repo.getWorkItems(projectId);
  const facts = await repo.getWorkItemFacts(projectId, ym);
  const out: WorkItemCompare = {};
  for (const stage of STAGE_ORDER) {
    if (STAGE_CALC_MODE[stage] !== 'volume') continue;
    const rows: WorkItemCompareRow[] = items.flatMap((wi) => {
      const fs = facts.filter((f) => f.stageCode === stage && f.workItemId === wi.id);
      if (!fs.length) return [];
      return [{ workItemId: wi.id, name: wi.name, planned: fs.reduce((s, f) => s + f.qtyPlan, 0), actual: fs.reduce((s, f) => s + f.qtyActual, 0) }];
    });
    if (rows.length) out[stage] = rows;
  }
  return out;
}

/** Chuỗi nhân lực theo ngày (đã cộng ngang nhà thầu) để client tự gộp tuần/tháng. */
export async function getManpowerDaily(projectId: number, yearMonth: string): Promise<DailyPoint[]> {
  const { from, to } = resourceWindow(yearMonth);
  return sumByDate(await repo.getDailyManpower(projectId, from, to));
}
