import { describe, expect, it } from 'vitest';
import { presetWeightsFor, STAGE_WEIGHT_PRESETS } from './stage-weight-presets';
import { DEFAULT_STAGE_WEIGHTS, SEED_STAGE_CODES, validateStageWeights } from './stages';
import type { ProjectType } from '@/server/repo/types';

/**
 * Kiem thu doc lap Q3a (P7-C2, chu du an chot 2026-09-27) - doi chieu TUNG SO trong bang Q3a da chot
 * (khong chi kiem tong = 100 nhu coder da lam trong stage-weight-presets.test.ts), va kiem preset
 * KHONG bi lech thu tu cot. Moi bo cu them Thanh quyet toan 2, lay 2 tu Lap dung.
 */
const Q3A_TABLE: Record<ProjectType, number[]> = {
  EPC: [8, 10, 15, 32, 5, 25, 3, 2],
  San_bay: [4, 8, 8, 42, 5, 28, 3, 2],
  San_van_dong: [5, 10, 8, 38, 6, 28, 3, 2],
  Nha_xuong: [3, 7, 20, 38, 5, 22, 3, 2],
  Cau_cang: [5, 10, 10, 38, 10, 22, 3, 2],
  Cao_tang: [5, 12, 10, 35, 5, 28, 3, 2],
  Dong_tau: [8, 12, 15, 45, 2, 13, 3, 2],
  Cau_giao_thong: [6, 10, 10, 37, 8, 24, 3, 2],
  Khac: [5, 10, 10, 40, 5, 25, 3, 2],
};

describe('STAGE_WEIGHT_PRESETS - dung tung so bang Q3a da chot (chu du an, 2026-09-27)', () => {
  for (const type of Object.keys(Q3A_TABLE) as ProjectType[]) {
    it(`${type}: dung thu tu SEED_STAGE_CODES va dung tung diem %`, () => {
      const rows = STAGE_WEIGHT_PRESETS[type];
      expect(rows.map((r) => r.stageCode)).toEqual([...SEED_STAGE_CODES]);
      expect(rows.map((r) => r.weightPct)).toEqual(Q3A_TABLE[type]);
      expect(rows.every((r) => r.applicable)).toBe(true);
    });
  }
});

describe('presetWeightsFor', () => {
  it("'' (chua chon loai) -> giong het DEFAULT_STAGE_WEIGHTS", () => {
    expect(presetWeightsFor('')).toEqual(DEFAULT_STAGE_WEIGHTS);
  });

  it('Khac -> giong het DEFAULT_STAGE_WEIGHTS (khong lech du khai bao rieng trong bang)', () => {
    expect(presetWeightsFor('Khac')).toEqual(DEFAULT_STAGE_WEIGHTS);
  });

  it('tra ve BAN SAO, sua ket qua khong lam hong bo goc STAGE_WEIGHT_PRESETS', () => {
    const rows = presetWeightsFor('EPC');
    rows[0].weightPct = 999;
    expect(STAGE_WEIGHT_PRESETS.EPC[0].weightPct).toBe(8);
  });

  it('moi loai deu qua duoc validateStageWeights (tong dung 100%, du 8 giai doan)', () => {
    for (const type of Object.keys(Q3A_TABLE) as ProjectType[]) {
      const r = validateStageWeights(STAGE_WEIGHT_PRESETS[type]);
      expect(r.ok, `${type} phai hop le`).toBe(true);
    }
  });
});
