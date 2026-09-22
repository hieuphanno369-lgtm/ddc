import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAGE_WEIGHTS, STAGE_ORDER, calcChainPctActual, calcStageContributions,
  calcStagePctFromVolume, findCurrentStage, normPct, validateStageWeights,
  type StageInput, type StageWeight,
} from './stages';
import { THRESHOLDS } from './thresholds';

const stage = (stageCode: StageInput['stageCode'], pctComplete: number, applicable = true): StageInput => ({
  stageCode,
  pctComplete,
  applicable,
});

const w = (stageCode: StageWeight['stageCode'], weightPct: number, applicable = true): StageWeight =>
  ({ stageCode, weightPct, applicable });

describe('% tổng thể = tổng CÓ TRỌNG SỐ', () => {
  it('0 giai đoạn áp dụng → 0 (không chia cho 0)', () => {
    expect(calcChainPctActual([])).toBe(0);
    expect(calcChainPctActual([stage('design', 0.5, false), stage('shop', 1, false)])).toBe(0);
  });

  it('tất cả = 0 → 0; tất cả = 1 → 1 (trọng số mặc định cộng đủ 100)', () => {
    expect(calcChainPctActual(STAGE_ORDER.map((s) => stage(s, 0)))).toBe(0);
    expect(calcChainPctActual(STAGE_ORDER.map((s) => stage(s, 1)))).toBeCloseTo(1, 10);
  });

  it('trọng số mặc định 5/10/10/40/5/27/3 được áp đúng, KHÔNG phải trung bình cộng', () => {
    const stages = [
      stage('design', 1), stage('shop', 0.8), stage('procurement', 0.6),
      stage('fabrication', 0), stage('transport', 0), stage('erection', 0), stage('handover', 0),
    ];
    // (5×1 + 10×0.8 + 10×0.6) / 100 = 0.19
    expect(calcChainPctActual(stages)).toBeCloseTo(0.19, 10);
    // Trung bình cộng cũ ≈ 0.342 - phải KHÁC, đây là chỗ chứng minh test có giá trị
    expect(calcChainPctActual(stages)).not.toBeCloseTo((1 + 0.8 + 0.6) / 7, 3);
  });

  it('giai đoạn không áp dụng bị loại khỏi CẢ tử số lẫn mẫu số', () => {
    const stages = [stage('design', 0.5), stage('shop', 1.0), stage('procurement', 0.9, false)];
    expect(calcChainPctActual(stages)).toBeCloseTo(12.5 / 15, 10);
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
      if (x.stageCode === 'erection') return w('erection', 32); // 27 + 5
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

describe('calcStageContributions', () => {
  it('tổng contributionPct = calcChainPctActual (bất biến của bảng chuỗi giá trị)', () => {
    const stages = [
      stage('design', 1), stage('shop', 0.8), stage('procurement', 0.6),
      stage('fabrication', 0.2), stage('transport', 0), stage('erection', 0), stage('handover', 0),
    ];
    const sum = calcStageContributions(stages).reduce((a, c) => a + c.contributionPct, 0);
    expect(sum).toBeCloseTo(calcChainPctActual(stages), 10);
  });
  it('giai đoạn không áp dụng có contributionPct = 0 nhưng vẫn nằm trong danh sách', () => {
    const rows = calcStageContributions([stage('design', 1), stage('shop', 1, false)]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.stageCode === 'shop')!.contributionPct).toBe(0);
  });
  it('trả về theo STAGE_ORDER, không theo thứ tự mảng đầu vào', () => {
    const rows = calcStageContributions([stage('erection', 1), stage('design', 1)]);
    expect(rows.map((r) => r.stageCode)).toEqual(['design', 'erection']);
  });
});

describe('Giai đoạn hiện tại (khâu nghẽn)', () => {
  it('bỏ qua giai đoạn không áp dụng', () => {
    const stages = [stage('design', 0, false), stage('shop', 0), stage('procurement', 0)];
    expect(findCurrentStage(stages)).toBe('shop');
  });
  it('trả về giai đoạn áp dụng đầu tiên có %HT < 100%', () => {
    const stages = [stage('design', 1), stage('shop', 1), stage('procurement', 0.8), stage('fabrication', 0.5)];
    expect(findCurrentStage(stages)).toBe('procurement');
  });
  it('tất cả giai đoạn áp dụng = 100% → null', () => {
    const all = STAGE_ORDER.map((s) => stage(s, 1));
    expect(findCurrentStage(all)).toBeNull();
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
    expect(findCurrentStage(STAGE_ORDER.map((s) => stage(s, 0.5, false)))).toBeNull();
    expect(findCurrentStage([])).toBeNull();
  });

  it('đúng 100% coi như xong; 99% vẫn là giai đoạn hiện tại', () => {
    expect(findCurrentStage([stage('design', 1), stage('shop', 0.99)])).toBe('shop');
    expect(findCurrentStage([stage('design', 1)])).toBeNull();
  });

  it('giai đoạn áp dụng cuối cùng (handover) chưa xong → trả về đúng nó', () => {
    const all = STAGE_ORDER.map((s) => stage(s, 1));
    all[6] = stage('handover', 0.5);
    expect(findCurrentStage(all)).toBe('handover');
  });

  it('không phụ thuộc thứ tự phần tử trong mảng (vẫn theo STAGE_ORDER)', () => {
    const shuffled = [stage('erection', 0), stage('design', 1), stage('shop', 1)];
    expect(findCurrentStage(shuffled)).toBe('erection');
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
