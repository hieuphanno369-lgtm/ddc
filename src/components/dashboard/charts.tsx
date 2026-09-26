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
import { useLocale } from 'next-intl';
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
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis dataKey="key" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: c.axis }}
          tickLine={false}
          axisLine={false}
        />
        {showValue && (
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
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
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
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
        <Bar dataKey="capacity" name="Công suất (tấn/tháng)" fill={c.neutral} radius={[0, 4, 4, 0]} maxBarSize={16} />
        <Bar dataKey="processed" name="Sản lượng (tấn)" fill={c.actual} radius={[0, 4, 4, 0]} maxBarSize={16}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.warn ? c.warn : c.actual} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpiCpiLine({
  data,
}: {
  data: { month: string; spi: number | null; cpi: number | null }[];
}) {
  const c = useChartTokens();
  const { mode, setMode } = useLabelMode();
  const spiSel = mode === 'smart' ? smartIndices(data, 'spi') : new Set(data.map((_, i) => i));
  const cpiSel = mode === 'smart' ? smartIndices(data, 'cpi') : new Set(data.map((_, i) => i));
  return (
    <div>
      <div className="mb-1 flex justify-end">
        <LabelModeSwitch mode={mode} onChange={setMode} />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
          <YAxis domain={[0.6, 1.4]} tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatRatio(Number(value))} />
          <Legend wrapperStyle={{ fontSize: 'var(--t-caption1)' }} />
          <ReferenceLine
            y={THRESHOLDS.spiWarn}
            stroke={c.warn}
            strokeDasharray="4 4"
            label={{ value: String(THRESHOLDS.spiWarn), fontSize: 10, fill: c.warn }}
          />
          <Line type="monotone" dataKey="spi" name="SPI" stroke={c.actual} strokeWidth={2} dot={{ r: 3 }}>
            <LabelList dataKey="spi" content={valueLabel(spiSel)} />
          </Line>
          <Line type="monotone" dataKey="cpi" name="CPI" stroke={c.third} strokeWidth={2} dot={{ r: 3 }}>
            <LabelList dataKey="cpi" content={valueLabel(cpiSel)} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SCurve({
  data,
}: {
  data: { month: string; pv: number; ev: number; ac: number }[];
}) {
  const locale = useLocale();
  const c = useChartTokens();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
        <YAxis tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatTyd(Number(value), locale)} />
        <Legend wrapperStyle={{ fontSize: 'var(--t-caption1)' }} />
        <Area type="monotone" dataKey="pv" name="PV" stroke={c.plan} strokeWidth={2} fill="url(#pvGrad)" />
        <Area type="monotone" dataKey="ev" name="EV" stroke={c.actual} strokeWidth={2} fill="url(#evGrad)" />
        <Area type="monotone" dataKey="ac" name="AC" stroke={c.cost} strokeDasharray="5 4" strokeWidth={2} fill="transparent" />
      </AreaChart>
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
