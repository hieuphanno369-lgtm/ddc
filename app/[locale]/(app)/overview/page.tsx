import { Suspense } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/session';
import { repo } from '@/server/repo';
import { formatDateTime } from '@/lib/format';
import { currentMonth, type DashboardFilters, type GroupBy } from '@/server/queries';
import type { Market, Priority, ProjectType, Status } from '@/server/repo/types';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { FilterBar } from '@/components/dashboard/FilterBar';
import {
  AlertBanner,
  BacklogOverdueCard,
  CapacityCard,
  GroupBarCard,
  KpiGrid,
  ProjectListCard,
  SCurveCard,
  SpiCpiCard,
  StatusDonutCard,
  WatchlistCard,
} from '@/components/dashboard/OverviewWidgets';

function p(searchParams: Record<string, string | string[] | undefined>, key: string): string {
  const v = searchParams[key];
  return typeof v === 'string' ? v : '';
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card h-24 animate-pulse" />
      ))}
    </div>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const lastUpdate = (await repo.getAuditLog())[0]?.changedAt ?? null;
  const dims = await repo.getDims();

  const month = p(searchParams, 'month') === 'all' ? 'all' : p(searchParams, 'month') || currentMonth;
  const groupBy = (p(searchParams, 'groupBy') as GroupBy) || 'team';

  const filters: DashboardFilters = {
    status: (p(searchParams, 'status') as Status) || 'all',
    teamKdId: p(searchParams, 'team') ? Number(p(searchParams, 'team')) : 'all',
    customerId: p(searchParams, 'customer') ? Number(p(searchParams, 'customer')) : 'all',
    priority: (p(searchParams, 'priority') as Priority) || 'all',
    market: (p(searchParams, 'market') as Market) || 'all',
    projectType: (p(searchParams, 'type') as ProjectType) || 'all',
    groupBy: p(searchParams, 'groupBy') ? groupBy : undefined,
    groupKey: p(searchParams, 'groupKey') || undefined,
  };

  const isAdmin = user?.role === 'admin';
  const canViewFinance = user?.canViewFinance ?? false;
  const search = p(searchParams, 'search');
  const sort = (p(searchParams, 'sort') as 'priority' | 'name' | 'value' | 'spi' | 'pctActual') || 'priority';
  const page = Number(p(searchParams, 'page')) || 1;

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        {t('admin.lastUpdate')}: {lastUpdate ? formatDateTime(lastUpdate, locale) : '-'}
      </p>

      <Suspense fallback={null}>
        <FilterBar teams={dims.teams} customers={dims.customers} />
      </Suspense>

      {isAdmin && (
        <Suspense fallback={null}>
          <AlertBanner month={month} filters={filters} />
        </Suspense>
      )}

      <Suspense fallback={<KpiSkeleton />}>
        <KpiGrid month={month} filters={filters} canViewFinance={canViewFinance} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<CardSkeleton h={220} />}>
          <StatusDonutCard month={month} filters={filters} />
        </Suspense>
        <div className="lg:col-span-2">
          <Suspense fallback={<CardSkeleton h={260} />}>
            <GroupBarCard month={month} groupBy={groupBy} filters={filters} />
          </Suspense>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<CardSkeleton h={220} />}>
          <CapacityCard month={month} filters={filters} />
        </Suspense>
        <div className="lg:col-span-2">
          <Suspense fallback={<CardSkeleton h={220} />}>
            <SpiCpiCard filters={filters} />
          </Suspense>
        </div>
      </div>

      {canViewFinance && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Suspense fallback={<CardSkeleton h={220} />}>
            <BacklogOverdueCard month={month} filters={filters} />
          </Suspense>
          <div className="lg:col-span-2">
            <Suspense fallback={<CardSkeleton h={240} />}>
              <SCurveCard filters={filters} />
            </Suspense>
          </div>
        </div>
      )}

      <Suspense fallback={<CardSkeleton h={300} />}>
        <WatchlistCard month={month} filters={filters} />
      </Suspense>

      <Suspense fallback={<CardSkeleton h={300} />}>
        <ProjectListCard month={month} filters={filters} search={search} sort={sort} page={page} />
      </Suspense>
    </div>
  );
}
