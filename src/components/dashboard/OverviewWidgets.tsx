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
  loadWatchlist,
} from '@/server/cache';
import { getScopedProjectIds, type DashboardFilters, type GroupBy } from '@/server/queries';
import { repo } from '@/server/repo';
import { historyMonths } from '@/lib/clock';
import { formatTyd } from '@/lib/format';
import { THRESHOLDS } from '@/lib/thresholds';
import { KpiCard } from './KpiCard';
import { Watchlist } from './Watchlist';
import { ProjectTable } from './ProjectTable';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Rise } from '@/components/ui/Rise';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { IconAlert, IconFlag, IconMoney, IconProject, IconFactory, IconTrend } from '@/components/icons';

const CapacityBar = dynamic(() => import('./charts').then((m) => m.CapacityBar), { ssr: false, loading: () => <CardSkeleton h={220} /> });
const SCurve = dynamic(() => import('./charts').then((m) => m.SCurve), { ssr: false, loading: () => <CardSkeleton h={240} /> });
const BacklogOverdueLine = dynamic(() => import('./charts').then((m) => m.BacklogOverdueLine), { ssr: false, loading: () => <CardSkeleton h={160} /> });
const SpiCpiLine = dynamic(() => import('./charts').then((m) => m.SpiCpiLine), { ssr: false, loading: () => <CardSkeleton h={200} /> });
const DrillDonut = dynamic(() => import('./DrillCharts').then((m) => m.DrillDonut), { ssr: false, loading: () => <CardSkeleton h={200} /> });
const GroupByCard = dynamic(() => import('./DrillCharts').then((m) => m.GroupByCard), { ssr: false, loading: () => <CardSkeleton h={260} /> });

type ListSort = 'priority' | 'name' | 'value' | 'spi' | 'pctActual';

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
      <KpiCard label={t('kpi.behindSchedule')} value={String(kpis.behindSchedule)} delta={kpis.delta.behindSchedule} deltaSuffix={prevLabel} tone="warn" invertDelta hero heroTagLabel={t('kpi.focusTag')} icon={IconTrend} />
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

export async function GroupBarCard({ month, groupBy, filters }: { month: string; groupBy: GroupBy; filters: DashboardFilters }) {
  const data = await loadTonnageByGroup(month, groupBy, filters);
  return (
    <Card>
      <CardBody>
        <GroupByCard data={data} groupBy={groupBy} />
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
  const scopedIds = await getScopedProjectIds(filters);
  const kpis = await loadPortfolioKpis(month, filters);
  const months = historyMonths();
  const backlogTrend = await Promise.all(
    months.map(async (m) =>
      (await repo.getFinancialForMonth(m)).filter((f) => scopedIds.has(f.projectId)).reduce((a, b) => a + b.backlog, 0),
    ),
  );
  const overdueTrend = await Promise.all(
    months.map(async (m) =>
      (await repo.getFinancialForMonth(m)).filter((f) => scopedIds.has(f.projectId)).reduce((a, b) => a + b.arOverdue, 0),
    ),
  );
  const totalOverdue = (await repo.getFinancialForMonth(month))
    .filter((f) => scopedIds.has(f.projectId))
    .reduce((a, b) => a + b.arOverdue, 0);
  const data = months.map((m, i) => ({ month: m, backlog: backlogTrend[i], overdue: overdueTrend[i] }));
  return (
    <Card>
      <CardHeader title={t('overview.backlogOverdue')} />
      <CardBody className="flex flex-col gap-3">
        <div className="g2">
          <div>
            <div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">{t('kpi.backlog')}</div>
            <div className="text-title3 font-bold">{formatTyd(kpis.backlog, locale)}</div>
          </div>
          <div>
            <div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">{t('metric.overdue')}</div>
            <div className="text-title3 font-bold" style={{ color: 'var(--danger)' }}>{formatTyd(totalOverdue, locale)}</div>
          </div>
        </div>
        <BacklogOverdueLine data={data} />
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

export async function WatchlistCard({ month, filters }: { month: string; filters: DashboardFilters }) {
  const items = await loadWatchlist(month, filters);
  return <Watchlist items={items} />;
}

export async function ProjectListCard({
  month,
  filters,
  search,
  sort,
  page,
}: {
  month: string;
  filters: DashboardFilters;
  search: string;
  sort: ListSort;
  page: number;
}) {
  const list = await loadProjectList({ month, filters, search, sort, page, pageSize: 10 });
  return <ProjectTable items={list.items} total={list.total} page={list.page} totalPages={list.totalPages} />;
}
