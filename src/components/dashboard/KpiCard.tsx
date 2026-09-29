import { IconArrowDown, IconArrowUp, type IconProps } from '@/components/icons';
import type { ScheduleGapDirection } from '@/lib/schedule-gap';
import { HelpTip } from '@/components/ui/HelpTip';

export type KpiTone = 'neutral' | 'ok' | 'warn' | 'danger';

export interface KpiScheduleGapNote {
  /** Da dich san (vd t('kpiSchedule.behind', {days, pct})) - KpiCard khong tu dich. */
  text: string;
  direction: ScheduleGapDirection;
}

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
  /**
   * Dong "Cham/Nhanh N ngay · ±x,x%" so voi tien do KH, hien duoi cung the %TT hero
   * (Vong bo sung P2B). Mau theo direction - xem SCHEDULE_GAP_COLOR.
   */
  scheduleGap?: KpiScheduleGapNote;
  /** Co -> ca the la <a href> (anchor cuon toi chart), them class "tap" (da co CSS: globals.css:253). */
  href?: string;
  /** Icon "?" giai thich chi so (P4): ngay sau nhan .lb. Co help thi the mo overflow de bong bong khong bi cat. */
  help?: { text: string; label: string };
}

/** Mau chu so chinh theo sac thai. The hero luon chu trang (nen gradient). */
const TONE_VALUE: Record<KpiTone, string> = {
  neutral: 'var(--label)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

/**
 * Mau dong "Cham/Nhanh N ngay · ±x,x%" tren nen gradient navy cua the hero. Khong dung
 * --danger/--ok mac dinh: o theme sang 2 token do la mau toi, doc kem tren navy - cung ly do
 * heroAlert (dong tren) dung --gold thay --warn/--danger. --gold dung lai cho "cham" (canh
 * bao); "nhanh" dung token rieng --mint (app/tokens.css) - mot gia tri xanh sang co dinh (khong
 * doi theo theme, giong --gold) du sang de doc tren navy.
 */
const SCHEDULE_GAP_COLOR: Record<ScheduleGapDirection, React.CSSProperties | undefined> = {
  behind: { color: 'var(--gold)' },
  ahead: { color: 'var(--mint)' },
  onTrack: undefined,
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
  scheduleGap,
  href,
  help,
}: KpiCardProps) {
  const deltaUp = (delta ?? 0) > 0;
  const hasDelta = delta != null && delta !== 0;
  const good = invertDelta ? !deltaUp : deltaUp;
  // The hero luon nen gradient navy nen chu trang moi doc duoc, TRU khi tone
  // dang canh bao (warn/danger) - luc do phai giu tin hieu mau, dung --gold
  // vi --warn ban sang khong du doi tren nen navy (B-3, danh-gia.md VONG 2).
  const heroAlert = hero && (tone === 'warn' || tone === 'danger');

  // Có delta + diễn giải dài ("so với kỳ trước cùng độ dài"): cho xuống dòng thay vì cắt "..." ở thẻ hẹp.
  const body = (
    <>
      {!hero && (
        <div className="ic">
          <Icon size={15} />
        </div>
      )}

      <div className="lb">{label}{help && <HelpTip text={help.text} label={help.label} onDark={hero} />}</div>
      <div className="vl" style={hero ? (heroAlert ? { color: 'var(--gold)' } : undefined) : { color: TONE_VALUE[tone] }}>
        {value}
      </div>

      {(hasDelta || sub || !scheduleGap) && (
      <div className="sb" style={hasDelta && deltaSuffix ? { whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', flexWrap: 'wrap', lineHeight: 1.3 } : undefined}>
        {hasDelta ? (
          <>
            <span className={`delta ${good ? 'up' : 'down'}`}>
              {deltaUp ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />}
              {Math.abs(delta!)}
            </span>
            {deltaSuffix && <span>{deltaSuffix}</span>}
          </>
        ) : (
          !sub && !scheduleGap && <span>-</span>
        )}
        {sub && <span>{sub}</span>}
      </div>
      )}
      {note && (
        <div className="sb">
          <span>{note}</span>
        </div>
      )}
      {scheduleGap && (
        // class "gap" rieng: cho phep xuong dong o the hep (globals.css) thay vi cat "..." -
        // dong nay co so % quan trong, cat mat la sai yeu cau "doc ro tren nen navy".
        <div className="sb gap" style={SCHEDULE_GAP_COLOR[scheduleGap.direction]}>
          {/* 2 dong co dinh: "▼ Cham 56 ngay" / "−19,3%" (tach o " · " cua chuoi i18n), moi dong nowrap -
              the 6 cot hep khong chua noi 1 dong, xuong dong o giua trong lech nen xep doc cho gon. */}
          {scheduleGap.text.split(' · ').map((part, i) => (
            <span key={i} style={{ whiteSpace: 'nowrap' }}>{part}</span>
          ))}
        </div>
      )}
    </>
  );

  const cls = `kpi rise${hero ? ' key' : ''}${href ? ' tap' : ''}`;

  return href ? (
    <a href={href} className={cls} style={{ color: 'inherit', textDecoration: 'none', ...(help ? { overflow: 'visible' } : null) }}>
      {body}
    </a>
  ) : (
    <div className={cls} style={help ? { overflow: 'visible' } : undefined}>{body}</div>
  );
}
