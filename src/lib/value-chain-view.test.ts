import { describe, expect, it } from 'vitest';
import type { ProjectStageWeight, Stage, StageCode } from '@/server/repo/types';
import type { WorkItemCompare, WorkItemCompareRow } from '@/lib/stage-timeline';
import { LEGACY_STAGE_WEIGHTS, SEED_STAGE_CODES, calcChainPctActual } from '@/lib/stages';
import {
  chainFooterSummary,
  chainWeightTotalLabel,
  stagePctLabel,
  stageTonnage,
  stageWeightLabel,
  valueChainColumns,
} from './value-chain-view';

/** 7 mã "cũ" (không gồm settlement) - dùng cho các test tính %TT theo bộ trọng số cũ. */
const OLD7 = SEED_STAGE_CODES.slice(0, 7);

const W = (stageCode: ProjectStageWeight['stageCode'], weightPct: number, applicable = true): ProjectStageWeight => ({
  projectId: 1,
  stageCode,
  weightPct,
  applicable,
});

describe('stageWeightLabel', () => {
  it('so nguyen: "40%"', () => {
    expect(stageWeightLabel([W('fabrication', 40)], 'fabrication', 'vi')).toBe('40%');
  });

  it('so le vi: dau phay thap phan "33,3%"', () => {
    expect(stageWeightLabel([W('shop', 33.333)], 'shop', 'vi')).toBe('33,3%');
  });

  it('so le en: dau cham "33.3%"', () => {
    expect(stageWeightLabel([W('shop', 33.333)], 'shop', 'en')).toBe('33.3%');
  });

  it('applicable=false -> "-"', () => {
    expect(stageWeightLabel([W('design', 5, false)], 'design', 'vi')).toBe('-');
  });

  it('khong co dong nao cho stage -> "-"', () => {
    expect(stageWeightLabel([W('shop', 10)], 'design', 'vi')).toBe('-');
  });
});

const ROW = (planned: number, actual: number): WorkItemCompareRow => ({ workItemId: 1, name: 'x', planned, actual });

describe('stageTonnage', () => {
  it('2 dong -> cong dung KH/TT', () => {
    const compare: WorkItemCompare = { fabrication: [ROW(100, 80), ROW(50, 40)] };
    expect(stageTonnage(compare, 'fabrication')).toEqual({ planned: 150, actual: 120 });
  });

  it('stage khong co key (vd design - thu cong) -> null', () => {
    const compare: WorkItemCompare = { fabrication: [ROW(100, 80)] };
    expect(stageTonnage(compare, 'design')).toBeNull();
  });

  it('mang rong -> null', () => {
    const compare: WorkItemCompare = { fabrication: [] };
    expect(stageTonnage(compare, 'fabrication')).toBeNull();
  });
});

describe('stagePctLabel (vong sua 1 muc 4a - luon 1 chu so thap phan, khac formatPct)', () => {
  it('vi: "40,0%" (co ,0 du la so tron)', () => {
    expect(stagePctLabel(0.4, 'vi')).toBe('40,0%');
  });
  it('en: "100.0%"', () => {
    expect(stagePctLabel(1, 'en')).toBe('100.0%');
  });
  it('lam tron dung 1 chu so: 0,535 -> "53,5%"', () => {
    expect(stagePctLabel(0.535, 'vi')).toBe('53,5%');
  });
});

const CHAIN_ROW = (stageCode: StageCode, pctComplete: number, applicable = true) => ({ stageCode, pctComplete, applicable });

describe('chainFooterSummary (vong sua 1 muc 4c - dong chan Sigma trong so + %TT)', () => {
  it('trong so du 100 -> weightOk=true, %TT tinh nhat quan voi calcChainPctActual + xu ly "khong ap dung" o CHAIN (khong phai o weights) giong stages.ts', () => {
    const weights: ProjectStageWeight[] = [W('design', 50), W('fabrication', 30), W('shop', 20)];
    // shop co trong so nhung chain danh dau khong ap dung -> khong duoc tinh (dung effectiveWeight cua stages.ts).
    const chain = [CHAIN_ROW('design', 0.5), CHAIN_ROW('fabrication', 0.25), CHAIN_ROW('shop', 0.9, false)];
    const out = chainFooterSummary(chain, weights, OLD7);
    expect(out.weightTotal).toBe(100);
    expect(out.weightOk).toBe(true);
    expect(out.pctTotal).toBeCloseTo((50 * 0.5 + 30 * 0.25) / (50 + 30), 10);
  });

  it('trong so lech 100 -> weightOk=false, weightTotal = tong that (khong ghi cung 100)', () => {
    const weights: ProjectStageWeight[] = [W('design', 50), W('fabrication', 30)];
    const chain = [CHAIN_ROW('design', 0.5), CHAIN_ROW('fabrication', 0.25)];
    const out = chainFooterSummary(chain, weights, OLD7);
    expect(out.weightTotal).toBe(80);
    expect(out.weightOk).toBe(false);
  });

  it('thieu han dong chain cho 1 giai doan co trong so -> mac dinh applicable=true/pct=0 (khop du danh sach order)', () => {
    const weights: ProjectStageWeight[] = [W('design', 50), W('fabrication', 50)];
    const chain = [CHAIN_ROW('design', 1)]; // thieu dong 'fabrication'
    const out = chainFooterSummary(chain, weights, OLD7);
    expect(out.pctTotal).toBeCloseTo(0.5, 10);
  });

  it('khop voi calcChainPctActual khi truyen du 7 giai doan tuong tu (nhat quan cong thuc)', () => {
    const weights: ProjectStageWeight[] = OLD7.map((s) => W(s, 100 / OLD7.length));
    const chain = OLD7.map((s) => CHAIN_ROW(s, 0.6));
    const out = chainFooterSummary(chain, weights, OLD7);
    const expected = calcChainPctActual(
      OLD7.map((s) => ({ stageCode: s, pctComplete: 0.6, applicable: true })),
      weights,
    );
    expect(out.pctTotal).toBeCloseTo(expected, 10);
  });
});

describe('chainWeightTotalLabel', () => {
  it('vi: "100%" khi tron; "95,5%" khi le', () => {
    expect(chainWeightTotalLabel(100, 'vi')).toBe('100%');
    expect(chainWeightTotalLabel(95.5, 'vi')).toBe('95,5%');
  });
});

const ST = (code: string, sortOrder: number, side: 'left' | 'right', isActive = true): Stage => ({
  code, nameVi: code, nameEn: code, sortOrder, calcMode: 'manual', side, isActive,
});

describe('valueChainColumns (giai doan dong - 2 cot tu dim_stage)', () => {
  const seed8: Stage[] = [
    ST('design', 1, 'left'), ST('shop', 2, 'left'), ST('procurement', 3, 'left'), ST('fabrication', 4, 'left'),
    ST('transport', 5, 'right'), ST('erection', 6, 'right'), ST('handover', 7, 'right'), ST('settlement', 8, 'right'),
  ];

  it('trai design/shop/procurement/fabrication; phai transport/erection/handover/settlement', () => {
    const [left, right] = valueChainColumns(seed8);
    expect(left.map((s) => s.code)).toEqual(['design', 'shop', 'procurement', 'fabrication']);
    expect(right.map((s) => s.code)).toEqual(['transport', 'erection', 'handover', 'settlement']);
  });

  it('giai doan ngung dung khong xuat hien', () => {
    const withInactive = [...seed8, ST('old', 0, 'left', false)];
    const [left] = valueChainColumns(withInactive);
    expect(left.map((s) => s.code)).not.toContain('old');
  });

  it("custom_1 ben trai sortOrder 5 -> cuoi cot trai", () => {
    const withCustom = [...seed8, ST('custom_1', 5, 'left')];
    const [left] = valueChainColumns(withCustom);
    expect(left.map((s) => s.code)).toEqual(['design', 'shop', 'procurement', 'fabrication', 'custom_1']);
  });
});

describe('chainFooterSummary voi order truyen vao (giai doan dong)', () => {
  it('chain 7 + LEGACY 8 dong + order 8 -> weightOk true, pctTotal bang tinh voi 7 dong cu', () => {
    const chain7 = SEED_STAGE_CODES.slice(0, 7).map((code) => CHAIN_ROW(code, 0.6));
    const old7 = SEED_STAGE_CODES.slice(0, 7).map((code) =>
      W(code, LEGACY_STAGE_WEIGHTS.find((w) => w.stageCode === code)!.weightPct));
    const legacy8 = LEGACY_STAGE_WEIGHTS.map((x) => W(x.stageCode, x.weightPct, x.applicable));
    const out8 = chainFooterSummary(chain7, legacy8, [...SEED_STAGE_CODES]);
    const out7 = chainFooterSummary(chain7, old7, SEED_STAGE_CODES.slice(0, 7));
    expect(out8.weightOk).toBe(true);
    expect(out8.pctTotal).toBeCloseTo(out7.pctTotal, 10);
  });
});
