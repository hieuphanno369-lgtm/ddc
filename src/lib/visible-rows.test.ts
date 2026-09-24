import { describe, expect, it } from 'vitest';
import { maxHeightForRows, WATCHLIST_VISIBLE_ROWS } from './visible-rows';

const rowsAt = (tops: number[], height = 72) => tops.map((offsetTop) => ({ offsetTop, offsetHeight: height }));

describe('maxHeightForRows', () => {
  it('7 dong, top [0,82,164,...], height 72 -> 4*82+72 = 400', () => {
    const tops = [0, 82, 164, 246, 328, 410, 492];
    expect(maxHeightForRows(rowsAt(tops), WATCHLIST_VISIBLE_ROWS)).toBe(400);
  });

  it('so dong <= visible (5 dong) -> null (khong gioi han)', () => {
    const tops = [0, 82, 164, 246, 328];
    expect(maxHeightForRows(rowsAt(tops), WATCHLIST_VISIBLE_ROWS)).toBeNull();
  });

  it('0 dong -> null', () => {
    expect(maxHeightForRows([], WATCHLIST_VISIBLE_ROWS)).toBeNull();
  });

  it('dong dau co top 10 (khung cha co padding) -> tru di 10', () => {
    const tops = [10, 92, 174, 256, 338, 420, 502];
    expect(maxHeightForRows(rowsAt(tops), WATCHLIST_VISIBLE_ROWS)).toBe(400);
  });
});
