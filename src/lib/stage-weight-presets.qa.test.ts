import { describe, expect, it } from 'vitest';
import { presetWeightsFor, STAGE_WEIGHT_PRESETS } from './stage-weight-presets';
import { DEFAULT_STAGE_WEIGHTS, STAGE_ORDER, validateStageWeights } from './stages';
import type { ProjectType } from '@/server/repo/types';

/**
 * Kiem thu doc lap Q1/G-6 - doi chieu TUNG SO trong bang Q1 da chot (khong chi kiem tong = 100
 * nhu coder da lam trong stage-weight-presets.test.ts), va kiem preset KHONG bi lech thu tu cot.
 */
const Q1_TABLE: Record<ProjectType, number[]> = {
  EPC: [8, 10, 15, 32, 5, 27, 3],
  San_bay: [4, 8, 8, 42, 5, 30, 3],
  San_van_dong: [5, 10, 8, 38, 6, 30, 3],
  Nha_xuong: [3, 7, 20, 38, 5, 24, 3],
  Cau_cang: [5, 10, 10, 38, 10, 24, 3],
  Cao_tang: [5, 12, 10, 35, 5, 30, 3],
  Dong_tau: [8, 12, 15, 45, 2, 15, 3],
  Cau_giao_thong: [6, 10, 10, 37, 8, 26, 3],
  Khac: [5, 10, 10, 40, 5, 27, 3],
};

describe('STAGE_WEIGHT_PRESETS - dung tung so bang Q1 da chot (chu du an, 2026-09-25)', () => {
  for (const type of Object.keys(Q1_TABLE) as ProjectType[]) {
    it(`${type}: dung thu tu STAGE_ORDER va dung tung diem %`, () => {
      const rows = STAGE_WEIGHT_PRESETS[type];
      expect(rows.map((r) => r.stageCode)).toEqual(STAGE_ORDER);
      expect(rows.map((r) => r.weightPct)).toEqual(Q1_TABLE[type]);
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

  it('moi loai deu qua duoc validateStageWeights (tong dung 100%, du 7 giai doan)', () => {
    for (const type of Object.keys(Q1_TABLE) as ProjectType[]) {
      const r = validateStageWeights(STAGE_WEIGHT_PRESETS[type]);
      expect(r.ok, `${type} phai hop le`).toBe(true);
    }
  });
});
