import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { repo } from '@/server/repo';
import { getProjectSummary } from '@/server/queries';
import { currentMonth, isValidYearMonth } from '@/lib/clock';
import { getCurrentUser } from '@/lib/session';
import { requireProjectRead } from '@/server/authz';
import { stageKey } from '@/lib/labels';
import { STAGE_ORDER } from '@/lib/stages';
import { THRESHOLDS } from '@/lib/thresholds';
import { formatDate, formatDateTime, formatPct, formatRatio, formatTyd } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Rise } from '@/components/ui/Rise';
import { MarketLabel, PriorityBadge, StatusBadge, TypeLabel } from '@/components/ui/Badges';
import { Badge } from '@/components/ui/Badge';
const SCurve = dynamic(() => import('@/components/dashboard/charts').then((m) => m.SCurve), { ssr: false, loading: () => <div className="sk h-60" /> });
const SpiCpiLine = dynamic(() => import('@/components/dashboard/charts').then((m) => m.SpiCpiLine), { ssr: false, loading: () => <div className="sk h-60" /> });
const ManpowerDailyChart = dynamic(
  () => import('@/components/project/ManpowerDailyChart').then((m) => m.ManpowerDailyChart),
  { ssr: false, loading: () => <div className="sk h-60" /> },
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
  // B-4 (danh-gia.md, vòng 2 - BOLA/IDOR): data-entry/viewer chỉ được xem dự án mình có trong
  // project_assignments; admin/bod xem mọi dự án. Check TRƯỚC khi đọc project để không lộ qua
  // timing/behavior khác nhau giữa "không có quyền" và "chưa load xong".
  await requireProjectRead(user, id);

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
    <>
      {/* Breadcrumb + switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-footnote text-label2">
        <div className="flex items-center gap-1">
          <Link href="/projects" className="transition-colors duration-fast hover:text-brand">
            {t('nav.projectDetail')}
          </Link>
          <IconChevronRight size={15} />
          <span className="font-semibold text-label">{project.projectName}</span>
        </div>
        <ProjectSwitcher
          currentId={project.id}
          projects={(await repo.listProjects()).map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }))}
        />
      </div>

      <p className="hintline">
        {t('admin.lastUpdate')}: {lastUpdate ? formatDateTime(lastUpdate, locale) : '-'}
      </p>

      {/* Header */}
      <Card>
        <div className="phead">
          <div className="idz">
            <div className="nmrow">
              <h2>{project.projectName}</h2>
              <StatusBadge status={summary.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            <div className="meta">
              <span className="mono">{project.currentAliasCode}</span>
              <span>{customer?.name ?? '-'}</span>
              <span>{team?.name ?? '-'}</span>
              <span><TypeLabel type={project.projectType} /></span>
              <span><MarketLabel market={project.marketCode} /></span>
            </div>
          </div>
          <div className="val">
            <div className="l">{t('metric.contractValue')}</div>
            <div className="v">{formatTyd(project.contractValue, locale)}</div>
            <div className="s">{formatTon(project.tonnage)} tấn</div>
          </div>
        </div>
      </Card>

      {/* 6 KPI cards */}
      <Rise className="kpis">
        <KpiCard label={t('metric.spi')} value={formatRatio(summary.spi)} delta={null} tone={summary.spi != null && summary.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'} hero heroTagLabel={t('kpi.focusTag')} icon={IconTrend} />
        <KpiCard label={t('metric.cpi')} value={formatRatio(summary.cpi)} delta={null} tone={summary.cpi != null && summary.cpi < THRESHOLDS.cpiWarn ? 'warn' : 'ok'} icon={IconMoney} />
        <KpiCard label={t('metric.eac')} value={formatTyd(summary.eac, locale)} delta={null} tone="neutral" icon={IconGauge} />
        <KpiCard label={t('metric.vac')} value={formatTyd(summary.vac, locale)} delta={null} tone={summary.vac != null && summary.vac < 0 ? 'danger' : 'ok'} icon={IconFlag} />
        <KpiCard label={t('metric.pctPlan')} value={formatPct(summary.pctPlan, locale)} delta={null} tone="neutral" icon={IconProject} />
        <KpiCard label={t('metric.pctActual')} value={formatPct(summary.pctActual, locale)} delta={null} tone="neutral" icon={IconAlert} />
      </Rise>

      {/* Nguồn lực: ảnh chụp NGÀY gần nhất có dữ liệu, không phải số theo tháng (Q3) */}
      <Rise className="kpis k2">
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
      </Rise>

      {/* Timeline */}
      <Card>
        <CardHeader title={t('detail.timeline')} />
        <CardBody>
          <div className="g2">
            <TimelineItem label={t('detail.planned')} start={project.plannedStartDate} finish={project.plannedFinishDate} locale={locale} />
            <TimelineItem label={t('detail.actual')} start={project.actualStartDate} finish={project.actualFinishDate} locale={locale} />
          </div>
          <div className="chainfoot">
            <span>{t('form.contractDate')}: {formatDate(project.contractDate, locale)}</span>
            <span>{t('form.committedHandover')}: <b style={{ color: 'var(--label)' }}>{formatDate(project.committedHandoverDate, locale)}</b></span>
          </div>
        </CardBody>
      </Card>

      {/* Value chain + EVM */}
      <div className="g2">
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
          <CardBody>
            <div className="stagegrid">
              {STAGE_ORDER.map((stage) => {
                const v = chain.find((c) => c.stageCode === stage);
                if (v && !v.applicable) return null;
                const pct = v?.pctComplete ?? 0;
                const isBottleneck = stage === latest?.bottleneckStage;
                return (
                  <div key={stage} className={`stage${isBottleneck ? ' bt' : ''}`}>
                    <span className="nm">{t(stageKey[stage])}</span>
                    <span className="w">-</span>
                    <div className="bar"><i className="fill" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
                    <span className="pc">{formatPct(pct, locale)}</span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('detail.evmMetrics')} />
          <CardBody>
            <table className="tbl">
              <tbody>
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
      <div className="g2">
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
      <div className="g2">
        <Card>
          <CardHeader title={t('detail.aliasHistory')} />
          <CardBody>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('form.projectCode')}</th>
                  <th>{t('common.month')}</th>
                  <th>{t('watchlist.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.aliasCode}</td>
                    <td>
                      {formatDate(a.effectiveFrom, locale)} - {a.effectiveTo ? formatDate(a.effectiveTo, locale) : '…'}
                    </td>
                    <td>{a.reason}</td>
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
              <p className="empty">{t('common.noData')}</p>
            ) : (
              <ul className="flex flex-col">
                {sapCodes.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm border-t-[0.5px] border-sep first:border-t-0">
                    <span className="mono">{s.sapCode}</span>
                    <span>{s.sourceDocType}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Alerts + financial */}
      <div className={canViewFinance ? 'g2' : ''}>
        <Card>
          <CardHeader title={t('detail.alerts')} />
          <CardBody>
            {alerts.length === 0 ? (
              <p className="empty">{t('overview.noAlerts')}</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {alerts.map((a) => (
                  <div key={a.id} className="alert">
                    <span className="dot" style={{ background: a.alertType === 'Red' ? 'var(--danger)' : 'var(--warn)' }} />
                    <div className="min-w-0 flex-1">
                      <h4>{a.message}</h4>
                      <div className="mt">
                        <Badge tone={a.alertType === 'Red' ? 'danger' : 'warn'}>{t(`alert.${a.alertType === 'Red' ? 'red' : 'amber'}`)}</Badge>
                        <span>{t('alert.rule')}: {a.ruleTriggered}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {canViewFinance && (
        <Card>
          <CardHeader title={t('detail.financial')} />
          <CardBody>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('common.month')}</th>
                  <th className="num">{t('metric.revenue')}</th>
                  <th className="num">{t('metric.cost')}</th>
                  <th className="num">{t('metric.grossProfit')}</th>
                </tr>
              </thead>
              <tbody>
                {financial.slice(-6).reverse().map((f) => (
                  <tr key={f.yearMonth}>
                    <td>{f.yearMonth}</td>
                    <td className="num">{formatTyd(f.revenueCumulative, locale)}</td>
                    <td className="num">{formatTyd(f.costActualCumulative, locale)}</td>
                    <td className="num">{formatTyd(f.grossProfit, locale)}</td>
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
            <p className="empty">{t('common.noData')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((ph) => (
                <div key={ph.id} className="relative aspect-[4/3] overflow-hidden rounded-md" style={{ background: 'var(--fill)' }}>
                  {ph.url ? (
                    <img src={`/api/photos/${ph.url}`} alt={ph.caption || t('detail.photos')} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-label3">
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
    </>
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
    <div className="sumbar" style={{ display: 'block' }}>
      <div className="text-caption2 font-bold uppercase tracking-[.025em] text-label3">{label}</div>
      <div className="mt-1.5 flex items-center gap-2 text-sm">
        <span>{formatDate(start, locale)}</span>
        <span className="text-label3">→</span>
        <span>{formatDate(finish, locale)}</span>
      </div>
    </div>
  );
}

function EvmRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="num" style={{ fontWeight: 600 }}>{value}</td>
    </tr>
  );
}

function formatTon(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}
