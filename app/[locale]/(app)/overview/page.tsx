import { Suspense } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/require-user';
import { repo } from '@/server/repo';
import { formatDateTime } from '@/lib/format';
import { todayIso } from '@/lib/clock';
import { defaultOverviewPeriod, parsePeriodChecked } from '@/lib/period';
import { parseDashboardFilters } from '@/lib/overview-params';
import { safeListSort } from '@/lib/finance-gate';
import { CardSkeleton } from '@/components/ui/Skeleton';
import {
  BacklogOverdueCard,
  CapacityCard,
  FilterBarSection,
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

  // N-2 (danh-gia-bao-mat.md): mọi giá trị đi vào khoá unstable_cache (src/server/cache.ts) phải được validate,
  // giá trị rác không được phình thêm khoá cache. Kỳ: from/to hợp lệ, hoặc month=YYYY-MM (trọn tháng), còn lại
  // (kể cả month=all cũ) rơi về kỳ mặc định. Bộ lọc: chỉ nhận giá trị trong danh sách enum (parseDashboardFilters).
  // CÙNG 1 object period/filters truyền xuống mọi widget để React cache (so theo tham chiếu) còn memo.
  const { period, invalid: periodInvalid } = parsePeriodChecked({ from: p(sp, 'from'), to: p(sp, 'to'), month: p(sp, 'month') }, defaultOverviewPeriod(todayIso()));
  const filters = parseDashboardFilters(sp, dims);
  const groupBy = filters.groupBy ?? 'team';

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

      <Suspense fallback={<CardSkeleton h={56} />}>
        <FilterBarSection period={period} filters={filters} teams={dims.teams} customers={dims.customers} />
      </Suspense>
      {periodInvalid && <p className="hintline" role="status" data-testid="period-invalid">{t('period.invalid')}</p>}

      <div className="sect"><b>{t('overview.title')}</b><i /></div>

      <Suspense fallback={<KpiSkeleton />}>
        <KpiGrid period={period} filters={filters} canViewFinance={canViewFinance} />
      </Suspense>

      <div className="g2">
        <Suspense fallback={<CardSkeleton h={220} />}>
          <StatusDonutCard period={period} filters={filters} />
        </Suspense>
        <Suspense fallback={<CardSkeleton h={260} />}>
          <GroupBarCard period={period} groupBy={groupBy} filters={filters} canViewFinance={canViewFinance} />
        </Suspense>
      </div>

      <div className="g21">
        <Suspense fallback={<CardSkeleton h={220} />}>
          <SpiCpiCard period={period} filters={filters} />
        </Suspense>
        <Suspense fallback={<CardSkeleton h={220} />}>
          <CapacityCard period={period} filters={filters} />
        </Suspense>
      </div>

      {canViewFinance && (
        <div className="g21">
          <Suspense fallback={<CardSkeleton h={240} />}>
            <SCurveCard period={period} filters={filters} />
          </Suspense>
          <Suspense fallback={<CardSkeleton h={220} />}>
            <BacklogOverdueCard period={period} filters={filters} />
          </Suspense>
        </div>
      )}

      <Suspense fallback={<CardSkeleton h={300} />}>
        <TopPriorityCard period={period} filters={filters} canViewFinance={canViewFinance} />
      </Suspense>

      <Suspense fallback={<CardSkeleton h={300} />}>
        <ProjectListCard period={period} filters={filters} search={search} sort={sort} page={page} canViewFinance={canViewFinance} />
      </Suspense>
    </>
  );
}
