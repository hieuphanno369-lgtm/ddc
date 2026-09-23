'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { StageCode } from '@/server/repo/types';
import type { IsoDate } from '@/lib/clock';
import { stageKey } from '@/lib/labels';
import { formatDateShort } from '@/lib/format';
import { STAGE_MARKERS, type StageTimelineRow } from '@/lib/stage-timeline';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Legend } from '@/components/ui/Legend';
import { StageTimelineChart } from './StageTimelineChart';
import { varianceColor, varianceText } from './stageText';

/** Thẻ "Timeline của 7 giai đoạn" (mock-up dòng 710-714). Task 10 thêm thẻ "Biểu đồ so sánh" dùng chung `selected`. */
export function StageExplorer({ rows, today }: { rows: StageTimelineRow[]; today: IsoDate; locale: string }) {
  const t = useTranslations();
  const [selected, setSelected] = useState<StageCode | null>(null);
  const toggle = (c: StageCode) => setSelected((s) => (s === c ? null : c));
  const sel = rows.find((r) => r.stageCode === selected) ?? null;
  return (
    <>
      <Card>
        <CardHeader
          title={t('detail.stageMs.title')}
          action={<Legend items={[
            ...STAGE_MARKERS.map((m) => ({ label: t(m.labelKey), color: m.color, shape: m.shape })),
            { label: t('common.today'), color: 'var(--danger)', line: true },
          ]} />}
        />
        <div className="msdetail">
          {sel ? (
            <>
              <span style={{ fontWeight: 750, color: 'var(--label)' }}>{t(stageKey[sel.stageCode])}</span>
              {STAGE_MARKERS.map((m) => (
                <span key={m.key} className="k"><i style={{ background: m.color }} />{t(m.labelKey)} <b>{formatDateShort(sel[m.key])}</b></span>
              ))}
              <span className="k">
                <i style={{ background: varianceColor(sel.dayVariance, 'var(--label3)') }} />{t('detail.stageMs.variance')}{' '}
                <b style={{ color: varianceColor(sel.dayVariance, 'var(--label)') }}>{varianceText(t, sel.dayVariance)}</b>
              </span>
            </>
          ) : (
            <span className="hint">{t('detail.stageMs.hint')}</span>
          )}
        </div>
        <CardBody>
          {rows.length ? <StageTimelineChart rows={rows} today={today} selected={selected} onToggle={toggle} /> : <p className="empty">{t('detail.stageMs.empty')}</p>}
        </CardBody>
      </Card>
    </>
  );
}
