'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { TOOLTIP_STYLE } from '@/components/dashboard/charts';
import { useChartTokens } from '@/components/dashboard/useChartTokens';
import { formatDayMonth } from '@/lib/format';
import { monthLabel, timelineMonths, weeksInMonth, type ContractorInfo, type WeekBucket } from '@/lib/manpower-charts';
import type { WeeklyChartData } from '@/server/manpower-queries';

/** Bề rộng mỗi tuần trên trục X khi cuộn ngang toàn timeline. */
const WEEK_W = 44;

/** Chart cột chồng theo tuần × nhà thầu (T12b Q3/Q4/Q5): kéo/phím cuộn toàn timeline, lọc tháng. */
export function WeeklyManpowerStackChart({ data, initialMonth, markerMonth }: { data: WeeklyChartData; initialMonth: string; markerMonth?: string }) {
  const t = useTranslations();
  const c = useChartTokens();
  const months = timelineMonths(data.range);
  const [month, setMonth] = useState<string>(months.includes(initialMonth) ? initialMonth : 'all');
  const [containerWidth, setContainerWidth] = useState(800);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragXRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function scrollToMonth(m: string) {
    const el = scrollRef.current;
    if (!el) return;
    if (m === 'all') {
      el.scrollLeft = el.scrollWidth;
      return;
    }
    const idx = weeksInMonth(data.weeks, m);
    if (!idx.length) return;
    el.scrollLeft = Math.max(0, Math.min(idx[0] * WEEK_W, el.scrollWidth - el.clientWidth));
  }

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    scrollToMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMonthChange(m: string) {
    setMonth(m);
    scrollToMonth(m);
  }

  function onPointerDown(ev: PointerEvent<HTMLDivElement>) {
    if (ev.button !== 0) return;
    dragXRef.current = ev.clientX;
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }
  function onPointerMove(ev: PointerEvent<HTMLDivElement>) {
    if (dragXRef.current == null || !scrollRef.current) return;
    scrollRef.current.scrollLeft -= ev.clientX - dragXRef.current;
    dragXRef.current = ev.clientX;
  }
  function onPointerUp() {
    dragXRef.current = null;
  }
  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el) return;
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); el.scrollLeft -= WEEK_W; }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); el.scrollLeft += WEEK_W; }
    else if (ev.key === 'Home') { ev.preventDefault(); el.scrollLeft = 0; }
    else if (ev.key === 'End') { ev.preventDefault(); el.scrollLeft = el.scrollWidth; }
  }

  // Phòng hờ (query đã trả null khi rỗng, trang không gọi component này với mảng rỗng).
  if (data.weeks.length === 0) return <p className="empty">{t('manpowerCharts.noData')}</p>;

  const highlighted = new Set(month === 'all' ? data.weeks.map((_, i) => i) : weeksInMonth(data.weeks, month));
  const markerWeek = markerMonth ? weeksInMonth(data.weeks, markerMonth)[0] : undefined;
  const markerLabel = markerWeek != null ? data.weeks[markerWeek]?.label : undefined;
  const palette = [c.actual, c.third, c.cost, c.plan, c.thirdLt, c.neutral, c.accent2];
  const chartWidth = Math.max(containerWidth, data.weeks.length * WEEK_W);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="hintline">{t('manpowerCharts.scrollHint')}</span>
        <select
          className="inp"
          style={{ width: 'auto', padding: '6px 10px', fontSize: 'var(--t-caption1)' }}
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
        >
          <option value="all">{t('manpowerCharts.allMonths')}</option>
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>
      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label={t('manpowerCharts.weeklyTitle')}
        style={{ overflowX: 'auto' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <ComposedChart width={chartWidth} height={280} data={data.weeks} margin={{ top: 20, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip {...TOOLTIP_STYLE} content={weeklyTooltip(data.contractors, t)} />
          {/* P4 D-19: vạch đỏ nét đứt tại tuần đầu của tháng mốc đang xem. */}
          {markerLabel && <ReferenceLine x={markerLabel} stroke={c.danger} strokeDasharray="4 4" />}
          {data.contractors.map((ct, i) => (
            <Bar key={ct.id} stackId="a" dataKey={(w: WeekBucket) => w.actualByContractor[ct.id] ?? 0} name={ct.name} fill={palette[i % palette.length]}>
              {data.weeks.map((w, wi) => (
                <Cell key={w.weekStart} fillOpacity={highlighted.has(wi) ? 1 : 0.35} />
              ))}
            </Bar>
          ))}
          {/* Bar rỗng ở đỉnh chồng: chỉ để vẽ nhãn tổng, luôn nằm trên cùng dù nhà thầu cuối = 0 */}
          <Bar stackId="a" dataKey={() => 0} fill="transparent" isAnimationActive={false} legendType="none">
            <LabelList
              dataKey={(w: unknown) => weeklyLabelValues(w as WeekBucket).total ?? ''}
              position="top"
              offset={4}
              style={{ fontSize: 10, fontWeight: 700, fill: c.label2 }}
            />
          </Bar>
          <Line type="monotone" dataKey="plannedAvg" name={t('manpowerCharts.plannedLine')} stroke={c.plan} strokeWidth={2} dot={false} isAnimationActive={false}>
            <LabelList
              dataKey={(w: unknown) => weeklyLabelValues(w as WeekBucket).planned ?? ''}
              position="top"
              offset={8}
              style={{ fontSize: 10, fill: c.plan }}
            />
          </Line>
        </ComposedChart>
      </div>
    </div>
  );
}

/** Nhãn số trên chart tuần: 0 -> null (không vẽ nhãn). */
export function weeklyLabelValues(w: WeekBucket): { total: number | null; planned: number | null } {
  return {
    total: w.actualAvg > 0 ? w.actualAvg : null,
    planned: w.plannedAvg > 0 ? w.plannedAvg : null,
  };
}

export function weeklyTooltip(contractors: ContractorInfo[], t: ReturnType<typeof useTranslations>) {
  return ({ active, payload }: { active?: boolean; payload?: { payload?: WeekBucket }[] }) => {
    if (!active || !payload?.length) return null;
    const w = payload[0].payload;
    if (!w) return null;
    return (
      <div style={TOOLTIP_STYLE.contentStyle}>
        <div style={TOOLTIP_STYLE.labelStyle}>
          {t('manpowerCharts.weekOf', { from: formatDayMonth(w.weekStart), to: formatDayMonth(w.weekEnd) })}
          {w.days < 7 ? ` · ${t('manpowerCharts.days', { n: w.days })}` : ''}
        </div>
        {contractors.map((ct) => (
          <div key={ct.id} style={TOOLTIP_STYLE.itemStyle}>{ct.name}: {w.actualByContractor[ct.id] ?? 0}</div>
        ))}
        <div style={TOOLTIP_STYLE.itemStyle}>{t('manpowerCharts.total')}: {w.actualAvg}</div>
        <div style={TOOLTIP_STYLE.itemStyle}>{t('manpowerCharts.plannedLine')}: {w.plannedAvg}</div>
      </div>
    );
  };
}
