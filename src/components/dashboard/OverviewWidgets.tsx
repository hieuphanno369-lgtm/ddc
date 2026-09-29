import { getLocale, getTranslations } from 'next-intl/server';
import {
  loadCapacity,
  loadPortfolioKpis,
  loadProjectCounts,
  loadProjectList,
  loadSCurve,
  loadSpiCpiTrend,
  loadStatusBreakdown,
  loadTonnageByGroup,
  loadTopPriority,
} from '@/server/cache';
import type { DashboardFilters, GroupBy } from '@/server/queries';
import type { Period } from '@/lib/period';
import { getOverdueScorecard, type Scorecard } from '@/server/overdue-scorecard';
import { formatDate, formatTon, formatTyd } from '@/lib/format';
import { formatMonthShort } from '@/lib/period-format';
import { todayIso } from '@/lib/clock';
import { periodAsOfDate, periodMonths } from '@/lib/period';
import { THRESHOLDS } from '@/lib/thresholds';
import { toTopPriorityItem } from '@/lib/top-priority';
import { maskGroupRows, maskProjectSummaries, safeListSort, type ListSort } from '@/lib/finance-gate';
import { FilterBar } from './FilterBar';
import { KpiCard } from './KpiCard';
import { TopPriorityList } from './TopPriorityList';
import { ProjectTable } from './ProjectTable';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Rise } from '@/components/ui/Rise';
import { HelpTip } from '@/components/ui/HelpTip';
import { IconAlert, IconFlag, IconMoney, IconProject, IconFactory, IconTrend } from '@/components/icons';
import { CapacityBar, DrillDonut, GroupByCard, SCurve, SpiCpiLine } from './OverviewChartsLazy';

/** Thanh lọc: đọc "n / total dự án" ở server (cache theo kỳ + bộ lọc), phần còn lại là client component. */
export async function FilterBarSection({
  period,
  filters,
  teams,
  customers,
}: {
  period: Period;
  filters: DashboardFilters;
  teams: { id: number; name: string }[];
  customers: { id: number; name: string }[];
}) {
  const { count, total } = await loadProjectCounts(period, filters);
  return (
    <FilterBar
      teams={teams}
      customers={customers}
      period={period}
      asOfDate={periodAsOfDate(period, todayIso())}
      months={periodMonths(period)}
      count={count}
      total={total}
    />
  );
}

export async function KpiGrid({ period, filters, canViewFinance }: { period: Period; filters: DashboardFilters; canViewFinance: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const kpis = await loadPortfolioKpis(period, filters);
  const vsPrev = t('period.vsPrev');
  const help = (key: string) => ({ text: t(`helpTip.${key}`), label: t('common.explain') });
  return (
    <>
      {/* Nhóm 1 "Đang thế nào?": số tồn tại ngày cuối kỳ (mốc). */}
      <div className="sect"><b>{t('kpiGroup.now')}</b><i /></div>
      <p className="hintline">{t('kpiGroup.nowSub', { date: formatDate(kpis.asOfDate, locale) })}</p>
      <Rise className={`kpis${canViewFinance ? '' : ' k5'}`}>
        <KpiCard label={t('kpi.totalProjects')} value={String(kpis.projectsInPeriod)} delta={kpis.delta.projectsInPeriod} deltaSuffix={vsPrev} icon={IconProject} help={help('ovInPeriod')} />
        <KpiCard label={t('kpi.inProgress')} value={String(kpis.inProgress)} delta={kpis.delta.inProgress} deltaSuffix={vsPrev} note={t('kpiGroup.inProgressNote', { n: kpis.projectsInPeriod })} tone="ok" hero icon={IconFactory} help={help('ovInProgress')} />
        <KpiCard label={t('kpi.behindSchedule')} value={String(kpis.behindSchedule)} delta={kpis.delta.behindSchedule} deltaSuffix={vsPrev} tone="warn" invertDelta icon={IconTrend} help={help('ovBehind')} />
        <KpiCard label={t('kpi.penaltyRisk')} value={String(kpis.penaltyRisk)} delta={kpis.delta.penaltyRisk} deltaSuffix={vsPrev} tone="warn" invertDelta icon={IconFlag} help={help('ovPenaltyRisk')} />
        <KpiCard label={t('kpi.penalized')} value={String(kpis.penalized)} delta={kpis.delta.penalized} deltaSuffix={vsPrev} tone="danger" invertDelta icon={IconAlert} help={help('ovPenalized')} />
        {canViewFinance && (
          <KpiCard label={t('kpi.backlog')} value={formatTyd(kpis.notStartedValue, locale)} delta={kpis.delta.notStartedValue} deltaSuffix={vsPrev} tone="neutral" icon={IconMoney} help={help('ovNotStarted')} />
        )}
      </Rise>

      {/* Nhóm 2 "Làm được bao nhiêu trong kỳ?": số cộng dồn các tháng của kỳ. */}
      <div className="sect"><b>{t('kpiGroup.flow')}</b><i /></div>
      <p className="hintline">{t('kpiGroup.flowSub', { m1: formatMonthShort(kpis.months[0] ?? kpis.asOfDate.slice(0, 7)), m2: formatMonthShort(kpis.months.at(-1) ?? kpis.asOfDate.slice(0, 7)) })}</p>
      <Rise className="kpis k2">
        {canViewFinance && (
          <KpiCard label={t('kpiGroup.revenue')} value={formatTyd(kpis.revenueInPeriod, locale)} delta={kpis.delta.revenueInPeriod} deltaSuffix={vsPrev} tone="neutral" icon={IconMoney} help={help('ovRevenue')} />
        )}
        <KpiCard label={t('kpiGroup.tonnage')} value={formatTon(kpis.tonnageInPeriod, locale)} unit={t('common.ton')} delta={kpis.delta.tonnageInPeriod} deltaSuffix={vsPrev} tone="neutral" icon={IconFactory} help={help('ovTonnage')} />
      </Rise>
    </>
  );
}

/** Dòng "Cách đọc" nhỏ dưới chart (D-11). */
const HowTo = ({ text }: { text: string }) => <p className="hintline mt-2">{text}</p>;

type Translate = Awaited<ReturnType<typeof getTranslations>>;

/** "Tháng 10/2025 - 09/2026": khoảng tháng ĐANG VẼ (R2: tới tháng mốc, không vẽ tháng chưa tới). */
function chartRangeText(t: Translate, rows: { month: string }[]): string | undefined {
  if (rows.length === 0) return undefined;
  return t('period.chartRange', { m1: formatMonthShort(rows[0].month), m2: formatMonthShort(rows[rows.length - 1].month) });
}
const chartRangeSuffix = (t: Translate, rows: { month: string }[]) => {
  const text = chartRangeText(t, rows);
  return text ? ` · ${text}` : '';
};

export async function StatusDonutCard({ period, filters }: { period: Period; filters: DashboardFilters }) {
  const t = await getTranslations();
  const data = await loadStatusBreakdown(period, filters);
  return (
    <Card className="overflow-visible">
      <CardHeader
        title={t('overview.statusBreakdown')}
        titleExtra={<HelpTip text={t('helpTip.ovStatus')} label={t('common.explain')} />}
      />
      <CardBody>
        <DrillDonut data={data} />
        <HowTo text={t('chartHowTo.statusDonut')} />
      </CardBody>
    </Card>
  );
}

export async function GroupBarCard({
  period,
  groupBy,
  filters,
  canViewFinance,
}: {
  period: Period;
  groupBy: GroupBy;
  filters: DashboardFilters;
  canViewFinance: boolean;
}) {
  const t = await getTranslations();
  const data = await loadTonnageByGroup(period, groupBy, filters);
  return (
    <Card>
      <CardBody>
        <GroupByCard data={maskGroupRows(data, canViewFinance)} groupBy={groupBy} showValue={canViewFinance} />
        <HowTo text={t('chartHowTo.groupBar')} />
      </CardBody>
    </Card>
  );
}

export async function CapacityCard({ period, filters }: { period: Period; filters: DashboardFilters }) {
  const t = await getTranslations();
  const data = await loadCapacity(period, filters);
  const months = periodMonths(period);
  return (
    <Card className="overflow-visible">
      <CardHeader
        title={t('overview.capacity')}
        titleExtra={<HelpTip text={t('helpTip.ovCapacity')} label={t('common.explain')} />}
      />
      <CardBody>
        <CapacityBar data={data} />
        <HowTo text={`${t('period.chartRange', { m1: formatMonthShort(months[0]), m2: formatMonthShort(months[months.length - 1]) })}. ${t('chartHowTo.capacity')}`} />
      </CardBody>
    </Card>
  );
}

export async function SpiCpiCard({ period, filters }: { period: Period; filters: DashboardFilters }) {
  const t = await getTranslations();
  const trend = await loadSpiCpiTrend(period, filters);
  return (
    <Card className="overflow-visible">
      <CardHeader
        title={t('overview.spiCpiTrend')}
        subtitle={`${t('overview.threshold')}: ${THRESHOLDS.spiWarn}${chartRangeSuffix(t, trend)}`}
        titleExtra={<HelpTip text={t('helpTip.ovSpiCpi')} label={t('common.explain')} />}
      />
      <CardBody>
        <SpiCpiLine data={trend} />
        {trend.length === 1 && <HowTo text={t('period.oneMonth')} />}
        <HowTo text={t('chartHowTo.spiCpi')} />
      </CardBody>
    </Card>
  );
}

export async function BacklogOverdueCard({ period, filters }: { period: Period; filters: DashboardFilters }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const kpis = await loadPortfolioKpis(period, filters);
  const backlog: Scorecard = { value: kpis.notStartedValue, delta: kpis.delta.notStartedValue };
  const overdue = await getOverdueScorecard(period, filters);
  return (
    <Card>
      <CardHeader title={t('overview.backlogOverdue')} />
      <CardBody>
        <Rise className="kpis k2">
          <KpiCard label={t('kpi.backlog')} value={formatTyd(backlog.value, locale)} delta={backlog.delta} deltaSuffix={t('period.vsPrev')} tone="neutral" icon={IconMoney} help={{ text: t('helpTip.ovNotStarted'), label: t('common.explain') }} />
          <KpiCard label={t('metric.overdue')} value={formatTyd(overdue.value, locale)} delta={overdue.delta} deltaSuffix={t('period.vsPrev')}
            tone={overdue.value > 0 ? 'danger' : 'neutral'} invertDelta icon={IconAlert} />
        </Rise>
      </CardBody>
    </Card>
  );
}

export async function SCurveCard({ period, filters }: { period: Period; filters: DashboardFilters }) {
  const t = await getTranslations();
  const data = await loadSCurve(period, filters);
  return (
    <Card className="overflow-visible">
      <CardHeader
        title={t('overview.sCurve')}
        subtitle={chartRangeText(t, data)}
        titleExtra={<HelpTip text={t('helpTip.ovSCurve')} label={t('common.explain')} />}
      />
      <CardBody>
        <SCurve data={data} />
        {data.length === 1 && <HowTo text={t('period.oneMonth')} />}
        <HowTo text={t('chartHowTo.sCurve')} />
      </CardBody>
    </Card>
  );
}

export async function TopPriorityCard({
  period,
  filters,
  canViewFinance,
}: {
  period: Period;
  filters: DashboardFilters;
  canViewFinance: boolean;
}) {
  const items = await loadTopPriority(period, filters);
  return <TopPriorityList items={maskProjectSummaries(items, canViewFinance).map(toTopPriorityItem)} period={period} />;
}

export async function ProjectListCard({
  period,
  filters,
  search,
  sort,
  page,
  canViewFinance,
}: {
  period: Period;
  filters: DashboardFilters;
  search: string;
  sort: ListSort;
  page: number;
  canViewFinance: boolean;
}) {
  const list = await loadProjectList({ period, filters, search, sort: safeListSort(sort, canViewFinance), page, pageSize: 10 });
  return (
    <ProjectTable
      items={maskProjectSummaries(list.items, canViewFinance)}
      total={list.total}
      page={list.page}
      totalPages={list.totalPages}
      canViewFinance={canViewFinance}
      period={period}
    />
  );
}
