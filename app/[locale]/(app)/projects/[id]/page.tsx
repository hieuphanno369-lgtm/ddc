import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { repo } from '@/server/repo';
import { getProjectSummary } from '@/server/queries';
import { currentMonth, isValidYearMonth, todayIso } from '@/lib/clock';
import { getCurrentUser } from '@/lib/session';
import { requireProjectRead } from '@/server/authz';
import { stageKey } from '@/lib/labels';
import type { FactFinancial, StageCode } from '@/server/repo/types';
import { maskAlertMessage } from '@/lib/finance-gate';
import { THRESHOLDS } from '@/lib/thresholds';
import { calcScheduleGap } from '@/lib/evm';
import { calcScheduleGap as calcKpiScheduleGap } from '@/lib/schedule-gap';
import { buildPlanActualTimeline } from '@/lib/timeline';
import { buildStageTimelineRows } from '@/lib/stage-timeline';
import { VALUE_CHAIN_COLUMNS, chainFooterSummary, chainWeightTotalLabel, stagePctLabel, stageTonnage, stageWeightLabel } from '@/lib/value-chain-view';
import { formatDate, formatDateTime, formatDayMonth, formatPct, formatRatio, formatTon as formatQty, formatTyd } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Rise } from '@/components/ui/Rise';
import { Legend } from '@/components/ui/Legend';
import { MarketLabel, PriorityBadge, StatusBadge, TypeLabel } from '@/components/ui/Badges';
import { Badge } from '@/components/ui/Badge';
import { HelpTip } from '@/components/ui/HelpTip';
import { PlanActualTimeline } from '@/components/project/PlanActualTimeline';
import { StageSelectionProvider } from '@/components/project/StageSelectionContext';
import { ValueChainModeChip } from '@/components/project/ValueChainModeChip';
const SCurve = dynamic(() => import('@/components/dashboard/charts').then((m) => m.SCurve), { ssr: false, loading: () => <div className="sk h-60" /> });
const CountdownPanel = dynamic(() => import('@/components/project/CountdownPanel').then((m) => m.CountdownPanel), { ssr: false, loading: () => <div className="sk" style={{ width: 240, height: 88 }} /> });
const ResourceBreakdownChart = dynamic(() => import('@/components/project/ResourceBreakdownChart').then((m) => m.ResourceBreakdownChart), { ssr: false, loading: () => <div className="sk h-60" /> });
const WeeklyTrackingCard = dynamic(() => import('@/components/project/WeeklyTrackingCard').then((m) => m.WeeklyTrackingCard), { ssr: false, loading: () => <div className="sk h-60" /> });
const KeyMilestoneChart = dynamic(() => import('@/components/project/KeyMilestoneChart').then((m) => m.KeyMilestoneChart), { ssr: false, loading: () => <div className="sk h-60" /> });
const StageExplorer = dynamic(() => import('@/components/project/StageExplorer').then((m) => m.StageExplorer), { ssr: false, loading: () => <div className="sk h-60" /> });
const SpiCpiLine = dynamic(() => import('@/components/dashboard/charts').then((m) => m.SpiCpiLine), { ssr: false, loading: () => <div className="sk h-60" /> });
const ShiftManpowerChart = dynamic(
  () => import('@/components/project/ShiftManpowerChart').then((m) => m.ShiftManpowerChart),
  { ssr: false, loading: () => <div className="sk h-60" /> },
);
const WeeklyManpowerStackChart = dynamic(
  () => import('@/components/project/WeeklyManpowerStackChart').then((m) => m.WeeklyManpowerStackChart),
  { ssr: false, loading: () => <div className="sk h-60" /> },
);
const EquipmentGantt = dynamic(
  () => import('@/components/project/EquipmentGantt').then((m) => m.EquipmentGantt),
  { ssr: false, loading: () => <div className="sk h-60" /> },
);
import { getResourceBreakdown, getResourceSnapshot, getWeeklyTracking, getWorkItemComparison } from '@/server/project-queries';
import { getShiftChartData, getWeeklyChartData } from '@/server/manpower-queries';
import { getEquipmentGantt } from '@/server/equipment-gantt-queries';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { WhatIf } from '@/components/project/WhatIf';
import { ProjectSwitcher } from '@/components/project/ProjectSwitcher';
import {
  IconChevronRight,
  IconAlert,
  IconDataEntry,
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
  const canViewFinance = user?.canViewFinance ?? false;
  // B-4 (danh-gia.md, vòng 2 - BOLA/IDOR): data-entry/viewer chỉ được xem dự án mình có trong
  // project_assignments; admin/bod xem mọi dự án. Check TRƯỚC khi đọc project để không lộ qua
  // timing/behavior khác nhau giữa "không có quyền" và "chưa load xong".
  await requireProjectRead(user, id);

  const project = await repo.getProject(id);
  if (!project) notFound();

  // T1 Bước 6: gom mọi lệnh đọc ĐỘC LẬP (không phụ thuộc kết quả của nhau) vào 1 Promise.all -
  // trang Chi tiết trước đây await tuần tự từng dòng (>20 round-trip nối tiếp).
  const [
    summaryOrNull, lastUpdate, facts, chain, financial, alerts, aliases, sapCodes, photos, dims,
    resources, breakdown, tracking, keyMilestones, stageWeights, stageMilestones, compare,
    projectsList, shiftChart, weekly, gantt,
  ] = await Promise.all([
    getProjectSummary(id, month),
    repo.readLastAuditAt(),
    repo.getFacts(id),
    repo.getValueChain(id, month),
    canViewFinance ? repo.getFinancial(id) : Promise.resolve([] as FactFinancial[]),
    repo.getAlerts(id),
    repo.getAliases(id),
    repo.getSapCodes(id),
    repo.getPhotos(id),
    repo.getDims(),
    getResourceSnapshot(id, month),
    getResourceBreakdown(id, month),
    getWeeklyTracking(id, month),
    repo.getKeyMilestones(id),
    repo.getStageWeights(id),
    repo.getStageMilestones(id),
    getWorkItemComparison(id, month),
    repo.listProjects(),
    getShiftChartData(id, locale),
    getWeeklyChartData(id, project),
    getEquipmentGantt(id, t('equipmentGantt.noWorkItem')),
  ]);
  const summary = summaryOrNull!;
  const today = todayIso();
  const timeline = buildPlanActualTimeline({
    plannedStart: project.plannedStartDate, plannedFinish: project.plannedFinishDate,
    actualStart: project.actualStartDate, pctActual: summary.pctActual, today,
  });
  const startDelay = timeline?.startDelayDays ?? null;
  const gap = summary.pctPlan != null ? calcScheduleGap(summary.pctPlan, summary.pctActual) : null;
  // Vong bo sung P2B: dong "Cham/Nhanh N ngay · ±x,x%" duoi the %TT hero - cong thuc rieng
  // (gapDays quy doi ra ngay), khac voi `gap` phia tren (chi la diem % dung cho dong chan timeline).
  const kpiScheduleGap = calcKpiScheduleGap(summary.pctPlan, summary.pctActual, project.plannedStartDate, project.plannedFinishDate);
  const scheduleGapNote = kpiScheduleGap
    ? {
        direction: kpiScheduleGap.direction,
        text: t(`kpiSchedule.${kpiScheduleGap.direction}`, {
          days: Math.abs(kpiScheduleGap.gapDays),
          pct: new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(Math.abs(kpiScheduleGap.gapPct) * 100),
        }),
      }
    : undefined;
  const latest = facts[facts.length - 1];
  const canEditMs = user?.role === 'admin' || user?.role === 'data-entry';
  const stageRows = buildStageTimelineRows(stageMilestones, stageWeights);
  const customer = dims.customers.find((c) => c.id === project.customerId);
  const team = dims.teams.find((x) => x.id === project.teamKdId);
  const switcherProjects = projectsList.map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }));

  const sCurve = canViewFinance ? facts.map((f) => ({ month: f.yearMonth, pv: Math.round(f.pv), ev: Math.round(f.ev), ac: Math.round(f.ac) })) : [];
  const trend = facts.map((f) => ({ month: f.yearMonth, spi: f.spi, cpi: f.cpi }));
  const bottleneck = chain.find((c) => c.stageCode === latest?.bottleneckStage);
  const chainFooter = chainFooterSummary(chain, stageWeights);
  // Dich san ten 7 giai doan cho ValueChainModeChip (client component, muc 4d) - tranh goi
  // useTranslations phia client khi khong co NextIntlClientProvider (renderToStaticMarkup trong test).
  const stageLabels = Object.fromEntries(
    [...VALUE_CHAIN_COLUMNS[0], ...VALUE_CHAIN_COLUMNS[1]].map((s) => [s, t(stageKey[s])]),
  ) as Record<StageCode, string>;

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
          projects={switcherProjects}
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
          {canViewFinance ? (
            <div className="val">
              <div className="l">{t('metric.contractValue')}</div>
              <div className="v">{formatTyd(project.contractValue, locale)}</div>
              <div className="s">{formatTon(project.tonnage)} tấn</div>
            </div>
          ) : (
            <div className="val">
              <div className="l">{t('financeGate.tonnage')}</div>
              <div className="v">{formatTon(project.tonnage)} tấn</div>
            </div>
          )}
          {/* Q1 mac dinh (a): dem toi ngay HT ke hoach. Thieu ngay -> khong ve panel */}
          {project.plannedFinishDate && (
            <CountdownPanel targetDate={project.plannedFinishDate.slice(0, 10)} appToday={today} locale={locale} />
          )}
        </div>
      </Card>

      {/* 6 KPI - 3 the "Trong tam" (%TT, SPI, CPI) dung canh nhau nhu mock-up dong 646-649 */}
      <Rise className="kpis">
        <KpiCard label={t('metric.pctPlan')} value={formatPct(summary.pctPlan, locale)} delta={null} tone="neutral" icon={IconProject} />
        <KpiCard label={t('metric.pctActual')} value={formatPct(summary.pctActual, locale)} delta={null} tone="neutral" hero scheduleGap={scheduleGapNote} icon={IconAlert} />
        <KpiCard label={t('metric.spi')} value={formatRatio(summary.spi)} delta={null} tone={summary.spi != null && summary.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'} hero icon={IconTrend} />
        <KpiCard label={t('metric.cpi')} value={formatRatio(summary.cpi)} delta={null} tone={summary.cpi != null && summary.cpi < THRESHOLDS.cpiWarn ? 'warn' : 'ok'} hero icon={IconMoney} />
        <KpiCard label={t('resourceKpi.manpowerTotal')}
          value={resources.manpowerAsOfDate ? formatQty(resources.manpowerActual, locale) : '-'}
          sub={resources.manpowerAsOfDate ? t('resourceKpi.asOf', { date: formatDayMonth(resources.manpowerAsOfDate) }) : t('detail.noDailyData')}
          note={resources.manpowerAsOfDate ? t('resourceKpi.planContractors', { planned: formatQty(resources.manpowerPlanned, locale), n: resources.manpowerContractors }) : undefined}
          href="#res-manpower" delta={null} tone="neutral" icon={IconProject} />
        <KpiCard label={t('resourceKpi.equipmentTotal')}
          value={resources.equipmentAsOfDate ? formatQty(resources.equipmentActual, locale) : '-'}
          sub={resources.equipmentAsOfDate ? t('resourceKpi.asOf', { date: formatDayMonth(resources.equipmentAsOfDate) }) : t('detail.noDailyData')}
          note={resources.equipmentAsOfDate ? t('resourceKpi.planContractors', { planned: formatQty(resources.equipmentPlanned, locale), n: resources.equipmentContractors }) : undefined}
          href="#res-equipment" delta={null} tone="neutral" icon={IconGauge} />
      </Rise>

      {/* Timeline KH vs TT dang thanh (mock-up dong 655-676) */}
      <Card>
        <CardHeader
          title={t('detail.timeline')}
          action={<Legend items={[
            { label: t('detail.planned'), color: 'var(--s-plan)' },
            { label: t('detail.actual'), color: 'var(--s-actual)' },
            { label: t('common.today'), color: 'var(--danger)', line: true },
          ]} />}
        />
        <CardBody>
          {timeline ? (
            <PlanActualTimeline
              geometry={timeline}
              labels={{ planned: t('detail.planned'), actual: t('detail.actual'), todayPill: t('detail.tl.todayPill', { date: formatDate(today, locale) }), notStarted: t('detail.tl.notStarted') }}
              planRange={`${formatDate(project.plannedStartDate, locale)} → ${formatDate(project.plannedFinishDate, locale)}`}
              actualRange={`${formatDate(project.actualStartDate, locale)} → ${project.actualFinishDate ? formatDate(project.actualFinishDate, locale) : t('detail.tl.running')}`}
              planPctText={formatPct(summary.pctPlan, locale)}
              actualPctText={formatPct(summary.pctActual, locale)}
            />
          ) : (
            <div className="g2">
              <TimelineItem label={t('detail.planned')} start={project.plannedStartDate} finish={project.plannedFinishDate} locale={locale} />
              <TimelineItem label={t('detail.actual')} start={project.actualStartDate} finish={project.actualFinishDate} locale={locale} />
            </div>
          )}
          <div className="tlfoot">
            <span>{t('form.contractDate')}: {formatDate(project.contractDate, locale)}</span>
            <span>{t('form.committedHandover')}: <b style={{ color: 'var(--label)' }}>{formatDate(project.committedHandoverDate, locale)}</b></span>
            <span>{t('detail.tl.startDelay')}: <b style={{ color: startDelay != null && startDelay > 0 ? 'var(--danger)' : 'var(--label)' }}>{startDelay == null ? '-' : t('detail.tl.days', { n: Math.max(startDelay, 0) })}</b></span>
            <span>{t('detail.tl.gap')}: <b style={{ color: !gap ? 'var(--label)' : gap.direction === 'behind' && gap.pct > 0 ? 'var(--danger)' : 'var(--ok)' }}>{gap ? formatPct(gap.pct, locale) : '-'}</b></span>
          </div>
        </CardBody>
      </Card>

      {/* Cac moc chinh cua du an (mock-up dong 678-700) */}
      <Card className="overflow-visible">
        <CardHeader
          title={t('detail.keyMs.title')}
          subtitle={locale === 'vi' ? t('detail.keyMs.titleEn') : undefined}
          titleExtra={<HelpTip text={t('detail.keyMs.help')} label={t('common.explain')} />}
          action={
            <div className="flex flex-wrap items-center gap-2.5">
              <Legend items={[
                { label: t('detail.keyMs.legendPlanned'), color: 'var(--s-plan)' },
                { label: t('detail.keyMs.legendDone'), color: 'var(--s-third)' },
                { label: t('common.today'), color: 'var(--danger)', line: true },
              ]} />
              {canEditMs && (
                <Link href={`/nhap-lieu?project=${project.id}&step=profile#key-milestones`} className="btn ghost" style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}>
                  <IconDataEntry size={16} />{t('detail.keyMs.edit')}
                </Link>
              )}
            </div>
          }
        />
        <CardBody><KeyMilestoneChart milestones={keyMilestones} today={today} /></CardBody>
      </Card>

      {/* Chuoi gia tri (mock-up dong 701-707): the rong het hang, khong con ghep EVM (chu du an
          chot 2026-09-24, xem .bangiao/danh-gia.md muc 4) - EVM da hien o KPI/StageExplorer noi khac.
          Bao trong StageSelectionProvider (muc 4d) de chip goc noi voi giai doan dang chon o
          StageExplorer ben duoi, khong phai viet lai StageExplorer. */}
      <StageSelectionProvider>
        <Card className="valueChainCard">
          <CardHeader
            title={t('detail.valueChain')}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <ValueChainModeChip allStagesLabel={t('valueChainCard.allStages')} stageLabels={stageLabels} />
                {bottleneck && (
                  <Badge tone="danger">
                    {t('detail.bottleneck')}: {t(stageKey[bottleneck.stageCode])}
                  </Badge>
                )}
              </div>
            }
          />
          <CardBody>
            <div className="stagegrid">
              {VALUE_CHAIN_COLUMNS.map((column, i) => (
                <div key={i} className="stagecol">
                  {column.map((stage) => {
                    const v = chain.find((c) => c.stageCode === stage);
                    if (v && !v.applicable) return null;
                    const pct = v?.pctComplete ?? 0;
                    const tonnage = stageTonnage(compare, stage);
                    return (
                      <StageRow
                        key={stage}
                        name={t(stageKey[stage])}
                        weightLabel={stageWeightLabel(stageWeights, stage, locale)}
                        pct={pct}
                        pctLabel={stagePctLabel(pct, locale)}
                        isBottleneck={stage === latest?.bottleneckStage}
                        tonnageLabel={tonnage ? t('valueChainAbs.ton', { actual: formatQty(tonnage.actual, locale), planned: formatQty(tonnage.planned, locale) }) : null}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="chainfoot">
              <span>
                {t('valueChainCard.footerWeight')}{' '}
                <b style={{ color: chainFooter.weightOk ? 'var(--label)' : 'var(--warn)' }}>{chainWeightTotalLabel(chainFooter.weightTotal, locale)}</b>
                {' · '}{t('valueChainCard.footerFormula')}
              </span>
              <span style={{ fontWeight: 750, color: 'var(--label)', fontSize: 'var(--t-footnote)' }}>{stagePctLabel(chainFooter.pctTotal, locale)}</span>
            </div>
          </CardBody>
        </Card>

        <StageExplorer rows={stageRows} compare={compare} today={today} locale={locale} />
      </StageSelectionProvider>

      {/* Tang 4 - Huy dong nguon luc (mock-up dong 759-767) */}
      <div className="g2">
        <Card id="res-manpower" style={{ scrollMarginTop: 72 }}>
          <CardHeader
            title={t('detail.res.manTitle')}
            titleExtra={<span className="chip c-plain">{t('detail.res.manual')}</span>}
            action={<Legend items={[{ label: t('detail.planned'), color: 'var(--s-plan)' }, { label: t('detail.actual'), color: 'var(--s-third)' }]} />}
          />
          <CardBody><ResourceBreakdownChart rows={breakdown.manpower} kind="manpower" /></CardBody>
        </Card>
        <Card id="res-equipment" style={{ scrollMarginTop: 72 }}>
          <CardHeader
            title={t('detail.res.eqpTitle')}
            titleExtra={<span className="chip c-plain">{t('detail.res.manual')}</span>}
            action={<Legend items={[{ label: t('detail.planned'), color: 'var(--s-plan)' }, { label: t('detail.actual'), color: 'var(--s-cost)' }]} />}
          />
          <CardBody><ResourceBreakdownChart rows={breakdown.equipment} kind="equipment" /></CardBody>
        </Card>
      </div>

      {tracking ? (
        <WeeklyTrackingCard data={tracking} locale={locale} />
      ) : (
        <Card>
          <CardHeader title={t('detail.track.title')} />
          <CardBody><p className="empty">{t('detail.noDailyData')}</p></CardBody>
        </Card>
      )}

      {/* T12b(a) - chart nhan luc theo ca x nha thau */}
      <Card id="res-shift" style={{ scrollMarginTop: 72 }}>
        <CardHeader
          title={t('manpowerCharts.shiftTitle')}
          titleExtra={<HelpTip text={t('manpowerCharts.shiftHelp')} label={t('common.explain')} />}
        />
        <CardBody><ShiftManpowerChart data={shiftChart} initialMonth={month} /></CardBody>
      </Card>

      {/* T12b(b) - chart cot chong nhan luc theo tuan x nha thau, dat cuoi trang theo yeu cau */}
      <Card id="res-weekly" style={{ scrollMarginTop: 72 }}>
        <CardHeader
          title={t('manpowerCharts.weeklyTitle')}
          titleExtra={<HelpTip text={t('manpowerCharts.weeklyHelp')} label={t('common.explain')} />}
        />
        <CardBody>
          {weekly ? <WeeklyManpowerStackChart data={weekly} initialMonth={month} /> : <p className="empty">{t('manpowerCharts.noData')}</p>}
        </CardBody>
      </Card>

      {/* T14 - Gantt thiet bi theo tung chiec */}
      <Card id="eq-gantt" style={{ scrollMarginTop: 72 }} className="overflow-visible">
        <CardHeader
          title={t('equipmentGantt.title')}
          subtitle={gantt ? `${formatDate(gantt.planFrom, locale)} - ${formatDate(gantt.planTo, locale)}` : undefined}
          titleExtra={<HelpTip text={t('equipmentGantt.help')} label={t('common.explain')} />}
          action={gantt ? (
            <Legend items={[
              ...gantt.legend.map((l) => ({ label: l.name, color: l.color })),
              { label: t('equipmentGantt.legendUsed'), color: 'var(--label2)' },
            ]} />
          ) : undefined}
        />
        <CardBody>{gantt ? <EquipmentGantt model={gantt} /> : <p className="empty">{t('equipmentGantt.noPlan')}</p>}</CardBody>
      </Card>

      {/* Cum xu huong + ho so dat cuoi trang theo yeu cau chu du an 2026-09-24 */}
      {/* Charts */}
      <div className={canViewFinance ? 'g2' : ''}>
        {canViewFinance && (
          <Card>
            <CardHeader title={t('detail.sCurve12')} />
            <CardBody>
              <SCurve data={sCurve} />
            </CardBody>
          </Card>
        )}
        <Card>
          <CardHeader title={t('detail.spiCpi12')} />
          <CardBody>
            <SpiCpiLine data={trend} />
          </CardBody>
        </Card>
      </div>

      {/* What-if */}
      {latest && canViewFinance && (
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
                {alerts.map((a) => maskAlertMessage(a, canViewFinance, t('financeGate.alertHidden'))).map((a) => (
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

/** 1 hàng giai đoạn trong thẻ "Chuỗi giá trị" (mock-up dòng 701-707): tên · chip trọng số · thanh
 * · %HT; `tonnageLabel` (nếu có) là dòng chữ nhỏ màu xám ngay dưới thanh, ghim vào cột thanh (cột 3). */
function StageRow({
  name, weightLabel, pct, pctLabel, isBottleneck, tonnageLabel,
}: {
  name: string; weightLabel: string; pct: number; pctLabel: string; isBottleneck: boolean; tonnageLabel: string | null;
}) {
  return (
    <div className={`stage${isBottleneck ? ' bt' : ''}`} style={{ gridTemplateColumns: '116px 38px 1fr auto' }}>
      <span className="nm">{name}</span>
      <span className="w">{weightLabel}</span>
      <div className="bar"><i className="fill" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
      <span className="pc">{pctLabel}</span>
      {tonnageLabel && <span className="stagesub" style={{ gridColumn: 3 }}>{tonnageLabel}</span>}
    </div>
  );
}

function formatTon(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}
