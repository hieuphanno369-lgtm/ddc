'use client';

import type { StageCode } from '@/server/repo/types';
import { useStageSelection } from './StageSelectionContext';

/**
 * Chip goc the "Chuoi gia tri" (mock-up dong 702, `#chainMode`): "Toan bo giai doan" khi chua
 * chon giai doan nao, doi thanh ten giai doan dang chon o "Timeline cac giai doan" khi co - dung
 * chung `StageSelectionContext` voi `StageExplorer` (vong sua 1 muc 4d, danh-gia.md).
 * Nhan da dich san tu server component (khong goi useTranslations o day) - giong cach Badge/
 * StatusBadge nhan chuoi da dich qua props, tranh loi "NextIntlClientProvider not found" khi
 * component nay duoc import tinh (khong qua next/dynamic ssr:false) trong cac test renderToStaticMarkup.
 */
export function ValueChainModeChip({
  allStagesLabel,
  stageLabels,
}: {
  allStagesLabel: string;
  stageLabels: Record<StageCode, string>;
}) {
  const { selected } = useStageSelection();
  return <span className="chip c-plain">{selected ? stageLabels[selected] : allStagesLabel}</span>;
}
