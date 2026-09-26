import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * QA doc lap cho p3c-contract.test.ts (Buoc 1, item 7 cua nhiem vu tester): xac nhan co che
 * so khop truong (`fieldsOf`) THAT SU bat duoc lech - khong chi "luon xanh vi types.ts chua co
 * kieu". Dung 1 BAN SAO tam trong bo nho (khong dung, khong ghi ra dia, khong dung types.ts
 * that) mo phong tinh huong A merge P3C-A nhung lech 1 truong so voi hop dong, roi khang dinh
 * so sanh PHAI khac nhau (tuc la neu day la test that trong p3c-contract.test.ts thi no se FAIL
 * dung nhu ke hoach mo ta o Buoc 1: "neu FAIL nghia la A doi ten/kieu truong khac hop dong").
 */
const ROOT = process.cwd();
// Chuan hoa CRLF -> LF: checkout Windows luu file voi \r\n nen chuoi .replace() ben duoi
// (viet bang \n) khong khop, lam test "PHAI THAT BAI" khong that su thay doi noi dung.
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8').replace(/\r\n/g, '\n');
const p3c = read('src/lib/p3c-contract.ts');

const NAMES = ['EquipmentPlanSegment', 'EquipmentQuota', 'ManpowerPlanMonthRow', 'ShiftRatio'];

/** Sao chep y het logic fieldsOf trong p3c-contract.test.ts (khong import de khong phu thuoc
 * implementation detail cua file test khac - copy nho, on dinh). */
function fieldsOf(src: string, name: string): string[] | null {
  const m = src.match(new RegExp(`export interface ${name}\\s*\\{([^}]*)\\}`));
  if (!m) return null;
  const body = m[1].replace(/\/\/.*$/gm, '');
  return body
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/\s+/g, ''))
    .sort();
}

describe('QA p3c-contract - fieldsOf that su bat duoc lech (khong tu lam vo hieu)', () => {
  it('types.ts GIA LAP dung het 4 kieu, KHOP hoan toan voi p3c-contract.ts -> so sanh bang nhau', () => {
    const fakeTypesOk = p3c.replace('export interface', 'export interface'); // y het p3c (khop)
    for (const name of NAMES) {
      const a = fieldsOf(fakeTypesOk, name);
      expect(a).not.toBeNull();
      expect(fieldsOf(p3c, name)).toEqual(a);
    }
  });

  it('PHAI THAT BAI: types.ts GIA LAP doi ten truong "qty" -> "quantity" trong EquipmentPlanSegment thi so sanh KHONG con bang nhau (chung minh test chong lech co rang)', () => {
    const fakeTypesDrifted = p3c.replace(
      'export interface EquipmentPlanSegment {\n  id: number; equipmentId: number; equipmentName: string;\n  from: string; to: string;   // \'YYYY-MM-DD\'\n  qty: number;                // SL dùng trong đợt\n}',
      'export interface EquipmentPlanSegment {\n  id: number; equipmentId: number; equipmentName: string;\n  from: string; to: string;   // \'YYYY-MM-DD\'\n  quantity: number;           // SL dung trong dot (A doi ten - LECH hop dong)\n}',
    );
    // Xac nhan ban gia lap that su da bi doi (khong phai chuoi thay the sai khien test tu duong).
    expect(fakeTypesDrifted).not.toBe(p3c);
    const drifted = fieldsOf(fakeTypesDrifted, 'EquipmentPlanSegment');
    expect(drifted).not.toBeNull();
    const contractFields = fieldsOf(p3c, 'EquipmentPlanSegment');
    // Day chinh la khang dinh se FAIL neu ai do "vo tinh" sua p3c-contract.test.ts de luon xanh
    // (vd bo qua so sanh) - no chung minh assertion toEqual co kha nang bat loi that.
    expect(drifted).not.toEqual(contractFields);
  });

  it('PHAI THAT BAI: types.ts GIA LAP thieu 1 truong (mat "isManual" trong ManpowerPlanMonthRow) -> khong khop', () => {
    const fakeTypesMissing = p3c.replace(
      'export interface ManpowerPlanMonthRow { yearMonth: string; shiftCode: string; planned: number; isManual: boolean }',
      'export interface ManpowerPlanMonthRow { yearMonth: string; shiftCode: string; planned: number }',
    );
    expect(fakeTypesMissing).not.toBe(p3c);
    const drifted = fieldsOf(fakeTypesMissing, 'ManpowerPlanMonthRow');
    const contractFields = fieldsOf(p3c, 'ManpowerPlanMonthRow');
    expect(drifted).not.toEqual(contractFields);
    expect(drifted!.length).toBe(contractFields!.length - 1);
  });
});

describe('QA - fieldsOf(src, name) voi ten khong ton tai -> null (dung nhu p3c-contract.test.ts mo ta khi A chua merge)', () => {
  it("ten interface khong co trong src -> null, khong throw", () => {
    expect(fieldsOf(p3c, 'KhongTonTai')).toBeNull();
  });
});
