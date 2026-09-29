import { describe, expect, it } from 'vitest';
import { carriedRuns, withRunKeys } from './carried-segments';

describe('carriedRuns: tách đoạn nét liền / nét đứt theo số dự án dùng số tháng trước', () => {
  it('[0,1,0]: đoạn tới tháng 2 nét đứt, đoạn tới tháng 3 nét liền', () => {
    expect(carriedRuns([0, 1, 0])).toEqual([
      { dashed: true, from: 0, to: 1 },
      { dashed: false, from: 1, to: 2 },
    ]);
  });

  it('không có tháng mang số: một đoạn liền phủ hết', () => {
    expect(carriedRuns([0, 0, 0])).toEqual([{ dashed: false, from: 0, to: 2 }]);
  });

  it('mang số liên tiếp gộp thành 1 đoạn đứt', () => {
    expect(carriedRuns([0, 2, 1, 0])).toEqual([
      { dashed: true, from: 0, to: 2 },
      { dashed: false, from: 2, to: 3 },
    ]);
  });

  it('1 tháng: một điểm, nét liền; rỗng: không đoạn nào', () => {
    expect(carriedRuns([3])).toEqual([{ dashed: false, from: 0, to: 0 }]);
    expect(carriedRuns([])).toEqual([]);
  });
});

describe('withRunKeys: thêm cột dữ liệu riêng cho từng đoạn', () => {
  it('mỗi đoạn có cột `${key}_r${n}`, chỉ có giá trị ở các chỉ số của đoạn, còn lại null', () => {
    const data = [
      { m: 'a', v: 1, carriedProjects: 0 },
      { m: 'b', v: 2, carriedProjects: 1 },
      { m: 'c', v: 3, carriedProjects: 0 },
    ];
    const runs = carriedRuns(data.map((d) => d.carriedProjects));
    const out = withRunKeys(data, ['v'], runs);
    expect(out.map((r) => r.v_r0)).toEqual([1, 2, null]);
    expect(out.map((r) => r.v_r1)).toEqual([null, 2, 3]);
    expect(out[0].v).toBe(1);
  });
});
