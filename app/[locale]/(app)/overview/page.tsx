import { Suspense } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/require-user';
import { repo } from '@/server/repo';
import { formatDateTime } from '@/lib/format';
import { type DashboardFilters, type GroupBy } from '@/server/queries';
import { currentMonth, historyMonths, isValidYearMonth } from '@/lib/clock';
import type { Market, Priority, ProjectType, Status } from '@/server/repo/types';
import { safeListSort } from '@/lib/finance-gate';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { FilterBar } from '@/components/dashboard/FilterBar';
import {
  BacklogOverdueCard,
  CapacityCard,
  GroupBarCard,
  KpiGrid,
  ProjectListCard,
  SCurveCard,
  SpiCpiCard,
  StatusDonutCard,
  TopPriorityCard,
} from '@/components/dashboard/OverviewWidgets';

function p(searchParams: Record<string, string | string[] | undefined>, key: string): string {
  const v = searchParams[key];
  return typeof v === 'string' ? v : '';
}

function KpiSkeleton() {
  return (
    <div className="kpis">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="kpi sk" style={{ height: 96 }} />
      ))}
    </div>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const user = await requireUser(locale, ['admin', 'bod', 'viewer']);
  const t = await getTranslations();
  const lastUpdate = await repo.readLastAuditAt();
  const dims = await repo.getDims();

  // N-2 (danh-gia-bao-mat.md): month rác (khác 'all'/'YYYY-MM' hợp lệ) từng lọt thẳng vào khoá
  // unstable_cache (src/server/cache.ts) - mỗi giá trị rác khác nhau phình thêm 1 khoá cache mới.
  // Validate như trang Chi tiết, sai format thì rơi về tháng hiện tại.
  const rawMonth = p(sp, 'month');
  const month = rawMonth === 'all' ? 'all' : isValidYearMonth(rawMonth) ? rawMonth : currentMonth();
  const groupBy = (p(sp, 'groupBy') as GroupBy) || 'team';

  const filters: DashboardFilters = {
    status: (p(sp, 'status') as Status) || 'all',
    teamKdId: p(sp, 'team') ? Number(p(sp, 'team')) : 'all',
    customerId: p(sp, 'customer') ? Number(p(sp, 'customer')) : 'all',
    priority: (p(sp, 'priority') as Priority) || 'all',
    market: (p(sp, 'market') as Market) || 'all',
    projectType: (p(sp, 'type') as ProjectType) || 'all',
    groupBy: p(sp, 'groupBy') ? groupBy : undefined,
    groupKey: p(sp, 'groupKey') || undefined,
  };

  const canViewFinance = user?.canViewFinance ?? false;
  const search = p(sp, 'search');
  const rawSort = (p(sp, 'sort') as 'priority' | 'name' | 'value' | 'spi' | 'pctActual') || 'priority';
  const sort = safeListSort(rawSort, canViewFinance);
  const page = Number(p(sp, 'page')) || 1;

  return (
    <>
      <p className="hintline">
        {t('admin.lastUpdate')}: {lastUpdate ? formatDateTime(lastUpdate, locale) : '-'}
      </p>

      <Suspense fallback={null}>
        <FilterBar teams={dims.teams} customers={dims.customers} months={historyMonths()} currentMonth={currentMonth()} />
      </Suspense>

      <div className="sect"><b>{t('overview.title')}</b><i /></div>

      <Suspense fallback={<KpiSkeleton />}>
        <KpiGrid month={month} filters={filters} canViewFinance={canViewFinance} />
      </Suspense>

      <div className="g2">
        <Suspense fallback={<CardSkeleton h={220} />}>
          <StatusDonutCard month={month} filters={filters} />
        </Suspense>
        <Suspense fallback={<CardSkeleton h={260} />}>
          <GroupBarCard month={month} groupBy={groupBy} filters={filters} canViewFinance={canViewFinance} />
        </Suspense>
      </div>

      <div className="g21">
        <Suspense fallback={<CardSkeleton h={220} />}>
          <SpiCpiCard filters={filters} />
        </Suspense>
        <Suspense fallback={<CardSkeleton h={220} />}>
          <CapacityCard month={month} filters={filters} />
        </Suspense>
      </div>

      {canViewFinance && (
        <div className="g21">
          <Suspense fallback={<CardSkeleton h={240} />}>
            <SCurveCard filters={filters} />
          </Suspense>
          <Suspense fallback={<CardSkeleton h={220} />}>
            <BacklogOverdueCard month={month} filters={filters} />
          </Suspense>
        </div>
      )}

      <Suspense fallback={<CardSkeleton h={300} />}>
        <TopPriorityCard month={month} filters={filters} canViewFinance={canViewFinance} />
      </Suspense>

      <Suspense fallback={<CardSkeleton h={300} />}>
        <ProjectListCard month={month} filters={filters} search={search} sort={sort} page={page} canViewFinance={canViewFinance} />
      </Suspense>
    </>
  );
}
