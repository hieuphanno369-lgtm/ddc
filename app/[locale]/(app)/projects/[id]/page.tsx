import { notFound } from 'next/navigation';
import { SidebarProjectBrand } from '@/components/layout/SidebarBrand';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { repo } from '@/server/repo';
import { getProjectSummary } from '@/server/queries';
import { todayIso } from '@/lib/clock';
import { resolveDetailTime } from '@/lib/detail-time';
import { pickAsOf } from '@/lib/as-of';
import { dataStateLabel } from '@/lib/data-state-label';
import { periodAsOfDate, periodMonths } from '@/lib/period';
import { formatMonthShort } from '@/lib/period-format';
import { requireUser } from '@/lib/require-user';
import { requireProjectRead } from '@/server/authz';
import type { FactFinancial } from '@/server/repo/types';
import { maskAlertMessage } from '@/lib/finance-gate';
import { THRESHOLDS } from '@/lib/thresholds';
import { calcScheduleGap as calcKpiScheduleGap } from '@/lib/schedule-gap';
import { buildPlanActualTimeline } from '@/lib/timeline';
import { buildStageTimelineRows } from '@/lib/stage-timeline';
import { stageNameMap, stageOrder } from '@/lib/stages';
import { chainFooterSummary, chainWeightTotalLabel, stagePctLabel, stageTonnage, stageWeightLabel, valueChainColumns } from '@/lib/value-chain-view';
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
import {
  CountdownPanel,
  EquipmentPlanGantt,
  KeyMilestoneChart,
  ManpowerMonthChart,
  ResourceBreakdownChart,
  SCurve,
  SpiCpiLine,
  StageExplorer,
  WeeklyManpowerStackChart,
  WeeklyTrackingCard,
} from '@/components/project/ProjectDetailChartsLazy';
import { getResourceBreakdown, getResourceSnapshot, getWeeklyTracking, getWorkItemComparison } from '@/server/project-queries';
import { getManpowerMonthChartData, getWeeklyChartData } from '@/server/manpower-queries';
import { getEquipmentPlanGantt } from '@/server/equipment-plan-gantt-queries';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { WhatIf } from '@/components/project/WhatIf';
import { DetailTimeBar } from '@/components/project/DetailTimeBar';
import { ResourceDayNav } from '@/components/project/ResourceDayNav';
import { ProjectSwitcher } from '@/components/project/ProjectSwitcher';
import {
  IconChevronRight,
  IconAlert,
  IconDataEntry,
  IconGauge,
  IconMoney,
  IconProject,
  IconStage,
  IconTrend,
} from '@/components/icons';

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Khong dung Promise.all([params, searchParams]) o day: app-pages-require-user.test.ts khoi bat ky
  // loi goi ham nao dung truoc requireUser, va Promise.all(...) la mot loi goi ham nhu vay. Doi thanh
  // 2 lenh await rieng khong co dau ngoac ngay sau ten bien nen khong bi tinh la loi goi, van giu dung
  // thu tu getLocale roi moi toi requireUser.
  const { id: rawId } = await params;
  const sp = await searchParams;
  // from/to/month/day chỉ lấy khi là chuỗi; resolveDetailTime (src/lib/detail-time.ts) validate từng giá trị,
  // rác (vd ?month=abc, ?day=2026-02-30) rơi về mặc định, không ném lỗi (từng gây 500 ở endOfMonth).
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const locale = await getLocale();
  const user = await requireUser(locale);
  // L-1 (security P3D-B): matcher middleware bỏ qua đường dẫn có dấu chấm ('/vi/projects/1.0'),
  // mà Number() lại nhận '1.0', '1e0', '0x1' -> chỉ nhận số nguyên dương viết chuẩn.
  if (!/^[1-9]\d*$/.test(rawId)) notFound();
  const id = Number(rawId);
  const t = await getTranslations();
  const canViewFinance = user.canViewFinance ?? false;
  // B-4 (danh-gia.md, vòng 2 - BOLA/IDOR): data-entry/viewer chỉ được xem dự án mình có trong
  // project_assignments; admin/bod xem mọi dự án. Check TRƯỚC khi đọc project để không lộ qua
  // timing/behavior khác nhau giữa "không có quyền" và "chưa load xong".
  await requireProjectRead(user, id);

  const project = await repo.getProject(id);
  if (!project) notFound();

  const today = todayIso();
  // Kỳ/mốc/ngày phụ thuộc số của dự án (mốc mặc định = tháng gần nhất có số) nên đọc facts trước, phần còn lại gom Promise.all.
  const facts = await repo.getFacts(id);
  const t2 = resolveDetailTime(
    { from: str('from'), to: str('to'), month: str('month'), day: str('day') },
    project,
    facts.map((f) => f.yearMonth),
    today,
  );

  // T1 Bước 6: gom mọi lệnh đọc ĐỘC LẬP (không phụ thuộc kết quả của nhau) vào 1 Promise.all -
  // trang Chi tiết trước đây await tuần tự từng dòng (>20 round-trip nối tiếp).
  // Chuỗi giá trị lấy tháng lớn nhất <= mốc (mang số tháng trước); bảng so sánh hạng mục dùng đúng tháng nguồn đó.
  const chainPromise = repo.readValueChainAsOf(id, t2.asOfMonth);
  const [
    summaryOrNull, lastUpdate, chain, financial, alerts, aliases, sapCodes, dims,
    resources, breakdown, tracking, keyMilestones, stageWeights, stageMilestones, compare,
    projectsList, monthChart, weekly, planGantt, stages,
  ] = await Promise.all([
    getProjectSummary(id, t2.asOfMonth),
    repo.readLastAuditAt(),
    chainPromise,
    canViewFinance ? repo.getFinancial(id) : Promise.resolve([] as FactFinancial[]),
    repo.getAlerts(id),
    repo.getAliases(id),
    repo.getSapCodes(id),
    repo.getDims(),
    getResourceSnapshot(id, t2.day),
    getResourceBreakdown(id, t2.day),
    getWeeklyTracking(id, t2.day),
    repo.getKeyMilestones(id),
    repo.getStageWeights(id),
    repo.getStageMilestones(id),
    chainPromise.then((c) => getWorkItemComparison(id, c[0]?.yearMonth ?? t2.asOfMonth)),
    repo.listProjects(),
    getManpowerMonthChartData(id, locale),
    getWeeklyChartData(id, project),
    getEquipmentPlanGantt(id, today),
    repo.getStages(),
  ]);
  const summary = summaryOrNull!;
  const timeline = buildPlanActualTimeline({
    plannedStart: project.plannedStartDate, plannedFinish: project.plannedFinishDate,
    actualStart: project.actualStartDate, pctActual: summary.pctActual, today,
  });
  const startDelay = timeline?.startDelayDays ?? null;
  // D-17: một câu "Chậm N ngày (x điểm %)" dùng chung cho thẻ %TT và chân timeline (công thức calcScheduleGap của P2B).
  const kpiScheduleGap = calcKpiScheduleGap(summary.pctPlan, summary.pctActual, project.plannedStartDate, project.plannedFinishDate);
  const gapSentence = kpiScheduleGap
    ? t(`scheduleGapSentence.${kpiScheduleGap.direction}`, {
        days: Math.abs(kpiScheduleGap.gapDays),
        pts: Math.round(Math.abs(kpiScheduleGap.gapPct) * 100),
      })
    : null;
  const scheduleGapNote = kpiScheduleGap && gapSentence ? { direction: kpiScheduleGap.direction, text: gapSentence } : undefined;
  const latest = pickAsOf(facts, t2.asOfMonth)?.row;
  const canEditMs = user?.role === 'admin' || user?.role === 'data-entry';
  // P7-C2: danh sách + tên giai đoạn giờ đọc từ dim_stage (repo.getStages()), không còn hằng cứng.
  const order = stageOrder(stages);
  const stageNames = stageNameMap(stages, locale);
  const chainColumns = valueChainColumns(stages);
  const stageRows = buildStageTimelineRows(stageMilestones, stageWeights, order);
  const customer = dims.customers.find((c) => c.id === project.customerId);
  const team = dims.teams.find((x) => x.id === project.teamKdId);
  const switcherProjects = projectsList.map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }));

  // Chart theo kỳ: mỗi tháng của kỳ (tới mốc của kỳ) lấy số gần nhất <= tháng đó, tháng trước tháng có số đầu tiên bỏ.
  const capMonth = periodAsOfDate(t2.period, today).slice(0, 7);
  const chartMonths = periodMonths(t2.period).filter((m) => m <= capMonth);
  const carried = chartMonths.flatMap((m) => {
    const at = pickAsOf(facts, m);
    return at ? [{ month: m, f: at.row }] : [];
  });
  const sCurve = canViewFinance ? carried.map(({ month, f }) => ({ month, pv: Math.round(f.pv), ev: Math.round(f.ev), ac: Math.round(f.ac) })) : [];
  const trend = carried.map(({ month, f }) => ({ month, spi: f.spi, cpi: f.cpi }));
  const chartRange = carried.length
    ? t('period.chartRange', { m1: formatMonthShort(carried[0].month), m2: formatMonthShort(carried[carried.length - 1].month) })
    : undefined;
  const asOfLabel = (() => {
    const l = dataStateLabel(summary.dataState);
    return t(l.key, { month: l.month });
  })();
  const chainMonth = chain[0]?.yearMonth;
  const chainLabel = chainMonth
    ? t(chainMonth === t2.asOfMonth ? 'asOf.month' : 'asOf.carried', { month: formatMonthShort(chainMonth) })
    : t('asOf.none');
  const helpOf = (key: string) => ({ text: t(`helpTip.${key}`), label: t('common.explain') });
  const financialRows = financial.filter((f) => f.yearMonth <= t2.asOfMonth && f.yearMonth >= t2.period.from.slice(0, 7)).reverse();
  const dayCap = periodAsOfDate(t2.period, today);
  const bottleneck = chain.find((c) => c.stageCode === latest?.bottleneckStage);
  const chainFooter = chainFooterSummary(chain, stageWeights, order);
  // Dich san ten cac giai doan cho ValueChainModeChip (client component, muc 4d) - tranh goi
  // useTranslations phia client khi khong co NextIntlClientProvider (renderToStaticMarkup trong test).
  const stageLabels = stageNames;

  return (
    <>
      <SidebarProjectBrand name={project.projectName} code={project.currentAliasCode} />
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

      {/* P4 D-14: kỳ + mốc tháng (đổi URL, server render lại) */}
      <DetailTimeBar
        period={t2.period}
        asOfMonth={t2.asOfMonth}
        monthsInPeriod={chartMonths}
        lastDataMonth={t2.lastDataMonth}
      />
      {t2.invalidPeriod && <p className="hintline" role="status" data-testid="period-invalid">{t('period.invalid')}</p>}

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
        <KpiCard label={t('metric.pctPlan')} value={formatPct(summary.pctPlan, locale)} delta={null} sub={asOfLabel} tone="neutral" icon={IconProject} help={helpOf('dtPctPlan')} />
        <KpiCard label={t('metric.pctActual')} value={formatPct(summary.pctActual, locale)} delta={null} sub={asOfLabel} tone="neutral" hero scheduleGap={scheduleGapNote} icon={IconAlert} help={helpOf('dtPctActual')} />
        <KpiCard label={t('metric.spi')} value={formatRatio(summary.spi)} delta={null} tone={summary.spi != null && summary.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'} hero sub={asOfLabel} icon={IconTrend} help={helpOf('dtSpi')} />
        <KpiCard label={t('metric.cpi')} value={formatRatio(summary.cpi)} delta={null} tone={summary.cpi != null && summary.cpi < THRESHOLDS.cpiWarn ? 'warn' : 'ok'} hero sub={asOfLabel} icon={IconMoney} help={helpOf('dtCpi')} />
        <KpiCard label={t('resourceKpi.manpowerTotal')}
          value={resources.manpowerAsOfDate ? formatQty(resources.manpowerActual, locale) : '-'}
          sub={resources.manpowerAsOfDate ? t('resourceKpi.asOf', { date: formatDayMonth(resources.manpowerAsOfDate) }) : t('detail.noDailyData')}
          note={resources.manpowerAsOfDate ? t('resourceKpi.planContractors', { planned: formatQty(resources.manpowerPlanned, locale), n: resources.manpowerContractors }) : undefined}
          href="#res-manpower" delta={null} tone="neutral" icon={IconProject} help={helpOf('dtResource')} />
        <KpiCard label={t('resourceKpi.equipmentTotal')}
          value={resources.equipmentAsOfDate ? formatQty(resources.equipmentActual, locale) : '-'}
          sub={resources.equipmentAsOfDate ? t('resourceKpi.asOf', { date: formatDayMonth(resources.equipmentAsOfDate) }) : t('detail.noDailyData')}
          note={resources.equipmentAsOfDate ? t('resourceKpi.planContractors', { planned: formatQty(resources.equipmentPlanned, locale), n: resources.equipmentContractors }) : undefined}
          href="#res-equipment" delta={null} tone="neutral" icon={IconGauge} help={helpOf('dtResource')} />
      </Rise>

      {/* Timeline KH vs TT dang thanh (mock-up dong 655-676) */}
      <Card className="overflow-visible">
        <CardHeader
          title={t('detail.timeline')}
          titleExtra={<HelpTip text={t('helpTip.dtTimeline')} label={t('common.explain')} />}
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
            <span>{t('detail.tl.gap')}: <b style={{ color: !kpiScheduleGap ? 'var(--label)' : kpiScheduleGap.direction === 'behind' ? 'var(--danger)' : kpiScheduleGap.direction === 'ahead' ? 'var(--ok)' : 'var(--label)' }}>{gapSentence ?? '-'}</b></span>
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
                <Link href={`/ho-so-du-an?project=${project.id}#key-milestones`} className="btn ghost" style={{ padding: '6px 12px', fontSize: 'var(--t-caption1)' }}>
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
        <Card className="valueChainCard overflow-visible">
          <CardHeader
            title={t('detail.valueChain')}
            subtitle={chainLabel}
            titleExtra={<HelpTip text={t('helpTip.dtValueChain')} label={t('common.explain')} />}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <ValueChainModeChip allStagesLabel={t('valueChainCard.allStages')} stageLabels={stageLabels} />
                {bottleneck && (
                  <Badge tone="danger">
                    {t('detail.bottleneck')}: {stageNames[bottleneck.stageCode] ?? bottleneck.stageCode}
                  </Badge>
                )}
              </div>
            }
          />
          <CardBody>
            <div className="stagegrid">
              {chainColumns.map((column, i) => (
                <div key={i} className="stagecol">
                  {column.map((s) => {
                    const stage = s.code;
                    const v = chain.find((c) => c.stageCode === stage);
                    if (v && !v.applicable) return null;
                    const pct = v?.pctComplete ?? 0;
                    const tonnage = stageTonnage(compare, stage);
                    return (
                      <StageRow
                        key={stage}
                        name={stageNames[stage]}
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

        <StageExplorer rows={stageRows} compare={compare} today={today} locale={locale} stages={stages} />
      </StageSelectionProvider>

      {/* Tang 4 - Huy dong nguon luc (mock-up dong 759-767). P4 D-15: dieu huong ngay cho ca nhom. */}
      <ResourceDayNav
        day={t2.day}
        min={t2.period.from}
        max={dayCap}
        manpowerAsOf={resources.manpowerAsOfDate}
        equipmentAsOf={resources.equipmentAsOfDate}
      />
      <div className="g2">
        <Card id="res-manpower" style={{ scrollMarginTop: 72 }}>
          <CardHeader
            title={t('detail.res.manTitle')}
            subtitle={breakdown.manpowerAsOfDate ? t('asOf.day', { date: formatDate(breakdown.manpowerAsOfDate, locale) }) : undefined}
            titleExtra={<span className="chip c-plain">{t('detail.res.manual')}</span>}
            action={<Legend items={[{ label: t('detail.planned'), color: 'var(--s-plan)' }, { label: t('detail.actual'), color: 'var(--s-third)' }]} />}
          />
          <CardBody><ResourceBreakdownChart rows={breakdown.manpower} kind="manpower" /></CardBody>
        </Card>
        <Card id="res-equipment" style={{ scrollMarginTop: 72 }}>
          <CardHeader
            title={t('detail.res.eqpTitle')}
            subtitle={breakdown.equipmentAsOfDate ? t('asOf.day', { date: formatDate(breakdown.equipmentAsOfDate, locale) }) : undefined}
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

      {/* T5 - chart KH nhan luc theo thang x ca (thay ShiftManpowerChart) */}
      <Card id="res-shift" style={{ scrollMarginTop: 72 }}>
        <CardHeader
          title={t('manpowerMonthChart.title')}
          titleExtra={<HelpTip text={t('manpowerMonthChart.help')} label={t('common.explain')} />}
        />
        <CardBody>{monthChart ? <ManpowerMonthChart model={monthChart} markerMonth={t2.asOfMonth} /> : <p className="empty">{t('manpowerMonthChart.noData')}</p>}</CardBody>
      </Card>

      {/* T12b(b) - chart cot chong nhan luc theo tuan x nha thau, dat cuoi trang theo yeu cau */}
      <Card id="res-weekly" style={{ scrollMarginTop: 72 }}>
        <CardHeader
          title={t('manpowerCharts.weeklyTitle')}
          titleExtra={<HelpTip text={t('manpowerCharts.weeklyHelp')} label={t('common.explain')} />}
        />
        <CardBody>
          {weekly ? <WeeklyManpowerStackChart data={weekly} initialMonth={t2.asOfMonth} markerMonth={t2.asOfMonth} /> : <p className="empty">{t('manpowerCharts.noData')}</p>}
        </CardBody>
      </Card>

      {/* T4 - Gantt thiet bi theo dot (thay EquipmentGantt tung chiec) */}
      <Card id="eq-gantt" style={{ scrollMarginTop: 72 }} className="overflow-visible">
        <CardHeader
          title={t('equipmentPlanGantt.title')}
          subtitle={planGantt ? `${formatDate(planGantt.planFrom, locale)} - ${formatDate(planGantt.planTo, locale)}` : undefined}
          titleExtra={<HelpTip text={t('equipmentPlanGantt.help')} label={t('common.explain')} />}
        />
        <CardBody>{planGantt ? <EquipmentPlanGantt model={planGantt} /> : <p className="empty">{t('equipmentPlanGantt.noPlan')}</p>}</CardBody>
      </Card>

      {/* Cum xu huong + ho so dat cuoi trang theo yeu cau chu du an 2026-09-24 */}
      {/* Charts */}
      <div className={canViewFinance ? 'g2' : ''}>
        {canViewFinance && (
          <Card className="overflow-visible">
            <CardHeader title={t('detail.sCurve12')} subtitle={chartRange} titleExtra={<HelpTip text={t('helpTip.dtSCurve')} label={t('common.explain')} />} />
            <CardBody>
              <SCurve data={sCurve} markerMonth={t2.asOfMonth} />
              <p className="hintline mt-2">{t('chartHowTo.dtSCurve')}</p>
            </CardBody>
          </Card>
        )}
        <Card className="overflow-visible">
          <CardHeader title={t('detail.spiCpi12')} subtitle={chartRange} titleExtra={<HelpTip text={t('helpTip.ovSpiCpi')} label={t('common.explain')} />} />
          <CardBody>
            <SpiCpiLine data={trend} markerMonth={t2.asOfMonth} />
            <p className="hintline mt-2">{t('chartHowTo.dtSpiCpi')}</p>
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
          <CardHeader title={t('detail.financial')} subtitle={t('asOf.month', { month: formatMonthShort(t2.asOfMonth) })} />
          <CardBody>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
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
                {financialRows.map((f) => (
                  <tr key={f.yearMonth}>
                    <td>{f.yearMonth}</td>
                    <td className="num">{formatTyd(f.revenueCumulative, locale)}</td>
                    <td className="num">{formatTyd(f.costActualCumulative, locale)}</td>
                    <td className="num">{formatTyd(f.grossProfit, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardBody>
        </Card>
        )}
      </div>

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
      <span className="nm inline-flex items-center gap-1.5 min-w-0">
        <IconStage size={14} data-stage-icon="" className="shrink-0 text-label3" />
        <span className="truncate">{name}</span>
      </span>
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
