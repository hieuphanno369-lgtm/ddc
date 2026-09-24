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
  /** true -> the "Trong tam": nen gradient navy, khong hien icon. */
  hero?: boolean;
  icon: (p: IconProps) => React.ReactNode;
  /** Dong phu thu 2, hien duoi `sub` (vd "KH 520 · 6 nha thau"). */
  note?: string;
  /** Co -> ca the la <a href> (anchor cuon toi chart), them class "tap" (da co CSS: globals.css:253). */
  href?: string;
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
  icon: Icon,
  note,
  href,
}: KpiCardProps) {
  const deltaUp = (delta ?? 0) > 0;
  const hasDelta = delta != null && delta !== 0;
  const good = invertDelta ? !deltaUp : deltaUp;
  // The hero luon nen gradient navy nen chu trang moi doc duoc, TRU khi tone
  // dang canh bao (warn/danger) - luc do phai giu tin hieu mau, dung --gold
  // vi --warn ban sang khong du doi tren nen navy (B-3, danh-gia.md VONG 2).
  const heroAlert = hero && (tone === 'warn' || tone === 'danger');

  const body = (
    <>
      {!hero && (
        <div className="ic">
          <Icon size={15} />
        </div>
      )}

      <div className="lb">{label}</div>
      <div className="vl" style={hero ? (heroAlert ? { color: 'var(--gold)' } : undefined) : { color: TONE_VALUE[tone] }}>
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
      {note && (
        <div className="sb">
          <span>{note}</span>
        </div>
      )}
    </>
  );

  const cls = `kpi rise${hero ? ' key' : ''}${href ? ' tap' : ''}`;

  return href ? (
    <a href={href} className={cls} style={{ color: 'inherit', textDecoration: 'none' }}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}
