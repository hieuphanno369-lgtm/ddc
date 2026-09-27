'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { StageCode } from '@/server/repo/types';

interface StageSelectionValue {
  selected: StageCode | null;
  toggle: (c: StageCode) => void;
}

/** Export dể test bơm thẳng `value` (vd ValueChainModeChip.test.ts) mà không cần mô phỏng click. */
export const StageSelectionContext = createContext<StageSelectionValue | null>(null);

/**
 * Vong sua 1 muc 4d (danh-gia.md): noi chip "Toan bo giai doan" cua the "Chuoi gia tri" voi
 * giai doan dang chon o StageExplorer, khong viet lai StageExplorer - chi doi nguon state tu
 * useState noi bo sang Context dung chung. Bao ca hai the trong Provider nay o page.tsx.
 */
export function StageSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<StageCode | null>(null);
  const toggle = (c: StageCode) => setSelected((s) => (s === c ? null : c));
  return <StageSelectionContext.Provider value={{ selected, toggle }}>{children}</StageSelectionContext.Provider>;
}

/** Ngoai Provider (vd StageExplorer.test.ts dung rieng le) -> tu tao state cuc bo, van hoat dong binh thuong. */
export function useStageSelection(): StageSelectionValue {
  const ctx = useContext(StageSelectionContext);
  const [localSelected, setLocalSelected] = useState<StageCode | null>(null);
  if (ctx) return ctx;
  return { selected: localSelected, toggle: (c) => setLocalSelected((s) => (s === c ? null : c)) };
}
