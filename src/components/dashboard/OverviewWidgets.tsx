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
    <div className="flex items-start gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3">
      <IconAlert size={20} className="mt-0.5 shrink-0 text-red-600" />
      <div className="text-sm text-red-800">
        <span className="font-semibold">{t('overview.watchlist')}: </span>
        {p0Red.map((w) => w.projectName).join(', ')} - {t('penalty.risk')}/{t('penalty.penalized')}
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
    <div className={`grid grid-cols-2 gap-5 md:grid-cols-3 ${canViewFinance ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
      <KpiCard label={t('kpi.totalProjects')} value={String(kpis.totalProjects)} delta={kpis.delta.totalProjects} deltaSuffix={prevLabel} icon={IconProject} />
      <KpiCard label={t('kpi.inProgress')} value={String(kpis.inProgress)} delta={kpis.delta.inProgress} deltaSuffix={prevLabel} tone="ok" icon={IconFactory} />
      <KpiCard label={t('kpi.behindSchedule')} value={String(kpis.behindSchedule)} delta={kpis.delta.behindSchedule} deltaSuffix={prevLabel} tone="warn" invertDelta hero heroTagLabel={t('kpi.focusTag')} icon={IconTrend} />
      <KpiCard label={t('kpi.penaltyRisk')} value={String(kpis.penaltyRisk)} delta={kpis.delta.penaltyRisk} deltaSuffix={prevLabel} tone="warn" invertDelta icon={IconFlag} />
      <KpiCard label={t('kpi.penalized')} value={String(kpis.penalized)} delta={kpis.delta.penalized} deltaSuffix={prevLabel} tone="danger" invertDelta icon={IconAlert} />
      {canViewFinance && (
        <KpiCard label={t('kpi.backlog')} value={formatTyd(kpis.backlog, locale)} delta={kpis.delta.backlog} deltaSuffix={prevLabel} tone="neutral" icon={IconMoney} />
      )}
    </div>
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
      <CardBody className="pt-4">
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
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">{t('kpi.backlog')}</div>
            <div className="text-xl font-semibold text-navy-900">{formatTyd(kpis.backlog, locale)}</div>
          </div>
          <div>
            <div className="label">{t('metric.overdue')}</div>
            <div className="text-xl font-semibold text-red-600">{formatTyd(totalOverdue, locale)}</div>
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
