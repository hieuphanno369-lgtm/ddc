import { describe, expect, it } from 'vitest';
import type { Stage } from '@/server/repo/types';
import {
  DEFAULT_STAGE_WEIGHTS, LEGACY_STAGE_WEIGHTS, SEED_STAGE_CODES, activeStages, calcChainPctActual,
  calcStagePctFromVolume, findCurrentStage, fillWeightsForStages,
  isSameStageSet, nextCustomStageCode, normPct, stageName, stageNameMap, validateStageWeights,
  type StageInput, type StageWeight,
} from './stages';
import { THRESHOLDS } from './thresholds';

/** 7 mã "cũ" (không gồm settlement) - dùng lại cho các test đã có từ trước P7-C2 (hằng cứng cũ đã gỡ ở Task 7). */
const OLD7 = SEED_STAGE_CODES.slice(0, 7);

const stage = (stageCode: StageInput['stageCode'], pctComplete: number, applicable = true): StageInput => ({
  stageCode,
  pctComplete,
  applicable,
});

const w = (stageCode: StageWeight['stageCode'], weightPct: number, applicable = true): StageWeight =>
  ({ stageCode, weightPct, applicable });

describe('% tổng thể = tổng CÓ TRỌNG SỐ', () => {
  it('0 giai đoạn áp dụng → 0 (không chia cho 0)', () => {
    expect(calcChainPctActual([], DEFAULT_STAGE_WEIGHTS)).toBe(0);
    expect(calcChainPctActual([stage('design', 0.5, false), stage('shop', 1, false)], DEFAULT_STAGE_WEIGHTS)).toBe(0);
  });

  it('tất cả = 0 → 0; tất cả = 1 → 1 (trọng số mặc định cộng đủ 100)', () => {
    expect(calcChainPctActual(SEED_STAGE_CODES.map((s) => stage(s, 0)), DEFAULT_STAGE_WEIGHTS)).toBe(0);
    expect(calcChainPctActual(SEED_STAGE_CODES.map((s) => stage(s, 1)), DEFAULT_STAGE_WEIGHTS)).toBeCloseTo(1, 10);
  });

  it('trọng số mặc định 5/10/10/40/5/25/3 (P7-C2, chain 7 mã - thiếu settlement 2) áp đúng, KHÔNG phải trung bình cộng', () => {
    const stages = [
      stage('design', 1), stage('shop', 0.8), stage('procurement', 0.6),
      stage('fabrication', 0), stage('transport', 0), stage('erection', 0), stage('handover', 0),
    ];
    // (5×1 + 10×0.8 + 10×0.6) / (5+10+10+40+5+25+3) = 19 / 98 - mẫu số KHÔNG có settlement (2)
    // vì chain chỉ gửi 7 mã (settlement không nằm trong `stages`, effectiveWeight của nó không được cộng).
    expect(calcChainPctActual(stages, DEFAULT_STAGE_WEIGHTS)).toBeCloseTo(19 / 98, 10);
    // Trung bình cộng cũ ≈ 0.342 - phải KHÁC, đây là chỗ chứng minh test có giá trị
    expect(calcChainPctActual(stages, DEFAULT_STAGE_WEIGHTS)).not.toBeCloseTo((1 + 0.8 + 0.6) / 7, 3);
  });

  it('giai đoạn không áp dụng bị loại khỏi CẢ tử số lẫn mẫu số', () => {
    const stages = [stage('design', 0.5), stage('shop', 1.0), stage('procurement', 0.9, false)];
    expect(calcChainPctActual(stages, DEFAULT_STAGE_WEIGHTS)).toBeCloseTo(12.5 / 15, 10);
  });

  it('applicable=false ở BẢNG TRỌNG SỐ cũng loại giai đoạn đó (2 nguồn, cùng hiệu lực)', () => {
    const weights = [w('design', 5), w('shop', 10, false), w('procurement', 10)];
    const stages = [stage('design', 1), stage('shop', 1), stage('procurement', 0)];
    expect(calcChainPctActual(stages, weights)).toBeCloseTo(5 / 15, 10);
  });

  it('stage có trong chain nhưng KHÔNG có trong bảng trọng số → trọng số 0, bị bỏ', () => {
    const weights = [w('design', 100)];
    expect(calcChainPctActual([stage('design', 0.5), stage('erection', 1)], weights)).toBe(0.5);
  });

  it('trọng số không cộng đủ 100 vẫn chuẩn hoá đúng (mẫu số là Σw thật)', () => {
    const weights = [w('design', 30), w('shop', 20)];
    expect(calcChainPctActual([stage('design', 1), stage('shop', 0)], weights)).toBeCloseTo(0.6, 10);
  });

  it('mọi trọng số applicable = 0 → 0, không NaN', () => {
    const r = calcChainPctActual([stage('design', 1), stage('shop', 1)], [w('design', 0), w('shop', 0)]);
    expect(r).toBe(0);
    expect(Number.isNaN(r)).toBe(false);
  });
});

describe('validateStageWeights', () => {
  it('bộ mặc định hợp lệ, tổng đúng 100', () => {
    const v = validateStageWeights(DEFAULT_STAGE_WEIGHTS);
    expect(v.ok).toBe(true);
    expect(v.total).toBeCloseTo(THRESHOLDS.stageWeightTotal, 10);
  });

  it('tổng applicable KHÔNG đủ 100 → chặn, kèm tổng thực tế', () => {
    const bad = DEFAULT_STAGE_WEIGHTS.map((x) => (x.stageCode === 'fabrication' ? w('fabrication', 30) : x));
    const v = validateStageWeights(bad);
    expect(v.ok).toBe(false);
    expect(v.error).toBe('sum');
    expect(v.total).toBeCloseTo(90, 10);
  });

  it('bỏ 1 giai đoạn mà không phân bổ lại → vẫn chặn', () => {
    const bad = DEFAULT_STAGE_WEIGHTS.map((x) => (x.stageCode === 'transport' ? { ...x, applicable: false } : x));
    expect(validateStageWeights(bad).ok).toBe(false);
  });

  it('bỏ 1 giai đoạn VÀ dồn trọng số sang giai đoạn khác → hợp lệ', () => {
    const good = DEFAULT_STAGE_WEIGHTS.map((x) => {
      if (x.stageCode === 'transport') return { ...x, applicable: false };
      if (x.stageCode === 'erection') return w('erection', 30); // 25 + 5 (P7-C2: bo mac dinh moi)
      return x;
    });
    expect(validateStageWeights(good).ok).toBe(true);
  });

  it('trọng số âm → "negative"; rỗng → "empty"; trùng stageCode → "duplicate"', () => {
    expect(validateStageWeights([w('design', -1), w('shop', 101)]).error).toBe('negative');
    expect(validateStageWeights([]).error).toBe('empty');
    expect(validateStageWeights([w('design', 50), w('design', 50)]).error).toBe('duplicate');
  });

  it('sai số float trong epsilon vẫn hợp lệ', () => {
    expect(validateStageWeights([w('design', 33.333), w('shop', 33.333), w('procurement', 33.335)]).ok).toBe(true);
  });
});

describe('calcStagePctFromVolume', () => {
  it('Σ qtyActual / Σ qtyPlan', () => {
    expect(calcStagePctFromVolume([
      { qtyPlan: 100, qtyActual: 40 }, { qtyPlan: 300, qtyActual: 60 },
    ])).toBeCloseTo(0.25, 10);
  });
  it('qtyPlan = 0 → 0, KHÔNG Infinity/NaN (biên bắt buộc)', () => {
    expect(calcStagePctFromVolume([{ qtyPlan: 0, qtyActual: 10 }])).toBe(0);
    expect(calcStagePctFromVolume([{ qtyPlan: 0, qtyActual: 0 }])).toBe(0);
    expect(calcStagePctFromVolume([])).toBe(0);
  });
  it('tổng plan âm (data rác) → 0 thay vì số âm', () => {
    expect(calcStagePctFromVolume([{ qtyPlan: -5, qtyActual: 3 }])).toBe(0);
  });
  it('vượt kế hoạch cho phép > 1 (khớp quy ước pctInputMax)', () => {
    expect(calcStagePctFromVolume([{ qtyPlan: 100, qtyActual: 120 }])).toBeCloseTo(1.2, 10);
  });
});

describe('Giai đoạn hiện tại (khâu nghẽn)', () => {
  it('bỏ qua giai đoạn không áp dụng', () => {
    const stages = [stage('design', 0, false), stage('shop', 0), stage('procurement', 0)];
    expect(findCurrentStage(stages, OLD7)).toBe('shop');
  });
  it('trả về giai đoạn áp dụng đầu tiên có %HT < 100%', () => {
    const stages = [stage('design', 1), stage('shop', 1), stage('procurement', 0.8), stage('fabrication', 0.5)];
    expect(findCurrentStage(stages, OLD7)).toBe('procurement');
  });
  it('tất cả giai đoạn áp dụng = 100% → null', () => {
    const all = OLD7.map((s) => stage(s, 1));
    expect(findCurrentStage(all, OLD7)).toBeNull();
  });
});

describe('Chuẩn hóa % nhập tay', () => {
  it('nhập "50" (> 1.5) → 0.5; "0.5" giữ nguyên', () => {
    expect(normPct('50')).toBe(0.5);
    expect(normPct('0.5')).toBe(0.5);
  });
  it('ô rỗng → null; giá trị không phải số → null', () => {
    expect(normPct('')).toBeNull();
    expect(normPct('  ')).toBeNull();
    expect(normPct('abc')).toBeNull();
  });
  it('"2" (> 1.5) → 0.02 theo quy ước /100', () => {
    expect(normPct('2')).toBe(0.02);
  });
});

describe('Biên bổ sung - giai đoạn hiện tại', () => {
  it('0 giai đoạn áp dụng → null (không có khâu nghẽn, không crash)', () => {
    expect(findCurrentStage(OLD7.map((s) => stage(s, 0.5, false)), OLD7)).toBeNull();
    expect(findCurrentStage([], OLD7)).toBeNull();
  });

  it('đúng 100% coi như xong; 99% vẫn là giai đoạn hiện tại', () => {
    expect(findCurrentStage([stage('design', 1), stage('shop', 0.99)], OLD7)).toBe('shop');
    expect(findCurrentStage([stage('design', 1)], OLD7)).toBeNull();
  });

  it('giai đoạn áp dụng cuối cùng (handover) chưa xong → trả về đúng nó', () => {
    const all = OLD7.map((s) => stage(s, 1));
    all[6] = stage('handover', 0.5);
    expect(findCurrentStage(all, OLD7)).toBe('handover');
  });

  it('không phụ thuộc thứ tự phần tử trong mảng (vẫn theo order truyền vào)', () => {
    const shuffled = [stage('erection', 0), stage('design', 1), stage('shop', 1)];
    expect(findCurrentStage(shuffled, OLD7)).toBe('erection');
  });
});

describe('Biên bổ sung - normPct (quy ước nhập %, biên 150)', () => {
  it('"150" → 1.5 đúng trần (hợp lệ); "151" → 1.51 vượt trần (form báo stageRange)', () => {
    expect(normPct('150')).toBe(1.5);
    expect(normPct('150')! <= THRESHOLDS.pctInputMax).toBe(true);

    const over = normPct('151')!;
    expect(over).toBeCloseTo(1.51);
    expect(over > THRESHOLDS.pctInputMax).toBe(true);
  });

  it('"200" → 2, vượt trần → cơ sở để form báo lỗi stageRange', () => {
    const v = normPct('200')!;
    expect(v).toBe(2);
    expect(v > THRESHOLDS.pctInputMax).toBe(true);
  });

  it('"1.5" giữ nguyên (không bị /100); "0.01" giữ nguyên', () => {
    expect(normPct('1.5')).toBe(1.5);
    expect(normPct('0.01')).toBe(0.01);
  });

  it('số âm giữ nguyên (để tầng validate bắt v < 0)', () => {
    expect(normPct('-5')).toBe(-5);
  });

  it('khoảng trắng thừa quanh số vẫn parse được', () => {
    expect(normPct(' 0.5 ')).toBe(0.5);
  });
});

const S = (over: Partial<Stage> & Pick<Stage, 'code'>): Stage => ({
  nameVi: over.code, nameEn: over.code, sortOrder: 1, calcMode: 'manual', side: 'left', isActive: true,
  ...over,
});

describe('activeStages (giai doan dong)', () => {
  it('bo isActive=false', () => {
    const rows = [S({ code: 'a', sortOrder: 1 }), S({ code: 'b', sortOrder: 2, isActive: false })];
    expect(activeStages(rows).map((s) => s.code)).toEqual(['a']);
  });
  it('sortOrder 2,1 -> thu tu 1,2', () => {
    const rows = [S({ code: 'a', sortOrder: 2 }), S({ code: 'b', sortOrder: 1 })];
    expect(activeStages(rows).map((s) => s.code)).toEqual(['b', 'a']);
  });
  it('cung sortOrder -> theo code tang', () => {
    const rows = [S({ code: 'z', sortOrder: 1 }), S({ code: 'a', sortOrder: 1 })];
    expect(activeStages(rows).map((s) => s.code)).toEqual(['a', 'z']);
  });
});

describe('stageName / stageNameMap', () => {
  it("'vi' -> nameVi, 'en' -> nameEn", () => {
    const s = S({ code: 'design', nameVi: 'Thiet ke', nameEn: 'Design' });
    expect(stageName(s, 'vi')).toBe('Thiet ke');
    expect(stageName(s, 'en')).toBe('Design');
  });
  it('stageNameMap gom ca giai doan ngung dung', () => {
    const rows = [
      S({ code: 'design', nameVi: 'Thiet ke', nameEn: 'Design' }),
      S({ code: 'old', nameVi: 'Cu', nameEn: 'Old', isActive: false }),
    ];
    expect(stageNameMap(rows, 'vi')).toEqual({ design: 'Thiet ke', old: 'Cu' });
  });
});

describe('fillWeightsForStages', () => {
  it('thieu settlement -> them {settlement, 0, true}; ma la x -> bo; dung thu tu order', () => {
    const order = ['design', 'shop', 'settlement'];
    const rows = [{ stageCode: 'x', weightPct: 99, applicable: true }, { stageCode: 'shop', weightPct: 10, applicable: true }, { stageCode: 'design', weightPct: 5, applicable: true }];
    expect(fillWeightsForStages(rows, order)).toEqual([
      { stageCode: 'design', weightPct: 5, applicable: true },
      { stageCode: 'shop', weightPct: 10, applicable: true },
      { stageCode: 'settlement', weightPct: 0, applicable: true },
    ]);
  });
});

describe('isSameStageSet', () => {
  const order = ['design', 'shop', 'settlement'];
  it('dung tap khac thu tu -> true', () => {
    expect(isSameStageSet(['settlement', 'design', 'shop'], order)).toBe(true);
  });
  it('thieu 1 -> false', () => {
    expect(isSameStageSet(['design', 'shop'], order)).toBe(false);
  });
  it('thua 1 -> false', () => {
    expect(isSameStageSet(['design', 'shop', 'settlement', 'x'], order)).toBe(false);
  });
  it('trung ma -> false', () => {
    expect(isSameStageSet(['design', 'design', 'settlement'], order)).toBe(false);
  });
});

describe('nextCustomStageCode', () => {
  it('mang rong -> custom_1', () => {
    expect(nextCustomStageCode([])).toBe('custom_1');
  });
  it("(['design','custom_2','custom_10']) -> custom_11, bo qua custom_abc", () => {
    expect(nextCustomStageCode(['design', 'custom_2', 'custom_10', 'custom_abc'])).toBe('custom_11');
  });
});

describe('LEGACY_STAGE_WEIGHTS', () => {
  it('hop le, tong 100, settlement 0 ap dung', () => {
    const v = validateStageWeights(LEGACY_STAGE_WEIGHTS);
    expect(v.ok).toBe(true);
    expect(v.total).toBeCloseTo(100, 10);
    const settlement = LEGACY_STAGE_WEIGHTS.find((w) => w.stageCode === 'settlement')!;
    expect(settlement).toEqual({ stageCode: 'settlement', weightPct: 0, applicable: true });
  });
});

describe('validateStageWeights - 0% ap dung hop le (khoa luat chu du an)', () => {
  it('1 giai doan ap dung 0%, tong con lai du 100 -> ok', () => {
    const v = validateStageWeights([w('design', 100), w('settlement', 0)]);
    expect(v.ok).toBe(true);
  });
});

describe('%TT du an cu khong doi khi them Thanh quyet toan', () => {
  const chain7 = [
    stage('design', 1), stage('shop', 0.8), stage('procurement', 0.6),
    stage('fabrication', 0.4), stage('transport', 0.2), stage('erection', 0.1), stage('handover', 0),
  ];
  const old7 = DEFAULT_STAGE_WEIGHTS.map((x) => (x.stageCode === 'erection' ? w('erection', 27) : x));

  it('LEGACY_STAGE_WEIGHTS cho ket qua bang bo 7 so cu', () => {
    expect(calcChainPctActual(chain7, LEGACY_STAGE_WEIGHTS)).toBeCloseTo(calcChainPctActual(chain7, old7), 10);
  });
  it('them dong settlement pct 0.3 cung khong doi ket qua (trong so 0)', () => {
    const chain8 = [...chain7, stage('settlement', 0.3)];
    expect(calcChainPctActual(chain8, LEGACY_STAGE_WEIGHTS)).toBeCloseTo(calcChainPctActual(chain7, old7), 10);
  });
});

describe('findCurrentStage - giai doan dong (order/weights)', () => {
  const order8 = ['design', 'shop', 'procurement', 'fabrication', 'transport', 'erection', 'handover', 'settlement'];

  it('7 giai doan xong 100%, settlement 0% + weights=LEGACY -> null (Q4a)', () => {
    const done = [
      stage('design', 1), stage('shop', 1), stage('procurement', 1), stage('fabrication', 1),
      stage('transport', 1), stage('erection', 1), stage('handover', 1), stage('settlement', 0),
    ];
    expect(findCurrentStage(done, order8, LEGACY_STAGE_WEIGHTS)).toBeNull();
  });

  it('khong truyen weights -> settlement (van xet vi chain applicable=true, pct<1)', () => {
    const done = [
      stage('design', 1), stage('shop', 1), stage('procurement', 1), stage('fabrication', 1),
      stage('transport', 1), stage('erection', 1), stage('handover', 1), stage('settlement', 0),
    ];
    expect(findCurrentStage(done, order8)).toBe('settlement');
  });

  it('order dao (shop truoc design) -> theo thu tu order', () => {
    const rows = [stage('design', 0), stage('shop', 0)];
    expect(findCurrentStage(rows, ['shop', 'design'])).toBe('shop');
  });
});
