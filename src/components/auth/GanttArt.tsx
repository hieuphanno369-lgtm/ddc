import { useTranslations } from 'next-intl';
import {
  IconCrane,
  IconHexNut,
  IconSetSquare,
  IconSteelBeam,
  IconTruck,
} from '@/components/icons';
import s from './auth.module.css';
import { cx } from './cx';

type StageKey = 'stageDesign' | 'stageProcurement' | 'stageFabrication' | 'stageDelivery' | 'stageErection';

interface GanttRow {
  key: StageKey;
  Icon: typeof IconSetSquare;
  left: number;
  width: number;
  state: 'done' | 'run' | 'plan';
  delay: 1 | 2 | 3 | 4 | 5;
}

const ROWS: GanttRow[] = [
  { key: 'stageDesign', Icon: IconSetSquare, left: 0, width: 34, state: 'done', delay: 1 },
  { key: 'stageProcurement', Icon: IconSteelBeam, left: 18, width: 30, state: 'done', delay: 2 },
  { key: 'stageFabrication', Icon: IconHexNut, left: 36, width: 30, state: 'run', delay: 3 },
  { key: 'stageDelivery', Icon: IconTruck, left: 60, width: 22, state: 'plan', delay: 4 },
  { key: 'stageErection', Icon: IconCrane, left: 70, width: 30, state: 'plan', delay: 5 },
];

const DELAY_CLASS = { 1: s.d1, 2: s.d2, 3: s.d3, 4: s.d4, 5: s.d5 } as const;

/**
 * Khối Gantt minh hoạ tĩnh (không đọc dữ liệu dự án, người chưa đăng nhập không được thấy dữ liệu thật).
 * full: đăng nhập (tiêu đề, chú giải, tháng, 5 dòng có icon, vạch Hôm nay); compact: đăng ký (4 dòng, không icon).
 */
export function GanttArt({ variant }: { variant: 'full' | 'compact' }) {
  const t = useTranslations();
  const compact = variant === 'compact';
  const rows = compact ? ROWS.filter((r) => r.key !== 'stageDelivery') : ROWS;
  const months = t('authPage.months').split(',');

  return (
    <div
      className={cx(s.glass, s.gantt, compact && s.ganttCompact)}
      data-auth={compact ? 'gantt-compact' : 'gantt-full'}
    >
      {!compact && (
        <>
          <div className={s.ganttHead}>
            <span className={s.ganttTitle}>{t('authPage.ganttTitle')}</span>
            <div className={s.legend}>
              <span><i className={s.swDone} />{t('authPage.legendDone')}</span>
              <span><i className={s.swRun} />{t('authPage.legendRunning')}</span>
              <span><i className={s.swPlan} />{t('authPage.legendPlan')}</span>
            </div>
          </div>
          <div className={s.months}>
            <span className={s.monthsLabel} />
            <div className={s.monthsGrid}>
              {months.map((m) => <span key={m}>{m}</span>)}
            </div>
          </div>
        </>
      )}
      <div className={s.rows}>
        {rows.map(({ key, Icon, left, width, state, delay }) => (
          <div key={key} className={cx(s.row, compact && s.rowCompact)}>
            <span className={cx(s.rowLabel, compact && s.rowLabelCompact, state === 'run' && s.rowLabelRun)}>
              {!compact && (
                state === 'run'
                  ? <IconHexNut size={16} className={cx(s.spin, s.nut)} data-anim="spin" />
                  : <Icon size={16} />
              )}
              {t(`authPage.${key}`)}
            </span>
            <div className={s.track}>
              <div
                className={cx(
                  state === 'done' && s.barDone,
                  state === 'run' && s.barRun,
                  state === 'plan' && s.barPlan,
                  state === 'run' && !compact && s.barRunRing,
                  !compact && s.bar,
                  !compact && DELAY_CLASS[delay],
                )}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            </div>
          </div>
        ))}
        {!compact && (
          <>
            <div className={cx(s.todayLine, s.today)} />
            <div className={cx(s.todayPill, s.today)}>{t('authPage.today')}</div>
          </>
        )}
      </div>
    </div>
  );
}
