import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/require-user';
import { getReportData } from '@/server/report';
import { currentMonth } from '@/lib/clock';
import { Link } from '@/i18n/navigation';
import { formatPct, formatRatio, formatTyd } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Rise } from '@/components/ui/Rise';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Badge } from '@/components/ui/Badge';
import { PenaltyBadge, PriorityBadge } from '@/components/ui/Badges';
import { THRESHOLDS } from '@/lib/thresholds';
import {
  IconAlert,
  IconExport,
  IconFactory,
  IconFlag,
  IconMoney,
  IconProject,
  IconTrend,
} from '@/components/icons';

export default async function ReportPage() {
  // RBAC server-side: trang vận hành dành cho admin + bod (không phó mặc middleware).
  const locale = await getLocale();
  const user = await requireUser(locale, ['admin', 'bod']);
  const t = await getTranslations();
  const canViewFinance = user.canViewFinance;
  const { kpis, p0Red, rows } = await getReportData(currentMonth());
  const prevLabel = t('common.previousMonth');

  return (
    <>
      {/* Topbar da hien ten trang (nav.report); giu h1 an cho cau truc heading/a11y +
          khop test operation-pages-render.test.ts dang doi 'report.title' trong HTML. */}
      <h1 className="sr-only">{t('report.title')}</h1>
      <div className="flex justify-end">
        <a
          href="/api/report/export"
          className="btn"
        >
          <IconExport size={16} /> {t('common.export')}
        </a>
      </div>

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

      <Card>
        <CardHeader title={t('report.p0Red')} />
        <CardBody>
          {p0Red.length === 0 ? (
            <p className="empty">{t('common.noData')}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {p0Red.map((w) => (
                <div key={w.id} className="alert">
                  <h4 className="min-w-0 flex-1 truncate">{w.projectName}</h4>
                  <PriorityBadge priority={w.priority} />
                  <PenaltyBadge penalty={w.penalty} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('report.projectTable')} />
        <CardBody>
          <div className="scroll">
            <table className="tbl" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Mã DA</th>
                  <th>{t('form.projectName')}</th>
                  <th className="num">SPI</th>
                  <th className="num">CPI</th>
                  <th className="num">% TT</th>
                  {canViewFinance && <th className="num">{t('kpi.backlog')}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.code}</td>
                    <td>
                      <Link href={`/projects/${r.id}`}>
                        {r.name}
                      </Link>
                    </td>
                    <td className="num">
                      <Badge tone={r.spi == null ? 'neutral' : r.spi < THRESHOLDS.spiWarn ? 'warn' : 'ok'}>
                        {formatRatio(r.spi)}
                      </Badge>
                    </td>
                    <td className="num">
                      <Badge tone={r.cpi == null ? 'neutral' : r.cpi < THRESHOLDS.cpiWarn ? 'warn' : 'ok'}>
                        {formatRatio(r.cpi)}
                      </Badge>
                    </td>
                    <td className="num">{formatPct(r.pctActual, locale)}</td>
                    {canViewFinance && <td className="num">{formatTyd(r.backlog, locale)}</td>}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={canViewFinance ? 6 : 5} className="empty">
                      {t('common.noData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
