import { IconArrowDown, IconArrowUp, type IconProps } from '@/components/icons';

export type KpiTone = 'neutral' | 'ok' | 'warn' | 'danger';

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  delta: number | null;
  deltaSuffix?: string;
  tone?: KpiTone;
  invertDelta?: boolean;
  /** true -> the "Trong tam": nen gradient navy + tag vang, khong hien icon. */
  hero?: boolean;
  /**
   * Chu tren tag vang khi hero=true (vd. da dich san "Trong tam"/"Focus").
   * KpiCard KHONG tu dich: component nay phai o lai dang sync (khong 'use client',
   * khong async) de renderToStaticMarkup trong test render trang van dung duoc
   * khi long trong cay Server Component - nen ben goi (da co t() san) tu tinh
   * chu roi truyen xuong.
   */
  heroTagLabel?: string;
  icon: (p: IconProps) => React.ReactNode;
}

/** Mau chu so chinh theo sac thai. The hero luon chu trang (nen gradient). */
const TONE_VALUE: Record<KpiTone, string> = {
  neutral: 'var(--label)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

export function KpiCard({
  label,
  value,
  sub,
  delta,
  deltaSuffix,
  tone = 'neutral',
  invertDelta = false,
  hero = false,
  heroTagLabel,
  icon: Icon,
}: KpiCardProps) {
  const deltaUp = (delta ?? 0) > 0;
  const hasDelta = delta != null && delta !== 0;
  const good = invertDelta ? !deltaUp : deltaUp;

  return (
    <div className={`kpi rise${hero ? ' key' : ''}`}>
      {hero ? (
        <span className="tag">{heroTagLabel}</span>
      ) : (
        <div className="ic">
          <Icon size={15} />
        </div>
      )}

      <div className="lb">{label}</div>
      <div className="vl" style={hero ? undefined : { color: TONE_VALUE[tone] }}>
        {value}
      </div>

      <div className="sb">
        {hasDelta ? (
          <>
            <span className={`delta ${good ? 'up' : 'down'}`}>
              {deltaUp ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />}
              {Math.abs(delta!)}
            </span>
            {deltaSuffix && <span>{deltaSuffix}</span>}
          </>
        ) : (
          !sub && <span>-</span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}
