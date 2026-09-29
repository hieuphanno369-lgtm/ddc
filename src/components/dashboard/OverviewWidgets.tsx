import { getLocale, getTranslations } from 'next-intl/server';
import {
  loadCapacity,
  loadPortfolioKpis,
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
import { formatTyd } from '@/lib/format';
import { THRESHOLDS } from '@/lib/thresholds';
import { toTopPriorityItem } from '@/lib/top-priority';
import { maskGroupRows, maskProjectSummaries, safeListSort, type ListSort } from '@/lib/finance-gate';
import { KpiCard } from './KpiCard';
import { TopPriorityList } from './TopPriorityList';
import { ProjectTable } from './ProjectTable';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Rise } from '@/components/ui/Rise';
import { IconAlert, IconFlag, IconMoney, IconProject, IconFactory, IconTrend } from '@/components/icons';
import { CapacityBar, DrillDonut, GroupByCard, SCurve, SpiCpiLine } from './OverviewChartsLazy';

export async function KpiGrid({ period, filters, canViewFinance }: { period: Period; filters: DashboardFilters; canViewFinance: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const kpis = await loadPortfolioKpis(period, filters);
  const prevLabel = t('common.previousMonth');
  return (
    <Rise className={`kpis${canViewFinance ? '' : ' k5'}`}>
      <KpiCard label={t('kpi.totalProjects')} value={String(kpis.projectsInPeriod)} delta={kpis.delta.projectsInPeriod} deltaSuffix={prevLabel} icon={IconProject} />
      <KpiCard label={t('kpi.inProgress')} value={String(kpis.inProgress)} delta={kpis.delta.inProgress} deltaSuffix={prevLabel} tone="ok" hero icon={IconFactory} />
      <KpiCard label={t('kpi.behindSchedule')} value={String(kpis.behindSchedule)} delta={kpis.delta.behindSchedule} deltaSuffix={prevLabel} tone="warn" invertDelta icon={IconTrend} />
      <KpiCard label={t('kpi.penaltyRisk')} value={String(kpis.penaltyRisk)} delta={kpis.delta.penaltyRisk} deltaSuffix={prevLabel} tone="warn" invertDelta icon={IconFlag} />
      <KpiCard label={t('kpi.penalized')} value={String(kpis.penalized)} delta={kpis.delta.penalized} deltaSuffix={prevLabel} tone="danger" invertDelta icon={IconAlert} />
      {canViewFinance && (
        <KpiCard label={t('kpi.backlog')} value={formatTyd(kpis.notStartedValue, locale)} delta={kpis.delta.notStartedValue} deltaSuffix={prevLabel} tone="neutral" icon={IconMoney} />
      )}
    </Rise>
  );
}

export async function StatusDonutCard({ period, filters }: { period: Period; filters: DashboardFilters }) {
  const t = await getTranslations();
  const data = await loadStatusBreakdown(period, filters);
  return (
    <Card>
      <CardHeader title={t('overview.statusBreakdown')} />
      <CardBody>
        <DrillDonut data={data} />
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
  const data = await loadTonnageByGroup(period, groupBy, filters);
  return (
    <Card>
      <CardBody>
        <GroupByCard data={maskGroupRows(data, canViewFinance)} groupBy={groupBy} showValue={canViewFinance} />
      </CardBody>
    </Card>
  );
}

export async function CapacityCard({ period, filters }: { period: Period; filters: DashboardFilters }) {
  const t = await getTranslations();
  const data = await loadCapacity(period, filters);
  return (
    <Card>
      <CardHeader title={t('overview.capacity')} />
      <CardBody>
        <CapacityBar data={data} />
      </CardBody>
    </Card>
  );
}

export async function SpiCpiCard({ period, filters }: { period: Period; filters: DashboardFilters }) {
  const t = await getTranslations();
  const trend = (await loadSpiCpiTrend(period, filters)).slice(-6);
  return (
    <Card>
      <CardHeader title={t('overview.spiCpiTrend')} subtitle={`${t('overview.threshold')}: ${THRESHOLDS.spiWarn}`} />
      <CardBody>
        <SpiCpiLine data={trend} />
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
          <KpiCard label={t('kpi.backlog')} value={formatTyd(backlog.value, locale)} delta={backlog.delta} deltaSuffix={t('common.previousMonth')} tone="neutral" icon={IconMoney} />
          <KpiCard label={t('metric.overdue')} value={formatTyd(overdue.value, locale)} delta={overdue.delta} deltaSuffix={t('common.previousMonth')}
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
    <Card>
      <CardHeader title={t('overview.sCurve')} />
      <CardBody>
        <SCurve data={data} />
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
  return <TopPriorityList items={maskProjectSummaries(items, canViewFinance).map(toTopPriorityItem)} />;
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
    />
  );
}
