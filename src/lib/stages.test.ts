import { describe, expect, it } from 'vitest';
import { STAGE_ORDER, calcChainPctActual, findCurrentStage, normPct, type StageInput } from './stages';
import { THRESHOLDS } from './thresholds';

const stage = (stageCode: StageInput['stageCode'], pctComplete: number, applicable = true): StageInput => ({
  stageCode,
  pctComplete,
  applicable,
});

describe('% tổng thể chuỗi giá trị', () => {
  it('0 giai đoạn áp dụng → 0 (không chia cho 0)', () => {
    expect(calcChainPctActual([])).toBe(0);
    expect(calcChainPctActual([stage('design', 0.5, false), stage('shop', 1, false)])).toBe(0);
  });
  it('tất cả giai đoạn áp dụng = 0 → 0', () => {
    const all = STAGE_ORDER.map((s) => stage(s, 0));
    expect(calcChainPctActual(all)).toBe(0);
  });
  it('tất cả giai đoạn áp dụng = 1 → 1', () => {
    const all = STAGE_ORDER.map((s) => stage(s, 1));
    expect(calcChainPctActual(all)).toBe(1);
  });
  it('giai đoạn không áp dụng bị loại khỏi mẫu số', () => {
    const stages = [stage('design', 0.5), stage('shop', 1.0), stage('procurement', 0.9, false)];
    expect(calcChainPctActual(stages)).toBe(0.75);
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

describe('Biên bổ sung - % tổng thể (ke-hoach mục 3)', () => {
  it('chỉ 1 giai đoạn áp dụng → % tổng đúng bằng chính nó (không chia theo 7)', () => {
    expect(calcChainPctActual([stage('design', 0.4), stage('shop', 1, false), stage('handover', 0.9, false)])).toBe(0.4);
  });

  it('mẫu số CHỈ gồm giai đoạn áp dụng - khác hẳn trung bình trên cả 7 giai đoạn', () => {
    // Đây là "chứng minh test có giá trị": nếu ai đó tính naive (chia 7 hoặc gồm cả
    // giai đoạn non-applicable) thì kết quả sẽ KHÁC và test này rớt.
    const stages: StageInput[] = [
      stage('design', 0.5),
      stage('shop', 1.0),
      stage('procurement', 0.9, false), // non-applicable, giá trị cao - phải bị loại bỏ
      ...(['fabrication', 'transport', 'erection', 'handover'] as const).map((s) => stage(s, 0, false)),
    ];

    const correct = calcChainPctActual(stages); // (0.5 + 1.0) / 2 = 0.75
    const naiveChia7 = stages.reduce((sum, s) => sum + s.pctComplete, 0) / 7; // 2.4/7 ≈ 0.343
    const naiveGomTatCa = stages.reduce((sum, s) => sum + s.pctComplete, 0) / stages.length; // 2.4/7

    expect(correct).toBe(0.75);
    expect(correct).not.toBe(naiveChia7);
    expect(correct).not.toBe(naiveGomTatCa);
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
