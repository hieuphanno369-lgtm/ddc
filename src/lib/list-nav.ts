/** ↓/↑ vòng tròn trong [0, count). current = -1 nghĩa là chưa chọn. count = 0 -> -1. Phím khác -> giữ current. */
export function nextActiveIndex(current: number, key: string, count: number): number {
  if (count <= 0) return -1;
  if (key === 'ArrowDown') return current < 0 ? 0 : (current + 1) % count;
  if (key === 'ArrowUp') return current < 0 ? count - 1 : (current - 1 + count) % count;
  return current;
}

export type ListboxAction =
  | { type: 'none' }
  | { type: 'open'; active: number } // mở danh sách + đặt mục active
  | { type: 'move'; active: number }
  | { type: 'choose'; index: number }
  | { type: 'close' };

/** Bảng quyết định phím cho ô combobox (focus luôn ở input, dùng aria-activedescendant). */
export function listboxKeyAction(key: string, s: { open: boolean; active: number; count: number }): ListboxAction {
  if (key === 'ArrowDown') {
    return s.open
      ? { type: 'move', active: nextActiveIndex(s.active, 'ArrowDown', s.count) }
      : { type: 'open', active: s.count > 0 ? 0 : -1 };
  }
  if (key === 'ArrowUp') {
    return s.open
      ? { type: 'move', active: nextActiveIndex(s.active, 'ArrowUp', s.count) }
      : { type: 'open', active: s.count > 0 ? s.count - 1 : -1 };
  }
  if (key === 'Enter') {
    return s.open && s.active >= 0 && s.active < s.count ? { type: 'choose', index: s.active } : { type: 'none' };
  }
  if (key === 'Escape') {
    return s.open ? { type: 'close' } : { type: 'none' };
  }
  return { type: 'none' };
}
