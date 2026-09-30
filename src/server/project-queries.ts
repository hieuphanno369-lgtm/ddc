import { addDaysIso, currentMonth, isValidIsoDate, isValidYearMonth, todayIso, type IsoDate } from '@/lib/clock';
import { sumByDate, type DailyPoint } from '@/lib/daily-series';
import type { ResourceRow } from '@/lib/resources';
import { activeStages } from '@/lib/stages';
import type { WorkItemCompare, WorkItemCompareRow } from '@/lib/stage-timeline';
import { TRACKING_DAYS, type WeeklyTracking } from '@/lib/tracking';
import { repo } from './repo';

/**
 * Ngày người xem chọn (URL `day`): sai định dạng hoặc ngày không tồn tại -> hôm nay; lớn hơn hôm nay -> hôm nay
 * (không có số tương lai). Validate NGAY TẠI ĐÂY, không dựa vào caller (bài học N-3: `?month=abc` từng gây 500).
 */
function safeDay(day: string): IsoDate {
  const today = todayIso();
  return typeof day === 'string' && isValidIsoDate(day) && day <= today ? day : today;
}

/** Ngày cuối CÓ số của nhân lực và thiết bị, mỗi bên tính riêng, không lớn hơn `day` (Q7 = a, không giới hạn 180 ngày). */
async function lastDays(projectId: number, day: IsoDate) {
  const [manpower, equipment] = await Promise.all([
    repo.readLastDailyDate(projectId, 'manpower', day),
    repo.readLastDailyDate(projectId, 'equipment', day),
  ]);
  return { manpower, equipment };
}

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

/**
 * Nguồn lực = ẢNH CHỤP ngày gần nhất CÓ dữ liệu không lớn hơn `day`, cộng ngang nhà thầu trong đúng ngày đó (Q3, Q7 = a).
 * KHÔNG cộng dồn cả khoảng: 7 ngày × 520 người không phải 3.640 người.
 * Nhân lực và thiết bị có thể nhập lệch ngày → mỗi bên lấy ngày cuối của chính nó,
 * asOfDate trả ngày mới hơn trong hai ngày (đó là ngày ghi dưới scorecard).
 */
export async function getResourceSnapshot(projectId: number, day: string): Promise<ResourceSnapshot> {
  const last = await lastDays(projectId, safeDay(day));
  const [manpowerRows, equipmentRows] = await Promise.all([
    last.manpower ? repo.getDailyManpower(projectId, last.manpower, last.manpower) : Promise.resolve([]),
    last.equipment ? repo.getDailyEquipment(projectId, last.equipment, last.equipment) : Promise.resolve([]),
  ]);
  const lastManpowerDay = last.manpower;
  const lastEquipmentDay = last.equipment;
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
export async function getResourceBreakdown(projectId: number, day: string): Promise<ResourceBreakdown> {
  const last = await lastDays(projectId, safeDay(day));
  const [manpower, equipment, contractorList, equipmentList] = await Promise.all([
    last.manpower ? repo.getDailyManpower(projectId, last.manpower, last.manpower) : Promise.resolve([]),
    last.equipment ? repo.getDailyEquipment(projectId, last.equipment, last.equipment) : Promise.resolve([]),
    repo.getContractors(),
    repo.getEquipments(),
  ]);
  const contractors = new Map(contractorList.map((c) => [c.id, c]));
  const equipments = new Map(equipmentList.map((e) => [e.id, e]));
  const manpowerAsOfDate = last.manpower;
  const equipmentAsOfDate = last.equipment;

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
 * 7 ngày tracking liên tiếp, kết thúc ở ngày cuối CÓ số liệu (nhân lực hoặc thiết bị) không lớn hơn `day`
 * - Q4 mặc định (a), Q7 = a. Không có số liệu → null.
 * Nhà thầu = danh sách project_contractor + nhà thầu có số liệu nhưng không còn trong danh sách.
 */
export async function getWeeklyTracking(projectId: number, day: string): Promise<WeeklyTracking | null> {
  const last = await lastDays(projectId, safeDay(day));
  const lastDay = [last.manpower, last.equipment].filter((d): d is IsoDate => d != null).sort().at(-1);
  if (!lastDay) return null;
  const weekStart = addDaysIso(lastDay, -(TRACKING_DAYS - 1));
  const [manpowerAll, equipmentAll] = await Promise.all([
    repo.getDailyManpower(projectId, weekStart, lastDay),
    repo.getDailyEquipment(projectId, weekStart, lastDay),
  ]);
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
  const stages = activeStages(await repo.getStages()).filter((s) => s.calcMode === 'volume');
  const out: WorkItemCompare = {};
  for (const { code: stage } of stages) {
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
export async function getManpowerDaily(projectId: number, from: IsoDate, to: IsoDate): Promise<DailyPoint[]> {
  const a = isValidIsoDate(from) ? from : todayIso();
  const b = isValidIsoDate(to) ? to : todayIso();
  return sumByDate(await repo.getDailyManpower(projectId, a <= b ? a : b, a <= b ? b : a));
}
