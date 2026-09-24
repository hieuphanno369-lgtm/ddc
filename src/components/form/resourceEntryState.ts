import type { Contractor, Equipment, FactDailyEquipmentUsage, FactDailyManpowerShift, Shift } from '@/server/repo/types';
import type { EquipmentCellInput, ManpowerCellInput } from '@/lib/daily-entry';

export interface ManpowerGridRow {
  contractorId: number;
  contractorName: string;
  /** key = shiftCode */
  cells: Record<string, { planned: string; actual: string }>;
}

export interface EquipmentGridRow {
  key: string;
  contractorId: number;
  equipmentId: number;
  planned: string;
  actual: string;
  isNew: boolean;
}

/** Lưới đủ (thành viên × ca); thiếu dòng trong DB → '0'. */
export function buildManpowerGrid(members: Contractor[], shifts: Shift[], rows: FactDailyManpowerShift[]): ManpowerGridRow[] {
  return members.map((m) => {
    const cells: Record<string, { planned: string; actual: string }> = {};
    for (const s of shifts) {
      const row = rows.find((r) => r.contractorId === m.id && r.shiftCode === s.code);
      cells[s.code] = { planned: String(row?.plannedHeadcount ?? 0), actual: String(row?.actualHeadcount ?? 0) };
    }
    return { contractorId: m.id, contractorName: m.name, cells };
  });
}

export function buildEquipmentGrid(rows: FactDailyEquipmentUsage[]): EquipmentGridRow[] {
  return rows.map((r) => ({
    key: `${r.contractorId}-${r.equipmentId}`,
    contractorId: r.contractorId,
    equipmentId: r.equipmentId,
    planned: String(r.qtyPlanned),
    actual: String(r.qtyActual),
    isNew: false,
  }));
}

function toIntOrZero(v: string): number {
  const n = Number(v);
  return Number.isInteger(n) ? n : 0;
}

export function manpowerTotals(
  grid: ManpowerGridRow[],
  shifts: Shift[],
): {
  byContractor: Record<number, { planned: number; actual: number }>;
  byShift: Record<string, { planned: number; actual: number }>;
  day: { planned: number; actual: number };
} {
  const byContractor: Record<number, { planned: number; actual: number }> = {};
  const byShift: Record<string, { planned: number; actual: number }> = {};
  const day = { planned: 0, actual: 0 };
  for (const s of shifts) byShift[s.code] = { planned: 0, actual: 0 };

  for (const row of grid) {
    let cPlanned = 0;
    let cActual = 0;
    for (const s of shifts) {
      const cell = row.cells[s.code];
      const planned = cell ? toIntOrZero(cell.planned) : 0;
      const actual = cell ? toIntOrZero(cell.actual) : 0;
      cPlanned += planned;
      cActual += actual;
      byShift[s.code].planned += planned;
      byShift[s.code].actual += actual;
    }
    byContractor[row.contractorId] = { planned: cPlanned, actual: cActual };
    day.planned += cPlanned;
    day.actual += cActual;
  }

  return { byContractor, byShift, day };
}

export type GridToPayloadResult =
  | { ok: true; manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] }
  | { ok: false; error: 'bad_number' | 'duplicate_equipment'; key: string };

function parseCell(raw: string): number | null {
  if (raw.trim() === '') return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function gridToPayload(mg: ManpowerGridRow[], eg: EquipmentGridRow[]): GridToPayloadResult {
  const manpower: ManpowerCellInput[] = [];
  for (const row of mg) {
    for (const [shiftCode, cell] of Object.entries(row.cells)) {
      const planned = parseCell(cell.planned);
      if (planned == null) return { ok: false, error: 'bad_number', key: `${row.contractorId}.${shiftCode}.planned` };
      const actual = parseCell(cell.actual);
      if (actual == null) return { ok: false, error: 'bad_number', key: `${row.contractorId}.${shiftCode}.actual` };
      manpower.push({ contractorId: row.contractorId, shiftCode, plannedHeadcount: planned, actualHeadcount: actual });
    }
  }

  const equipment: EquipmentCellInput[] = [];
  const seen = new Set<string>();
  for (const row of eg) {
    const dupKey = `${row.contractorId}-${row.equipmentId}`;
    if (seen.has(dupKey)) return { ok: false, error: 'duplicate_equipment', key: row.key };
    seen.add(dupKey);
    const planned = parseCell(row.planned);
    if (planned == null) return { ok: false, error: 'bad_number', key: `${row.key}.planned` };
    const actual = parseCell(row.actual);
    if (actual == null) return { ok: false, error: 'bad_number', key: `${row.key}.actual` };
    equipment.push({ contractorId: row.contractorId, equipmentId: row.equipmentId, qtyPlanned: planned, qtyActual: actual });
  }

  return { ok: true, manpower, equipment };
}

/** Danh sách thiết bị cho select trong dòng mới - dùng ở ResourceEntryPanel. */
export function equipmentOptions(equipments: Equipment[]): { value: string; label: string }[] {
  return equipments.map((e) => ({ value: String(e.id), label: e.name }));
}
