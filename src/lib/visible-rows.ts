export const WATCHLIST_VISIBLE_ROWS = 5;

/**
 * Chiều cao khung để thấy trọn `visible` dòng đầu:
 * (top + height của dòng thứ `visible`) - top dòng đầu.
 * Số dòng <= visible -> null (không giới hạn, không cần cuộn).
 */
export function maxHeightForRows(
  rows: { offsetTop: number; offsetHeight: number }[],
  visible: number,
): number | null {
  if (rows.length <= visible) return null;
  const first = rows[0];
  const last = rows[visible - 1];
  return last.offsetTop + last.offsetHeight - first.offsetTop;
}
