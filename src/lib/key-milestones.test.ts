import { describe, expect, it } from 'vitest';
import {
  addKeyMilestone, estimateLabelWidth, keyMilestoneState, keyMsDomain, keyMsSuggestions,
  layoutMilestoneLabels, normalizeKeyMilestones, removeKeyMilestone, toKeyMilestoneDraft,
  updateKeyMilestone, validateKeyMilestones,
} from './key-milestones';

describe('keyMilestoneState', () => {
  it('da xong, tre', () => {
    expect(keyMilestoneState('2026-01-15', '2026-01-18', '2026-09-16')).toEqual({ kind: 'done', days: 3, tone: 'warn' });
  });
  it('da xong, som', () => {
    expect(keyMilestoneState('2026-03-01', '2026-02-27', '2026-09-16')).toEqual({ kind: 'done', days: -2, tone: 'ok' });
  });
  it('da xong, dung han', () => {
    expect(keyMilestoneState('2026-03-01', '2026-03-01', '2026-09-16')).toEqual({ kind: 'done', days: 0, tone: 'ok' });
  });
  it('da tre, chua xong', () => {
    expect(keyMilestoneState('2026-09-15', null, '2026-09-16')).toEqual({ kind: 'late', days: 1, tone: 'danger' });
  });
  it('con toi, chua xong', () => {
    expect(keyMilestoneState('2026-09-29', null, '2026-09-16')).toEqual({ kind: 'next', days: 13, tone: 'accent' });
  });
  it('dung ngay hom nay, chua xong', () => {
    expect(keyMilestoneState('2026-09-16', null, '2026-09-16')).toEqual({ kind: 'next', days: 0, tone: 'accent' });
  });
});

describe('layoutMilestoneLabels', () => {
  it('4 hop cach xa nhau -> xen ke tren/duoi, tang tang khi cham', () => {
    expect(layoutMilestoneLabels([{ x: 100, width: 100 }, { x: 150, width: 100 }, { x: 200, width: 100 }, { x: 250, width: 100 }])).toEqual([
      { side: -1, tier: 0 }, { side: 1, tier: 0 }, { side: -1, tier: 1 }, { side: 1, tier: 1 },
    ]);
  });
  it('5 hop cung vi tri -> hop thu 5 doi phia', () => {
    const boxes = Array.from({ length: 5 }, () => ({ x: 100, width: 100 }));
    expect(layoutMilestoneLabels(boxes)).toEqual([
      { side: -1, tier: 0 }, { side: 1, tier: 0 }, { side: -1, tier: 1 }, { side: 1, tier: 1 }, { side: 1, tier: 1 },
    ]);
  });
});

describe('estimateLabelWidth', () => {
  it('uoc luong theo do dai chuoi dai hon', () => {
    expect(estimateLabelWidth('abcd', 'ab')).toBeCloseTo(4 * 7.4 + 18, 5);
  });
});

describe('keyMsDomain', () => {
  it('1 ngay duy nhat -> +-14 ngay', () => {
    const T = Date.parse('2026-09-16T00:00:00Z');
    const d = keyMsDomain(['2026-09-16'], '2026-09-16');
    expect(d.lo).toBe(T - 14 * 86_400_000);
    expect(d.hi).toBe(T + 14 * 86_400_000);
  });
  it('khoang rong -> nghi them 6% moi dau', () => {
    const d = keyMsDomain(['2026-01-01', '2026-12-31'], '2026-06-01');
    expect((d.hi - d.lo) / 86_400_000).toBeCloseTo(364 * 1.12, 5);
  });
});

describe('validateKeyMilestones', () => {
  it('bat dung o rows', () => {
    const r = validateKeyMilestones([
      { name: ' ', plannedDate: '2026-09-01', actualDate: null },
      { name: 'A', plannedDate: '', actualDate: 'x' },
    ]);
    expect(r).toEqual({ ok: false, errors: { 0: ['name'], 1: ['plannedDate', 'actualDate'] } });
  });
  it('mang hop le -> ok, khong loi', () => {
    const r = validateKeyMilestones([{ name: 'A', plannedDate: '2026-09-01', actualDate: null }]);
    expect(r).toEqual({ ok: true, errors: {} });
  });
  it('51 dong hop le -> ok:false (vuot KEY_MS_MAX_ROWS)', () => {
    const rows = Array.from({ length: 51 }, () => ({ name: 'A', plannedDate: '2026-09-01', actualDate: null }));
    expect(validateKeyMilestones(rows).ok).toBe(false);
  });
});

describe('normalizeKeyMilestones', () => {
  it('trim ten, chuoi rong -> null cho actualDate', () => {
    expect(normalizeKeyMilestones([{ name: ' A ', plannedDate: '2026-09-01', actualDate: '' }]))
      .toEqual([{ name: 'A', plannedDate: '2026-09-01', actualDate: null }]);
  });
});

describe('toKeyMilestoneDraft', () => {
  it('map dung tu ProjectKeyMilestone, plannedDate null -> chuoi rong', () => {
    expect(toKeyMilestoneDraft({ id: 1, projectId: 1, name: 'A', sortOrder: 1, plannedDate: null, actualDate: null }))
      .toEqual({ name: 'A', plannedDate: '', actualDate: null });
  });
});

describe('addKeyMilestone / removeKeyMilestone / updateKeyMilestone', () => {
  it('addKeyMilestone them dong moi, khong mutate mang goc', () => {
    const rows = [] as ReturnType<typeof toKeyMilestoneDraft>[];
    const next = addKeyMilestone(rows, 'Mốc mới 1', '2026-09-16');
    expect(next).toEqual([{ name: 'Mốc mới 1', plannedDate: '2026-09-16', actualDate: null }]);
    expect(rows).toEqual([]);
  });
  it('addKeyMilestone khi da du 50 dong -> tra nguyen mang', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ name: `M${i}`, plannedDate: '2026-09-16', actualDate: null }));
    expect(addKeyMilestone(rows, 'Thêm', '2026-09-16')).toBe(rows);
  });
  it('removeKeyMilestone khong mutate mang goc', () => {
    const rows = [{ name: 'A', plannedDate: '2026-09-16', actualDate: null }, { name: 'B', plannedDate: '2026-09-17', actualDate: null }];
    const next = removeKeyMilestone(rows, 0);
    expect(next).toEqual([{ name: 'B', plannedDate: '2026-09-17', actualDate: null }]);
    expect(rows).toHaveLength(2);
  });
  it('updateKeyMilestone khong mutate mang goc', () => {
    const rows = [{ name: 'A', plannedDate: '2026-09-16', actualDate: null }];
    const next = updateKeyMilestone(rows, 0, { name: 'A2' });
    expect(next).toEqual([{ name: 'A2', plannedDate: '2026-09-16', actualDate: null }]);
    expect(rows[0].name).toBe('A');
  });
});

describe('keyMsSuggestions', () => {
  it('loai bo ten da co, gioi han so luong', () => {
    const rows = [{ name: 'S1', plannedDate: '2026-09-16', actualDate: null }];
    expect(keyMsSuggestions(rows, ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'])).toEqual(['S2', 'S3', 'S4', 'S5']);
  });
});
