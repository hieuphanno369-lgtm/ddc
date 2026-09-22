import { IconArrowDown, IconArrowUp, type IconProps } from '@/components/icons';
import { Card } from '@/components/ui/Card';

export type KpiTone = 'neutral' | 'ok' | 'warn' | 'danger';

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  delta: number | null;
  deltaSuffix?: string;
  tone?: KpiTone;
  invertDelta?: boolean;
  hero?: boolean;
  icon: (p: IconProps) => React.ReactNode;
}

const TONE_STYLES: Record<KpiTone, { ring: string; text: string; tint: string; glow: string }> = {
  neutral: { ring: 'bg-navy-50 text-navy-700', text: 'text-navy-900', tint: 'from-slate-400', glow: 'rgba(100,116,139,0.18)' },
  ok: { ring: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-900', tint: 'from-emerald-500', glow: 'rgba(22,163,74,0.18)' },
  warn: { ring: 'bg-amber-50 text-amber-700', text: 'text-amber-900', tint: 'from-amber-500', glow: 'rgba(245,158,11,0.18)' },
  danger: { ring: 'bg-red-50 text-red-700', text: 'text-red-900', tint: 'from-red-500', glow: 'rgba(220,38,38,0.18)' },
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
}: KpiCardProps) {
  const s = TONE_STYLES[tone];
  const deltaUp = (delta ?? 0) > 0;
  const hasDelta = delta != null && delta !== 0;
  const good = invertDelta ? !deltaUp : deltaUp;
  return (
    <Card className={`card-hover relative overflow-hidden p-4 ${hero ? 'border-l-4 border-gold' : ''}`}>
      <span className={`absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r ${hero ? 'from-gold' : s.tint} to-transparent`} />
      <span
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${hero ? 'rgba(245,179,1,0.25)' : s.glow}, transparent 70%)` }}
      />
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${hero ? 'bg-gold-soft text-gold' : s.ring}`}>
          <Icon size={17} />
        </span>
      </div>
      <div className={`mt-2 ${hero ? 'text-[34px]' : 'text-[28px]'} font-bold tracking-tight tabular-nums ${s.text}`}>{value}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
        {hasDelta ? (
          <>
            <span
              className={`flex items-center gap-0.5 font-medium ${good ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {deltaUp ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />}
              {Math.abs(delta!)}
            </span>
            {deltaSuffix && <span>{deltaSuffix}</span>}
          </>
        ) : (
          <span>-</span>
        )}
        {sub && <span className="ml-auto text-slate-400">{sub}</span>}
      </div>
    </Card>
  );
}
