import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Chặn lệch giữa kiểu tạm (`p3c-contract.ts`, B tự chép hợp đồng) và `src/server/repo/types.ts`
 * (file của A). Trước khi A merge P3C-A thì `types.ts` chưa có 4 kiểu này -> chỉ kiểm bản thân
 * p3c-contract.ts; sau khi A merge thì so khớp trường.
 */
const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');
const p3c = read('src/lib/p3c-contract.ts');
const typesSrc = read('src/server/repo/types.ts');

const NAMES = ['EquipmentPlanSegment', 'EquipmentQuota', 'ManpowerPlanMonthRow', 'ShiftRatio'];

/** Lấy danh sách trường 'ten:kieu' (đã bỏ khoảng trắng, sort) của 1 interface trong mã nguồn dạng chữ. */
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

describe('p3c-contract', () => {
  it('p3c-contract khai du 4 kieu', () => {
    for (const name of NAMES) {
      expect(fieldsOf(p3c, name)).not.toBeNull();
    }
    expect(fieldsOf(p3c, 'EquipmentPlanSegment')).toEqual(
      ['equipmentId:number', 'equipmentName:string', 'from:string', 'id:number', 'qty:number', 'to:string'].sort(),
    );
  });

  it('khop truong voi types.ts neu A da merge', () => {
    for (const name of NAMES) {
      const a = fieldsOf(typesSrc, name);
      if (a === null) continue; // A chua merge P3C-A - bo qua ten nay
      expect(fieldsOf(p3c, name)).toEqual(a);
    }
  });
});
