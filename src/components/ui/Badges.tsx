'use client';

import { useTranslations } from 'next-intl';
import type { Market, Priority, ProjectType, Status } from '@/server/repo/types';
import type { PenaltyState } from '@/lib/evm';
import { marketKey, priorityLabel, statusKey, typeKey } from '@/lib/labels';
import { Badge, type BadgeTone } from './Badge';

const STATUS_TONE: Record<Status, BadgeTone> = {
  Chuan_bi: 'neutral',
  Dang_trien_khai: 'info',
  Hoan_thanh: 'ok',
  Tam_dung: 'warn',
};

const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  P0: 'danger',
  P1: 'warn',
  P2: 'info',
  P3: 'neutral',
};

export function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations();
  return <Badge tone={STATUS_TONE[status]}>{t(statusKey[status])}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{priorityLabel[priority]}</Badge>;
}

export function PenaltyBadge({ penalty }: { penalty: PenaltyState }) {
  const t = useTranslations();
  if (penalty === 'penalized') return <Badge tone="danger">{t('penalty.penalized')}</Badge>;
  if (penalty === 'risk') return <Badge tone="warn">{t('penalty.risk')}</Badge>;
  return <Badge tone="neutral">{t('penalty.none')}</Badge>;
}

export function OnTrackBadge({ onTrack, status }: { onTrack: boolean; status: Status }) {
  const t = useTranslations();
  if (status !== 'Dang_trien_khai') return <span className="text-xs text-slate-400">-</span>;
  return onTrack ? (
    <Badge tone="ok">{t('onTrack.onTrack')}</Badge>
  ) : (
    <Badge tone="warn">{t('onTrack.behind')}</Badge>
  );
}

export function TypeLabel({ type }: { type: ProjectType }) {
  const t = useTranslations();
  return <>{t(typeKey[type])}</>;
}

export function MarketLabel({ market }: { market: Market }) {
  const t = useTranslations();
  return <>{t(marketKey[market])}</>;
}
