'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale, useTranslations } from 'next-intl';
import { carriedRuns, withRunKeys } from '@/lib/carried-segments';
import { THRESHOLDS } from '@/lib/thresholds';
import { formatRatio, formatTyd } from '@/lib/format';
import { LabelModeSwitch, smartIndices, useLabelMode, valueLabel } from './ChartLabels';
import { useChartTokens } from './useChartTokens';

/** Tooltip kinh - inline style nen var() chay duoc. */
export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 'var(--r-sm)',
    border: '.5px solid var(--glass-stroke)',
    background: 'var(--glass-3)',
    backdropFilter: 'blur(var(--mat-thick)) saturate(var(--mat-sat))',
    WebkitBackdropFilter: 'blur(var(--mat-thick)) saturate(var(--mat-sat))',
    boxShadow: 'var(--e4)',
    fontSize: 'var(--t-caption1)',
    color: 'var(--label)',
    padding: '10px 12px',
  },
  itemStyle: { color: 'var(--label2)' },
  labelStyle: { color: 'var(--label)', fontWeight: 700, marginBottom: 6 },
} as const;

/** Nhãn đơn vị trục Y (D-11), xoay dọc sát mép trái. */
function yUnit(value: string, fill: string) {
  return { value, angle: -90, position: 'insideLeft', offset: 4, style: { fontSize: 10, fill, textAnchor: 'middle' } } as const;
}

/** Tooltip: thêm "N dự án dùng số tháng trước" ở tiêu đề khi tháng đó có số mang sang (D-10). */
function carriedLabel(t: (k: string, v?: Record<string, number>) => string) {
  return (label: unknown, payload: readonly { payload?: { carriedProjects?: number } }[]) => {
    const n = payload?.[0]?.payload?.carriedProjects ?? 0;
    return n > 0 ? `${label} · ${t('asOf.carriedTip', { n })}` : String(label);
  };
}

export function StatusDonut({
  data,
  onSelect,
  center,
}: {
  data: { status: string; value: number; label: string; color: string }[];
  onSelect?: (status: string) => void;
  /** 7.9: so + nhan dat giua vong tron (lop phu khong chan click vao lat banh). */
  center?: { value: string; label: string };
}) {
  const c = useChartTokens();
  return (
    <div className="relative">
    {center && (
      <div
        data-testid="donut-total"
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        <b className="text-title2 font-bold leading-none text-label">{center.value}</b>
        <span className="mt-1 max-w-[96px] text-caption2 leading-tight text-label3">{center.label}</span>
      </div>
    )}
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={60}
          outerRadius={88}
          paddingAngle={2}
          strokeWidth={2}
          onClick={(d: any) => onSelect?.(d?.status)}
        >
          {data.map((d) => (
            <Cell key={d.status} fill={d.color} className="cursor-pointer" />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} />
      </PieChart>
    </ResponsiveContainer>
    </div>
  );
}

export function GroupBar({
  data,
  onSelect,
  showValue = true,
}: {
  data: { key: string; tonnage: number; value: number | null }[];
  onSelect?: (key: string) => void;
  showValue?: boolean;
}) {
  const c = useChartTokens();
  const t = useTranslations();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis dataKey="key" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: c.axis }}
          tickLine={false}
          axisLine={false}
          label={yUnit(showValue ? t('chartHowTo.axisBillion') : t('chartHowTo.axisTon'), c.axis)}
        />
        {showValue && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: c.axis }}
            tickLine={false}
            axisLine={false}
            label={{ ...yUnit(t('chartHowTo.axisTon'), c.axis), angle: 90, position: 'insideRight' }}
          />
        )}
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 'var(--t-caption1)' }} />
        {showValue ? (
          <>
            <Bar
              yAxisId="left"
              dataKey="value"
              name="Trị (tỷ VNĐ)"
              fill={c.actual}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              onClick={(d: any) => onSelect?.(d?.key)}
              className="cursor-pointer"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="tonnage"
              name="Lượng (tấn)"
              stroke={c.cost}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </>
        ) : (
          <Bar
            yAxisId="left"
            dataKey="tonnage"
            name="Lượng (tấn)"
            fill={c.cost}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            onClick={(d: any) => onSelect?.(d?.key)}
            className="cursor-pointer"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function CapacityBar({
  data,
}: {
  data: { name: string; processed: number; capacity: number; warn: boolean }[];
}) {
  const c = useChartTokens();
  const t = useTranslations();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 14 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: c.axis }}
          tickLine={false}
          axisLine={false}
          label={{ value: t('chartHowTo.axisTon'), position: 'insideBottomRight', offset: -2, style: { fontSize: 10, fill: c.axis } }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 11, fill: c.axis }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 'var(--t-caption1)' }} />
        <Bar dataKey="capacity" name="Công suất kỳ (tấn)" fill={c.neutral} radius={[0, 4, 4, 0]} maxBarSize={16} />
        <Bar dataKey="processed" name="Sản lượng (tấn)" fill={c.actual} radius={[0, 4, 4, 0]} maxBarSize={16}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.warn ? c.warn : c.actual} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

type TrendRow = { month: string; spi: number | null; cpi: number | null; carriedProjects?: number };

export function SpiCpiLine({
  data,
  markerMonth,
}: {
  data: TrendRow[];
  /** Tháng mốc đang xem (vạch đỏ nét đứt, D-19); chỉ vẽ khi tháng đó có trên trục. */
  markerMonth?: string;
}) {
  const c = useChartTokens();
  const t = useTranslations();
  const { mode, setMode } = useLabelMode();
  const spiSel = mode === 'smart' ? smartIndices(data, 'spi') : new Set(data.map((_, i) => i));
  const cpiSel = mode === 'smart' ? smartIndices(data, 'cpi') : new Set(data.map((_, i) => i));
  const runs = carriedRuns(data.map((d) => d.carriedProjects ?? 0));
  const rows = withRunKeys(data, ['spi', 'cpi'], runs);
  const line = (key: 'spi' | 'cpi', stroke: string, sel: Set<number>, name: string) => (
    <>
      {/* Đường đầy đủ ẩn nét (giữ chú giải, tooltip, nhãn giá trị); nét thật vẽ theo từng đoạn liền/đứt. */}
      <Line type="monotone" dataKey={key} name={name} stroke={stroke} strokeOpacity={0} dot={false} activeDot={{ r: 4 }}>
        <LabelList dataKey={key} content={valueLabel(sel)} />
      </Line>
      {runs.map((run, n) => (
        <Line
          key={`${key}_r${n}`}
          type="monotone"
          dataKey={`${key}_r${n}`}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray={run.dashed ? '5 4' : undefined}
          dot={{ r: 3 }}
          activeDot={false}
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
      ))}
    </>
  );
  return (
    <div>
      <div className="mb-1 flex justify-end">
        <LabelModeSwitch mode={mode} onChange={setMode} />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={rows} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
          <YAxis domain={[0.6, 1.4]} tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} label={yUnit(t('chartHowTo.axisIndex'), c.axis)} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatRatio(Number(value))} labelFormatter={carriedLabel(t)} />
          <Legend wrapperStyle={{ fontSize: 'var(--t-caption1)' }} />
          <ReferenceLine
            y={THRESHOLDS.spiWarn}
            stroke={c.warn}
            strokeDasharray="4 4"
            label={{ value: String(THRESHOLDS.spiWarn), fontSize: 10, fill: c.warn }}
          />
          {markerMonth && data.some((d) => d.month === markerMonth) && (
            <ReferenceLine x={markerMonth} stroke={c.danger} strokeDasharray="4 4" />
          )}
          {line('spi', c.actual, spiSel, 'SPI')}
          {line('cpi', c.third, cpiSel, 'CPI')}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type CurveRow = { month: string; pv: number; ev: number; ac: number; carriedProjects?: number };

export function SCurve({
  data,
  markerMonth,
}: {
  data: CurveRow[];
  /** Tháng mốc đang xem (vạch đỏ nét đứt, D-19); chỉ vẽ khi tháng đó có trên trục. */
  markerMonth?: string;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const c = useChartTokens();
  const runs = carriedRuns(data.map((d) => d.carriedProjects ?? 0));
  const rows = withRunKeys(data, ['pv', 'ev', 'ac'], runs);
  const strokes = { pv: c.plan, ev: c.actual, ac: c.cost } as const;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c.plan} stopOpacity={0.25} />
            <stop offset="95%" stopColor={c.plan} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c.actual} stopOpacity={0.25} />
            <stop offset="95%" stopColor={c.actual} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} label={yUnit(t('chartHowTo.axisBillion'), c.axis)} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatTyd(Number(value), locale)} labelFormatter={carriedLabel(t)} />
        <Legend wrapperStyle={{ fontSize: 'var(--t-caption1)' }} />
        {/* Vùng tô + chú giải + tooltip lấy từ đường đầy đủ (ẩn nét); nét thật vẽ theo từng đoạn liền/đứt. */}
        <Area type="monotone" dataKey="pv" name="PV" stroke={strokes.pv} strokeOpacity={0} strokeWidth={2} fill="url(#pvGrad)" />
        <Area type="monotone" dataKey="ev" name="EV" stroke={strokes.ev} strokeOpacity={0} strokeWidth={2} fill="url(#evGrad)" />
        <Line type="monotone" dataKey="ac" name="AC" stroke={strokes.ac} strokeOpacity={0} dot={false} />
        {markerMonth && data.some((d) => d.month === markerMonth) && (
          <ReferenceLine x={markerMonth} stroke={c.danger} strokeDasharray="4 4" />
        )}
        {(['pv', 'ev', 'ac'] as const).flatMap((key) =>
          runs.map((run, n) => (
            <Line
              key={`${key}_r${n}`}
              type="monotone"
              dataKey={`${key}_r${n}`}
              stroke={strokes[key]}
              strokeWidth={2}
              // AC vốn đã nét đứt "5 4" để phân biệt với PV/EV; đoạn mang số của AC đứt dày hơn "2 3".
              strokeDasharray={run.dashed ? (key === 'ac' ? '2 3' : '5 4') : key === 'ac' ? '5 4' : undefined}
              dot={data.length === 1 ? { r: 3 } : false}
              activeDot={false}
              legendType="none"
              tooltipType="none"
              isAnimationActive={false}
            />
          )),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data, color }: { data: number[]; color?: string }) {
  const c = useChartTokens();
  const stroke = color ?? c.actual;
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} fill={stroke} fillOpacity={0.1} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
