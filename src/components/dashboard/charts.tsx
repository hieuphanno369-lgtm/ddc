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

export const CHART_COLORS = {
  navy: '#0a1f3d',
  accent: '#B91C1C',
  amber: '#f59e0b',
  green: '#16a34a',
  slate: '#94a3b8',
  pv: '#8aa5c4',
  ev: '#B91C1C',
  ac: '#F5B301',
  spi: '#B91C1C',
  cpi: '#16a34a',
  statusChuanBi: '#94a3b8',
  statusDang: '#B91C1C',
  statusHoanThanh: '#16a34a',
  statusTamDung: '#f59e0b',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    boxShadow: '0 4px 16px rgba(10,31,61,0.08)',
  },
};

export function StatusDonut({
  data,
  onSelect,
}: {
  data: { status: string; value: number; label: string; color: string }[];
  onSelect?: (status: string) => void;
}) {
  return (
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
  );
}

export function GroupBar({
  data,
  onSelect,
}: {
  data: { key: string; tonnage: number; value: number }[];
  onSelect?: (key: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="key" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="left"
          dataKey="value"
          name="Trị (tỷ VNĐ)"
          fill={CHART_COLORS.accent}
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
          onClick={(d: any) => onSelect?.(d?.key)}
          className="cursor-pointer"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="tonnage"
          name="Lượng (tấn)"
          stroke={CHART_COLORS.amber}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function CapacityBar({
  data,
}: {
  data: { name: string; processed: number; capacity: number; warn: boolean }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="capacity" name="Công suất (tấn/tháng)" fill={CHART_COLORS.slate} radius={[0, 6, 6, 0]} maxBarSize={16} />
        <Bar dataKey="processed" name="Sản lượng (tấn)" fill={CHART_COLORS.accent} radius={[0, 6, 6, 0]} maxBarSize={16}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.warn ? CHART_COLORS.ac : CHART_COLORS.accent} />
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
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis domain={[0.6, 1.4]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatRatio(Number(value))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine
            y={THRESHOLDS.spiWarn}
            stroke={CHART_COLORS.amber}
            strokeDasharray="4 4"
            label={{ value: '0.9', fontSize: 10, fill: '#f59e0b' }}
          />
          <Line type="monotone" dataKey="spi" name="SPI" stroke={CHART_COLORS.spi} strokeWidth={2} dot={{ r: 3 }}>
            <LabelList dataKey="spi" content={valueLabel(spiSel)} />
          </Line>
          <Line type="monotone" dataKey="cpi" name="CPI" stroke={CHART_COLORS.cpi} strokeWidth={2} dot={{ r: 3 }}>
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
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.pv} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.pv} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.ev} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.ev} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatTyd(Number(value), locale)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="pv" name="PV" stroke={CHART_COLORS.pv} strokeWidth={2} fill="url(#pvGrad)" />
        <Area type="monotone" dataKey="ev" name="EV" stroke={CHART_COLORS.ev} strokeWidth={2} fill="url(#evGrad)" />
        <Area type="monotone" dataKey="ac" name="AC" stroke={CHART_COLORS.ac} strokeWidth={2} fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BacklogOverdueLine({
  data,
}: {
  data: { month: string; backlog: number; overdue: number }[];
}) {
  const locale = useLocale();
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(m: string) => `${m.slice(5)}/${m.slice(2, 4)}`}
        />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatTyd(Number(value), locale)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="backlog" name="Backlog" stroke={CHART_COLORS.accent} strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="overdue" name="Công nợ quá hạn" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data, color = CHART_COLORS.accent }: { data: number[]; color?: string }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
