import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { repo } from '@/server/repo';
import { getProjectSummary } from '@/server/queries';
import { currentMonth, isValidYearMonth } from '@/lib/clock';
import { getCurrentUser } from '@/lib/session';
import { stageKey } from '@/lib/labels';
import { STAGE_ORDER } from '@/lib/stages';
import { THRESHOLDS } from '@/lib/thresholds';
import { formatDate, formatDateTime, formatPct, formatRatio, formatTyd } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { MarketLabel, PriorityBadge, StatusBadge, TypeLabel } from '@/components/ui/Badges';
import { Badge, Dot } from '@/components/ui/Badge';
const SCurve = dynamic(() => import('@/components/dashboard/charts').then((m) => m.SCurve), { ssr: false, loading: () => <div className="h-60 animate-pulse rounded-lg bg-slate-200/70" /> });
const SpiCpiLine = dynamic(() => import('@/components/dashboard/charts').then((m) => m.SpiCpiLine), { ssr: false, loading: () => <div className="h-60 animate-pulse rounded-lg bg-slate-200/70" /> });
const ManpowerDailyChart = dynamic(
  () => import('@/components/project/ManpowerDailyChart').then((m) => m.ManpowerDailyChart),
  { ssr: false, loading: () => <div className="h-60 animate-pulse rounded-lg bg-slate-200/70" /> },
);
import { getManpowerDaily, getResourceSnapshot } from '@/server/project-queries';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { WhatIf } from '@/components/project/WhatIf';
import { ProjectSwitcher } from '@/components/project/ProjectSwitcher';
import {
  IconChevronRight,
  IconAlert,
  IconFlag,
  IconGauge,
  IconMoney,
  IconProject,
  IconTrend,
} from '@/components/icons';

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const id = Number(params.id);
  // month rác (vd ?month=abc) từng lọt qua thẳng vào endOfMonth() và ném RangeError (500) -
  // validate đúng format 'YYYY-MM' trước khi dùng, sai thì rơi về tháng hiện tại.
  const month = typeof searchParams.month === 'string' && isValidYearMonth(searchParams.month) ? searchParams.month : currentMonth();
  const t = await getTranslations();
  const locale = await getLocale();
  const user = await getCurrentUser();
  const canViewFinance = user?.canViewFinance ?? true;

  const project = await repo.getProject(id);
  if (!project) notFound();

  const summary = (await getProjectSummary(id, month))!;
  const lastUpdate = (await repo.getAuditLog())[0]?.changedAt ?? null;
  const facts = await repo.getFacts(id);
  const latest = facts[facts.length - 1];
  const chain = await repo.getValueChain(id, month);
  const financial = await repo.getFinancial(id);
  const alerts = await repo.getAlerts(id);
  const aliases = await repo.getAliases(id);
  const sapCodes = await repo.getSapCodes(id);
  const photos = await repo.getPhotos(id);
  const dims = await repo.getDims();
  const resources = await getResourceSnapshot(id, month);
  const manpowerDaily = await getManpowerDaily(id, month);
  // N-6 (danh-gia.md, vòng 2): nhân lực và thiết bị có thể nhập lệch ngày - MỖI card phải hiện
  // đúng ngày CỦA CHÍNH NÓ, không dùng chung 1 nhãn (asOfDate cũ = ngày mới hơn trong 2 ngày,
  // khiến card có dữ liệu cũ hơn hiện nhầm ngày của card kia).
  const manpowerAsOf = resources.manpowerAsOfDate ? t('detail.asOfDate', { date: formatDate(resources.manpowerAsOfDate, locale) }) : t('detail.noDailyData');
  const equipmentAsOf = resources.equipmentAsOfDate ? t('detail.asOfDate', { date: formatDate(resources.equipmentAsOfDate, locale) }) : t('detail.noDailyData');
  const customer = dims.customers.find((c) => c.id === project.customerId);
  const team = dims.teams.find((x) => x.id === project.teamKdId);

  const sCurve = facts.map((f) => ({ month: f.yearMonth, pv: Math.round(f.pv), ev: Math.round(f.ev), ac: Math.round(f.ac) }));
  const trend = facts.map((f) => ({ month: f.yearMonth, spi: f.spi, cpi: f.cpi }));
  const bottleneck = chain.find((c) => c.stageCode === latest?.bottleneckStage);

  return (
    <div className="space-y-4">
      {/* Breadcrumb + switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <div className="flex items-center gap-1">
          <Link href="/projects" className="hover:text-navy-800">
            {t('nav.projectDetail')}
          </Link>
          <IconChevronRight size={15} />
          <span className="font-medium text-navy-900">{project.projectName}</span>
        </div>
        <ProjectSwitcher
          currentId={project.id}
          projects={(await repo.listProjects()).map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }))}
        />
      </div>

      <p className="text-xs text-slate-500">
        {t('admin.lastUpdate')}: {lastUpdate ? formatDateTime(lastUpdate, locale) : '-'}
      </p>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-navy-900">{project.projectName}</h1>
              <StatusBadge status={summary.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="font-mono text-xs">{project.currentAliasCode}</span>
              <span>{customer?.name ?? '-'}</span>
              <span>{team?.name ?? '-'}</span>
              <TypeLabel type={project.projectType} />
              <MarketLabel market={project.marketCode} />
            </div>
          </div>
          <div className="text-right">
            <div className="label">{t('metric.contractValue')}</div>
            <div className="text-2xl font-semibold text-navy-900">{formatTyd(project.contractValue, locale)}</div>
            <div className="mt-1 text-xs text-slate-400">{formatTon(project.tonnage)} tấn</div>
          </div>
        </div>
      </Card>

      {/* 6 KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label={t('metric.spi')} value={formatRatio(summary.spi)} delta={null} tone={summary.spi != null && summary.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'} hero icon={IconTrend} />
        <KpiCard label={t('metric.cpi')} value={formatRatio(summary.cpi)} delta={null} tone={summary.cpi != null && summary.cpi < THRESHOLDS.cpiWarn ? 'warn' : 'ok'} icon={IconMoney} />
        <KpiCard label={t('metric.eac')} value={formatTyd(summary.eac, locale)} delta={null} tone="neutral" icon={IconGauge} />
        <KpiCard label={t('metric.vac')} value={formatTyd(summary.vac, locale)} delta={null} tone={summary.vac != null && summary.vac < 0 ? 'danger' : 'ok'} icon={IconFlag} />
        <KpiCard label={t('metric.pctPlan')} value={formatPct(summary.pctPlan, locale)} delta={null} tone="neutral" icon={IconProject} />
        <KpiCard label={t('metric.pctActual')} value={formatPct(summary.pctActual, locale)} delta={null} tone="neutral" icon={IconAlert} />
      </div>

      {/* Nguồn lực: ảnh chụp NGÀY gần nhất có dữ liệu, không phải số theo tháng (Q3) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label={t('detail.manpower')}
          value={resources.manpowerAsOfDate ? `${resources.manpowerActual}/${resources.manpowerPlanned}` : '-'}
          sub={manpowerAsOf}
          delta={null}
          tone="neutral"
          icon={IconProject}
        />
        <KpiCard
          label={t('detail.equipment')}
          value={resources.equipmentAsOfDate ? `${resources.equipmentActual}/${resources.equipmentPlanned}` : '-'}
          sub={equipmentAsOf}
          delta={null}
          tone="neutral"
          icon={IconGauge}
        />
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader title={t('detail.timeline')} />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <TimelineItem label={t('detail.planned')} start={project.plannedStartDate} finish={project.plannedFinishDate} locale={locale} />
            <TimelineItem label={t('detail.actual')} start={project.actualStartDate} finish={project.actualFinishDate} locale={locale} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            <span>{t('form.contractDate')}: {formatDate(project.contractDate, locale)}</span>
            <span>{t('form.committedHandover')}: <b className="text-navy-800">{formatDate(project.committedHandoverDate, locale)}</b></span>
          </div>
        </CardBody>
      </Card>

      {/* Value chain + EVM */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('detail.valueChain')}
            action={
              bottleneck ? (
                <Badge tone="danger">
                  {t('detail.bottleneck')}: {t(stageKey[bottleneck.stageCode])}
                </Badge>
              ) : undefined
            }
          />
          <CardBody className="space-y-2">
            {STAGE_ORDER.map((stage) => {
              const v = chain.find((c) => c.stageCode === stage);
              if (v && !v.applicable) return null;
              const pct = v?.pctComplete ?? 0;
              const isBottleneck = stage === latest?.bottleneckStage;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-slate-600">{t(stageKey[stage])}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${isBottleneck ? 'bg-amber-500' : 'bg-accent'}`}
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs font-medium text-slate-600">
                    {formatPct(pct, locale)}
                  </span>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('detail.evmMetrics')} />
          <CardBody>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <EvmRow label={t('metric.pv')} value={formatTyd(latest?.pv, locale)} />
                <EvmRow label={t('metric.ev')} value={formatTyd(latest?.ev, locale)} />
                <EvmRow label={t('metric.ac')} value={formatTyd(latest?.ac, locale)} />
                <EvmRow label={t('metric.sv')} value={formatTyd(latest ? latest.ev - latest.pv : null, locale)} />
                <EvmRow label={t('metric.cv')} value={formatTyd(latest ? latest.ev - latest.ac : null, locale)} />
                <EvmRow label={t('metric.spi')} value={formatRatio(summary.spi)} />
                <EvmRow label={t('metric.cpi')} value={formatRatio(summary.cpi)} />
                <EvmRow label={t('metric.eac')} value={formatTyd(summary.eac, locale)} />
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('detail.sCurve12')} />
          <CardBody>
            <SCurve data={sCurve} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('detail.spiCpi12')} />
          <CardBody>
            <SpiCpiLine data={trend} />
          </CardBody>
        </Card>
      </div>

      {/* What-if */}
      {latest && (
        <Card>
          <CardHeader title={t('whatif.title')} />
          <CardBody>
            <WhatIf ac={latest.ac} pctActual={latest.pctActual} bac={latest.bac || project.contractValue} />
          </CardBody>
        </Card>
      )}

      {/* Alias + SAP */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('detail.aliasHistory')} />
          <CardBody>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="py-1.5 font-medium">{t('form.projectCode')}</th>
                  <th className="py-1.5 font-medium">{t('common.month')}</th>
                  <th className="py-1.5 font-medium">{t('watchlist.reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aliases.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 font-mono text-xs text-navy-800">{a.aliasCode}</td>
                    <td className="py-2 text-xs text-slate-500">
                      {formatDate(a.effectiveFrom, locale)} - {a.effectiveTo ? formatDate(a.effectiveTo, locale) : '…'}
                    </td>
                    <td className="py-2 text-xs text-slate-500">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('sap.title')} />
          <CardBody>
            {sapCodes.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">{t('common.noData')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sapCodes.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-mono text-xs text-navy-800">{s.sapCode}</span>
                    <span className="text-xs text-slate-400">{s.sourceDocType}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Alerts + financial */}
      <div className={`grid gap-4 ${canViewFinance ? 'lg:grid-cols-2' : ''}`}>
        <Card>
          <CardHeader title={t('detail.alerts')} />
          <CardBody>
            {alerts.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">{t('overview.noAlerts')}</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-3">
                    <Dot tone={a.alertType === 'Red' ? 'danger' : 'warn'} />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge tone={a.alertType === 'Red' ? 'danger' : 'warn'}>{t(`alert.${a.alertType === 'Red' ? 'red' : 'amber'}`)}</Badge>
                        <span className="text-xs text-slate-400">{t('alert.rule')}: {a.ruleTriggered}</span>
                      </div>
                      <p className="mt-1 text-navy-800">{a.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {canViewFinance && (
        <Card>
          <CardHeader title={t('detail.financial')} />
          <CardBody>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="py-1.5 font-medium">{t('common.month')}</th>
                  <th className="py-1.5 text-right font-medium">{t('metric.revenue')}</th>
                  <th className="py-1.5 text-right font-medium">{t('metric.cost')}</th>
                  <th className="py-1.5 text-right font-medium">{t('metric.grossProfit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {financial.slice(-6).reverse().map((f) => (
                  <tr key={f.yearMonth}>
                    <td className="py-2 text-xs text-slate-500">{f.yearMonth}</td>
                    <td className="py-2 text-right text-slate-700">{formatTyd(f.revenueCumulative, locale)}</td>
                    <td className="py-2 text-right text-slate-700">{formatTyd(f.costActualCumulative, locale)}</td>
                    <td className="py-2 text-right text-slate-700">{formatTyd(f.grossProfit, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        )}
      </div>

      {/* Photos */}
      <Card>
        <CardHeader title={t('detail.photos')} />
        <CardBody>
          {photos.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">{t('common.noData')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((ph) => (
                <div key={ph.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                  {ph.url ? (
                    <img src={`/api/photos/${ph.url}`} alt={ph.caption || t('detail.photos')} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400">
                      <IconProject size={24} />
                      <span className="mt-1 px-2 text-center text-xs">{ph.caption}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Biểu đồ nhân lực KH vs TT - đặt cuối trang theo yêu cầu */}
      <Card>
        <CardHeader title={t('detail.manpowerTrend')} />
        <CardBody>
          <ManpowerDailyChart data={manpowerDaily} />
        </CardBody>
      </Card>
    </div>
  );
}

function TimelineItem({
  label,
  start,
  finish,
  locale,
}: {
  label: string;
  start: string | null;
  finish: string | null;
  locale: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="label">{label}</div>
      <div className="mt-1.5 flex items-center gap-2 text-sm">
        <span className="text-navy-900">{formatDate(start, locale)}</span>
        <span className="text-slate-300">→</span>
        <span className="text-navy-900">{formatDate(finish, locale)}</span>
      </div>
    </div>
  );
}

function EvmRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-2 text-slate-500">{label}</td>
      <td className="py-2 text-right font-medium text-navy-900">{value}</td>
    </tr>
  );
}

function formatTon(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}
