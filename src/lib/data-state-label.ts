/**
 * Nhãn cột "Số liệu" (D-12): chọn key i18n `asOf.*` và tháng hiển thị (MM/yyyy) theo DataState. HÀM THUẦN.
 * current -> "Số tại 09/2026"; carried -> "Dùng số tháng 08/2026"; completed -> "Hoàn thành 05/2026"; none -> "Chưa có số".
 */

import type { DataState } from './as-of';
import { formatMonthShort } from './period-format';

export function dataStateLabel(state: DataState): { key: 'asOf.month' | 'asOf.carried' | 'asOf.completed' | 'asOf.none'; month: string } {
  const month = state.month ? formatMonthShort(state.month) : '';
  switch (state.kind) {
    case 'current': return { key: 'asOf.month', month };
    case 'carried': return { key: 'asOf.carried', month };
    case 'completed': return { key: 'asOf.completed', month };
    default: return { key: 'asOf.none', month: '' };
  }
}
