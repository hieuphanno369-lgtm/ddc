import dynamic from 'next/dynamic';
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
  loadWatchlist,
} from '@/server/cache';
import type { DashboardFilters, GroupBy } from '@/server/queries';
import { getOverdueScorecard, type Scorecard } from '@/server/overdue-scorecard';
import { formatTyd } from '@/lib/format';
import { THRESHOLDS } from '@/lib/thresholds';
import { maskGroupRows, maskProjectSummaries, safeListSort, type ListSort } from '@/lib/finance-gate';
import { KpiCard } from './KpiCard';
import { TopPriorityList } from './TopPriorityList';
import { ProjectTable } from './ProjectTable';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Rise } from '@/components/ui/Rise';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { IconAlert, IconFlag, IconMoney, IconProject, IconFactory, IconTrend } from '@/components/icons';

const CapacityBar = dynamic(() => import('./charts').then((m) => m.CapacityBar), { ssr: false, loading: () => <CardSkeleton h={220} /> });
const SCurve = dynamic(() => import('./charts').then((m) => m.SCurve), { ssr: false, loading: () => <CardSkeleton h={240} /> });
const SpiCpiLine = dynamic(() => import('./charts').then((m) => m.SpiCpiLine), { ssr: false, loading: () => <CardSkeleton h={200} /> });
const DrillDonut = dynamic(() => import('./DrillCharts').then((m) => m.DrillDonut), { ssr: false, loading: () => <CardSkeleton h={200} /> });
const GroupByCard = dynamic(() => import('./DrillCharts').then((m) => m.GroupByCard), { ssr: false, loading: () => <CardSkeleton h={260} /> });

export async function AlertBanner({ month, filters }: { month: string; filters: DashboardFilters }) {
  const t = await getTranslations();
  const watchlist = await loadWatchlist(month, filters);
  const p0Red = watchlist.filter((w) => w.priority === 'P0' && (w.penalty === 'risk' || w.penalty === 'penalized'));
  if (p0Red.length === 0) return null;
  return (
    <div className="alert">
      <span className="dot" style={{ background: 'var(--danger)' }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h4>{t('overview.watchlist')}</h4>
        <p>{p0Red.map((w) => w.projectName).join(', ')} - {t('penalty.risk')}/{t('penalty.penalized')}</p>
      </div>
    </div>
  );
}

export async function KpiGrid({ month, filters, canViewFinance }: { month: string; filters: DashboardFilters; canViewFinance: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const kpis = await loadPortfolioKpis(month, filters);
  const prevLabel = t('common.previousMonth');
  return (
    <Rise className={`kpis${canViewFinance ? '' : ' k5'}`}>
      <KpiCard label={t('kpi.totalProjects')} value={String(kpis.totalProjects)} delta={kpis.delta.totalProjects} deltaSuffix={prevLabel} icon={IconProject} />
      <KpiCard label={t('kpi.inProgress')} value={String(kpis.inProgress)} delta={kpis.delta.inProgress} deltaSuffix={prevLabel} tone="ok" icon={IconFactory} />
      <KpiCard label={t('kpi.behindSchedule')} value={String(kpis.behindSchedule)} delta={kpis.delta.behindSchedule} deltaSuffix={prevLabel} tone="warn" invertDelta hero icon={IconTrend} />
      <KpiCard label={t('kpi.penaltyRisk')} value={String(kpis.penaltyRisk)} delta={kpis.delta.penaltyRisk} deltaSuffix={prevLabel} tone="warn" invertDelta icon={IconFlag} />
      <KpiCard label={t('kpi.penalized')} value={String(kpis.penalized)} delta={kpis.delta.penalized} deltaSuffix={prevLabel} tone="danger" invertDelta icon={IconAlert} />
      {canViewFinance && (
        <KpiCard label={t('kpi.backlog')} value={formatTyd(kpis.backlog, locale)} delta={kpis.delta.backlog} deltaSuffix={prevLabel} tone="neutral" icon={IconMoney} />
      )}
    </Rise>
  );
}

export async function StatusDonutCard({ month, filters }: { month: string; filters: DashboardFilters }) {
  const t = await getTranslations();
  const data = await loadStatusBreakdown(month, filters);
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
  month,
  groupBy,
  filters,
  canViewFinance,
}: {
  month: string;
  groupBy: GroupBy;
  filters: DashboardFilters;
  canViewFinance: boolean;
}) {
  const data = await loadTonnageByGroup(month, groupBy, filters);
  return (
    <Card>
      <CardBody>
        <GroupByCard data={maskGroupRows(data, canViewFinance)} groupBy={groupBy} showValue={canViewFinance} />
      </CardBody>
    </Card>
  );
}

export async function CapacityCard({ month, filters }: { month: string; filters: DashboardFilters }) {
  const t = await getTranslations();
  const data = await loadCapacity(month, filters);
  return (
    <Card>
      <CardHeader title={t('overview.capacity')} />
      <CardBody>
        <CapacityBar data={data} />
      </CardBody>
    </Card>
  );
}

export async function SpiCpiCard({ filters }: { filters: DashboardFilters }) {
  const t = await getTranslations();
  const trend = (await loadSpiCpiTrend(filters)).slice(-6);
  return (
    <Card>
      <CardHeader title={t('overview.spiCpiTrend')} subtitle={`${t('overview.threshold')}: ${THRESHOLDS.spiWarn}`} />
      <CardBody>
        <SpiCpiLine data={trend} />
      </CardBody>
    </Card>
  );
}

export async function BacklogOverdueCard({ month, filters }: { month: string; filters: DashboardFilters }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const kpis = await loadPortfolioKpis(month, filters);
  const backlog: Scorecard = { value: kpis.backlog, delta: kpis.delta.backlog };
  const overdue = await getOverdueScorecard(month, filters);
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

export async function SCurveCard({ filters }: { filters: DashboardFilters }) {
  const t = await getTranslations();
  const data = await loadSCurve(filters);
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
  month,
  filters,
  canViewFinance,
}: {
  month: string;
  filters: DashboardFilters;
  canViewFinance: boolean;
}) {
  const items = await loadTopPriority(month, filters);
  return <TopPriorityList items={maskProjectSummaries(items, canViewFinance)} />;
}

export async function ProjectListCard({
  month,
  filters,
  search,
  sort,
  page,
  canViewFinance,
}: {
  month: string;
  filters: DashboardFilters;
  search: string;
  sort: ListSort;
  page: number;
  canViewFinance: boolean;
}) {
  const list = await loadProjectList({ month, filters, search, sort: safeListSort(sort, canViewFinance), page, pageSize: 10 });
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
