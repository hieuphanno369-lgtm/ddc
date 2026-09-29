import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Test doc lap (khong sua src/i18n/messages.test.ts cua coder) cho key i18n moi cua
 * P3C-B Buoc 9 (topPriority.*, equipmentPlanGantt.*, manpowerMonthChart.*).
 * Bao: duong chay thuan loi (du 3 nhom o ca vi/en), bien (khoa dung boi 3 component
 * moi deu ton tai), va ca "phai that bai neu lech" (khong duoc co ky tu en/em dash
 * trong 3 nhom moi).
 */

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf-8')) as Record<string, unknown>;
const vi = read('src/i18n/messages/vi.json');
const en = read('src/i18n/messages/en.json');

const NEW_GROUPS = ['topPriority', 'equipmentPlanGantt', 'manpowerMonthChart'] as const;

const EXPECTED_KEYS: Record<(typeof NEW_GROUPS)[number], string[]> = {
  // 2026-09-29: bo 'behind', 'onTrack' (the Top khong hien tre/dung tien do nua, chu du an chot).
  topPriority: ['title', 'subtitle', 'empty'],
  equipmentPlanGantt: [
    'title', 'help', 'colEquipment', 'colQty', 'qty', 'today', 'tipRange', 'tipQty', 'tipDays', 'noPlan',
  ],
  manpowerMonthChart: ['title', 'help', 'planTotal', 'actualAvg', 'actualDays', 'noData'],
};

function collectStrings(group: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const v of Object.values(group)) {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') out.push(...collectStrings(v as Record<string, unknown>));
  }
  return out;
}

const usedKeysOf = (source: string): string[] => {
  const keys = new Set<string>();
  for (const m of source.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'\s*[,)]/g)) keys.add(m[1]);
  return [...keys];
};

const readSrc = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

describe('i18n P3C-B Buoc 9-10: 3 nhom key moi - duong chay thuan loi', () => {
  for (const group of NEW_GROUPS) {
    it(`nhom ${group} co day du key o ca vi.json va en.json`, () => {
      const viGroup = vi[group] as Record<string, unknown> | undefined;
      const enGroup = en[group] as Record<string, unknown> | undefined;
      expect(viGroup, `thieu nhom ${group} o vi.json`).toBeTruthy();
      expect(enGroup, `thieu nhom ${group} o en.json`).toBeTruthy();
      for (const key of EXPECTED_KEYS[group]) {
        expect(viGroup?.[key], `thieu vi.json ${group}.${key}`).toBeTypeOf('string');
        expect(enGroup?.[key], `thieu en.json ${group}.${key}`).toBeTypeOf('string');
        expect((viGroup?.[key] as string).length).toBeGreaterThan(0);
        expect((enGroup?.[key] as string).length).toBeGreaterThan(0);
      }
    });
  }
});

describe('i18n P3C-B Buoc 9-10: bien - moi key cac component dung deu ton tai', () => {
  const COMPONENTS = {
    TopPriorityList: 'src/components/dashboard/TopPriorityList.tsx',
    EquipmentPlanGantt: 'src/components/project/EquipmentPlanGantt.tsx',
    ManpowerMonthChart: 'src/components/project/ManpowerMonthChart.tsx',
  };

  function flatten(obj: Record<string, unknown>, prefix = '', out: string[] = []): string[] {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v as Record<string, unknown>, key, out);
      else out.push(key);
    }
    return out;
  }
  const viKeys = flatten(vi);
  const enKeys = flatten(en);

  for (const [label, file] of Object.entries(COMPONENTS)) {
    it(`${label}: moi key t('...') dung deu co o vi.json va en.json`, () => {
      const used = usedKeysOf(readSrc(file));
      expect(used.length, `${file} khong trich duoc key nao - kiem tra lai regex/file`).toBeGreaterThan(0);
      expect(used.filter((k) => !viKeys.includes(k)), 'thieu o vi.json').toEqual([]);
      expect(used.filter((k) => !enKeys.includes(k)), 'thieu o en.json').toEqual([]);
    });
  }
});

describe('i18n P3C-B Buoc 9-10: PHAI THAT BAI NEU LECH - khong co en/em dash trong 3 nhom moi', () => {
  it('khong co ky tu en dash (U+2013) hoac em dash (U+2014) trong topPriority/equipmentPlanGantt/manpowerMonthChart o vi.json', () => {
    for (const group of NEW_GROUPS) {
      const strings = collectStrings(vi[group] as Record<string, unknown>);
      for (const s of strings) {
        expect(s, `vi.json ${group} co dash la: "${s}"`).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });

  it('khong co ky tu en dash (U+2013) hoac em dash (U+2014) trong topPriority/equipmentPlanGantt/manpowerMonthChart o en.json', () => {
    for (const group of NEW_GROUPS) {
      const strings = collectStrings(en[group] as Record<string, unknown>);
      for (const s of strings) {
        expect(s, `en.json ${group} co dash la: "${s}"`).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });
});
