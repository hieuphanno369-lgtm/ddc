import { describe, expect, it } from 'vitest';
import {
  cellText, EQUIPMENT_HEADERS, groupImportByDay, manpowerHeaders, parseEquipmentSheet, parseExcelDate, parseManpowerSheet,
  type CellValue, type DailyImportContext,
} from './daily-import';
import type { Contractor, Equipment, Shift } from '@/server/repo/types';

const SHIFTS: Shift[] = [
  { code: 'morning', nameVi: 'Ca sáng', nameEn: 'Morning', sortOrder: 1, isActive: true },
  { code: 'evening', nameVi: 'Ca tối', nameEn: 'Evening', sortOrder: 2, isActive: true },
];
const MEMBERS: Contractor[] = [{ id: 1, name: 'Nhà thầu A', scopeOfWork: '', isActive: true, mergedIntoId: null }];
const EQUIPMENTS: Equipment[] = [{ id: 1, name: 'Cẩu bánh xích', unit: 'cái', isActive: true }];
const CTX: DailyImportContext = {
  members: MEMBERS, shifts: SHIFTS, equipments: EQUIPMENTS,
  window: { min: '2026-09-09', max: '2026-10-16' }, today: '2026-09-16',
};

describe('manpowerHeaders', () => {
  it("dung thu tu ['Ngày','Nhà thầu','KH Ca sáng','TT Ca sáng','KH Ca tối','TT Ca tối']", () => {
    expect(manpowerHeaders(SHIFTS)).toEqual(['Ngày', 'Nhà thầu', 'KH Ca sáng', 'TT Ca sáng', 'KH Ca tối', 'TT Ca tối']);
  });
});

describe('parseExcelDate', () => {
  it.each([
    [new Date(Date.UTC(2026, 8, 15)), '2026-09-15'],
    [46280, '2026-09-15'],
    ['15/09/2026', '2026-09-15'],
    ['5/9/2026', '2026-09-05'],
    ['2026-09-15', '2026-09-15'],
    ['31/02/2026', null],
    [{ result: 46280 }, '2026-09-15'],
  ] as [CellValue, string | null][])('%o -> %s', (input, expected) => {
    expect(parseExcelDate(input)).toBe(expected);
  });
});

describe('cellText', () => {
  it('richText noi text, formula lay result', () => {
    expect(cellText({ richText: [{ text: 'Nhà ' }, { text: 'thầu A' }] })).toBe('Nhà thầu A');
    expect(cellText({ result: 'X' })).toBe('X');
  });
});

describe('parseManpowerSheet', () => {
  const header = manpowerHeaders(SHIFTS);

  it('header thieu cot TT Ca toi -> bad_header', () => {
    const badHeader = header.slice(0, -1);
    const res = parseManpowerSheet(badHeader, [], CTX);
    expect(res).toEqual({ ok: false, error: 'bad_header' });
  });

  it('dong trong bi bo (khong tinh)', () => {
    const res = parseManpowerSheet(header, [['', '', '', '', '', '']], CTX);
    expect(res).toEqual({ ok: true, rows: [] });
  });

  it('bad_date', () => {
    const res = parseManpowerSheet(header, [['khong-phai-ngay', 'Nhà thầu A', 1, 1, 1, 1]], CTX);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.rows[0]).toMatchObject({ status: 'invalid', reason: 'bad_date' });
  });

  it('out_of_window', () => {
    const res = parseManpowerSheet(header, [['2026-01-01', 'Nhà thầu A', 1, 1, 1, 1]], CTX);
    if (res.ok) expect(res.rows[0]).toMatchObject({ status: 'invalid', reason: 'out_of_window' });
  });

  it('unknown_contractor', () => {
    const res = parseManpowerSheet(header, [['2026-09-16', 'Nhà thầu lạ', 1, 1, 1, 1]], CTX);
    if (res.ok) expect(res.rows[0]).toMatchObject({ status: 'invalid', reason: 'unknown_contractor' });
  });

  it('bad_number', () => {
    const res = parseManpowerSheet(header, [['2026-09-16', 'Nhà thầu A', 'abc', 1, 1, 1]], CTX);
    if (res.ok) expect(res.rows[0]).toMatchObject({ status: 'invalid', reason: 'bad_number' });
  });

  it('actual_future', () => {
    const res = parseManpowerSheet(header, [['2026-09-17', 'Nhà thầu A', 0, 1, 0, 0]], CTX);
    if (res.ok) expect(res.rows[0]).toMatchObject({ status: 'invalid', reason: 'actual_future' });
  });

  it('duplicate (2 dong cung ngay + nha thau)', () => {
    const row = ['2026-09-16', 'Nhà thầu A', 1, 1, 1, 1];
    const res = parseManpowerSheet(header, [row, row], CTX);
    if (res.ok) {
      expect(res.rows[0].status).toBe('ok');
      expect(res.rows[1]).toMatchObject({ status: 'invalid', reason: 'duplicate' });
    }
  });

  it('dong hop le -> ok, co du manpower cho 2 ca', () => {
    const res = parseManpowerSheet(header, [['2026-09-16', 'Nhà thầu A', 5, 4, 3, 2]], CTX);
    if (res.ok) {
      expect(res.rows[0].status).toBe('ok');
      expect(res.rows[0].manpower).toEqual([
        { contractorId: 1, shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
        { contractorId: 1, shiftCode: 'evening', plannedHeadcount: 3, actualHeadcount: 2 },
      ]);
    }
  });
});

describe('parseEquipmentSheet', () => {
  const header = [...EQUIPMENT_HEADERS];

  it('unknown_equipment', () => {
    const res = parseEquipmentSheet(header, [['2026-09-16', 'Nhà thầu A', 'Thiết bị lạ', 1, 1]], CTX);
    if (res.ok) expect(res.rows[0]).toMatchObject({ status: 'invalid', reason: 'unknown_equipment' });
  });

  it('dong hop le -> ok', () => {
    const res = parseEquipmentSheet(header, [['2026-09-16', 'Nhà thầu A', 'Cẩu bánh xích', 3, 2]], CTX);
    if (res.ok) {
      expect(res.rows[0].status).toBe('ok');
      expect(res.rows[0].equipment).toEqual([{ contractorId: 1, equipmentId: 1, qtyPlanned: 3, qtyActual: 2 }]);
    }
  });
});

describe('groupImportByDay', () => {
  it('gop 2 sheet cung ngay', () => {
    const mp = parseManpowerSheet(manpowerHeaders(SHIFTS), [['2026-09-16', 'Nhà thầu A', 5, 4, 3, 2]], CTX);
    const eq = parseEquipmentSheet([...EQUIPMENT_HEADERS], [['2026-09-16', 'Nhà thầu A', 'Cẩu bánh xích', 3, 2]], CTX);
    if (!mp.ok || !eq.ok) throw new Error('parse failed');
    const grouped = groupImportByDay([...mp.rows, ...eq.rows]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].workDate).toBe('2026-09-16');
    expect(grouped[0].manpower).toHaveLength(2);
    expect(grouped[0].equipment).toHaveLength(1);
  });
});
