import { describe, expect, it } from 'vitest';
import { presetWeightsFor, STAGE_WEIGHT_PRESETS } from './stage-weight-presets';
import { DEFAULT_STAGE_WEIGHTS, SEED_STAGE_CODES, fillWeightsForStages, validateStageWeights } from './stages';

/**
 * Tester doc lap P7-C2: ke hoach (muc "Truong hop bien bat buoc xu ly") co neu ten:
 * "Bo theo loai du an khi mot giai doan goc bi ngung dung: fillWeightsForStages bo giai doan
 * do, tong co the lech 100, form bao do, nguoi dung tu chia lai (chap nhan, khong tu chia)."
 * Chua co test nao (stage-weight-presets.test.ts / .qa.test.ts cua coder) dung truc tiep truong
 * hop nay - ca hai file do chi kiem order THEM ma moi (custom_1), chua kiem order BO BOT 1 ma goc.
 */
describe('presetWeightsFor + fillWeightsForStages khi 1 giai doan goc bi ngung dung (bien tu ke hoach)', () => {
  const orderWithoutFabrication = SEED_STAGE_CODES.filter((c) => c !== 'fabrication');

  it("EPC voi order thieu 'fabrication' -> ket qua KHONG con dong fabrication, dung 7 dong con lai theo dung thu tu order", () => {
    const rows = presetWeightsFor('EPC', orderWithoutFabrication);

    expect(rows.map((r) => r.stageCode)).toEqual(orderWithoutFabrication);
    expect(rows.some((r) => r.stageCode === 'fabrication')).toBe(false);
  });

  it("tong trong so ap dung LECH 100 dung bang trong so fabrication da mat (32 cua bo EPC) -> validateStageWeights bao loi 'sum'", () => {
    const epcFabricationPct = STAGE_WEIGHT_PRESETS.EPC.find((r) => r.stageCode === 'fabrication')!.weightPct;
    const rows = presetWeightsFor('EPC', orderWithoutFabrication);

    const total = rows.filter((r) => r.applicable).reduce((s, r) => s + r.weightPct, 0);
    expect(total).toBe(100 - epcFabricationPct);

    const result = validateStageWeights(rows);
    expect(result).toEqual({ ok: false, total, error: 'sum' });
  });

  it('bo mac dinh (Khac/DEFAULT_STAGE_WEIGHTS) cung bi lech tuong tu khi thieu 1 ma goc, khong tu chia lai cho cac giai doan con lai', () => {
    const defaultFabricationPct = DEFAULT_STAGE_WEIGHTS.find((r) => r.stageCode === 'fabrication')!.weightPct;
    const rows = fillWeightsForStages(DEFAULT_STAGE_WEIGHTS, orderWithoutFabrication);

    const total = rows.reduce((s, r) => s + (r.applicable ? r.weightPct : 0), 0);
    expect(total).toBe(100 - defaultFabricationPct);
    // Cac dong con lai GIU NGUYEN so cu (khong tu chia lai phan thieu) - dung y "chap nhan, khong tu chia".
    for (const r of rows) {
      const original = DEFAULT_STAGE_WEIGHTS.find((x) => x.stageCode === r.stageCode)!;
      expect(r.weightPct).toBe(original.weightPct);
    }
  });

  it('duong chay thuan loi (doi chieu): order du 8 ma goc -> tong dung 100, hop le cho ca 8 bo preset', () => {
    for (const type of Object.keys(STAGE_WEIGHT_PRESETS) as (keyof typeof STAGE_WEIGHT_PRESETS)[]) {
      const rows = presetWeightsFor(type as never, SEED_STAGE_CODES);
      expect(validateStageWeights(rows).ok).toBe(true);
    }
  });
});
