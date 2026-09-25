'use client';

import { useTranslations } from 'next-intl';
import type { StageCode } from '@/server/repo/types';
import type { IsoDate } from '@/lib/clock';
import { stageKey } from '@/lib/labels';
import { formatDateShort } from '@/lib/format';
import { STAGE_MARKERS, type StageTimelineRow, type WorkItemCompare } from '@/lib/stage-timeline';
import { STAGE_CALC_MODE } from '@/lib/stages';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Legend } from '@/components/ui/Legend';
import { StageTimelineChart } from './StageTimelineChart';
import { WorkItemCompareChart } from './WorkItemCompareChart';
import { varianceColor, varianceText } from './stageText';
import { useStageSelection } from './StageSelectionContext';

/** Thẻ "Timeline của 7 giai đoạn" (mock-up dòng 710-714) + thẻ "Biểu đồ so sánh" (mock-up dòng 716-720), dùng chung `selected`. */
export function StageExplorer({ rows, compare, today, locale }: { rows: StageTimelineRow[]; compare: WorkItemCompare; today: IsoDate; locale: string }) {
  const t = useTranslations();
  // Vong sua 1 muc 4d: state chon giai doan lay tu StageSelectionContext (dung chung voi chip
  // the "Chuoi gia tri") thay vi useState rieng - ngoai Provider van hoat dong nho fallback cuc bo.
  const { selected, toggle } = useStageSelection();
  const sel = rows.find((r) => r.stageCode === selected) ?? null;
  const cmpStage: StageCode = selected ?? 'fabrication';
  const cmpRows = compare[cmpStage] ?? [];
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

      <Card>
        <CardHeader
          title={`${t('detail.cmp.title')} -`}
          titleExtra={<span style={{ color: 'var(--accent)' }}>{t(stageKey[cmpStage])}{selected ? '' : ` ${t('detail.cmp.default')}`}</span>}
          action={<Legend items={[{ label: t('detail.cmp.planTon'), color: 'var(--s-plan)' }, { label: t('detail.cmp.actualTon'), color: 'var(--s-actual)' }]} />}
        />
        <CardBody>
          {STAGE_CALC_MODE[cmpStage] === 'manual' ? (
            <p className="empty">{t('detail.cmp.manualStage')}</p>
          ) : cmpRows.length ? (
            <WorkItemCompareChart rows={cmpRows} locale={locale} />
          ) : (
            <p className="empty">{t('detail.cmp.empty')}</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
